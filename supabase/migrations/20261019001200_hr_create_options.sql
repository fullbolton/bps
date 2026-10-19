-- Private candidate for the coordinated HR cutover. No client grant yet.
BEGIN;
CREATE FUNCTION public.hr_scoped_create_options_v1(p_actor uuid,p_tenant uuid,p_after text DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE policy jsonb;rules jsonb;rows jsonb;more boolean;
BEGIN
 IF p_actor IS NULL OR p_actor IS DISTINCT FROM auth.uid() OR p_tenant IS NULL OR p_tenant IS DISTINCT FROM public.current_user_verified_tenant() THEN RAISE EXCEPTION 'HR_SCOPE';END IF;
 IF p_after IS NOT NULL AND p_after !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN RAISE EXCEPTION 'HR_CURSOR';END IF;
 IF NOT EXISTS(SELECT FROM public.tenant_module_settings s JOIN public.tenant_module_entitlements e USING(tenant_id,module_key) WHERE s.tenant_id=p_tenant AND s.module_key='hr' AND s.enabled AND e.granted) THEN RAISE EXCEPTION 'HR_MODULE_CLOSED';END IF;
 policy:=public.company_access_policy_v1(p_tenant,p_actor);
 IF policy IS NULL THEN RAISE EXCEPTION 'HR_CUSTOM_POLICY_REQUIRED';END IF;
 SELECT (policy->'rules')||coalesce(jsonb_agg(value),'[]') INTO rules FROM jsonb_array_elements(policy->'exceptions') WHERE (value->>'startsAt')::timestamptz<=statement_timestamp() AND statement_timestamp()<(value->>'expiresAt')::timestamptz;
 -- Return authorized combinations, not two independent lists whose cross-product could widen scope.
 -- Policy is materialized once. The writer rechecks the exact pair under its tenant lock.
 WITH departments AS MATERIALIZED (
  SELECT id,name FROM public.hr_departments WHERE tenant_id=p_tenant AND closed_on IS NULL
  UNION ALL SELECT NULL::uuid,NULL::text
 ), locations AS MATERIALIZED (
  SELECT id,name FROM public.hr_work_locations WHERE tenant_id=p_tenant AND closed_on IS NULL
  UNION ALL SELECT NULL::uuid,NULL::text
 ), allowed AS MATERIALIZED (
  SELECT coalesce(d.id::text,'00000000-0000-0000-0000-000000000000')||':'||coalesce(l.id::text,'00000000-0000-0000-0000-000000000000') AS key,d.id AS department_id,d.name AS department_name,l.id AS location_id,l.name AS location_name
  FROM departments d CROSS JOIN locations l
  WHERE (p_after IS NULL OR coalesce(d.id::text,'00000000-0000-0000-0000-000000000000')||':'||coalesce(l.id::text,'00000000-0000-0000-0000-000000000000')>p_after)
  AND EXISTS(SELECT FROM jsonb_array_elements(rules) r WHERE r->>'capability'='hr.employees.read' AND r->>'effect'='allow' AND public.company_access_scope_matches(r->'scope',p_actor,NULL,d.id,l.id))
  AND EXISTS(SELECT FROM jsonb_array_elements(rules) r WHERE r->>'capability'='hr.employees.create' AND r->>'effect'='allow' AND public.company_access_scope_matches(r->'scope',p_actor,NULL,d.id,l.id))
  AND NOT EXISTS(SELECT FROM jsonb_array_elements(rules) r WHERE r->>'capability' IN ('hr.employees.read','hr.employees.create') AND r->>'effect'='deny' AND public.company_access_scope_matches(r->'scope',p_actor,NULL,d.id,l.id))
  ORDER BY key LIMIT 51
 )
 SELECT coalesce((SELECT jsonb_agg(jsonb_build_object('key',v.key,'departmentId',v.department_id,'departmentName',v.department_name,'locationId',v.location_id,'locationName',v.location_name) ORDER BY v.key) FROM (SELECT * FROM allowed ORDER BY key LIMIT 50) v),'[]'),(SELECT count(*)>50 FROM allowed) INTO rows,more;
 RETURN jsonb_build_object('schemaVersion',1,'actorId',p_actor,'tenantId',p_tenant,'policyRevision',(policy->>'revision')::bigint,'options',rows,'hasMore',more,
 'canCreateFuture',(public.company_access_decision_v1(p_tenant,p_actor,'hr.employees.read',NULL,NULL,NULL,statement_timestamp())->>'allowed')::boolean);
END $$;
REVOKE ALL ON FUNCTION public.hr_scoped_create_options_v1(uuid,uuid,text) FROM PUBLIC,anon,authenticated,service_role;
COMMIT;
