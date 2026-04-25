-- ==========================================================================
-- BPS — documents read boundary alignment with ROLE_MATRIX §4:307
-- ==========================================================================
-- ROLE_MATRIX.md §4 row 307 ("Evrak görüntüleme") states:
--   yönetici=Evet  partner=Portföyünde Evet  operasyon=Evet  ik=Evet
--   muhasebe=Hayır  görüntüleyici=Hayır
--
-- Two existing SELECT policies allowed muhasebe + görüntüleyici against
-- the source-of-truth:
--   1) public.documents > documents_select
--      (created in 20260407001000_create_documents.sql)
--   2) storage.objects > documents_bucket_select
--      (created in 20260423000100_documents_storage_policies.sql,
--       which inherited the original drift by mirroring (1))
--
-- This migration drops + recreates both SELECT policies with the role
-- list trimmed to ('yonetici', 'operasyon', 'ik') plus the existing
-- partner scope branch (unchanged). INSERT, UPDATE, DELETE policies on
-- both surfaces are untouched. Path-format CASE guard in the storage
-- policy is preserved verbatim.
-- ==========================================================================

DROP POLICY IF EXISTS documents_select ON public.documents;

CREATE POLICY documents_select ON public.documents
  FOR SELECT USING (
    public.current_user_role() IN ('yonetici', 'operasyon', 'ik')
    OR (
      public.current_user_role() = 'partner'
      AND public.current_user_has_company_scope(company_id)
    )
  );

DROP POLICY IF EXISTS documents_bucket_select ON storage.objects;

CREATE POLICY documents_bucket_select ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'documents'
    AND (
      public.current_user_role() IN ('yonetici', 'operasyon', 'ik')
      OR (
        public.current_user_role() = 'partner'
        AND CASE
          WHEN name ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[^/]+$'
            THEN public.current_user_has_company_scope(
              (split_part(name, '/', 1))::uuid
            )
          ELSE false
        END
      )
    )
  );
