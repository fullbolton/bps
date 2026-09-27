-- Global intake belongs to platform administration, never a tenant manager.
BEGIN;
SET LOCAL lock_timeout='15s';
LOCK TABLE public.access_requests IN ACCESS EXCLUSIVE MODE;
ALTER TABLE public.access_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.access_requests FROM PUBLIC,anon,authenticated;
GRANT SELECT,UPDATE ON public.access_requests TO authenticated;

DROP POLICY IF EXISTS yonetici_select_access_requests ON public.access_requests;
DROP POLICY IF EXISTS yonetici_update_access_requests ON public.access_requests;
CREATE POLICY platform_select_access_requests ON public.access_requests
 FOR SELECT TO authenticated USING (public.is_platform_admin());
CREATE POLICY platform_update_access_requests ON public.access_requests
 FOR UPDATE TO authenticated USING (public.is_platform_admin())
 WITH CHECK (public.is_platform_admin());
-- Restrictive fence also covers any older permissive policy from the bootstrap.
CREATE POLICY access_requests_platform_fence ON public.access_requests
 AS RESTRICTIVE FOR ALL TO authenticated
 USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());
COMMENT ON POLICY access_requests_platform_fence ON public.access_requests
 IS 'Global intake is platform-only. Public submission remains server-side service-role.';
NOTIFY pgrst,'reload schema';
COMMIT;
