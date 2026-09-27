-- NOT APPLIED TO PRODUCTION. Location metadata only; identity/history preserved.
BEGIN;
SET LOCAL lock_timeout='5s';
CREATE FUNCTION public.ops_update_location(p_actor_id uuid,p_tenant_id uuid,p_command_id uuid,p_company_id uuid,p_entity_id uuid,p_expected_revision integer,p_name text,p_city text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' SET lock_timeout='3s' AS $$
DECLARE v_actor uuid:=auth.uid(); v_cmd public.ops_commands%ROWTYPE; v_payload jsonb; v_result jsonb;
  v_old public.ops_locations%ROWTYPE;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'OPS_UNAUTHENTICATED'; END IF;
  PERFORM 1 FROM public.profiles WHERE id=v_actor FOR SHARE;
  IF p_actor_id IS DISTINCT FROM v_actor OR p_tenant_id IS NULL OR p_tenant_id IS DISTINCT FROM public.current_user_verified_tenant() THEN RAISE EXCEPTION 'OPS_SCOPE_CHANGED'; END IF;
  IF public.current_user_role() IS DISTINCT FROM 'yonetici' THEN RAISE EXCEPTION 'OPS_FORBIDDEN'; END IF;
  IF p_command_id IS NULL OR p_company_id IS NULL OR p_entity_id IS NULL OR p_expected_revision IS NULL OR p_expected_revision NOT BETWEEN 0 AND 2147483646
    OR p_name IS NULL OR p_city IS NULL OR length(btrim(p_name)) NOT BETWEEN 1 AND 160 OR length(btrim(p_city)) NOT BETWEEN 1 AND 80
    OR p_name ~ '[[:cntrl:]]' OR p_city ~ '[[:cntrl:]]' THEN RAISE EXCEPTION 'OPS_VALIDATION'; END IF;
  v_payload:=jsonb_build_object('companyId',p_company_id,'id',p_entity_id,'expectedRevision',p_expected_revision,'name',btrim(p_name),'city',btrim(p_city));
  INSERT INTO public.ops_commands(tenant_id,actor_id,id,kind,payload) VALUES(p_tenant_id,v_actor,p_command_id,'location_update',v_payload) ON CONFLICT DO NOTHING;
  SELECT * INTO v_cmd FROM public.ops_commands WHERE tenant_id=p_tenant_id AND actor_id=v_actor AND id=p_command_id FOR UPDATE;
  IF v_cmd.kind<>'location_update' OR v_cmd.payload<>v_payload THEN RAISE EXCEPTION 'OPS_IDEMPOTENCY_MISMATCH'; END IF;
  IF v_cmd.result IS NOT NULL THEN RETURN v_cmd.result; END IF;
  PERFORM 1 FROM public.companies WHERE id=p_company_id AND tenant_id=p_tenant_id FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'OPS_OUT_OF_SCOPE'; END IF;
  SELECT * INTO v_old FROM public.ops_locations WHERE id=p_entity_id AND company_id=p_company_id AND tenant_id=p_tenant_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'OPS_OUT_OF_SCOPE'; END IF;
  IF v_old.directory_revision<>p_expected_revision THEN RAISE EXCEPTION 'OPS_STALE_VERSION'; END IF;
  UPDATE public.ops_locations SET name=btrim(p_name),city=btrim(p_city),directory_revision=directory_revision+1 WHERE id=p_entity_id AND tenant_id=p_tenant_id;
  INSERT INTO public.ops_events(tenant_id,actor_id,command_id,kind,entity_id) VALUES(p_tenant_id,v_actor,p_command_id,'location_update',p_entity_id);
  v_result:=jsonb_build_object('id',p_entity_id,'companyId',p_company_id,'commandId',p_command_id,'name',btrim(p_name),'city',btrim(p_city),
    'revision',v_old.directory_revision+1,'previousRevision',v_old.directory_revision,'previousName',v_old.name,'previousCity',v_old.city);
  UPDATE public.ops_commands SET result=v_result WHERE tenant_id=p_tenant_id AND actor_id=v_actor AND id=p_command_id;
  RETURN v_result;
END $$;
REVOKE ALL ON FUNCTION public.ops_update_location(uuid,uuid,uuid,uuid,uuid,integer,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ops_update_location(uuid,uuid,uuid,uuid,uuid,integer,text,text) TO authenticated;

COMMIT;
