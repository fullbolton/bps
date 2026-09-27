-- NOT APPLIED TO PRODUCTION. Directory activation never removes assignments/history.
BEGIN;
SET LOCAL lock_timeout='5s';
ALTER TABLE public.ops_locations ADD COLUMN directory_revision integer NOT NULL DEFAULT 0 CHECK(directory_revision>=0);
ALTER TABLE public.ops_workers ADD COLUMN directory_revision integer NOT NULL DEFAULT 0 CHECK(directory_revision>=0);
CREATE FUNCTION public.ops_set_directory_active(p_actor_id uuid,p_tenant_id uuid,p_command_id uuid,p_kind text,p_entity_id uuid,p_expected_revision integer,p_active boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' SET lock_timeout='3s' AS $$
DECLARE v_actor uuid:=auth.uid(); v_cmd public.ops_commands%ROWTYPE; v_payload jsonb; v_result jsonb;
  v_company uuid; v_company_active boolean; v_revision integer; v_active boolean;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'OPS_UNAUTHENTICATED'; END IF;
  PERFORM 1 FROM public.profiles WHERE id=v_actor FOR SHARE;
  IF p_actor_id IS DISTINCT FROM v_actor OR p_tenant_id IS NULL OR p_tenant_id IS DISTINCT FROM public.current_user_verified_tenant() THEN RAISE EXCEPTION 'OPS_SCOPE_CHANGED'; END IF;
  IF public.current_user_role() IS DISTINCT FROM 'yonetici' THEN RAISE EXCEPTION 'OPS_FORBIDDEN'; END IF;
  IF p_command_id IS NULL OR p_kind IS NULL OR p_kind NOT IN ('locations','workers') OR p_entity_id IS NULL OR p_expected_revision IS NULL OR p_expected_revision NOT BETWEEN 0 AND 2147483646 OR p_active IS NULL THEN RAISE EXCEPTION 'OPS_VALIDATION'; END IF;
  v_payload:=jsonb_build_object('kind',p_kind,'id',p_entity_id,'expectedRevision',p_expected_revision,'active',p_active);
  INSERT INTO public.ops_commands(tenant_id,actor_id,id,kind,payload) VALUES(p_tenant_id,v_actor,p_command_id,'directory_active',v_payload) ON CONFLICT DO NOTHING;
  SELECT * INTO v_cmd FROM public.ops_commands WHERE tenant_id=p_tenant_id AND actor_id=v_actor AND id=p_command_id FOR UPDATE;
  IF v_cmd.kind<>'directory_active' OR v_cmd.payload<>v_payload THEN RAISE EXCEPTION 'OPS_IDEMPOTENCY_MISMATCH'; END IF;
  IF v_cmd.result IS NOT NULL THEN RETURN v_cmd.result; END IF;
  IF p_kind='locations' THEN
    SELECT company_id INTO v_company FROM public.ops_locations WHERE id=p_entity_id AND tenant_id=p_tenant_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'OPS_OUT_OF_SCOPE'; END IF;
    SELECT status='aktif' INTO v_company_active FROM public.companies WHERE id=v_company AND tenant_id=p_tenant_id FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'OPS_OUT_OF_SCOPE'; END IF;
    IF p_active AND v_company_active IS DISTINCT FROM true THEN RAISE EXCEPTION 'OPS_INACTIVE_COMPANY'; END IF;
    -- No request locks here: assignment uses company -> request -> location -> worker.
    SELECT active,directory_revision INTO v_active,v_revision FROM public.ops_locations WHERE id=p_entity_id AND tenant_id=p_tenant_id FOR UPDATE;
  ELSE
    SELECT active,directory_revision INTO v_active,v_revision FROM public.ops_workers WHERE id=p_entity_id AND tenant_id=p_tenant_id FOR UPDATE;
  END IF;
  IF NOT FOUND THEN RAISE EXCEPTION 'OPS_OUT_OF_SCOPE'; END IF;
  IF v_revision<>p_expected_revision THEN RAISE EXCEPTION 'OPS_STALE_VERSION'; END IF;
  IF p_kind='locations' THEN
    UPDATE public.ops_locations SET active=p_active,directory_revision=directory_revision+1 WHERE id=p_entity_id AND tenant_id=p_tenant_id;
  ELSE
    UPDATE public.ops_workers SET active=p_active,directory_revision=directory_revision+1 WHERE id=p_entity_id AND tenant_id=p_tenant_id;
  END IF;
  INSERT INTO public.ops_events(tenant_id,actor_id,command_id,kind,entity_id) VALUES(p_tenant_id,v_actor,p_command_id,'directory_active',p_entity_id);
  v_result:=jsonb_build_object('id',p_entity_id,'commandId',p_command_id,'kind',p_kind,'active',p_active,'revision',v_revision+1,'previousActive',v_active,'previousRevision',v_revision);
  UPDATE public.ops_commands SET result=v_result WHERE tenant_id=p_tenant_id AND actor_id=v_actor AND id=p_command_id;
  RETURN v_result;
END $$;
REVOKE ALL ON FUNCTION public.ops_set_directory_active(uuid,uuid,uuid,text,uuid,integer,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ops_set_directory_active(uuid,uuid,uuid,text,uuid,integer,boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.ops_mutate(p_command_id uuid,p_kind text,p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_actor uuid := auth.uid(); v_tenant uuid; v_role text; v_existing public.ops_commands%ROWTYPE;
  v_company uuid; v_request public.ops_daily_requests%ROWTYPE; v_id uuid; v_worker uuid;
  v_count integer; v_result jsonb; v_active boolean;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'OPS_UNAUTHENTICATED'; END IF;
  -- Same profile lock used by admin role/membership moves; checks follow the lock.
  PERFORM 1 FROM public.profiles WHERE id=v_actor FOR SHARE;
  v_tenant := public.current_user_verified_tenant(); v_role := public.current_user_role();
  IF v_tenant IS NULL OR v_role NOT IN ('yonetici','operasyon') OR v_role IS NULL THEN RAISE EXCEPTION 'OPS_FORBIDDEN'; END IF;
  IF p_command_id IS NULL OR p_kind IS NULL OR p_kind NOT IN ('location','worker','request','assign','remove','cancel')
    OR p_payload IS NULL OR jsonb_typeof(p_payload)<>'object' OR octet_length(p_payload::text)>8192 THEN RAISE EXCEPTION 'OPS_VALIDATION'; END IF;
  IF p_kind IN ('location','worker') AND v_role<>'yonetici' THEN RAISE EXCEPTION 'OPS_FORBIDDEN'; END IF;
  INSERT INTO public.ops_commands(tenant_id,actor_id,id,kind,payload)
    VALUES(v_tenant,v_actor,p_command_id,p_kind,p_payload) ON CONFLICT DO NOTHING;
  SELECT * INTO v_existing FROM public.ops_commands WHERE tenant_id=v_tenant AND actor_id=v_actor AND id=p_command_id FOR UPDATE;
  IF v_existing.kind<>p_kind OR v_existing.payload<>p_payload THEN RAISE EXCEPTION 'OPS_IDEMPOTENCY_MISMATCH'; END IF;
  IF v_existing.result IS NOT NULL THEN RETURN v_existing.result; END IF;

  IF p_kind='worker' THEN
    INSERT INTO public.ops_workers(id,tenant_id,name,code,kind)
      VALUES(p_command_id,v_tenant,btrim(p_payload->>'name'),btrim(p_payload->>'code'),p_payload->>'kind');
    v_id:=p_command_id;
  ELSE
    IF p_kind IN ('assign','remove','cancel') THEN
      SELECT company_id INTO v_company FROM public.ops_daily_requests
        WHERE id=(p_payload->>'requestId')::uuid AND tenant_id=v_tenant;
    ELSE v_company:=(p_payload->>'companyId')::uuid; END IF;
    SELECT status='aktif' INTO v_active FROM public.companies WHERE id=v_company AND tenant_id=v_tenant FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'OPS_OUT_OF_SCOPE'; END IF;
    IF v_active IS DISTINCT FROM true AND p_kind NOT IN ('remove','cancel') THEN RAISE EXCEPTION 'OPS_INACTIVE_COMPANY'; END IF;

    IF p_kind='location' THEN
      INSERT INTO public.ops_locations(id,tenant_id,company_id,name,city)
        VALUES(p_command_id,v_tenant,v_company,btrim(p_payload->>'name'),btrim(p_payload->>'city'));
      v_id:=p_command_id;
    ELSIF p_kind='request' THEN
      PERFORM 1 FROM public.ops_locations WHERE id=(p_payload->>'locationId')::uuid AND company_id=v_company AND tenant_id=v_tenant AND active FOR SHARE;
      IF NOT FOUND THEN RAISE EXCEPTION 'OPS_INACTIVE_LOCATION'; END IF;
      INSERT INTO public.ops_daily_requests(id,tenant_id,company_id,location_id,work_date,service_line,position,required_count,created_by)
        VALUES(p_command_id,v_tenant,v_company,(p_payload->>'locationId')::uuid,(p_payload->>'workDate')::date,
          btrim(p_payload->>'serviceLine'),btrim(p_payload->>'position'),(p_payload->>'requiredCount')::integer,v_actor);
      v_id:=p_command_id;
    ELSE
      SELECT * INTO v_request FROM public.ops_daily_requests WHERE id=(p_payload->>'requestId')::uuid AND tenant_id=v_tenant FOR UPDATE;
      IF NOT FOUND THEN RAISE EXCEPTION 'OPS_OUT_OF_SCOPE'; END IF;
      v_id:=v_request.id;
      IF p_kind='assign' THEN
        IF v_request.lifecycle<>'active' THEN RAISE EXCEPTION 'OPS_REQUEST_NOT_ACTIVE'; END IF;
        PERFORM 1 FROM public.ops_locations WHERE id=v_request.location_id AND tenant_id=v_tenant AND active FOR SHARE;
        IF NOT FOUND THEN RAISE EXCEPTION 'OPS_INACTIVE_LOCATION'; END IF;
        v_worker:=(p_payload->>'workerId')::uuid;
        PERFORM 1 FROM public.ops_workers WHERE id=v_worker AND tenant_id=v_tenant AND active FOR UPDATE;
        IF NOT FOUND THEN RAISE EXCEPTION 'OPS_INACTIVE_WORKER'; END IF;
        IF EXISTS(SELECT 1 FROM public.ops_assignments WHERE tenant_id=v_tenant AND worker_id=v_worker AND work_date=v_request.work_date AND removed_at IS NULL)
          THEN RAISE EXCEPTION 'OPS_WORKER_CONFLICT'; END IF;
        SELECT count(*) INTO v_count FROM public.ops_assignments WHERE tenant_id=v_tenant AND request_id=v_request.id AND removed_at IS NULL;
        IF v_count>=v_request.required_count THEN RAISE EXCEPTION 'OPS_CAPACITY_FULL'; END IF;
        INSERT INTO public.ops_assignments(id,tenant_id,request_id,work_date,worker_id,created_by)
          VALUES(p_command_id,v_tenant,v_request.id,v_request.work_date,v_worker,v_actor);
        v_id:=p_command_id;
      ELSIF p_kind='remove' THEN
        UPDATE public.ops_assignments SET removed_at=now() WHERE id=(p_payload->>'assignmentId')::uuid
          AND tenant_id=v_tenant AND request_id=v_request.id AND removed_at IS NULL;
        IF NOT FOUND THEN RAISE EXCEPTION 'OPS_STALE_VERSION'; END IF;
      ELSE
        UPDATE public.ops_assignments SET removed_at=now() WHERE request_id=v_request.id AND tenant_id=v_tenant AND removed_at IS NULL;
        UPDATE public.ops_daily_requests SET lifecycle='cancelled' WHERE id=v_request.id;
      END IF;
    END IF;
  END IF;
  v_result:=jsonb_build_object('id',v_id,'commandId',p_command_id);
  INSERT INTO public.ops_events(tenant_id,actor_id,command_id,kind,entity_id) VALUES(v_tenant,v_actor,p_command_id,p_kind,v_id);
  UPDATE public.ops_commands SET result=v_result WHERE tenant_id=v_tenant AND actor_id=v_actor AND id=p_command_id;
  RETURN v_result;
END $$;
REVOKE ALL ON FUNCTION public.ops_mutate(uuid,text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ops_mutate(uuid,text,jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.ops_directory(p_kind text,p_company_id uuid,p_search text,p_status text,p_offset integer)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE v_tenant uuid:=public.current_user_verified_tenant(); v_search text; v_total bigint; v_rows jsonb;
BEGIN
  IF v_tenant IS NULL OR coalesce(public.current_user_role(),'') NOT IN ('yonetici','operasyon') THEN RAISE EXCEPTION 'OPS_FORBIDDEN'; END IF;
  IF p_kind IS NULL OR p_kind NOT IN ('locations','workers') OR p_search IS NULL OR length(p_search)>160
    OR p_status IS NULL OR p_status NOT IN ('all','active','inactive') OR p_offset IS NULL OR p_offset<0 OR p_offset>1000000 OR p_offset%50<>0 THEN RAISE EXCEPTION 'OPS_VALIDATION'; END IF;
  IF p_kind='locations' AND NOT EXISTS(SELECT 1 FROM public.companies WHERE id=p_company_id AND tenant_id=v_tenant) THEN RAISE EXCEPTION 'OPS_OUT_OF_SCOPE'; END IF;
  IF p_kind='workers' AND p_company_id IS NOT NULL THEN RAISE EXCEPTION 'OPS_VALIDATION'; END IF;
  v_search:=lower(btrim(p_search));
  IF p_kind='locations' THEN
    SELECT count(*) INTO v_total FROM public.ops_locations
      WHERE tenant_id=v_tenant AND company_id=p_company_id AND (p_status='all' OR active=(p_status='active'))
      AND strpos(lower(concat_ws(' ',name,external_code,city)),v_search)>0;
    SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'code',external_code,'city',city,'workerKind',NULL,'active',active,'revision',directory_revision) ORDER BY name,id),'[]') INTO v_rows FROM
      (SELECT * FROM public.ops_locations WHERE tenant_id=v_tenant AND company_id=p_company_id AND (p_status='all' OR active=(p_status='active'))
        AND strpos(lower(concat_ws(' ',name,external_code,city)),v_search)>0 ORDER BY name,id LIMIT 50 OFFSET p_offset) page;
  ELSE
    SELECT count(*) INTO v_total FROM public.ops_workers
      WHERE tenant_id=v_tenant AND (p_status='all' OR active=(p_status='active')) AND strpos(lower(concat_ws(' ',name,code)),v_search)>0;
    SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'code',code,'city',NULL,'workerKind',kind,'active',active,'revision',directory_revision) ORDER BY name,id),'[]') INTO v_rows FROM
      (SELECT * FROM public.ops_workers WHERE tenant_id=v_tenant AND (p_status='all' OR active=(p_status='active'))
        AND strpos(lower(concat_ws(' ',name,code)),v_search)>0 ORDER BY name,id LIMIT 50 OFFSET p_offset) page;
  END IF;
  IF v_total>1000050 THEN RAISE EXCEPTION 'OPS_DIRECTORY_TOO_LARGE'; END IF;
  RETURN jsonb_build_object('kind',p_kind,'companyId',p_company_id,'search',btrim(p_search),'status',p_status,'offset',p_offset,'total',v_total,'generatedAt',statement_timestamp(),'rows',v_rows);
END $$;
REVOKE ALL ON FUNCTION public.ops_directory(text,uuid,text,text,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ops_directory(text,uuid,text,text,integer) TO authenticated;
COMMIT;
