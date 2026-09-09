-- NOT APPLIED TO PRODUCTION. Atomic scoped multi-day request creation.
BEGIN;
SET LOCAL lock_timeout='5s';
CREATE FUNCTION public.ops_create_request_batch(p_actor_id uuid,p_tenant_id uuid,p_command_id uuid,p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' SET lock_timeout='3s' AS $$
DECLARE v_actor uuid:=auth.uid(); v_role text; v_cmd public.ops_commands%ROWTYPE;
  v_company uuid; v_location uuid; v_service text; v_position text; v_count integer;
  v_dates date[]; v_day date; v_payload jsonb; v_active boolean; v_id uuid;
  v_ids jsonb:='[]'; v_result jsonb;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'OPS_UNAUTHENTICATED'; END IF;
  PERFORM 1 FROM public.profiles WHERE id=v_actor FOR SHARE;
  IF p_actor_id IS DISTINCT FROM v_actor OR p_tenant_id IS NULL OR p_tenant_id IS DISTINCT FROM public.current_user_verified_tenant() THEN RAISE EXCEPTION 'OPS_SCOPE_CHANGED'; END IF;
  v_role:=public.current_user_role();
  IF v_role IS NULL OR v_role NOT IN ('yonetici','operasyon') THEN RAISE EXCEPTION 'OPS_FORBIDDEN'; END IF;
  IF p_command_id IS NULL OR p_payload IS NULL OR jsonb_typeof(p_payload)<>'object' OR octet_length(p_payload::text)>8192
    OR jsonb_typeof(p_payload->'dates') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'OPS_VALIDATION'; END IF;
  IF jsonb_array_length(p_payload->'dates') NOT BETWEEN 1 AND 31 THEN RAISE EXCEPTION 'OPS_VALIDATION'; END IF;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_payload->'dates') d WHERE jsonb_typeof(d)<>'string' OR (d#>>'{}')!~'^\d{4}-\d{2}-\d{2}$') THEN RAISE EXCEPTION 'OPS_VALIDATION'; END IF;
  SELECT array_agg(d::date ORDER BY d::date) INTO v_dates FROM jsonb_array_elements_text(p_payload->'dates') d;
  IF cardinality(v_dates)<>(SELECT count(DISTINCT d) FROM unnest(v_dates) d)
    OR v_dates[1]<DATE '2000-01-01' OR v_dates[cardinality(v_dates)]>DATE '2100-12-31'
    OR v_dates[cardinality(v_dates)]-v_dates[1]>30 THEN RAISE EXCEPTION 'OPS_VALIDATION'; END IF;
  IF jsonb_typeof(p_payload->'companyId') IS DISTINCT FROM 'string' OR jsonb_typeof(p_payload->'locationId') IS DISTINCT FROM 'string'
    OR jsonb_typeof(p_payload->'serviceLine') IS DISTINCT FROM 'string' OR jsonb_typeof(p_payload->'position') IS DISTINCT FROM 'string'
    OR jsonb_typeof(p_payload->'requiredCount') IS DISTINCT FROM 'number' OR (p_payload->>'requiredCount')!~'^[0-9]+$' THEN RAISE EXCEPTION 'OPS_VALIDATION'; END IF;
  v_company:=(p_payload->>'companyId')::uuid; v_location:=(p_payload->>'locationId')::uuid;
  v_service:=btrim(p_payload->>'serviceLine'); v_position:=btrim(p_payload->>'position'); v_count:=(p_payload->>'requiredCount')::integer;
  IF length(v_service) NOT BETWEEN 1 AND 80 OR length(v_position) NOT BETWEEN 1 AND 80 OR v_count NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'OPS_VALIDATION'; END IF;
  v_payload:=jsonb_build_object('companyId',v_company,'locationId',v_location,'serviceLine',v_service,'position',v_position,'requiredCount',v_count,'dates',to_jsonb(v_dates));
  INSERT INTO public.ops_commands(tenant_id,actor_id,id,kind,payload) VALUES(p_tenant_id,v_actor,p_command_id,'request_batch',v_payload) ON CONFLICT DO NOTHING;
  SELECT * INTO v_cmd FROM public.ops_commands WHERE tenant_id=p_tenant_id AND actor_id=v_actor AND id=p_command_id FOR UPDATE;
  IF v_cmd.kind<>'request_batch' OR v_cmd.payload<>v_payload THEN RAISE EXCEPTION 'OPS_IDEMPOTENCY_MISMATCH'; END IF;
  IF v_cmd.result IS NOT NULL THEN RETURN v_cmd.result; END IF;
  SELECT status='aktif' INTO v_active FROM public.companies WHERE id=v_company AND tenant_id=p_tenant_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'OPS_OUT_OF_SCOPE'; END IF;
  IF v_active IS DISTINCT FROM true THEN RAISE EXCEPTION 'OPS_INACTIVE_COMPANY'; END IF;
  PERFORM 1 FROM public.ops_locations WHERE id=v_location AND company_id=v_company AND tenant_id=p_tenant_id AND active FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'OPS_INACTIVE_LOCATION'; END IF;
  IF EXISTS(SELECT 1 FROM public.ops_daily_requests WHERE tenant_id=p_tenant_id AND company_id=v_company AND location_id=v_location
    AND work_date=ANY(v_dates) AND service_line=v_service AND position=v_position AND lifecycle='active') THEN RAISE EXCEPTION 'OPS_BATCH_EXISTS'; END IF;
  FOREACH v_day IN ARRAY v_dates LOOP
    v_id:=pg_catalog.gen_random_uuid();
    INSERT INTO public.ops_daily_requests(id,tenant_id,company_id,location_id,work_date,service_line,position,required_count,created_by)
      VALUES(v_id,p_tenant_id,v_company,v_location,v_day,v_service,v_position,v_count,v_actor);
    INSERT INTO public.ops_events(tenant_id,actor_id,command_id,kind,entity_id) VALUES(p_tenant_id,v_actor,p_command_id,'request_batch',v_id);
    v_ids:=v_ids||jsonb_build_array(v_id);
  END LOOP;
  v_result:=jsonb_build_object('commandId',p_command_id,'created',cardinality(v_dates),'requestIds',v_ids);
  UPDATE public.ops_commands SET result=v_result WHERE tenant_id=p_tenant_id AND actor_id=v_actor AND id=p_command_id;
  RETURN v_result;
END $$;
REVOKE ALL ON FUNCTION public.ops_create_request_batch(uuid,uuid,uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ops_create_request_batch(uuid,uuid,uuid,jsonb) TO authenticated;
COMMIT;
