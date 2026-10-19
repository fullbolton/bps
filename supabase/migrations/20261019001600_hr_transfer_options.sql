BEGIN;
CREATE FUNCTION public.hr_location_transfer_options_v1(p_actor uuid,p_tenant uuid,p_employee uuid,p_after uuid DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE a public.hr_location_assignments;department uuid;account uuid;policy jsonb;rows jsonb;more boolean;source_name text;
 today date:=(statement_timestamp() AT TIME ZONE 'Europe/Istanbul')::date;
BEGIN
 IF public.hr_access_mode_v1(p_actor,p_tenant)<>'scoped' THEN RAISE EXCEPTION 'HR_SCOPED_MODE_REQUIRED';END IF;
 SELECT * INTO a FROM public.hr_location_assignments WHERE tenant_id=p_tenant AND employee_id=p_employee AND daterange(starts_on,ends_on,'[]') @> today;
 IF NOT FOUND THEN RAISE EXCEPTION 'HR_TRANSFER_UNAVAILABLE';END IF;
 SELECT department_id INTO department FROM public.hr_assignments WHERE tenant_id=p_tenant AND employee_id=p_employee AND daterange(starts_on,ends_on,'[]') @> today;
 account:=public.hr_employee_account_v1(p_tenant,p_employee);
 IF NOT (public.company_access_decision_v1(p_tenant,p_actor,'hr.employees.update',account,department,a.location_id,statement_timestamp())->>'allowed')::boolean THEN RAISE EXCEPTION 'HR_TRANSFER_UNAVAILABLE';END IF;
 IF a.ends_on IS NOT NULL OR a.starts_on>=today OR NOT EXISTS(SELECT FROM public.hr_employment_periods WHERE tenant_id=p_tenant AND id=a.employment_id AND ends_on IS NULL) THEN RAISE EXCEPTION 'HR_TRANSFER_UNAVAILABLE';END IF;
 policy:=public.company_access_policy_v1(p_tenant,p_actor);
 SELECT name INTO source_name FROM public.hr_work_locations WHERE tenant_id=p_tenant AND id=a.location_id;
 WITH eligible AS MATERIALIZED (
  SELECT l.id,l.name FROM public.hr_work_locations l WHERE l.tenant_id=p_tenant AND l.closed_on IS NULL AND l.id<>a.location_id AND (p_after IS NULL OR l.id>p_after)
  AND (public.company_access_decision_v1(p_tenant,p_actor,'hr.employees.update',account,department,l.id,statement_timestamp())->>'allowed')::boolean
  ORDER BY l.id LIMIT 51
 )
 SELECT coalesce((SELECT jsonb_agg(jsonb_build_object('id',x.id,'name',x.name) ORDER BY x.id) FROM (SELECT * FROM eligible ORDER BY id LIMIT 50) x),'[]'),(SELECT count(*)>50 FROM eligible) INTO rows,more;
 RETURN jsonb_build_object('schemaVersion',1,'actorId',p_actor,'tenantId',p_tenant,'employeeId',p_employee,'policyRevision',(policy->>'revision')::bigint,
 'assignmentId',a.id,'assignmentRevision',a.revision,'sourceLocationId',a.location_id,'sourceLocationName',source_name,'effectiveOn',today,'locations',rows,'hasMore',more);
END $$;
REVOKE ALL ON FUNCTION public.hr_location_transfer_options_v1(uuid,uuid,uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.hr_location_transfer_options_v1(uuid,uuid,uuid,uuid) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
