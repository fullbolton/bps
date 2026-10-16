-- EXPAND. Keep direct writes until the RPC application has passed acceptance.
BEGIN;
SET LOCAL lock_timeout='15s';
LOCK TABLE public.appointments IN ACCESS EXCLUSIVE MODE;
CREATE POLICY appointments_module_read_v1 ON public.appointments AS RESTRICTIVE FOR SELECT TO authenticated
 USING(tenant_id=public.current_user_verified_tenant() AND (SELECT public.workspace_module_enabled_v1('calendar')));

CREATE FUNCTION public.appointment_execute_v1(p_action text,p_id uuid,p_tenant uuid,p_input jsonb)
RETURNS SETOF public.appointments LANGUAGE plpgsql SECURITY DEFINER SET search_path='' SET lock_timeout='5s' AS $$
DECLARE
 actor uuid:=auth.uid(); tenant uuid:=public.current_user_verified_tenant();
 result public.appointments; candidate public.appointments; company uuid;
BEGIN
 IF actor IS NULL OR tenant IS NULL OR p_tenant IS DISTINCT FROM tenant THEN
  RAISE EXCEPTION 'APPOINTMENT_SCOPE' USING ERRCODE='42501'; END IF;
 IF p_action IS NULL OR p_action NOT IN ('create','status') OR p_input IS NULL OR jsonb_typeof(p_input)<>'object'
  OR (p_action='create' AND p_id IS NOT NULL) OR (p_action='status' AND p_id IS NULL) THEN
  RAISE EXCEPTION 'APPOINTMENT_INPUT' USING ERRCODE='22023'; END IF;
 -- Same config -> profile -> company -> appointment order as completion.
 PERFORM public.workspace_require_module_write_v1(tenant,ARRAY['calendar']);
 PERFORM 1 FROM public.profiles WHERE id=actor FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'APPOINTMENT_SCOPE' USING ERRCODE='42501'; END IF;
 PERFORM public.workspace_require_module_write_v1(tenant,ARRAY['calendar']);
 IF public.current_user_role() IS NULL OR public.current_user_role() NOT IN ('yonetici','operasyon') THEN
  RAISE EXCEPTION 'APPOINTMENT_ROLE' USING ERRCODE='42501'; END IF;
 IF p_action='create' THEN
  IF EXISTS(SELECT FROM jsonb_object_keys(p_input) k WHERE k NOT IN ('company_id','contract_id','meeting_date','meeting_time','meeting_type','attendee'))
   OR EXISTS(SELECT FROM jsonb_each(p_input) e WHERE jsonb_typeof(e.value) NOT IN ('string','null')) THEN
   RAISE EXCEPTION 'APPOINTMENT_INPUT' USING ERRCODE='22023'; END IF;
  SELECT * INTO candidate FROM jsonb_populate_record(NULL::public.appointments,p_input);
  IF candidate.company_id IS NULL OR candidate.meeting_date IS NULL
   OR candidate.meeting_date::text !~ '^\d{4}-\d{2}-\d{2}$'
   OR candidate.meeting_type IS NULL OR candidate.meeting_type NOT IN ('ziyaret','online','telefon','teklif_sunumu','denetim','diger') THEN
   RAISE EXCEPTION 'APPOINTMENT_INPUT' USING ERRCODE='22023'; END IF;
  -- Also validate when the historical schema stores the date as text.
  PERFORM candidate.meeting_date::date;
  company:=candidate.company_id;
 ELSE
  IF (SELECT count(*) FROM jsonb_object_keys(p_input))<>2 OR NOT (p_input ?& ARRAY['status','expected_status'])
   OR jsonb_typeof(p_input->'status') IS DISTINCT FROM 'string'
   OR jsonb_typeof(p_input->'expected_status') IS DISTINCT FROM 'string'
   OR p_input->>'status' NOT IN ('planlandi','iptal') OR p_input->>'expected_status' NOT IN ('planlandi','iptal') THEN
   RAISE EXCEPTION 'APPOINTMENT_INPUT' USING ERRCODE='22023'; END IF;
  SELECT company_id INTO company FROM public.appointments WHERE id=p_id AND tenant_id=tenant;
  IF NOT FOUND THEN RAISE EXCEPTION 'APPOINTMENT_NOT_FOUND' USING ERRCODE='42501'; END IF;
 END IF;
 PERFORM 1 FROM public.companies WHERE id=company AND tenant_id=tenant FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'APPOINTMENT_COMPANY' USING ERRCODE='42501'; END IF;
 IF p_action='create' THEN
  IF candidate.contract_id IS NOT NULL THEN
   PERFORM public.workspace_require_module_write_v1(tenant,ARRAY['contracts']);
   PERFORM 1 FROM public.contracts WHERE id=candidate.contract_id AND company_id=company AND tenant_id=tenant FOR SHARE;
   IF NOT FOUND THEN RAISE EXCEPTION 'APPOINTMENT_CONTRACT' USING ERRCODE='42501'; END IF;
  END IF;
  INSERT INTO public.appointments(tenant_id,company_id,contract_id,meeting_date,meeting_time,meeting_type,attendee,status,created_by)
   VALUES(tenant,company,candidate.contract_id,candidate.meeting_date,candidate.meeting_time,candidate.meeting_type,candidate.attendee,'planlandi',actor)
   RETURNING * INTO result;
 ELSE
  SELECT * INTO result FROM public.appointments WHERE id=p_id AND tenant_id=tenant FOR UPDATE;
  IF NOT FOUND OR result.company_id IS DISTINCT FROM company THEN
   RAISE EXCEPTION 'APPOINTMENT_NOT_FOUND' USING ERRCODE='42501'; END IF;
  IF result.status IS DISTINCT FROM p_input->>'expected_status' THEN
   RAISE EXCEPTION 'APPOINTMENT_CHANGED' USING ERRCODE='PT409'; END IF;
  UPDATE public.appointments SET status=p_input->>'status',updated_at=clock_timestamp() WHERE id=p_id RETURNING * INTO result;
 END IF;
 RETURN NEXT result;
END $$;
REVOKE ALL ON FUNCTION public.appointment_execute_v1(text,uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.appointment_execute_v1(text,uuid,uuid,jsonb) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
