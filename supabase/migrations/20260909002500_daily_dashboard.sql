BEGIN;
SET LOCAL lock_timeout='15s';
CREATE FUNCTION public.daily_dashboard(p_actor_id uuid,p_tenant_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE v_day date:=(statement_timestamp() AT TIME ZONE 'Europe/Istanbul')::date;v jsonb;
BEGIN
 IF auth.uid() IS NULL OR p_actor_id IS DISTINCT FROM auth.uid() OR p_tenant_id IS NULL OR p_tenant_id IS DISTINCT FROM public.current_user_verified_tenant() THEN RAISE EXCEPTION 'DAILY_DASHBOARD_SCOPE'; END IF;
 IF coalesce(public.current_user_role(),'') NOT IN ('yonetici','operasyon') THEN RAISE EXCEPTION 'DAILY_DASHBOARD_FORBIDDEN'; END IF;
 WITH demand AS (
 SELECT r.id,r.company_id,c.name AS company,l.name AS location,r.position,r.required_count,
 (SELECT count(*)::integer FROM public.ops_assignments a WHERE a.request_id=r.id AND a.tenant_id=r.tenant_id AND a.work_date=v_day AND a.removed_at IS NULL) AS placed
 FROM public.ops_daily_requests r JOIN public.companies c ON c.id=r.company_id AND c.tenant_id=r.tenant_id
 JOIN public.ops_locations l ON l.id=r.location_id AND l.tenant_id=r.tenant_id AND l.company_id=r.company_id
 WHERE r.tenant_id=p_tenant_id AND r.work_date=v_day AND r.lifecycle='active'
 ), gaps AS (SELECT *,greatest(0,required_count-placed) AS missing FROM demand), top_gaps AS (
 SELECT * FROM gaps WHERE missing>0 ORDER BY missing DESC,id LIMIT 5
 ) SELECT jsonb_build_object('day',v_day,'requests',(SELECT count(*) FROM demand),
 'required',(SELECT coalesce(sum(required_count),0) FROM demand),'placed',(SELECT coalesce(sum(placed),0) FROM demand),
 'missing',(SELECT coalesce(sum(missing),0) FROM gaps),'openRequests',(SELECT count(*) FROM gaps WHERE missing>0),
 'gaps',coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'companyId',company_id,'company',company,'location',location,'position',position,'missing',missing) ORDER BY missing DESC,id) FROM top_gaps),'[]'::jsonb)) INTO v;
 RETURN v;
END $$;
REVOKE ALL ON FUNCTION public.daily_dashboard(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.daily_dashboard(uuid,uuid) TO authenticated;
COMMIT;
