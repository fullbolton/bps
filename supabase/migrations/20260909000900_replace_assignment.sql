-- NOT APPLIED TO PRODUCTION. Atomic replacement preserves the old assignment/history.
BEGIN;
SET LOCAL lock_timeout='5s';
CREATE FUNCTION public.ops_replace_assignment(p_actor_id uuid,p_tenant_id uuid,p_command_id uuid,p_assignment_id uuid,p_worker_id uuid,p_expected_revision integer)
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
  SELECT status='aktif' INTO v_active FROM public.companies WHERE id=v_company AND tenant_id=p_tenant_id FOR SHARE;
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
REVOKE ALL ON FUNCTION public.ops_replace_assignment(uuid,uuid,uuid,uuid,uuid,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ops_replace_assignment(uuid,uuid,uuid,uuid,uuid,integer) TO authenticated;
COMMIT;
