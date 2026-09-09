-- Read-only setup inventory. Requires daily operations baseline; no completion flags.
BEGIN;
SET LOCAL lock_timeout='15s';
CREATE OR REPLACE FUNCTION public.workspace_setup(p_actor_id uuid,p_tenant_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE v_today date:=(statement_timestamp() AT TIME ZONE 'Europe/Istanbul')::date; v_result jsonb;
BEGIN
 IF auth.uid() IS NULL OR p_actor_id IS DISTINCT FROM auth.uid()
 OR p_tenant_id IS NULL OR p_tenant_id IS DISTINCT FROM public.current_user_verified_tenant() THEN RAISE EXCEPTION 'SETUP_SCOPE'; END IF;
 IF public.current_user_role() IS DISTINCT FROM 'yonetici' THEN RAISE EXCEPTION 'SETUP_FORBIDDEN'; END IF;
 SELECT jsonb_build_object('tenantId',t.id,'name',t.name,'today',v_today,
 'companies',(SELECT count(*) FROM public.companies c WHERE c.tenant_id=t.id AND c.status='aktif'),
 'locations',(SELECT count(*) FROM public.ops_locations l JOIN public.companies c ON c.id=l.company_id AND c.tenant_id=l.tenant_id WHERE l.tenant_id=t.id AND l.active AND c.status='aktif'),
 'members',(SELECT count(*) FROM public.tenant_memberships m JOIN public.profiles p ON p.id=m.user_id WHERE m.tenant_id=t.id),
 'workers',(SELECT count(*) FROM public.ops_workers w WHERE w.tenant_id=t.id AND w.active),
 'requests',(SELECT count(*) FROM public.ops_daily_requests r JOIN public.ops_locations l ON l.id=r.location_id AND l.tenant_id=r.tenant_id JOIN public.companies c ON c.id=r.company_id AND c.tenant_id=r.tenant_id WHERE r.tenant_id=t.id AND r.lifecycle='active' AND r.work_date>=v_today AND l.active AND c.status='aktif'),
 'assignments',(SELECT count(*) FROM public.ops_assignments a JOIN public.ops_daily_requests r ON r.id=a.request_id AND r.tenant_id=a.tenant_id JOIN public.ops_workers w ON w.id=a.worker_id AND w.tenant_id=a.tenant_id JOIN public.ops_locations l ON l.id=r.location_id AND l.tenant_id=r.tenant_id JOIN public.companies c ON c.id=r.company_id AND c.tenant_id=r.tenant_id WHERE a.tenant_id=t.id AND a.removed_at IS NULL AND a.work_date>=v_today AND r.lifecycle='active' AND w.active AND l.active AND c.status='aktif')
 ) INTO v_result FROM public.tenants t WHERE t.id=p_tenant_id;
 IF v_result IS NULL THEN RAISE EXCEPTION 'SETUP_SCOPE'; END IF;
 RETURN v_result;
END $$;
REVOKE ALL ON FUNCTION public.workspace_setup(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.workspace_setup(uuid,uuid) TO authenticated;
COMMIT;
