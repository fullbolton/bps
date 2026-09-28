-- Expand before notification workers. Service projections never grant interactive users access.
BEGIN;
SET LOCAL lock_timeout='15s';
CREATE FUNCTION public.customer_notification_modules_v1(p_tenant_ids uuid[],p_module text)
RETURNS TABLE(tenant_id uuid,enabled boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE tenant uuid;
BEGIN
 IF p_module IS NULL OR p_module NOT IN ('calendar','contracts') OR p_tenant_ids IS NULL
  OR cardinality(p_tenant_ids) NOT BETWEEN 1 AND 500 OR array_position(p_tenant_ids,NULL) IS NOT NULL THEN
  RAISE EXCEPTION 'NOTIFICATION_MODULE_INPUT' USING ERRCODE='22023'; END IF;
 FOR tenant IN SELECT DISTINCT unnest(p_tenant_ids) ORDER BY 1 LOOP
  tenant_id:=tenant;
  enabled:=(public.workspace_module_snapshot_v1(tenant)->'modules'->>p_module)::boolean;
  RETURN NEXT;
 END LOOP;
END $$;
CREATE FUNCTION public.notification_company_names_v1(p_company_ids uuid[],p_tenant_ids uuid[],p_module text)
RETURNS TABLE(id uuid,tenant_id uuid,name text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE target record; company public.companies;
BEGIN
 IF p_module IS NULL OR p_module NOT IN ('calendar','contracts') OR p_company_ids IS NULL OR p_tenant_ids IS NULL
  OR cardinality(p_company_ids) NOT BETWEEN 1 AND 100 OR cardinality(p_company_ids)<>cardinality(p_tenant_ids)
  OR array_position(p_company_ids,NULL) IS NOT NULL OR array_position(p_tenant_ids,NULL) IS NOT NULL
  OR (SELECT count(DISTINCT value) FROM unnest(p_company_ids) value)<>cardinality(p_company_ids) THEN
  RAISE EXCEPTION 'NOTIFICATION_COMPANY_INPUT' USING ERRCODE='22023'; END IF;
 FOR target IN SELECT * FROM unnest(p_company_ids,p_tenant_ids) AS x(company_id,expected_tenant) LOOP
  IF NOT (public.workspace_module_snapshot_v1(target.expected_tenant)->'modules'->>p_module)::boolean THEN
   RAISE EXCEPTION 'MODULE_DISABLED' USING ERRCODE='BM001'; END IF;
  SELECT * INTO company FROM public.companies c WHERE c.id=target.company_id AND c.tenant_id=target.expected_tenant;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOTIFICATION_COMPANY_SCOPE' USING ERRCODE='42501'; END IF;
  id:=company.id;tenant_id:=company.tenant_id;name:=company.name;RETURN NEXT;
 END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.customer_notification_modules_v1(uuid[],text),public.notification_company_names_v1(uuid[],uuid[],text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.customer_notification_modules_v1(uuid[],text),public.notification_company_names_v1(uuid[],uuid[],text) TO service_role;
DO $$ DECLARE signature text; role_name text; BEGIN
 FOREACH signature IN ARRAY ARRAY['public.customer_notification_modules_v1(uuid[],text)','public.notification_company_names_v1(uuid[],uuid[],text)'] LOOP
  FOREACH role_name IN ARRAY ARRAY['anon','authenticated'] LOOP
   IF has_function_privilege(role_name,signature,'EXECUTE') THEN RAISE EXCEPTION 'NOTIFICATION_PRIVILEGE_DRIFT';END IF;
  END LOOP;
 END LOOP;
END $$;
NOTIFY pgrst,'reload schema';
COMMIT;
