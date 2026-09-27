BEGIN;
SET LOCAL lock_timeout='15s';
ALTER TABLE public.ops_idp_periods ADD COLUMN original_name text,ADD COLUMN leave_start date,ADD COLUMN leave_end date,
 ADD COLUMN revision integer NOT NULL DEFAULT 1 CHECK(revision>0),ADD COLUMN cancelled boolean NOT NULL DEFAULT false;
DO $$BEGIN
 IF EXISTS(SELECT 1 FROM public.ops_idp_periods p LEFT JOIN public.ops_idp_context c ON c.tenant_id=p.tenant_id AND c.period_id=p.id GROUP BY p.tenant_id,p.id HAVING count(c.request_id)=0 OR count(DISTINCT (c.original_name,c.leave_start,c.leave_end))<>1) THEN RAISE EXCEPTION 'IDP_PERIOD_INCONSISTENT';END IF;
END $$;
UPDATE public.ops_idp_periods p SET original_name=c.original_name,leave_start=c.leave_start,leave_end=c.leave_end FROM public.ops_idp_context c WHERE c.tenant_id=p.tenant_id AND c.period_id=p.id;
ALTER TABLE public.ops_idp_periods ALTER COLUMN original_name SET NOT NULL,ALTER COLUMN leave_start SET NOT NULL,ALTER COLUMN leave_end SET NOT NULL,
 ADD CHECK(length(btrim(original_name)) BETWEEN 1 AND 160),ADD CHECK(leave_start>=DATE '2000-01-01' AND leave_end<=DATE '2100-12-31' AND leave_end>=leave_start AND leave_end-leave_start<=30);
