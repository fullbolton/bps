-- Preserve deployed shift-overlap logic; reject new attendance on removed/cancelled work.
BEGIN;
SET LOCAL lock_timeout='15s';
DO $patch$
DECLARE target regprocedure:=to_regprocedure('public.ops_record_attendance(uuid,uuid,uuid,uuid,integer,text)');original text;definition text;
BEGIN
 IF target IS NULL THEN RAISE EXCEPTION 'ATTENDANCE_SIGNATURE_MISSING';END IF;
 SELECT prosrc INTO original FROM pg_proc WHERE oid=target;
 IF encode(sha256(convert_to(original,'UTF8')),'hex')<>'d52c70c2c5b4059db1762a92cd4afca4450a66e1f26c5555401bcc09a82b8a63' THEN RAISE EXCEPTION 'ATTENDANCE_SOURCE_DRIFT';END IF;
 definition:=pg_get_functiondef(target);
 IF strpos(definition,original)=0 THEN RAISE EXCEPTION 'ATTENDANCE_DEFINITION_DRIFT';END IF;
 EXECUTE replace(definition,original,'
DECLARE v_actor uuid:=auth.uid(); v_cmd public.ops_commands%ROWTYPE; v_assignment public.ops_assignments%ROWTYPE;
  v_request uuid; v_lifecycle text; v_payload jsonb; v_result jsonb;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION ''OPS_UNAUTHENTICATED''; END IF;
  PERFORM 1 FROM public.profiles WHERE id=v_actor FOR SHARE;
  IF p_actor_id IS DISTINCT FROM v_actor OR p_tenant_id IS NULL OR p_tenant_id IS DISTINCT FROM public.current_user_verified_tenant() THEN RAISE EXCEPTION ''OPS_SCOPE_CHANGED''; END IF;
  IF coalesce(public.current_user_role(),'''') NOT IN (''yonetici'',''operasyon'') THEN RAISE EXCEPTION ''OPS_FORBIDDEN''; END IF;
  IF p_command_id IS NULL OR p_assignment_id IS NULL OR p_expected_revision IS NULL OR p_expected_revision NOT BETWEEN 0 AND 2147483646 OR p_status IS NULL OR p_status NOT IN (''unreported'',''present'',''absent'') THEN RAISE EXCEPTION ''OPS_VALIDATION''; END IF;
  v_payload:=jsonb_build_object(''assignmentId'',p_assignment_id,''expectedRevision'',p_expected_revision,''status'',p_status);
  INSERT INTO public.ops_commands(tenant_id,actor_id,id,kind,payload) VALUES(p_tenant_id,v_actor,p_command_id,''attendance'',v_payload) ON CONFLICT DO NOTHING;
  SELECT * INTO v_cmd FROM public.ops_commands WHERE tenant_id=p_tenant_id AND actor_id=v_actor AND id=p_command_id FOR UPDATE;
  IF v_cmd.kind<>''attendance'' OR v_cmd.payload<>v_payload THEN RAISE EXCEPTION ''OPS_IDEMPOTENCY_MISMATCH''; END IF;
  IF v_cmd.result IS NOT NULL THEN RETURN v_cmd.result; END IF;
  SELECT request_id INTO v_request FROM public.ops_assignments WHERE id=p_assignment_id AND tenant_id=p_tenant_id;
  IF NOT FOUND THEN RAISE EXCEPTION ''OPS_OUT_OF_SCOPE''; END IF;
  -- Same request -> assignment ordering as remove/cancel. Worker serializes cross-request declarations.
  SELECT lifecycle INTO v_lifecycle FROM public.ops_daily_requests WHERE id=v_request AND tenant_id=p_tenant_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION ''OPS_OUT_OF_SCOPE''; END IF;
  SELECT * INTO v_assignment FROM public.ops_assignments WHERE id=p_assignment_id AND tenant_id=p_tenant_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION ''OPS_OUT_OF_SCOPE''; END IF;
  IF v_assignment.removed_at IS NOT NULL OR v_lifecycle IS DISTINCT FROM ''active'' THEN
   RAISE EXCEPTION ''OPS_ATTENDANCE_CLOSED'';
  END IF;
  IF v_assignment.work_date>(statement_timestamp() AT TIME ZONE ''Europe/Istanbul'')::date THEN RAISE EXCEPTION ''OPS_FUTURE_ATTENDANCE''; END IF;
  IF v_assignment.attendance_revision<>p_expected_revision THEN RAISE EXCEPTION ''OPS_STALE_VERSION''; END IF;
  PERFORM 1 FROM public.ops_workers WHERE id=v_assignment.worker_id AND tenant_id=p_tenant_id FOR UPDATE;
  IF p_status=''present'' AND EXISTS(SELECT 1 FROM public.ops_assignments WHERE tenant_id=p_tenant_id AND worker_id=v_assignment.worker_id AND occupied_range && v_assignment.occupied_range AND (removed_at IS NULL OR attendance=''present'') AND id<>p_assignment_id) THEN RAISE EXCEPTION ''OPS_ATTENDANCE_CONFLICT''; END IF;
  UPDATE public.ops_assignments SET attendance=p_status,attendance_revision=attendance_revision+1,attendance_recorded_at=statement_timestamp(),attendance_recorded_by=v_actor WHERE id=p_assignment_id AND tenant_id=p_tenant_id;
  INSERT INTO public.ops_events(tenant_id,actor_id,command_id,kind,entity_id) VALUES(p_tenant_id,v_actor,p_command_id,''attendance'',p_assignment_id);
  v_result:=jsonb_build_object(''id'',p_assignment_id,''commandId'',p_command_id,''previousStatus'',v_assignment.attendance,''previousRevision'',v_assignment.attendance_revision,''status'',p_status,''revision'',v_assignment.attendance_revision+1);
  UPDATE public.ops_commands SET result=v_result WHERE tenant_id=p_tenant_id AND actor_id=v_actor AND id=p_command_id;
  RETURN v_result;
END ');
END $patch$;
NOTIFY pgrst,'reload schema';
COMMIT;
