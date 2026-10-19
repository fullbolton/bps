-- Scoped reader candidate. Existing v1 and writers remain unchanged until coordinated cutover.
BEGIN;
SET LOCAL lock_timeout='5s';
CREATE FUNCTION public.hr_scoped_directory_v1(p_actor uuid,p_tenant uuid,p_after uuid DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE policy jsonb;rules jsonb;today date:=(statement_timestamp() AT TIME ZONE 'Europe/Istanbul')::date;page jsonb;more boolean;rev bigint;
BEGIN
 IF p_actor IS NULL OR p_actor IS DISTINCT FROM auth.uid() OR p_tenant IS NULL OR p_tenant IS DISTINCT FROM public.current_user_verified_tenant() THEN RAISE EXCEPTION 'HR_SCOPE';END IF;
 IF NOT EXISTS(SELECT FROM public.tenant_module_settings s JOIN public.tenant_module_entitlements e USING(tenant_id,module_key) WHERE s.tenant_id=p_tenant AND s.module_key='hr' AND s.enabled AND e.granted) THEN RAISE EXCEPTION 'HR_MODULE_CLOSED';END IF;
 -- No legacy-role OR custom-role fallback. A missing custom policy denies this new reader.
 policy:=public.company_access_policy_v1(p_tenant,p_actor);
 IF policy IS NULL THEN RAISE EXCEPTION 'HR_CUSTOM_POLICY_REQUIRED';END IF;
 rev:=(policy->>'revision')::bigint;
 SELECT (policy->'rules')||coalesce(jsonb_agg(value),'[]') INTO rules FROM jsonb_array_elements(policy->'exceptions') WHERE (value->>'startsAt')::timestamptz<=statement_timestamp() AND statement_timestamp()<(value->>'expiresAt')::timestamptz;
 -- Materialize rules once, then scope BEFORE the 51-row page probe. No per-person RPC or policy re-read.
 WITH eligible AS MATERIALIZED (
  SELECT e.id,e.code,coalesce(p.name,t.name) AS name,period.starts_on,period.ends_on,a.department_id,a.position
  FROM public.hr_employees e JOIN public.hr_people p ON p.tenant_id=e.tenant_id AND p.id=e.person_id
  LEFT JOIN public.talent_people t ON t.tenant_id=p.tenant_id AND t.id=p.talent_person_id
  LEFT JOIN LATERAL (SELECT x.id,x.starts_on,x.ends_on FROM public.hr_employment_periods x WHERE x.tenant_id=e.tenant_id AND x.employee_id=e.id ORDER BY (x.starts_on<=today) DESC,x.starts_on DESC LIMIT 1) period ON true
  LEFT JOIN public.hr_assignments a ON a.tenant_id=e.tenant_id AND a.employment_id=period.id AND daterange(a.starts_on,a.ends_on,'[]') @> today
  LEFT JOIN public.hr_location_assignments l ON l.tenant_id=e.tenant_id AND l.employee_id=e.id AND daterange(l.starts_on,l.ends_on,'[]') @> today
  LEFT JOIN public.hr_account_links link ON link.tenant_id=e.tenant_id AND link.employee_id=e.id AND link.unlinked_at IS NULL
  LEFT JOIN public.tenant_memberships m ON m.tenant_id=link.tenant_id AND m.user_id=link.account_id AND m.id=link.membership_id
  WHERE e.tenant_id=p_tenant AND (p_after IS NULL OR e.id>p_after)
   AND EXISTS(SELECT FROM jsonb_array_elements(rules) r WHERE r->>'capability'='hr.employees.read' AND r->>'effect'='allow' AND public.company_access_scope_matches(r->'scope',p_actor,m.user_id,a.department_id,l.location_id))
   AND NOT EXISTS(SELECT FROM jsonb_array_elements(rules) r WHERE r->>'capability'='hr.employees.read' AND r->>'effect'='deny' AND public.company_access_scope_matches(r->'scope',p_actor,m.user_id,a.department_id,l.location_id))
  ORDER BY e.id LIMIT 51
 ), visible AS (SELECT * FROM eligible ORDER BY id LIMIT 50)
 SELECT coalesce((SELECT jsonb_agg(jsonb_build_object('id',v.id,'code',v.code,'name',v.name,'startsOn',v.starts_on,'endsOn',v.ends_on,'department',d.name,'position',v.position) ORDER BY v.id) FROM visible v LEFT JOIN public.hr_departments d ON d.tenant_id=p_tenant AND d.id=v.department_id),'[]'),(SELECT count(*)>50 FROM eligible) INTO page,more;
 -- Do not leak an unscoped organization selector to a scoped reader. Writers need a separate authorized options contract.
 RETURN jsonb_build_object('schemaVersion',1,'actorId',p_actor,'tenantId',p_tenant,'policyRevision',rev,'employees',page,'departments','[]'::jsonb,'hasMore',more);
END $$;
-- Internal-only during cutover preparation: an authenticated caller cannot pick between scoped and legacy readers.
REVOKE ALL ON FUNCTION public.hr_scoped_directory_v1(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
COMMIT;
