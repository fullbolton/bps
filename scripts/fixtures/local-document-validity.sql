-- TEST ONLY: preserve role-dependent contract update boundary in the dedicated fixture.
BEGIN;
DO $$ BEGIN IF obj_description(to_regclass('public.documents')) IS DISTINCT FROM 'BPS synthetic documents fixture v1' THEN RAISE EXCEPTION 'Refusing non-fixture documents'; END IF; END $$;
DROP POLICY IF EXISTS fixture_document_validity_update ON public.documents;
CREATE POLICY fixture_document_validity_update ON public.documents FOR UPDATE TO authenticated
USING (tenant_id=public.current_user_verified_tenant() AND CASE WHEN contract_id IS NULL THEN public.current_user_role() IN ('yonetici','operasyon','ik') ELSE public.current_user_role()='yonetici' END)
WITH CHECK (tenant_id=public.current_user_verified_tenant() AND CASE WHEN contract_id IS NULL THEN public.current_user_role() IN ('yonetici','operasyon','ik') ELSE public.current_user_role()='yonetici' END);
COMMIT;
