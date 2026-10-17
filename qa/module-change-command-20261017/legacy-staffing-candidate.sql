-- LOCAL CANDIDATE. Apply and verify before granting the module-change command.
BEGIN;
SET LOCAL lock_timeout='15s';
LOCK TABLE public.staffing_demands,public.workforce_summary IN ACCESS EXCLUSIVE MODE;
CREATE FUNCTION public.legacy_staffing_write_barrier_v1() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' SET lock_timeout='5s' AS $$
DECLARE tenant uuid;
BEGIN
 IF auth.role()='authenticated' THEN
  tenant:=public.current_user_verified_tenant();
  PERFORM public.workspace_require_module_write_v1(tenant,ARRAY['staffing']);
  PERFORM 1 FROM public.profiles WHERE id=auth.uid() FOR SHARE;
  PERFORM public.workspace_require_module_write_v1(tenant,ARRAY['staffing']);
 END IF;
 RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION public.legacy_staffing_write_barrier_v1() FROM PUBLIC,anon,authenticated,service_role;
-- Statement triggers acquire config before UPDATE/DELETE lock business rows.
CREATE TRIGGER staffing_demands_module_write BEFORE INSERT OR UPDATE OR DELETE ON public.staffing_demands
FOR EACH STATEMENT EXECUTE FUNCTION public.legacy_staffing_write_barrier_v1();
CREATE TRIGGER workforce_summary_module_write BEFORE INSERT OR UPDATE OR DELETE ON public.workforce_summary
FOR EACH STATEMENT EXECUTE FUNCTION public.legacy_staffing_write_barrier_v1();
CREATE POLICY staffing_demands_module_fence ON public.staffing_demands AS RESTRICTIVE FOR ALL TO authenticated
USING (tenant_id=public.current_user_verified_tenant() AND (SELECT public.workspace_module_enabled_v1('staffing')))
WITH CHECK (tenant_id=public.current_user_verified_tenant() AND (SELECT public.workspace_module_enabled_v1('staffing')));
CREATE POLICY workforce_summary_module_fence ON public.workforce_summary AS RESTRICTIVE FOR ALL TO authenticated
USING (tenant_id=public.current_user_verified_tenant() AND (SELECT public.workspace_module_enabled_v1('staffing')))
WITH CHECK (tenant_id=public.current_user_verified_tenant() AND (SELECT public.workspace_module_enabled_v1('staffing')));
COMMIT;
