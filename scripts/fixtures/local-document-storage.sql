-- TEST ONLY: real local Storage API, guarded synthetic public fixture.
BEGIN;
DO $$ BEGIN
 IF obj_description(to_regclass('public.documents')) IS DISTINCT FROM 'BPS synthetic documents fixture v1'
 THEN RAISE EXCEPTION 'Refusing non-fixture Storage policy setup'; END IF;
END $$;
CREATE OR REPLACE FUNCTION public.fixture_document_object_scope(p_path text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.companies c WHERE c.id::text=split_part(p_path,'/',1) AND c.tenant_id=public.current_user_verified_tenant())
$$;
REVOKE ALL ON FUNCTION public.fixture_document_object_scope(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fixture_document_object_scope(text) TO authenticated;
DROP POLICY IF EXISTS fixture_document_bucket_read ON storage.objects;
CREATE POLICY fixture_document_bucket_read ON storage.objects FOR SELECT TO authenticated
USING(bucket_id='documents' AND public.current_user_role() IN ('yonetici','operasyon','ik') AND public.fixture_document_object_scope(name));
DROP POLICY IF EXISTS fixture_document_bucket_insert ON storage.objects;
CREATE POLICY fixture_document_bucket_insert ON storage.objects FOR INSERT TO authenticated
WITH CHECK(bucket_id='documents' AND public.current_user_role() IN ('yonetici','operasyon','ik') AND public.fixture_document_object_scope(name));
DROP POLICY IF EXISTS fixture_document_bucket_delete ON storage.objects;
CREATE POLICY fixture_document_bucket_delete ON storage.objects FOR DELETE TO authenticated
USING(bucket_id='documents' AND public.current_user_role()='yonetici' AND public.fixture_document_object_scope(name));
COMMIT;
