-- ==========================================================================
-- BPS Document Storage Foundation V1.1 — storage.objects policies
-- ==========================================================================
-- Mirrors the row-level security posture of public.documents onto
-- storage.objects, scoped strictly to the 'documents' bucket.
--
-- Authorization matches the documents table:
--   SELECT: yonetici, operasyon, ik, muhasebe, goruntuleyici (all);
--           partner restricted to assigned company scope.
--   INSERT: yonetici, operasyon, ik; partner restricted to scope.
--   DELETE: yonetici only.
--
-- Path convention: {company_id}/{uuid}.pdf
-- The leading path segment is the company UUID; the partner scope check
-- derives it via split_part + ::uuid cast. The regex test sits inside a
-- CASE expression so the guard is deterministic — the cast is reached
-- only when the regex branch matches, regardless of planner ordering.
-- Malformed paths return false from the CASE and the partner branch
-- fails closed without the cast ever running.
--
-- Bucket (documents, private, 10 MB, application/pdf only) is created
-- manually in the Supabase dashboard; this migration only adds the
-- row-level policies on storage.objects. No UPDATE policy is added:
-- object replacement is not a supported action in this batch, so
-- UPDATE is implicitly denied to all non-service_role clients.
-- ==========================================================================

CREATE POLICY documents_bucket_select ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'documents'
    AND (
      public.current_user_role() IN (
        'yonetici', 'operasyon', 'ik', 'muhasebe', 'goruntuleyici'
      )
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

CREATE POLICY documents_bucket_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
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

CREATE POLICY documents_bucket_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'documents'
    AND public.current_user_role() = 'yonetici'
  );
