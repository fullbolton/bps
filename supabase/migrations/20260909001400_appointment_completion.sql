-- New scoped completion; the old revoked RPC is deliberately untouched.
BEGIN;
SET LOCAL lock_timeout='15s';
CREATE TABLE public.appointment_completion_receipts (
  appointment_id uuid PRIMARY KEY REFERENCES public.appointments(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL,
  actor_id uuid NOT NULL,
  result_text text NOT NULL,
  next_action text NOT NULL,
  create_task boolean NOT NULL,
  task_id uuid,
  skipped_reason text,
  completed_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE public.appointment_completion_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.appointment_completion_receipts FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.complete_appointment_scoped(
  p_actor_id uuid,p_tenant_id uuid,p_appointment_id uuid,
  p_result text,p_next_action text,p_create_task boolean
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  v_actor uuid:=auth.uid(); v_tenant uuid; v_role text;
  v_company uuid; v_company_status text; v_appointment public.appointments%ROWTYPE;
  v_receipt public.appointment_completion_receipts%ROWTYPE;
  v_task uuid; v_skipped text;
  -- ECMAScript trim whitespace, including NBSP and BOM; regex \s alone misses them.
  v_whitespace text:=U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF';
  v_result text:=btrim(p_result,v_whitespace);
  v_next text:=btrim(p_next_action,v_whitespace);
BEGIN
  IF v_actor IS NULL OR p_actor_id IS DISTINCT FROM v_actor THEN RAISE EXCEPTION 'APPT_SCOPE_CHANGED'; END IF;
  -- Same profile lock order as admin membership mutation; re-read role/tenant after waiting.
  PERFORM 1 FROM public.profiles WHERE id=v_actor FOR SHARE;
  SELECT public.current_user_verified_tenant(),public.current_user_role() INTO v_tenant,v_role;
  IF v_tenant IS NULL OR p_tenant_id IS DISTINCT FROM v_tenant THEN RAISE EXCEPTION 'APPT_SCOPE_CHANGED'; END IF;
  IF v_role IS NULL OR v_role NOT IN ('yonetici','operasyon') THEN RAISE EXCEPTION 'APPT_FORBIDDEN'; END IF;
  IF p_appointment_id IS NULL OR p_create_task IS NULL OR v_result IS NULL OR v_next IS NULL
     OR length(v_result) NOT BETWEEN 1 AND 4000 OR length(v_next) NOT BETWEEN 1 AND 1000 THEN RAISE EXCEPTION 'APPT_VALIDATION'; END IF;

  SELECT company_id INTO v_company FROM public.appointments WHERE id=p_appointment_id AND tenant_id=v_tenant;
  IF NOT FOUND THEN RAISE EXCEPTION 'APPT_NOT_FOUND'; END IF;
  SELECT status INTO v_company_status FROM public.companies WHERE id=v_company AND tenant_id=v_tenant FOR SHARE;
  IF NOT FOUND OR v_company_status IS NULL OR v_company_status NOT IN ('aday','aktif','pasif') THEN RAISE EXCEPTION 'APPT_NOT_FOUND'; END IF;
  SELECT * INTO v_appointment FROM public.appointments WHERE id=p_appointment_id AND tenant_id=v_tenant FOR UPDATE;
  IF NOT FOUND OR v_appointment.company_id IS DISTINCT FROM v_company THEN RAISE EXCEPTION 'APPT_NOT_FOUND'; END IF;

  SELECT * INTO v_receipt FROM public.appointment_completion_receipts WHERE appointment_id=p_appointment_id;
  IF FOUND THEN
    IF v_receipt.actor_id IS DISTINCT FROM v_actor OR v_receipt.tenant_id IS DISTINCT FROM v_tenant
       OR v_receipt.result_text IS DISTINCT FROM v_result OR v_receipt.next_action IS DISTINCT FROM v_next
       OR v_receipt.create_task IS DISTINCT FROM p_create_task THEN RAISE EXCEPTION 'APPT_ALREADY_COMPLETED'; END IF;
    IF v_appointment.status IS DISTINCT FROM 'tamamlandi' OR v_appointment.result IS DISTINCT FROM v_result
       OR v_appointment.next_action IS DISTINCT FROM v_next THEN RAISE EXCEPTION 'APPT_STATE_CHANGED'; END IF;
    RETURN jsonb_build_object('appointmentId',p_appointment_id,'taskId',v_receipt.task_id,'taskSkippedReason',v_receipt.skipped_reason);
  END IF;
  IF v_appointment.status='tamamlandi' THEN RAISE EXCEPTION 'APPT_ALREADY_COMPLETED'; END IF;

  UPDATE public.appointments SET status='tamamlandi',result=v_result,next_action=v_next,updated_at=clock_timestamp()
    WHERE id=p_appointment_id;
  IF p_create_task THEN
    IF v_company_status='pasif' THEN v_skipped:='Firma pasif olduğu için takip görevi oluşturulmadı.';
    ELSE
      INSERT INTO public.tasks(tenant_id,company_id,title,source_type,appointment_id,status,created_by)
      VALUES(v_tenant,v_company,v_next,'randevu',p_appointment_id,'acik',v_actor) RETURNING id INTO v_task;
    END IF;
  END IF;
  INSERT INTO public.appointment_completion_receipts(appointment_id,tenant_id,actor_id,result_text,next_action,create_task,task_id,skipped_reason)
  VALUES(p_appointment_id,v_tenant,v_actor,v_result,v_next,p_create_task,v_task,v_skipped);
  RETURN jsonb_build_object('appointmentId',p_appointment_id,'taskId',v_task,'taskSkippedReason',v_skipped);
END $$;
REVOKE ALL ON FUNCTION public.complete_appointment_scoped(uuid,uuid,uuid,text,text,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.complete_appointment_scoped(uuid,uuid,uuid,text,text,boolean) TO authenticated;
COMMIT;
