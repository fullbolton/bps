-- Independent Fable 03 security patch; does not depend on the module-selection branch.
BEGIN;
SET LOCAL lock_timeout='15s';
LOCK TABLE public.demo_requests,public.critical_dates IN ACCESS EXCLUSIVE MODE;
DO $$
BEGIN
 IF to_regprocedure('public.is_platform_admin()') IS NULL OR to_regprocedure('public.current_user_verified_tenant()') IS NULL THEN RAISE EXCEPTION 'SECURITY_BOUNDARY_HELPER_MISSING';END IF;
 IF NOT EXISTS(SELECT FROM pg_attribute WHERE attrelid='public.critical_dates'::regclass AND attname='tenant_id' AND atttypid='uuid'::regtype AND attnotnull AND NOT attisdropped)
 OR NOT EXISTS(SELECT FROM pg_attribute WHERE attrelid='public.critical_dates'::regclass AND attname='created_by' AND atttypid='uuid'::regtype AND NOT attisdropped) THEN RAISE EXCEPTION 'CRITICAL_DATE_SCHEMA_DRIFT';END IF;
END $$;
ALTER TABLE public.demo_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.demo_requests FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.demo_requests TO authenticated;
-- Public intake is server-side. Do not grant browser insertion or admin mutation.
GRANT INSERT ON public.demo_requests TO service_role;
DROP POLICY IF EXISTS demo_requests_select ON public.demo_requests;
CREATE POLICY demo_requests_platform_select ON public.demo_requests FOR SELECT TO authenticated USING(public.is_platform_admin());
CREATE POLICY demo_requests_platform_fence ON public.demo_requests AS RESTRICTIVE FOR ALL TO authenticated
 USING(public.is_platform_admin()) WITH CHECK(public.is_platform_admin());

ALTER TABLE public.critical_dates ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.critical_dates FROM PUBLIC,anon;
DROP POLICY IF EXISTS critical_dates_insert ON public.critical_dates;
DROP POLICY IF EXISTS critical_dates_update ON public.critical_dates;
DROP POLICY IF EXISTS critical_dates_delete ON public.critical_dates;
CREATE POLICY critical_dates_insert ON public.critical_dates FOR INSERT TO authenticated
 WITH CHECK(public.current_user_role()='yonetici' AND tenant_id=public.current_user_verified_tenant() AND created_by=auth.uid());
CREATE POLICY critical_dates_update ON public.critical_dates FOR UPDATE TO authenticated
 USING(public.current_user_role()='yonetici' AND tenant_id=public.current_user_verified_tenant())
 WITH CHECK(public.current_user_role()='yonetici' AND tenant_id=public.current_user_verified_tenant());
CREATE POLICY critical_dates_delete ON public.critical_dates FOR DELETE TO authenticated
 USING(public.current_user_role()='yonetici' AND tenant_id=public.current_user_verified_tenant());
-- Additional permissive policies must not widen tenant, writer-role or author checks.
CREATE POLICY critical_dates_tenant_fence ON public.critical_dates AS RESTRICTIVE FOR ALL TO authenticated
 USING(tenant_id=public.current_user_verified_tenant()) WITH CHECK(tenant_id=public.current_user_verified_tenant());
CREATE POLICY critical_dates_insert_fence ON public.critical_dates AS RESTRICTIVE FOR INSERT TO authenticated
 WITH CHECK(public.current_user_role()='yonetici' AND created_by=auth.uid());
CREATE POLICY critical_dates_update_fence ON public.critical_dates AS RESTRICTIVE FOR UPDATE TO authenticated
 USING(public.current_user_role()='yonetici') WITH CHECK(public.current_user_role()='yonetici');
CREATE POLICY critical_dates_delete_fence ON public.critical_dates AS RESTRICTIVE FOR DELETE TO authenticated
 USING(public.current_user_role()='yonetici');
CREATE FUNCTION public.critical_dates_preserve_identity() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF NEW.tenant_id IS DISTINCT FROM OLD.tenant_id OR NEW.created_by IS DISTINCT FROM OLD.created_by THEN
  RAISE EXCEPTION 'CRITICAL_DATE_IDENTITY_IMMUTABLE' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.critical_dates_preserve_identity() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER critical_dates_preserve_identity BEFORE UPDATE ON public.critical_dates
 FOR EACH ROW EXECUTE FUNCTION public.critical_dates_preserve_identity();
NOTIFY pgrst,'reload schema';
COMMIT;