CREATE OR REPLACE FUNCTION public.ops_idp_period_context_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF OLD.period_id IS NOT NULL AND (NEW.period_id IS DISTINCT FROM OLD.period_id OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id OR NEW.request_id IS DISTINCT FROM OLD.request_id OR NOT EXISTS(
 SELECT 1 FROM public.ops_idp_periods p WHERE p.tenant_id=NEW.tenant_id AND p.id=NEW.period_id AND p.original_name=NEW.original_name AND p.leave_start=NEW.leave_start AND p.leave_end=NEW.leave_end)) THEN RAISE EXCEPTION 'IDP_PERIOD_READ_ONLY';END IF;
 RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION public.ops_idp_period_create(p_actor_id uuid,p_tenant_id uuid,p_command_id uuid,p_payload jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' SET lock_timeout='3s' AS $$
DECLARE c public.ops_commands; v_name text;v_start date;v_end date;v_batch jsonb;v_result jsonb;v_period uuid:=gen_random_uuid();v_request uuid;
BEGIN
 IF auth.uid() IS NULL OR auth.uid() IS DISTINCT FROM p_actor_id THEN RAISE EXCEPTION 'OPS_SCOPE_CHANGED';END IF;
 PERFORM 1 FROM public.profiles WHERE id=p_actor_id FOR SHARE;
 PERFORM 1 FROM public.tenant_memberships WHERE user_id=p_actor_id AND tenant_id=p_tenant_id FOR SHARE;
 PERFORM public.talent_assert_scope(p_actor_id,p_tenant_id);
 IF coalesce(public.current_user_role(),'') NOT IN ('yonetici','operasyon') THEN RAISE EXCEPTION 'OPS_FORBIDDEN';END IF;
 IF p_command_id IS NULL OR p_payload IS NULL OR jsonb_typeof(p_payload)<>'object' OR octet_length(p_payload::text)>8192
 OR jsonb_typeof(p_payload->'idp') IS DISTINCT FROM 'object' OR jsonb_typeof(p_payload->'idp'->'originalName') IS DISTINCT FROM 'string'
 OR coalesce(p_payload->'idp'->>'leaveStart','')!~'^\d{4}-\d{2}-\d{2}$' OR coalesce(p_payload->'idp'->>'leaveEnd','')!~'^\d{4}-\d{2}-\d{2}$'
 OR p_payload->'requiredCount' IS DISTINCT FROM '1'::jsonb THEN RAISE EXCEPTION 'OPS_VALIDATION';END IF;
 v_name:=btrim(p_payload->'idp'->>'originalName');v_start:=(p_payload->'idp'->>'leaveStart')::date;v_end:=(p_payload->'idp'->>'leaveEnd')::date;
 IF length(v_name) NOT BETWEEN 1 AND 160 OR v_name ~ '[[:cntrl:]]' OR v_start<DATE '2000-01-01' OR v_end>DATE '2100-12-31' OR v_end<v_start OR v_end-v_start>30 THEN RAISE EXCEPTION 'OPS_VALIDATION';END IF;
 INSERT INTO public.ops_commands(tenant_id,actor_id,id,kind,payload) VALUES(p_tenant_id,p_actor_id,p_command_id,'idp_period',p_payload) ON CONFLICT DO NOTHING;
 SELECT * INTO c FROM public.ops_commands WHERE tenant_id=p_tenant_id AND actor_id=p_actor_id AND id=p_command_id FOR UPDATE;
 IF c.kind IS DISTINCT FROM 'idp_period' OR c.payload IS DISTINCT FROM p_payload THEN RAISE EXCEPTION 'OPS_IDEMPOTENCY_MISMATCH';END IF;
 IF c.result IS NOT NULL THEN RETURN c.result;END IF;
 -- Existing batch RPC owns location, duplicate-day and required-count validation.
 -- Any later exception rolls back the entire batch as part of this same transaction.
 v_batch:=public.ops_create_request_batch(p_actor_id,p_tenant_id,gen_random_uuid(),p_payload-'idp');
 INSERT INTO public.ops_idp_periods(tenant_id,id,created_by,original_name,leave_start,leave_end) VALUES(p_tenant_id,v_period,p_actor_id,v_name,v_start,v_end);
 FOR v_request IN SELECT value::uuid FROM jsonb_array_elements_text(v_batch->'requestIds') LOOP
  IF NOT EXISTS(SELECT 1 FROM public.ops_daily_requests WHERE tenant_id=p_tenant_id AND id=v_request AND work_date BETWEEN v_start AND v_end) THEN RAISE EXCEPTION 'IDP_REQUEST';END IF;
  INSERT INTO public.ops_idp_context(tenant_id,request_id,original_name,leave_start,leave_end,revision,updated_by,period_id)
  VALUES(p_tenant_id,v_request,v_name,v_start,v_end,1,p_actor_id,v_period);
 END LOOP;
 v_result:=v_batch||jsonb_build_object('commandId',p_command_id,'periodId',v_period);
 UPDATE public.ops_commands SET result=v_result WHERE tenant_id=p_tenant_id AND actor_id=p_actor_id AND id=p_command_id;
 RETURN v_result;
END $$;
CREATE OR REPLACE FUNCTION public.ops_idp_period_read(p_actor_id uuid,p_tenant_id uuid,p_period_id uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE v_result jsonb;
BEGIN
 PERFORM public.talent_assert_scope(p_actor_id,p_tenant_id);
 IF coalesce(public.current_user_role(),'') NOT IN ('yonetici','operasyon') THEN RAISE EXCEPTION 'OPS_FORBIDDEN';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.ops_idp_periods WHERE tenant_id=p_tenant_id AND id=p_period_id) THEN RAISE EXCEPTION 'OPS_OUT_OF_SCOPE';END IF;
 SELECT jsonb_agg(jsonb_build_object('periodRevision',p.revision,'periodCancelled',p.cancelled,'requestId',r.id,'companyId',r.company_id,'day',r.work_date,'lifecycle',r.lifecycle,'originalName',c.original_name,'leaveStart',c.leave_start,'leaveEnd',c.leave_end,
 'assignedNames',(SELECT coalesce(jsonb_agg(w.name ORDER BY w.name),'[]') FROM public.ops_assignments a JOIN public.ops_workers w ON w.tenant_id=a.tenant_id AND w.id=a.worker_id WHERE a.tenant_id=r.tenant_id AND a.request_id=r.id AND a.removed_at IS NULL)) ORDER BY r.work_date,r.id)
 INTO v_result FROM public.ops_idp_context c JOIN public.ops_idp_periods p ON p.tenant_id=c.tenant_id AND p.id=c.period_id JOIN public.ops_daily_requests r ON r.tenant_id=c.tenant_id AND r.id=c.request_id WHERE c.tenant_id=p_tenant_id AND c.period_id=p_period_id;
 RETURN coalesce(v_result,'[]');
END $$;
CREATE FUNCTION public.ops_idp_period_manage(p_actor_id uuid,p_tenant_id uuid,p_command_id uuid,p_period_id uuid,p_expected_revision integer,p_payload jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' SET lock_timeout='3s' AS $$
DECLARE c public.ops_commands;p public.ops_idp_periods;r public.ops_daily_requests;v_company uuid;v_name text;v_start date;v_end date;v_dates date[];v_result jsonb;v_batch jsonb;v_id uuid;v_cancelled integer:=0;
BEGIN
 IF auth.uid() IS NULL OR auth.uid() IS DISTINCT FROM p_actor_id THEN RAISE EXCEPTION 'OPS_SCOPE_CHANGED';END IF;
 PERFORM 1 FROM public.profiles WHERE id=p_actor_id FOR SHARE;
 PERFORM 1 FROM public.tenant_memberships WHERE user_id=p_actor_id AND tenant_id=p_tenant_id FOR SHARE;
 PERFORM public.talent_assert_scope(p_actor_id,p_tenant_id);
 IF coalesce(public.current_user_role(),'') NOT IN ('yonetici','operasyon') THEN RAISE EXCEPTION 'OPS_FORBIDDEN';END IF;
 IF p_command_id IS NULL OR p_period_id IS NULL OR p_expected_revision IS NULL OR p_expected_revision NOT BETWEEN 1 AND 2147483646 OR p_payload IS NULL OR jsonb_typeof(p_payload)<>'object' OR octet_length(p_payload::text)>8192
 OR coalesce(p_payload->>'action','') NOT IN ('update','cancel') OR jsonb_typeof(p_payload->'reason') IS DISTINCT FROM 'string' OR length(btrim(p_payload->>'reason')) NOT BETWEEN 3 AND 500 THEN RAISE EXCEPTION 'OPS_VALIDATION';END IF;
 INSERT INTO public.ops_commands(tenant_id,actor_id,id,kind,payload) VALUES(p_tenant_id,p_actor_id,p_command_id,'idp_manage',jsonb_build_object('periodId',p_period_id,'revision',p_expected_revision,'change',p_payload)) ON CONFLICT DO NOTHING;
 SELECT * INTO c FROM public.ops_commands WHERE tenant_id=p_tenant_id AND actor_id=p_actor_id AND id=p_command_id FOR UPDATE;
 IF c.kind IS DISTINCT FROM 'idp_manage' OR c.payload IS DISTINCT FROM jsonb_build_object('periodId',p_period_id,'revision',p_expected_revision,'change',p_payload) THEN RAISE EXCEPTION 'OPS_IDEMPOTENCY_MISMATCH';END IF;
 IF c.result IS NOT NULL THEN RETURN c.result;END IF;
 SELECT q.company_id INTO v_company FROM public.ops_idp_context i JOIN public.ops_daily_requests q ON q.tenant_id=i.tenant_id AND q.id=i.request_id WHERE i.tenant_id=p_tenant_id AND i.period_id=p_period_id LIMIT 1;
 -- Same company-before-request order as daily and batch commands.
 PERFORM 1 FROM public.companies WHERE id=v_company AND tenant_id=p_tenant_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'OPS_OUT_OF_SCOPE';END IF;
 SELECT * INTO p FROM public.ops_idp_periods WHERE tenant_id=p_tenant_id AND id=p_period_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'OPS_OUT_OF_SCOPE';END IF;
 IF p.revision<>p_expected_revision THEN RAISE EXCEPTION 'OPS_STALE_VERSION';END IF;
 IF p.cancelled THEN RAISE EXCEPTION 'IDP_PERIOD_CANCELLED';END IF;
 PERFORM q.id FROM public.ops_daily_requests q JOIN public.ops_idp_context i ON i.tenant_id=q.tenant_id AND i.request_id=q.id WHERE i.tenant_id=p_tenant_id AND i.period_id=p_period_id ORDER BY q.id FOR UPDATE OF q;
 SELECT q.* INTO r FROM public.ops_daily_requests q JOIN public.ops_idp_context i ON i.tenant_id=q.tenant_id AND i.request_id=q.id WHERE i.tenant_id=p_tenant_id AND i.period_id=p_period_id ORDER BY q.work_date,q.id LIMIT 1;
 IF p_payload->>'action'='cancel' THEN
  IF EXISTS(SELECT 1 FROM public.ops_assignments a JOIN public.ops_idp_context i ON i.tenant_id=a.tenant_id AND i.request_id=a.request_id WHERE i.tenant_id=p_tenant_id AND i.period_id=p_period_id AND a.removed_at IS NULL) THEN RAISE EXCEPTION 'IDP_PERIOD_ASSIGNED';END IF;
  FOR v_id IN SELECT q.id FROM public.ops_daily_requests q JOIN public.ops_idp_context i ON i.tenant_id=q.tenant_id AND i.request_id=q.id WHERE i.tenant_id=p_tenant_id AND i.period_id=p_period_id AND q.lifecycle='active' ORDER BY q.id LOOP
   PERFORM public.ops_execute_scoped(p_actor_id,p_tenant_id,gen_random_uuid(),'cancel',jsonb_build_object('requestId',v_id));v_cancelled:=v_cancelled+1;
  END LOOP;
  UPDATE public.ops_idp_periods SET cancelled=true,revision=revision+1 WHERE tenant_id=p_tenant_id AND id=p_period_id;
 ELSE
  IF jsonb_typeof(p_payload->'originalName') IS DISTINCT FROM 'string' OR coalesce(p_payload->>'leaveStart','')!~'^\d{4}-\d{2}-\d{2}$' OR coalesce(p_payload->>'leaveEnd','')!~'^\d{4}-\d{2}-\d{2}$' OR jsonb_typeof(p_payload->'dates') IS DISTINCT FROM 'array' OR jsonb_array_length(p_payload->'dates')>31 THEN RAISE EXCEPTION 'OPS_VALIDATION';END IF;
  v_name:=btrim(p_payload->>'originalName');v_start:=(p_payload->>'leaveStart')::date;v_end:=(p_payload->>'leaveEnd')::date;
  IF length(v_name) NOT BETWEEN 1 AND 160 OR v_name ~ '[[:cntrl:]]' OR v_start<DATE '2000-01-01' OR v_end>DATE '2100-12-31' OR v_end<v_start OR v_end-v_start>30 THEN RAISE EXCEPTION 'OPS_VALIDATION';END IF;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_payload->'dates') d WHERE jsonb_typeof(d)<>'string' OR (d#>>'{}')!~'^\d{4}-\d{2}-\d{2}$') THEN RAISE EXCEPTION 'OPS_VALIDATION';END IF;
  SELECT coalesce(array_agg(d::date ORDER BY d::date),'{}'::date[]) INTO v_dates FROM jsonb_array_elements_text(p_payload->'dates') d;
  IF cardinality(v_dates)<>(SELECT count(DISTINCT d) FROM unnest(v_dates) d) OR EXISTS(SELECT 1 FROM unnest(v_dates) d WHERE d NOT BETWEEN v_start AND v_end) THEN RAISE EXCEPTION 'OPS_VALIDATION';END IF;
  IF EXISTS(SELECT 1 FROM public.ops_idp_context i JOIN public.ops_daily_requests q ON q.tenant_id=i.tenant_id AND q.id=i.request_id WHERE i.tenant_id=p_tenant_id AND i.period_id=p_period_id AND (q.work_date NOT BETWEEN v_start AND v_end OR q.work_date=ANY(v_dates))) THEN RAISE EXCEPTION 'IDP_PERIOD_DATES';END IF;
  IF (SELECT count(*) FROM public.ops_idp_context WHERE tenant_id=p_tenant_id AND period_id=p_period_id)+cardinality(v_dates)>31 THEN RAISE EXCEPTION 'OPS_VALIDATION';END IF;
  UPDATE public.ops_idp_periods SET original_name=v_name,leave_start=v_start,leave_end=v_end,revision=revision+1 WHERE tenant_id=p_tenant_id AND id=p_period_id;
  UPDATE public.ops_idp_context SET original_name=v_name,leave_start=v_start,leave_end=v_end,revision=revision+1,updated_by=p_actor_id,updated_at=clock_timestamp() WHERE tenant_id=p_tenant_id AND period_id=p_period_id;
  IF cardinality(v_dates)>0 THEN
   v_batch:=public.ops_create_request_batch(p_actor_id,p_tenant_id,gen_random_uuid(),jsonb_build_object('companyId',r.company_id,'locationId',r.location_id,'serviceLine',r.service_line,'position',r.position,'requiredCount',1,'dates',to_jsonb(v_dates)));
   FOR v_id IN SELECT value::uuid FROM jsonb_array_elements_text(v_batch->'requestIds') LOOP
    INSERT INTO public.ops_idp_context(tenant_id,request_id,original_name,leave_start,leave_end,revision,updated_by,period_id) VALUES(p_tenant_id,v_id,v_name,v_start,v_end,1,p_actor_id,p_period_id);
   END LOOP;
  END IF;
 END IF;
 v_result:=jsonb_build_object('commandId',p_command_id,'periodId',p_period_id,'revision',p_expected_revision+1,'created',coalesce(cardinality(v_dates),0),'cancelled',v_cancelled);
 UPDATE public.ops_commands SET result=v_result WHERE tenant_id=p_tenant_id AND actor_id=p_actor_id AND id=p_command_id;
 RETURN v_result;
END $$;
REVOKE ALL ON FUNCTION public.ops_idp_period_manage(uuid,uuid,uuid,uuid,integer,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ops_idp_period_manage(uuid,uuid,uuid,uuid,integer,jsonb) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
