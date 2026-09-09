-- NOT APPLIED TO PRODUCTION. Read-only weekly declarations, including removed/cancelled history.
BEGIN;
SET LOCAL lock_timeout='5s';
CREATE FUNCTION public.ops_attendance_week(p_company_id uuid,p_week_start date)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE v_tenant uuid:=public.current_user_verified_tenant(); v_company text;
BEGIN
  IF v_tenant IS NULL OR coalesce(public.current_user_role(),'') NOT IN ('yonetici','operasyon') THEN RAISE EXCEPTION 'OPS_FORBIDDEN'; END IF;
  IF p_week_start IS NULL OR extract(isodow FROM p_week_start)<>1
    OR p_week_start<DATE '1999-12-27' OR p_week_start>DATE '2100-12-27' THEN RAISE EXCEPTION 'OPS_VALIDATION'; END IF;
  SELECT name INTO v_company FROM public.companies WHERE id=p_company_id AND tenant_id=v_tenant;
  IF NOT FOUND THEN RAISE EXCEPTION 'OPS_OUT_OF_SCOPE'; END IF;
  IF (SELECT count(*) FROM public.ops_daily_requests WHERE tenant_id=v_tenant AND company_id=p_company_id
    AND work_date>=p_week_start AND work_date<p_week_start+7)>5000 THEN RAISE EXCEPTION 'OPS_WEEK_TOO_LARGE'; END IF;
  IF (SELECT count(*) FROM public.ops_assignments a JOIN public.ops_daily_requests r ON r.id=a.request_id AND r.tenant_id=a.tenant_id
    WHERE r.tenant_id=v_tenant AND r.company_id=p_company_id AND r.work_date>=p_week_start AND r.work_date<p_week_start+7)>20000 THEN RAISE EXCEPTION 'OPS_ATTENDANCE_WEEK_TOO_LARGE'; END IF;
  RETURN jsonb_build_object('companyId',p_company_id,'companyName',v_company,'weekStart',p_week_start,'generatedAt',statement_timestamp(),
    'requests',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',r.id,'locationId',r.location_id,'locationName',l.name,'city',l.city,
      'workDate',r.work_date,'serviceLine',r.service_line,'position',r.position,'requiredCount',r.required_count,'lifecycle',r.lifecycle,
      'attendance',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',a.id,'workerId',a.worker_id,'status',a.attendance,'revision',a.attendance_revision,'removed',a.removed_at IS NOT NULL) ORDER BY a.created_at,a.id),'[]') FROM public.ops_assignments a WHERE a.request_id=r.id AND a.tenant_id=v_tenant),
      'assignments',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',a.id,'workerId',a.worker_id,'name',w.name) ORDER BY w.name,a.id),'[]')
        FROM public.ops_assignments a JOIN public.ops_workers w ON w.id=a.worker_id AND w.tenant_id=a.tenant_id
        WHERE a.tenant_id=v_tenant AND a.request_id=r.id AND a.removed_at IS NULL)) ORDER BY r.work_date,l.name,r.position,r.id),'[]')
      FROM public.ops_daily_requests r JOIN public.ops_locations l ON l.id=r.location_id AND l.tenant_id=r.tenant_id
      WHERE r.tenant_id=v_tenant AND r.company_id=p_company_id AND r.work_date>=p_week_start AND r.work_date<p_week_start+7));
END $$;
REVOKE ALL ON FUNCTION public.ops_attendance_week(uuid,date) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ops_attendance_week(uuid,date) TO authenticated;
COMMIT;
