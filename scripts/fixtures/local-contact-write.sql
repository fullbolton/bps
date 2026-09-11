-- Synthetic contact form acceptance only. Product contacts has no tenant_id;
-- this existing fixture-only column is populated from the verified test session.
BEGIN;
SET LOCAL lock_timeout='5s';
DO $$ BEGIN
 IF obj_description(to_regclass('public.contacts')) IS DISTINCT FROM 'BPS synthetic contacts fixture v1'
 THEN RAISE EXCEPTION 'Requires dedicated synthetic contacts'; END IF;
END $$;
ALTER TABLE public.contacts ALTER COLUMN tenant_id SET DEFAULT public.current_user_verified_tenant();
DROP POLICY IF EXISTS contacts_feedback_insert ON public.contacts;
CREATE POLICY contacts_feedback_insert ON public.contacts FOR INSERT TO authenticated
 WITH CHECK(tenant_id=public.current_user_verified_tenant() AND public.current_user_role()='yonetici'
 AND EXISTS(SELECT 1 FROM public.companies c WHERE c.id=company_id AND c.tenant_id=public.current_user_verified_tenant()));
DROP POLICY IF EXISTS contacts_feedback_update ON public.contacts;
CREATE POLICY contacts_feedback_update ON public.contacts FOR UPDATE TO authenticated
 USING(tenant_id=public.current_user_verified_tenant() AND public.current_user_role() IN ('yonetici','operasyon'))
 WITH CHECK(tenant_id=public.current_user_verified_tenant() AND public.current_user_role() IN ('yonetici','operasyon'));
GRANT INSERT,UPDATE ON public.contacts TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
