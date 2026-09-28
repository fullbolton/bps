-- Project reporting; deployment status is recorded in the release manifest.
BEGIN;
SET LOCAL lock_timeout='5s';
CREATE INDEX reporting_actuals_month ON public.reporting_actuals(tenant_id,project_id,month,location_id);
CREATE FUNCTION public.reporting_monthly_report(p_actor uuid,p_tenant uuid,p_project uuid,p_month text,p_offset integer DEFAULT 0) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE m date; period_state text; project_name text; totals jsonb; branches jsonb; pending bigint;
BEGIN
 PERFORM public.reporting_assert_scope(p_actor,p_tenant,false);
 IF p_month IS NULL OR p_month !~ '^20[0-9]{2}-(0[1-9]|1[0-2])$' OR p_offset IS NULL OR p_offset<0 OR p_offset>1000000 OR p_offset%50<>0 THEN RAISE EXCEPTION 'REPORT_INPUT';END IF;
 m:=(p_month||'-01')::date;
 SELECT name INTO project_name FROM public.reporting_projects WHERE tenant_id=p_tenant AND id=p_project;
 IF NOT FOUND THEN RAISE EXCEPTION 'REPORT_NOT_FOUND';END IF;
 SELECT status INTO period_state FROM public.reporting_periods WHERE tenant_id=p_tenant AND project_id=p_project AND month=m;
 IF NOT FOUND THEN RAISE EXCEPTION 'REPORT_PERIOD_NOT_FOUND';END IF;
 SELECT count(*) INTO pending FROM public.reporting_imports WHERE tenant_id=p_tenant AND project_id=p_project AND month=m AND status='pending';
 -- One statement snapshot. Counts are distinct over the whole month, never sums of branch counts.
 SELECT jsonb_build_object('records',count(*),'minutes',coalesce(sum(minutes),0),'people',count(DISTINCT person_id),'days',count(DISTINCT day),'branches',count(DISTINCT location_id)) INTO totals
 FROM public.reporting_actuals WHERE tenant_id=p_tenant AND project_id=p_project AND month=m;
 SELECT coalesce(jsonb_agg(to_jsonb(q) ORDER BY q.name,q.id),'[]'::jsonb) INTO branches FROM (
 SELECT l.id,l.name,count(*) AS records,sum(a.minutes) AS minutes,count(DISTINCT a.person_id) AS people,count(DISTINCT a.day) AS days
 FROM public.reporting_actuals a JOIN public.ops_locations l ON l.tenant_id=a.tenant_id AND l.id=a.location_id
 WHERE a.tenant_id=p_tenant AND a.project_id=p_project AND a.month=m
 GROUP BY l.id,l.name ORDER BY l.name,l.id LIMIT 50 OFFSET p_offset
 )q;
 RETURN jsonb_build_object('tenantId',p_tenant,'projectId',p_project,'name',project_name,'month',p_month,'status',period_state,'pending',pending,'totals',totals,'offset',p_offset,'rows',branches);
END $$;
REVOKE ALL ON FUNCTION public.reporting_monthly_report(uuid,uuid,uuid,text,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.reporting_monthly_report(uuid,uuid,uuid,text,integer) TO authenticated;
COMMIT;
