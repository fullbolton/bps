-- NOT APPLIED TO PRODUCTION. Daily declarations, not hours or payroll approval.
BEGIN;
SET LOCAL lock_timeout='5s';
ALTER TABLE public.ops_assignments
  ADD COLUMN attendance text NOT NULL DEFAULT 'unreported' CHECK(attendance IN ('unreported','present','absent')),
  ADD COLUMN attendance_revision integer NOT NULL DEFAULT 0 CHECK(attendance_revision>=0),
  ADD COLUMN attendance_recorded_at timestamptz,
  ADD COLUMN attendance_recorded_by uuid REFERENCES public.profiles(id),
  ADD CONSTRAINT ops_attendance_record_consistent CHECK (
    (attendance_revision=0 AND attendance='unreported' AND attendance_recorded_at IS NULL AND attendance_recorded_by IS NULL)
    OR (attendance_revision>0 AND attendance_recorded_at IS NOT NULL AND attendance_recorded_by IS NOT NULL));
CREATE UNIQUE INDEX ops_worker_present_day ON public.ops_assignments(tenant_id,worker_id,work_date) WHERE attendance='present';

CREATE FUNCTION public.ops_record_attendance(p_actor_id uuid,p_tenant_id uuid,p_command_id uuid,p_assignment_id uuid,p_expected_revision integer,p_status text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' SET lock_timeout='3s' AS $$
DECLARE v_actor uuid:=auth.uid(); v_cmd public.ops_commands%ROWTYPE; v_assignment public.ops_assignments%ROWTYPE;
  v_request uuid; v_payload jsonb; v_result jsonb;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'OPS_UNAUTHENTICATED'; END IF;
  PERFORM 1 FROM public.profiles WHERE id=v_actor FOR SHARE;
  IF p_actor_id IS DISTINCT FROM v_actor OR p_tenant_id IS NULL OR p_tenant_id IS DISTINCT FROM public.current_user_verified_tenant() THEN RAISE EXCEPTION 'OPS_SCOPE_CHANGED'; END IF;
  IF coalesce(public.current_user_role(),'') NOT IN ('yonetici','operasyon') THEN RAISE EXCEPTION 'OPS_FORBIDDEN'; END IF;
  IF p_command_id IS NULL OR p_assignment_id IS NULL OR p_expected_revision IS NULL OR p_expected_revision NOT BETWEEN 0 AND 2147483646 OR p_status IS NULL OR p_status NOT IN ('unreported','present','absent') THEN RAISE EXCEPTION 'OPS_VALIDATION'; END IF;
  v_payload:=jsonb_build_object('assignmentId',p_assignment_id,'expectedRevision',p_expected_revision,'status',p_status);
  INSERT INTO public.ops_commands(tenant_id,actor_id,id,kind,payload) VALUES(p_tenant_id,v_actor,p_command_id,'attendance',v_payload) ON CONFLICT DO NOTHING;
  SELECT * INTO v_cmd FROM public.ops_commands WHERE tenant_id=p_tenant_id AND actor_id=v_actor AND id=p_command_id FOR UPDATE;
  IF v_cmd.kind<>'attendance' OR v_cmd.payload<>v_payload THEN RAISE EXCEPTION 'OPS_IDEMPOTENCY_MISMATCH'; END IF;
  IF v_cmd.result IS NOT NULL THEN RETURN v_cmd.result; END IF;
  SELECT request_id INTO v_request FROM public.ops_assignments WHERE id=p_assignment_id AND tenant_id=p_tenant_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'OPS_OUT_OF_SCOPE'; END IF;
  -- Same request -> assignment ordering as remove/cancel. Worker serializes cross-request declarations.
  PERFORM 1 FROM public.ops_daily_requests WHERE id=v_request AND tenant_id=p_tenant_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'OPS_OUT_OF_SCOPE'; END IF;
  SELECT * INTO v_assignment FROM public.ops_assignments WHERE id=p_assignment_id AND tenant_id=p_tenant_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'OPS_OUT_OF_SCOPE'; END IF;
  IF v_assignment.work_date>(statement_timestamp() AT TIME ZONE 'Europe/Istanbul')::date THEN RAISE EXCEPTION 'OPS_FUTURE_ATTENDANCE'; END IF;
  IF v_assignment.attendance_revision<>p_expected_revision THEN RAISE EXCEPTION 'OPS_STALE_VERSION'; END IF;
  PERFORM 1 FROM public.ops_workers WHERE id=v_assignment.worker_id AND tenant_id=p_tenant_id FOR UPDATE;
  IF p_status='present' AND EXISTS(SELECT 1 FROM public.ops_assignments WHERE tenant_id=p_tenant_id AND worker_id=v_assignment.worker_id AND work_date=v_assignment.work_date AND attendance='present' AND id<>p_assignment_id) THEN RAISE EXCEPTION 'OPS_ATTENDANCE_CONFLICT'; END IF;
  UPDATE public.ops_assignments SET attendance=p_status,attendance_revision=attendance_revision+1,attendance_recorded_at=statement_timestamp(),attendance_recorded_by=v_actor WHERE id=p_assignment_id AND tenant_id=p_tenant_id;
  INSERT INTO public.ops_events(tenant_id,actor_id,command_id,kind,entity_id) VALUES(p_tenant_id,v_actor,p_command_id,'attendance',p_assignment_id);
  v_result:=jsonb_build_object('id',p_assignment_id,'commandId',p_command_id,'previousStatus',v_assignment.attendance,'previousRevision',v_assignment.attendance_revision,'status',p_status,'revision',v_assignment.attendance_revision+1);
  UPDATE public.ops_commands SET result=v_result WHERE tenant_id=p_tenant_id AND actor_id=v_actor AND id=p_command_id;
  RETURN v_result;
END $$;
REVOKE ALL ON FUNCTION public.ops_record_attendance(uuid,uuid,uuid,uuid,integer,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ops_record_attendance(uuid,uuid,uuid,uuid,integer,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.ops_board(p_company_id uuid,p_work_date date)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE v_tenant uuid:=public.current_user_verified_tenant();
BEGIN
  IF v_tenant IS NULL OR coalesce(public.current_user_role(),'') NOT IN ('yonetici','operasyon') THEN RAISE EXCEPTION 'OPS_FORBIDDEN'; END IF;
  IF p_work_date IS NULL THEN RAISE EXCEPTION 'OPS_VALIDATION'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.companies WHERE id=p_company_id AND tenant_id=v_tenant) THEN RAISE EXCEPTION 'OPS_OUT_OF_SCOPE'; END IF;
  RETURN jsonb_build_object(
    'locations',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'city',city,'active',active) ORDER BY name),'[]') FROM public.ops_locations WHERE company_id=p_company_id AND tenant_id=v_tenant),
    'workers',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',w.id,'name',w.name,'code',w.code,'active',w.active,'booked',EXISTS(SELECT 1 FROM public.ops_assignments a WHERE a.worker_id=w.id AND a.tenant_id=v_tenant AND a.work_date=p_work_date AND a.removed_at IS NULL)) ORDER BY w.name),'[]') FROM public.ops_workers w WHERE w.tenant_id=v_tenant),
    'requests',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',r.id,'locationId',r.location_id,'workDate',r.work_date,'serviceLine',r.service_line,'position',r.position,'requiredCount',r.required_count,'lifecycle',r.lifecycle,
      'attendance',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',a.id,'workerId',a.worker_id,'status',a.attendance,'revision',a.attendance_revision,'removed',a.removed_at IS NOT NULL) ORDER BY a.created_at,a.id),'[]') FROM public.ops_assignments a WHERE a.request_id=r.id AND a.tenant_id=v_tenant),
      'assignments',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',a.id,'workerId',a.worker_id) ORDER BY a.created_at),'[]') FROM public.ops_assignments a WHERE a.request_id=r.id AND a.tenant_id=v_tenant AND a.removed_at IS NULL)) ORDER BY r.created_at),'[]') FROM public.ops_daily_requests r WHERE r.company_id=p_company_id AND r.tenant_id=v_tenant AND r.work_date=p_work_date)
  );
END $$;
REVOKE ALL ON FUNCTION public.ops_board(uuid,date) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ops_board(uuid,date) TO authenticated;
COMMIT;
