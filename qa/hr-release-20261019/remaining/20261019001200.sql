BEGIN; SET LOCAL statement_timeout='60s'; SET LOCAL lock_timeout='5s';
LOCK TABLE supabase_migrations.schema_migrations IN EXCLUSIVE MODE;
DO $guard$ BEGIN
IF (SELECT array_agg(version ORDER BY version) FROM supabase_migrations.schema_migrations) IS DISTINCT FROM ARRAY['20260407000000','20260407000100','20260407000200','20260407000300','20260407000400','20260407000500','20260407000600','20260407000700','20260407000800','20260407000900','20260407001000','20260407001100','20260407001600','20260407001700','20260407001800','20260413000100','20260414000100','20260414000200','20260415000100','20260415000200','20260415000300','20260415000400','20260415000500','20260423000100','20260425000100','20260425000200','20260713000100','20260713000200','20260722000100','20260810000100','20260810000200','20260827000100','20260827000200','20260827000300','20260827000400','20260904000100','20260904000200','20260909000100','20260909000200','20260909000300','20260909000400','20260909000500','20260909000600','20260909000700','20260909000800','20260909000900','20260909001000','20260909001100','20260909001200','20260909001300','20260909001400','20260909001500','20260909001600','20260909001700','20260909001800','20260909001900','20260909002000','20260909002100','20260909002200','20260909002300','20260909002400','20260909002500','20260909002600','20260909002700','20260909002800','20260909002900','20260910000100','20260910000200','20260910000300','20260910000400','20260911000100','20260913000100','20260914000100','20260914000200','20260914000300','20260914000400','20260914000500','20260914000600','20260914000700','20260915000100','20260915000200','20260915000300','20260915000400','20260915000500','20260915000600','20260915000700','20260915000800','20260915000900','20260915001000','20260923000100','20260923000200','20260923000300','20260923000400','20260924000100','20260924000200','20260924000300','20260924000400','20260924000500','20260925000100','20260925000200','20260925000300','20260925000400','20260925000500','20260925000600','20260925000700','20260926000100','20260926000200','20260927000100','20260927000200','20260927000300','20260927000400','20260927000500','20260927000600','20260927000700','20260927000800','20260927000900','20260928000100','20260928000200','20260928000300','20260928000400','20260928000500','20260928000600','20260928000700','20260928000800','20261004001000','20261004001100','20261004001200','20261004001300','20261004001400','20261005000100','20261005000200','20261005000300','20261005000400','20261005000500','20261005000600','20261005000700','20261005000800','20261005000900','20261005001000','20261005001100','20261005001200','20261005001300','20261005001400','20261005001500','20261005001600','20261005001700','20261005001800','20261005001900','20261005002000','20261005002100','20261005002200','20261005002300','20261005002400','20261005002500','20261005002600','20261005002700','20261005002800','20261005002900','20261005003000','20261005003100','20261013000100','20261013000200','20261013000300','20261015000100','20261015000200','20261015000300','20261015000400','20261015000500','20261015000600','20261015000700','20261015000800','20261016000100','20261016000200','20261016000300','20261016000400','20261016000500','20261016000600','20261016000700','20261016000800','20261016000900','20261016001000','20261016001100','20261017000100','20261017000200','20261018000100','20261018000200','20261018000300','20261018000400','20261018000500','20261018000600','20261019000100','20261019000200','20261019000300','20261019000400','20261019000500','20261019000600','20261019000700','20261019000800','20261019000900','20261019001000','20261019001100']::text[] THEN RAISE EXCEPTION 'LIVE_LEDGER_CHANGED'; END IF;
IF to_regnamespace('bps_release_guard') IS NOT NULL THEN RAISE EXCEPTION 'RELEASE_BARRIER_PRESENT'; END IF;
END $guard$;
-- Private candidate for the coordinated HR cutover. No client grant yet.

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

INSERT INTO supabase_migrations.schema_migrations(version,name,statements) VALUES('20261019001200','hr_create_options',ARRAY[$bps_source$-- Private candidate for the coordinated HR cutover. No client grant yet.
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
$bps_source$]);
COMMIT;
