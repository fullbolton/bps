-- Expand before the task-screen frontend. Narrow projection, existing company RLS retained.
BEGIN;
SET LOCAL lock_timeout='15s';
CREATE FUNCTION public.task_company_choices_v1()
RETURNS TABLE(id uuid,tenant_id uuid,legacy_mock_id text,name text,status text)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT c.id,c.tenant_id,c.legacy_mock_id,c.name,c.status
 FROM public.companies c
 WHERE c.tenant_id=public.current_user_verified_tenant()
 AND (SELECT public.workspace_module_enabled_v1('tasks'))
 AND (SELECT public.workspace_module_enabled_v1('customers'))
 AND (SELECT public.current_user_role()) IN ('yonetici','operasyon','ik')
$$;
REVOKE ALL ON FUNCTION public.task_company_choices_v1() FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.task_company_choices_v1() TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
