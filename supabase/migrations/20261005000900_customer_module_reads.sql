-- M2g: authenticated customer reads only. Not a complete module-disable boundary.
-- Definer/service reads, writes, imports and parent-FK effects require separate gates.
BEGIN;
SET LOCAL lock_timeout='15s';
SET LOCAL statement_timeout='60s';
-- Acquire the final policy DDL locks before catalog checks. Readers wait during apply.
LOCK TABLE public.companies,public.contacts,public.notes IN ACCESS EXCLUSIVE MODE;
DO $$
DECLARE relation regclass;
BEGIN
 IF to_regprocedure('public.workspace_module_enabled_v1(text)') IS NULL
  OR to_regprocedure('public.current_user_verified_tenant()') IS NULL THEN
  RAISE EXCEPTION 'CUSTOMER_MODULE_GUARD_MISSING';
 END IF;
 FOREACH relation IN ARRAY ARRAY['public.companies'::regclass,'public.contacts'::regclass,'public.notes'::regclass] LOOP
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid=relation)
   OR NOT has_table_privilege('authenticated',relation,'SELECT') THEN
   RAISE EXCEPTION 'CUSTOMER_READ_SCHEMA_DRIFT: %',relation;
  END IF;
 END LOOP;
END $$;
-- AND the existing role policies. Neither new access nor a role fallback is introduced.
CREATE POLICY companies_module_read_v1 ON public.companies AS RESTRICTIVE FOR SELECT TO authenticated
 USING(tenant_id=public.current_user_verified_tenant() AND (SELECT public.workspace_module_enabled_v1('customers')));
CREATE POLICY contacts_module_read_v1 ON public.contacts AS RESTRICTIVE FOR SELECT TO authenticated
 USING((SELECT public.workspace_module_enabled_v1('customers')) AND EXISTS(
  SELECT FROM public.companies c WHERE c.id=company_id AND c.tenant_id=public.current_user_verified_tenant()));
CREATE POLICY notes_module_read_v1 ON public.notes AS RESTRICTIVE FOR SELECT TO authenticated
 USING(tenant_id=public.current_user_verified_tenant() AND (SELECT public.workspace_module_enabled_v1('customers')));
COMMIT;
