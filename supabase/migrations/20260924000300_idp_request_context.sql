BEGIN;
SET LOCAL lock_timeout='15s';
CREATE TABLE public.ops_idp_context (
 tenant_id uuid NOT NULL,request_id uuid NOT NULL,original_name text NOT NULL CHECK(length(btrim(original_name)) BETWEEN 1 AND 160),
 leave_start date NOT NULL,leave_end date NOT NULL,revision integer NOT NULL CHECK(revision>0),
 updated_by uuid NOT NULL REFERENCES public.profiles(id),updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(tenant_id,request_id),FOREIGN KEY(tenant_id,request_id) REFERENCES public.ops_daily_requests(tenant_id,id),
 CHECK(leave_start BETWEEN DATE '2000-01-01' AND DATE '2100-12-31'),CHECK(leave_end>=leave_start AND leave_end<=DATE '2100-12-31' AND leave_end-leave_start<=366)
);
ALTER TABLE public.ops_idp_context ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ops_idp_context FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.ops_idp_read(p_actor_id uuid,p_tenant_id uuid,p_request_id uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb;
BEGIN
 PERFORM public.talent_assert_scope(p_actor_id,p_tenant_id);
 IF coalesce(public.current_user_role(),'') NOT IN ('yonetici','operasyon') THEN RAISE EXCEPTION 'IDP_FORBIDDEN'; END IF;
 PERFORM 1 FROM public.ops_daily_requests WHERE tenant_id=p_tenant_id AND id=p_request_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'IDP_SCOPE'; END IF;
 SELECT to_jsonb(c) INTO result FROM public.ops_idp_context c WHERE tenant_id=p_tenant_id AND request_id=p_request_id;
 RETURN result;
END $$;
CREATE FUNCTION public.ops_idp_save(p_actor_id uuid,p_tenant_id uuid,p_command_id uuid,p_request_id uuid,p_expected_revision integer,p_original_name text,p_leave_start date,p_leave_end date) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' SET lock_timeout='3s' AS $$
DECLARE r public.ops_daily_requests;c public.ops_commands;v_payload jsonb;v_result jsonb;v_company uuid;v_revision integer;
BEGIN
 IF auth.uid() IS NULL OR auth.uid() IS DISTINCT FROM p_actor_id THEN RAISE EXCEPTION 'IDP_SCOPE'; END IF;
 PERFORM 1 FROM public.profiles WHERE id=p_actor_id FOR SHARE;
 PERFORM 1 FROM public.tenant_memberships WHERE user_id=p_actor_id AND tenant_id=p_tenant_id FOR SHARE;
 PERFORM public.talent_assert_scope(p_actor_id,p_tenant_id);
 IF coalesce(public.current_user_role(),'') NOT IN ('yonetici','operasyon') THEN RAISE EXCEPTION 'IDP_FORBIDDEN'; END IF;
 IF p_request_id IS NULL OR p_command_id IS NULL OR p_expected_revision IS NULL OR p_expected_revision NOT BETWEEN 0 AND 2147483646
 OR p_original_name IS NULL OR length(btrim(p_original_name)) NOT BETWEEN 1 AND 160 OR p_original_name ~ '[[:cntrl:]]'
 OR p_leave_start IS NULL OR p_leave_end IS NULL OR p_leave_start<DATE '2000-01-01' OR p_leave_end>DATE '2100-12-31' OR p_leave_end<p_leave_start OR p_leave_end-p_leave_start>366 THEN RAISE EXCEPTION 'IDP_INPUT'; END IF;
 v_payload:=jsonb_build_object('requestId',p_request_id,'revision',p_expected_revision,'originalName',btrim(p_original_name),'leaveStart',p_leave_start,'leaveEnd',p_leave_end);
 INSERT INTO public.ops_commands(tenant_id,actor_id,id,kind,payload)VALUES(p_tenant_id,p_actor_id,p_command_id,'idp_context',v_payload) ON CONFLICT DO NOTHING;
 SELECT * INTO c FROM public.ops_commands WHERE tenant_id=p_tenant_id AND actor_id=p_actor_id AND id=p_command_id FOR UPDATE;
 IF c.kind IS DISTINCT FROM 'idp_context' OR c.payload IS DISTINCT FROM v_payload THEN RAISE EXCEPTION 'IDP_COMMAND'; END IF;
 IF c.result IS NOT NULL THEN RETURN c.result; END IF;
 SELECT company_id INTO v_company FROM public.ops_daily_requests WHERE tenant_id=p_tenant_id AND id=p_request_id;
 PERFORM 1 FROM public.companies WHERE tenant_id=p_tenant_id AND id=v_company AND status IN ('aday','aktif') FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'IDP_SCOPE'; END IF;
 SELECT * INTO r FROM public.ops_daily_requests WHERE tenant_id=p_tenant_id AND id=p_request_id FOR UPDATE;
 IF NOT FOUND OR r.lifecycle<>'active' OR r.required_count<>1 OR r.work_date NOT BETWEEN p_leave_start AND p_leave_end THEN RAISE EXCEPTION 'IDP_REQUEST'; END IF;
 SELECT revision INTO v_revision FROM public.ops_idp_context WHERE tenant_id=p_tenant_id AND request_id=p_request_id;
 IF coalesce(v_revision,0)<>p_expected_revision THEN RAISE EXCEPTION 'IDP_CONFLICT'; END IF;
 INSERT INTO public.ops_idp_context(tenant_id,request_id,original_name,leave_start,leave_end,revision,updated_by)
 VALUES(p_tenant_id,p_request_id,btrim(p_original_name),p_leave_start,p_leave_end,p_expected_revision+1,p_actor_id)
 ON CONFLICT(tenant_id,request_id) DO UPDATE SET original_name=EXCLUDED.original_name,leave_start=EXCLUDED.leave_start,leave_end=EXCLUDED.leave_end,revision=EXCLUDED.revision,updated_by=EXCLUDED.updated_by,updated_at=clock_timestamp();
 v_result:=public.ops_idp_read(p_actor_id,p_tenant_id,p_request_id);
 UPDATE public.ops_commands SET result=v_result WHERE tenant_id=p_tenant_id AND actor_id=p_actor_id AND id=p_command_id;
 RETURN v_result;
END $$;
CREATE FUNCTION public.ops_idp_request_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM public.ops_idp_context c WHERE c.tenant_id=NEW.tenant_id AND c.request_id=NEW.id AND (NEW.required_count<>1 OR NEW.work_date NOT BETWEEN c.leave_start AND c.leave_end)) THEN RAISE EXCEPTION 'IDP_REQUEST'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER ops_idp_request_guard BEFORE UPDATE OF required_count,work_date ON public.ops_daily_requests FOR EACH ROW EXECUTE FUNCTION public.ops_idp_request_guard();
REVOKE ALL ON FUNCTION public.ops_idp_request_guard() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.ops_idp_read(uuid,uuid,uuid),public.ops_idp_save(uuid,uuid,uuid,uuid,integer,text,date,date) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ops_idp_read(uuid,uuid,uuid),public.ops_idp_save(uuid,uuid,uuid,uuid,integer,text,date,date) TO authenticated;
CREATE FUNCTION public.ops_idp_list(p_company_id uuid,p_work_date date) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE t uuid:=public.current_user_verified_tenant();v_result jsonb;
BEGIN
 PERFORM public.talent_assert_scope(auth.uid(),t);
 IF coalesce(public.current_user_role(),'') NOT IN ('yonetici','operasyon') THEN RAISE EXCEPTION 'IDP_FORBIDDEN'; END IF;
 PERFORM 1 FROM public.companies WHERE tenant_id=t AND id=p_company_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'IDP_SCOPE'; END IF;
 SELECT coalesce(jsonb_agg(to_jsonb(c)),'[]') INTO v_result FROM public.ops_idp_context c JOIN public.ops_daily_requests r ON r.tenant_id=c.tenant_id AND r.id=c.request_id WHERE r.tenant_id=t AND r.company_id=p_company_id AND r.work_date=p_work_date;
 RETURN v_result;
END $$;
REVOKE ALL ON FUNCTION public.ops_idp_list(uuid,date) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ops_idp_list(uuid,date) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
