-- NOT APPLIED. Apply after 20260909000100_daily_operations_pilot.sql.
BEGIN;
SET LOCAL lock_timeout='5s';
ALTER TABLE public.ops_locations ADD COLUMN external_code text
  CHECK(external_code ~ '^[A-Za-z0-9_-]{1,40}$');
CREATE UNIQUE INDEX ops_locations_company_code ON public.ops_locations(tenant_id,company_id,external_code);
CREATE FUNCTION public.ops_import_locations(p_command_id uuid,p_company_id uuid,p_rows jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  v_actor uuid:=auth.uid(); v_tenant uuid; v_payload jsonb; v_cmd public.ops_commands%ROWTYPE;
  v_row jsonb; v_old public.ops_locations%ROWTYPE; v_active boolean; v_id uuid;
  v_added int:=0; v_skipped int:=0; v_result jsonb;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'OPS_UNAUTHENTICATED'; END IF;
  PERFORM 1 FROM public.profiles WHERE id=v_actor FOR SHARE;
  v_tenant:=public.current_user_verified_tenant();
  IF v_tenant IS NULL OR public.current_user_role() IS DISTINCT FROM 'yonetici' THEN RAISE EXCEPTION 'OPS_FORBIDDEN'; END IF;
  IF p_command_id IS NULL OR p_company_id IS NULL OR p_rows IS NULL OR jsonb_typeof(p_rows)<>'array' THEN RAISE EXCEPTION 'OPS_VALIDATION'; END IF;
  IF jsonb_array_length(p_rows) NOT BETWEEN 1 AND 500 OR octet_length(p_rows::text)>262144 THEN RAISE EXCEPTION 'OPS_VALIDATION'; END IF;
  FOR v_row IN SELECT value FROM jsonb_array_elements(p_rows) LOOP
    IF jsonb_typeof(v_row)<>'object' OR jsonb_typeof(v_row->'code') IS DISTINCT FROM 'string'
      OR jsonb_typeof(v_row->'name') IS DISTINCT FROM 'string' OR jsonb_typeof(v_row->'city') IS DISTINCT FROM 'string'
      OR (v_row->>'code') !~ '^[A-Za-z0-9_-]{1,40}$'
      OR length(btrim(v_row->>'name')) NOT BETWEEN 1 AND 160 OR length(btrim(v_row->>'city')) NOT BETWEEN 1 AND 80
      OR (v_row->>'name') ~ '[[:cntrl:]]' OR (v_row->>'city') ~ '[[:cntrl:]]' THEN RAISE EXCEPTION 'OPS_VALIDATION'; END IF;
  END LOOP;
  IF (SELECT count(*)<>count(DISTINCT value->>'code') FROM jsonb_array_elements(p_rows)) THEN RAISE EXCEPTION 'OPS_IMPORT_DUPLICATE'; END IF;
  v_payload:=jsonb_build_object('companyId',p_company_id,'rows',p_rows);
  INSERT INTO public.ops_commands(tenant_id,actor_id,id,kind,payload)
    VALUES(v_tenant,v_actor,p_command_id,'location_import',v_payload) ON CONFLICT DO NOTHING;
  SELECT * INTO v_cmd FROM public.ops_commands WHERE tenant_id=v_tenant AND actor_id=v_actor AND id=p_command_id FOR UPDATE;
  IF v_cmd.kind<>'location_import' OR v_cmd.payload<>v_payload THEN RAISE EXCEPTION 'OPS_IDEMPOTENCY_MISMATCH'; END IF;
  IF v_cmd.result IS NOT NULL THEN RETURN v_cmd.result; END IF;
  SELECT status='aktif' INTO v_active FROM public.companies WHERE id=p_company_id AND tenant_id=v_tenant FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'OPS_OUT_OF_SCOPE'; END IF;
  IF v_active IS DISTINCT FROM true THEN RAISE EXCEPTION 'OPS_INACTIVE_COMPANY'; END IF;
  FOR v_row IN SELECT value FROM jsonb_array_elements(p_rows) LOOP
    SELECT * INTO v_old FROM public.ops_locations WHERE tenant_id=v_tenant AND company_id=p_company_id AND external_code=v_row->>'code';
    IF FOUND THEN
      IF v_old.name<>btrim(v_row->>'name') OR v_old.city<>btrim(v_row->>'city') OR NOT v_old.active THEN RAISE EXCEPTION 'OPS_IMPORT_CONFLICT'; END IF;
      v_skipped:=v_skipped+1;
    ELSE
      v_id:=gen_random_uuid();
      INSERT INTO public.ops_locations(id,tenant_id,company_id,external_code,name,city)
        VALUES(v_id,v_tenant,p_company_id,v_row->>'code',btrim(v_row->>'name'),btrim(v_row->>'city'));
      INSERT INTO public.ops_events(tenant_id,actor_id,command_id,kind,entity_id) VALUES(v_tenant,v_actor,p_command_id,'location_import',v_id);
      v_added:=v_added+1;
    END IF;
  END LOOP;
  v_result:=jsonb_build_object('commandId',p_command_id,'added',v_added,'skipped',v_skipped);
  UPDATE public.ops_commands SET result=v_result WHERE tenant_id=v_tenant AND actor_id=v_actor AND id=p_command_id;
  RETURN v_result;
END $$;
REVOKE ALL ON FUNCTION public.ops_import_locations(uuid,uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ops_import_locations(uuid,uuid,jsonb) TO authenticated;
COMMIT;
