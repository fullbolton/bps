-- TEST ONLY: complete the existing manager fixture with the shipped upload roles.
BEGIN;
DO $$ BEGIN
 IF obj_description(to_regclass('public.documents')) IS DISTINCT FROM 'BPS synthetic documents fixture v1'
 THEN RAISE EXCEPTION 'Refusing non-fixture document upload setup'; END IF;
END $$;
DROP POLICY IF EXISTS fixture_company_document_insert ON public.documents;
CREATE POLICY fixture_company_document_insert ON public.documents FOR INSERT TO authenticated
WITH CHECK (
 tenant_id=public.current_user_verified_tenant()
 AND created_by=auth.uid()
 AND CASE WHEN contract_id IS NULL THEN public.current_user_role() IN ('yonetici','operasyon','ik') ELSE public.current_user_role()='yonetici' END
 AND EXISTS (SELECT 1 FROM public.companies c WHERE c.id=company_id AND c.tenant_id=public.current_user_verified_tenant())
);
COMMIT;
