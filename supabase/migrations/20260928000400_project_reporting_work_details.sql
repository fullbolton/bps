BEGIN;
SET LOCAL lock_timeout='5s';
CREATE FUNCTION public.reporting_work_details(p_actor uuid,p_tenant uuid,p_project uuid,p_month text,p_location uuid DEFAULT NULL,p_offset integer DEFAULT 0) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE m date;total bigint;rows jsonb;
BEGIN
 PERFORM public.reporting_assert_scope(p_actor,p_tenant,false);
 IF p_month IS NULL OR p_month !~ '^20[0-9]{2}-(0[1-9]|1[0-2])$' OR p_offset IS NULL OR p_offset<0 OR p_offset>1000000 OR p_offset%50<>0 THEN RAISE EXCEPTION 'REPORT_INPUT';END IF;
 m:=(p_month||'-01')::date;
 IF NOT EXISTS(SELECT 1 FROM public.reporting_periods WHERE tenant_id=p_tenant AND project_id=p_project AND month=m) THEN RAISE EXCEPTION 'REPORT_PERIOD_NOT_FOUND';END IF;
 SELECT count(*) INTO total FROM public.reporting_actuals WHERE tenant_id=p_tenant AND project_id=p_project AND month=m AND (p_location IS NULL OR location_id=p_location);
 SELECT coalesce(jsonb_agg(to_jsonb(q) ORDER BY q.day DESC,q."personId",q."locationId",q.slot,q.source,q."sourceId"),'[]'::jsonb) INTO rows FROM (
 SELECT a.day,a.person_id AS "personId",p.name AS "personName",a.location_id AS "locationId",l.name AS "locationName",a.slot,a.minutes,a.source,a.source_id AS "sourceId",a.batch_id AS "batchId"
 FROM public.reporting_actuals a JOIN public.talent_people p ON p.tenant_id=a.tenant_id AND p.id=a.person_id JOIN public.ops_locations l ON l.tenant_id=a.tenant_id AND l.id=a.location_id
 WHERE a.tenant_id=p_tenant AND a.project_id=p_project AND a.month=m AND (p_location IS NULL OR a.location_id=p_location)
 ORDER BY a.day DESC,a.person_id,a.location_id,a.slot,a.source,a.source_id LIMIT 50 OFFSET p_offset
 )q;
 RETURN jsonb_build_object('tenantId',p_tenant,'projectId',p_project,'month',p_month,'locationId',p_location,'total',total,'offset',p_offset,'rows',rows);
END $$;
REVOKE ALL ON FUNCTION public.reporting_work_details(uuid,uuid,uuid,text,uuid,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.reporting_work_details(uuid,uuid,uuid,text,uuid,integer) TO authenticated;
COMMIT;
