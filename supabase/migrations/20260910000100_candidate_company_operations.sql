-- Candidate companies can start operations without changing their CRM status.
-- Additive correction; requires baseline through 02700 (replacement wrapper) and 02200.
-- Existing owners, grants, row locks, replay checks and tenant boundaries are preserved.
BEGIN;
SET LOCAL lock_timeout='15s';
DO $$ BEGIN
 IF to_regprocedure('public.ops_import_locations(uuid,uuid,jsonb)') IS NULL OR
     to_regprocedure('public.ops_create_request_batch(uuid,uuid,uuid,jsonb)') IS NULL OR
     to_regprocedure('public.ops_resize_request(uuid,uuid,uuid,uuid,integer,integer)') IS NULL OR
     to_regprocedure('public.ops_replace_assignment_before_start(uuid,uuid,uuid,uuid,uuid,integer)') IS NULL OR
     to_regprocedure('public.ops_set_directory_active(uuid,uuid,uuid,text,uuid,integer,boolean)') IS NULL OR
     to_regprocedure('public.ops_mutate(uuid,text,jsonb)') IS NULL OR
     to_regprocedure('public.workspace_setup(uuid,uuid)') IS NULL THEN
  RAISE EXCEPTION 'OPS_CANDIDATE_BASELINE_REQUIRED';
 END IF;
END $$;

CREATE OR REPLACE FUNCTION public.ops_import_locations(p_command_id uuid,p_company_id uuid,p_rows jsonb)
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
  SELECT status IN ('aday','aktif') INTO v_active FROM public.companies WHERE id=p_company_id AND tenant_id=v_tenant FOR UPDATE;
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

CREATE OR REPLACE FUNCTION public.ops_create_request_batch(p_actor_id uuid,p_tenant_id uuid,p_command_id uuid,p_payload jsonb)
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
  SELECT status IN ('aday','aktif') INTO v_active FROM public.companies WHERE id=v_company AND tenant_id=p_tenant_id FOR UPDATE;
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
  SELECT status IN ('aday','aktif') INTO v_active FROM public.companies WHERE id=v_company AND tenant_id=p_tenant_id FOR SHARE;
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

