BEGIN;
SET LOCAL lock_timeout='15s';
CREATE TABLE public.ops_idp_periods (
 tenant_id uuid NOT NULL REFERENCES public.tenants(id), id uuid NOT NULL,
 created_by uuid NOT NULL REFERENCES public.profiles(id),created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(tenant_id,id)
);
ALTER TABLE public.ops_idp_periods ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ops_idp_periods FROM PUBLIC,anon,authenticated;
ALTER TABLE public.ops_idp_context ADD COLUMN period_id uuid,
 ADD CONSTRAINT ops_idp_period_fk FOREIGN KEY(tenant_id,period_id) REFERENCES public.ops_idp_periods(tenant_id,id);
CREATE INDEX ops_idp_context_period ON public.ops_idp_context(tenant_id,period_id) WHERE period_id IS NOT NULL;
-- Period metadata is immutable in this first release; daily edits must not split it.
CREATE FUNCTION public.ops_idp_period_context_guard() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN IF OLD.period_id IS NOT NULL THEN RAISE EXCEPTION 'IDP_PERIOD_READ_ONLY';END IF;RETURN NEW;END $$;
CREATE TRIGGER ops_idp_period_context_guard BEFORE UPDATE ON public.ops_idp_context FOR EACH ROW EXECUTE FUNCTION public.ops_idp_period_context_guard();
REVOKE ALL ON FUNCTION public.ops_idp_period_context_guard() FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.ops_idp_period_create(p_actor_id uuid,p_tenant_id uuid,p_command_id uuid,p_payload jsonb) RETURNS jsonb
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
 INSERT INTO public.ops_idp_periods(tenant_id,id,created_by) VALUES(p_tenant_id,v_period,p_actor_id);
 FOR v_request IN SELECT value::uuid FROM jsonb_array_elements_text(v_batch->'requestIds') LOOP
  IF NOT EXISTS(SELECT 1 FROM public.ops_daily_requests WHERE tenant_id=p_tenant_id AND id=v_request AND work_date BETWEEN v_start AND v_end) THEN RAISE EXCEPTION 'IDP_REQUEST';END IF;
  INSERT INTO public.ops_idp_context(tenant_id,request_id,original_name,leave_start,leave_end,revision,updated_by,period_id)
  VALUES(p_tenant_id,v_request,v_name,v_start,v_end,1,p_actor_id,v_period);
 END LOOP;
 v_result:=v_batch||jsonb_build_object('commandId',p_command_id,'periodId',v_period);
 UPDATE public.ops_commands SET result=v_result WHERE tenant_id=p_tenant_id AND actor_id=p_actor_id AND id=p_command_id;
 RETURN v_result;
END $$;
CREATE FUNCTION public.ops_idp_period_read(p_actor_id uuid,p_tenant_id uuid,p_period_id uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE v_result jsonb;
BEGIN
 PERFORM public.talent_assert_scope(p_actor_id,p_tenant_id);
 IF coalesce(public.current_user_role(),'') NOT IN ('yonetici','operasyon') THEN RAISE EXCEPTION 'OPS_FORBIDDEN';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.ops_idp_periods WHERE tenant_id=p_tenant_id AND id=p_period_id) THEN RAISE EXCEPTION 'OPS_OUT_OF_SCOPE';END IF;
 SELECT jsonb_agg(jsonb_build_object('requestId',r.id,'companyId',r.company_id,'day',r.work_date,'lifecycle',r.lifecycle,'originalName',c.original_name,'leaveStart',c.leave_start,'leaveEnd',c.leave_end,
 'assignedNames',(SELECT coalesce(jsonb_agg(w.name ORDER BY w.name),'[]') FROM public.ops_assignments a JOIN public.ops_workers w ON w.tenant_id=a.tenant_id AND w.id=a.worker_id WHERE a.tenant_id=r.tenant_id AND a.request_id=r.id AND a.removed_at IS NULL)) ORDER BY r.work_date,r.id)
 INTO v_result FROM public.ops_idp_context c JOIN public.ops_daily_requests r ON r.tenant_id=c.tenant_id AND r.id=c.request_id WHERE c.tenant_id=p_tenant_id AND c.period_id=p_period_id;
 RETURN coalesce(v_result,'[]');
END $$;
REVOKE ALL ON FUNCTION public.ops_idp_period_create(uuid,uuid,uuid,jsonb),public.ops_idp_period_read(uuid,uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ops_idp_period_create(uuid,uuid,uuid,jsonb),public.ops_idp_period_read(uuid,uuid,uuid) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
