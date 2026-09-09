-- NOT APPLIED TO PRODUCTION. Scoped, optimistic capacity update; assignments stay intact.
BEGIN;
SET LOCAL lock_timeout='5s';
CREATE OR REPLACE FUNCTION public.ops_resize_request(p_actor_id uuid,p_tenant_id uuid,p_command_id uuid,p_request_id uuid,p_expected_count integer,p_required_count integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' SET lock_timeout='3s' AS $$
DECLARE v_actor uuid:=auth.uid(); v_role text; v_cmd public.ops_commands%ROWTYPE;
  v_company uuid; v_request public.ops_daily_requests%ROWTYPE; v_active boolean;
  v_payload jsonb; v_result jsonb; v_assigned integer;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'OPS_UNAUTHENTICATED'; END IF;
  PERFORM 1 FROM public.profiles WHERE id=v_actor FOR SHARE;
  IF p_actor_id IS DISTINCT FROM v_actor OR p_tenant_id IS NULL OR p_tenant_id IS DISTINCT FROM public.current_user_verified_tenant() THEN RAISE EXCEPTION 'OPS_SCOPE_CHANGED'; END IF;
  v_role:=public.current_user_role();
  IF v_role IS NULL OR v_role NOT IN ('yonetici','operasyon') THEN RAISE EXCEPTION 'OPS_FORBIDDEN'; END IF;
  IF p_command_id IS NULL OR p_request_id IS NULL OR p_expected_count IS NULL OR p_required_count IS NULL
    OR p_expected_count NOT BETWEEN 1 AND 100 OR p_required_count NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'OPS_VALIDATION'; END IF;
  v_payload:=jsonb_build_object('requestId',p_request_id,'expectedCount',p_expected_count,'requiredCount',p_required_count);
  INSERT INTO public.ops_commands(tenant_id,actor_id,id,kind,payload) VALUES(p_tenant_id,v_actor,p_command_id,'resize',v_payload) ON CONFLICT DO NOTHING;
  SELECT * INTO v_cmd FROM public.ops_commands WHERE tenant_id=p_tenant_id AND actor_id=v_actor AND id=p_command_id FOR UPDATE;
  IF v_cmd.kind<>'resize' OR v_cmd.payload<>v_payload THEN RAISE EXCEPTION 'OPS_IDEMPOTENCY_MISMATCH'; END IF;
  IF v_cmd.result IS NOT NULL THEN RETURN v_cmd.result; END IF;
  SELECT company_id INTO v_company FROM public.ops_daily_requests WHERE id=p_request_id AND tenant_id=p_tenant_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'OPS_OUT_OF_SCOPE'; END IF;
  SELECT status='aktif' INTO v_active FROM public.companies WHERE id=v_company AND tenant_id=p_tenant_id FOR SHARE;
  IF v_active IS DISTINCT FROM true THEN RAISE EXCEPTION 'OPS_INACTIVE_COMPANY'; END IF;
  SELECT * INTO v_request FROM public.ops_daily_requests WHERE id=p_request_id AND tenant_id=p_tenant_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'OPS_OUT_OF_SCOPE'; END IF;
  IF v_request.lifecycle<>'active' THEN RAISE EXCEPTION 'OPS_REQUEST_NOT_ACTIVE'; END IF;
  IF v_request.required_count<>p_expected_count THEN RAISE EXCEPTION 'OPS_STALE_VERSION'; END IF;
  SELECT count(*) INTO v_assigned FROM public.ops_assignments WHERE tenant_id=p_tenant_id AND request_id=p_request_id AND removed_at IS NULL;
  IF p_required_count<v_assigned THEN RAISE EXCEPTION 'OPS_BELOW_ASSIGNED'; END IF;
  UPDATE public.ops_daily_requests SET required_count=p_required_count WHERE id=p_request_id AND tenant_id=p_tenant_id;
  INSERT INTO public.ops_events(tenant_id,actor_id,command_id,kind,entity_id) VALUES(p_tenant_id,v_actor,p_command_id,'resize',p_request_id);
  v_result:=jsonb_build_object('id',p_request_id,'commandId',p_command_id);
  UPDATE public.ops_commands SET result=v_result WHERE tenant_id=p_tenant_id AND actor_id=v_actor AND id=p_command_id;
  RETURN v_result;
END $$;
REVOKE ALL ON FUNCTION public.ops_resize_request(uuid,uuid,uuid,uuid,integer,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ops_resize_request(uuid,uuid,uuid,uuid,integer,integer) TO authenticated;
COMMIT;