CREATE OR REPLACE FUNCTION public.ops_replace_assignment_before_start(p_actor_id uuid,p_tenant_id uuid,p_command_id uuid,p_assignment_id uuid,p_worker_id uuid,p_expected_revision integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' SET lock_timeout='3s' AS $$
DECLARE v_actor uuid:=auth.uid(); v_cmd public.ops_commands%ROWTYPE;
  v_assignment public.ops_assignments%ROWTYPE; v_request public.ops_daily_requests%ROWTYPE;
  v_request_id uuid; v_company uuid; v_payload jsonb; v_result jsonb; v_active boolean;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'OPS_UNAUTHENTICATED'; END IF;
  PERFORM 1 FROM public.profiles WHERE id=v_actor FOR SHARE;
  IF p_actor_id IS DISTINCT FROM v_actor OR p_tenant_id IS NULL OR p_tenant_id IS DISTINCT FROM public.current_user_verified_tenant() THEN RAISE EXCEPTION 'OPS_SCOPE_CHANGED'; END IF;
  IF coalesce(public.current_user_role(),'') NOT IN ('yonetici','operasyon') THEN RAISE EXCEPTION 'OPS_FORBIDDEN'; END IF;
  IF p_command_id IS NULL OR p_assignment_id IS NULL OR p_worker_id IS NULL OR p_expected_revision IS NULL OR p_expected_revision NOT BETWEEN 0 AND 2147483647 THEN RAISE EXCEPTION 'OPS_VALIDATION'; END IF;
  v_payload:=jsonb_build_object('assignmentId',p_assignment_id,'workerId',p_worker_id,'expectedRevision',p_expected_revision);
  INSERT INTO public.ops_commands(tenant_id,actor_id,id,kind,payload) VALUES(p_tenant_id,v_actor,p_command_id,'replace',v_payload) ON CONFLICT DO NOTHING;
  SELECT * INTO v_cmd FROM public.ops_commands WHERE tenant_id=p_tenant_id AND actor_id=v_actor AND id=p_command_id FOR UPDATE;
  IF v_cmd.kind<>'replace' OR v_cmd.payload<>v_payload THEN RAISE EXCEPTION 'OPS_IDEMPOTENCY_MISMATCH'; END IF;
  IF v_cmd.result IS NOT NULL THEN RETURN v_cmd.result; END IF;
  SELECT a.request_id,r.company_id INTO v_request_id,v_company FROM public.ops_assignments a JOIN public.ops_daily_requests r ON r.id=a.request_id AND r.tenant_id=a.tenant_id WHERE a.id=p_assignment_id AND a.tenant_id=p_tenant_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'OPS_OUT_OF_SCOPE'; END IF;
  SELECT status IN ('aday','aktif') INTO v_active FROM public.companies WHERE id=v_company AND tenant_id=p_tenant_id FOR SHARE;
  IF v_active IS DISTINCT FROM true THEN RAISE EXCEPTION 'OPS_INACTIVE_COMPANY'; END IF;
  SELECT * INTO v_request FROM public.ops_daily_requests WHERE id=v_request_id AND tenant_id=p_tenant_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'OPS_OUT_OF_SCOPE'; END IF;
  IF v_request.lifecycle<>'active' THEN RAISE EXCEPTION 'OPS_REQUEST_NOT_ACTIVE'; END IF;
  PERFORM 1 FROM public.ops_locations WHERE id=v_request.location_id AND tenant_id=p_tenant_id AND active FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'OPS_INACTIVE_LOCATION'; END IF;
  SELECT * INTO v_assignment FROM public.ops_assignments WHERE id=p_assignment_id AND tenant_id=p_tenant_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'OPS_OUT_OF_SCOPE'; END IF;
  IF v_assignment.removed_at IS NOT NULL OR v_assignment.attendance_revision<>p_expected_revision THEN RAISE EXCEPTION 'OPS_STALE_VERSION'; END IF;
  IF v_assignment.worker_id=p_worker_id THEN RAISE EXCEPTION 'OPS_SAME_WORKER'; END IF;
  IF v_assignment.attendance='present' THEN RAISE EXCEPTION 'OPS_REPLACE_PRESENT'; END IF;
  PERFORM 1 FROM public.ops_workers WHERE id=p_worker_id AND tenant_id=p_tenant_id AND active FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'OPS_INACTIVE_WORKER'; END IF;
  IF EXISTS(SELECT 1 FROM public.ops_assignments WHERE tenant_id=p_tenant_id AND worker_id=p_worker_id AND work_date=v_request.work_date AND (removed_at IS NULL OR attendance='present')) THEN RAISE EXCEPTION 'OPS_WORKER_CONFLICT'; END IF;
  UPDATE public.ops_assignments SET removed_at=statement_timestamp() WHERE id=p_assignment_id AND tenant_id=p_tenant_id;
  INSERT INTO public.ops_assignments(id,tenant_id,request_id,work_date,worker_id,created_by) VALUES(p_command_id,p_tenant_id,v_request_id,v_request.work_date,p_worker_id,v_actor);
  INSERT INTO public.ops_events(tenant_id,actor_id,command_id,kind,entity_id) VALUES(p_tenant_id,v_actor,p_command_id,'replace',p_command_id);
  v_result:=jsonb_build_object('id',p_command_id,'commandId',p_command_id,'replacedAssignmentId',p_assignment_id,'previousWorkerId',v_assignment.worker_id,'workerId',p_worker_id);
  UPDATE public.ops_commands SET result=v_result WHERE tenant_id=p_tenant_id AND actor_id=v_actor AND id=p_command_id;
  RETURN v_result;
END $$;

CREATE OR REPLACE FUNCTION public.ops_set_directory_active(p_actor_id uuid,p_tenant_id uuid,p_command_id uuid,p_kind text,p_entity_id uuid,p_expected_revision integer,p_active boolean)
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
    SELECT status IN ('aday','aktif') INTO v_company_active FROM public.companies WHERE id=v_company AND tenant_id=p_tenant_id FOR SHARE;
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
    SELECT status IN ('aday','aktif') INTO v_active FROM public.companies WHERE id=v_company AND tenant_id=v_tenant FOR SHARE;
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

CREATE OR REPLACE FUNCTION public.workspace_setup(p_actor_id uuid,p_tenant_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE v_today date:=(statement_timestamp() AT TIME ZONE 'Europe/Istanbul')::date; v_result jsonb;
BEGIN
 IF auth.uid() IS NULL OR p_actor_id IS DISTINCT FROM auth.uid()
 OR p_tenant_id IS NULL OR p_tenant_id IS DISTINCT FROM public.current_user_verified_tenant() THEN RAISE EXCEPTION 'SETUP_SCOPE'; END IF;
 IF public.current_user_role() IS DISTINCT FROM 'yonetici' THEN RAISE EXCEPTION 'SETUP_FORBIDDEN'; END IF;
 SELECT jsonb_build_object('tenantId',t.id,'name',t.name,'today',v_today,
 'companies',(SELECT count(*) FROM public.companies c WHERE c.tenant_id=t.id AND c.status IN ('aday','aktif')),
 'locations',(SELECT count(*) FROM public.ops_locations l JOIN public.companies c ON c.id=l.company_id AND c.tenant_id=l.tenant_id WHERE l.tenant_id=t.id AND l.active AND c.status IN ('aday','aktif')),
 'members',(SELECT count(*) FROM public.tenant_memberships m JOIN public.profiles p ON p.id=m.user_id WHERE m.tenant_id=t.id),
 'workers',(SELECT count(*) FROM public.ops_workers w WHERE w.tenant_id=t.id AND w.active),
 'requests',(SELECT count(*) FROM public.ops_daily_requests r JOIN public.ops_locations l ON l.id=r.location_id AND l.tenant_id=r.tenant_id JOIN public.companies c ON c.id=r.company_id AND c.tenant_id=r.tenant_id WHERE r.tenant_id=t.id AND r.lifecycle='active' AND r.work_date>=v_today AND l.active AND c.status IN ('aday','aktif')),
 'assignments',(SELECT count(*) FROM public.ops_assignments a JOIN public.ops_daily_requests r ON r.id=a.request_id AND r.tenant_id=a.tenant_id JOIN public.ops_workers w ON w.id=a.worker_id AND w.tenant_id=a.tenant_id JOIN public.ops_locations l ON l.id=r.location_id AND l.tenant_id=r.tenant_id JOIN public.companies c ON c.id=r.company_id AND c.tenant_id=r.tenant_id WHERE a.tenant_id=t.id AND a.removed_at IS NULL AND a.work_date>=v_today AND r.lifecycle='active' AND w.active AND l.active AND c.status IN ('aday','aktif'))
 ) INTO v_result FROM public.tenants t WHERE t.id=p_tenant_id;
 IF v_result IS NULL THEN RAISE EXCEPTION 'SETUP_SCOPE'; END IF;
 RETURN v_result;
END $$;

COMMIT;
