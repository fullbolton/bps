BEGIN;
SET LOCAL lock_timeout='15s';
-- PDFs are immutable objects. Replacement uses a new reserved path, never an
-- in-place update/move. USING protects the source; CHECK protects the destination.
CREATE POLICY document_storage_immutable ON storage.objects AS RESTRICTIVE FOR UPDATE TO authenticated
 USING(bucket_id<>'documents') WITH CHECK(bucket_id<>'documents');

-- Legacy objects have no upload attempt. They still require metadata deletion
-- and its durable cleanup job before an authenticated Storage delete is allowed.
CREATE POLICY document_storage_cleanup_required ON storage.objects AS RESTRICTIVE FOR DELETE TO authenticated
 USING(bucket_id<>'documents' OR (
  public.document_cleanup_delete_allowed_v1(bucket_id,name)
  AND EXISTS(SELECT FROM public.document_cleanup_jobs j WHERE j.storage_path=name
   AND j.tenant_id=public.current_user_verified_tenant() AND j.completed_at IS NULL)
 ));
NOTIFY pgrst,'reload schema';
COMMIT;
