-- EXPAND before application deployment. Records cleanup in the same transaction
-- as metadata deletion. Does not grant any new Storage permission or run a worker.
BEGIN;
SET LOCAL lock_timeout='15s';
CREATE TABLE public.document_cleanup_jobs (
 document_id uuid PRIMARY KEY,
 tenant_id uuid NOT NULL,
 company_id uuid NOT NULL,
 storage_path text NOT NULL CHECK(length(storage_path)>0),
 requested_by uuid,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 completed_at timestamptz
);
ALTER TABLE public.document_cleanup_jobs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.document_cleanup_jobs FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.document_cleanup_jobs TO authenticated;
CREATE POLICY document_cleanup_manager_read ON public.document_cleanup_jobs FOR SELECT TO authenticated
 USING(tenant_id=public.current_user_verified_tenant() AND public.current_user_role()='yonetici');
CREATE INDEX document_cleanup_pending ON public.document_cleanup_jobs(tenant_id,created_at) WHERE completed_at IS NULL;

CREATE FUNCTION public.document_enqueue_cleanup_v1() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF OLD.storage_path IS NOT NULL AND length(OLD.storage_path)>0 THEN
  INSERT INTO public.document_cleanup_jobs(document_id,tenant_id,company_id,storage_path,requested_by)
  VALUES(OLD.id,OLD.tenant_id,OLD.company_id,OLD.storage_path,auth.uid());
 END IF;
 RETURN OLD;
END $$;
REVOKE ALL ON FUNCTION public.document_enqueue_cleanup_v1() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER documents_enqueue_cleanup AFTER DELETE ON public.documents
 FOR EACH ROW EXECUTE FUNCTION public.document_enqueue_cleanup_v1();

-- The caller's Storage receipt is not trusted. Acknowledge only after the DB
-- catalog also confirms absence. Retain the receipt rather than deleting it.
CREATE FUNCTION public.document_ack_cleanup_v1(p_document_id uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE job public.document_cleanup_jobs;tenant uuid:=public.current_user_verified_tenant();
BEGIN
 IF auth.uid() IS NULL OR tenant IS NULL THEN RAISE EXCEPTION 'DOCUMENT_CLEANUP_SCOPE' USING ERRCODE='42501';END IF;
 PERFORM 1 FROM public.profiles WHERE id=auth.uid() FOR SHARE;
 IF NOT FOUND OR public.current_user_verified_tenant() IS DISTINCT FROM tenant OR public.current_user_role() IS DISTINCT FROM 'yonetici' THEN
  RAISE EXCEPTION 'DOCUMENT_CLEANUP_ROLE' USING ERRCODE='42501';END IF;
 SELECT * INTO job FROM public.document_cleanup_jobs WHERE document_id=p_document_id AND tenant_id=tenant FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'DOCUMENT_CLEANUP_NOT_FOUND' USING ERRCODE='42501';END IF;
 IF EXISTS(SELECT FROM storage.objects WHERE bucket_id='documents' AND name=job.storage_path)
 OR EXISTS(SELECT FROM public.documents WHERE storage_path=job.storage_path)
 OR EXISTS(SELECT FROM public.contract_document_versions WHERE storage_path=job.storage_path) THEN
  RETURN false;
 END IF;
 UPDATE public.document_cleanup_jobs SET completed_at=COALESCE(completed_at,clock_timestamp()) WHERE document_id=p_document_id;
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.document_ack_cleanup_v1(uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.document_ack_cleanup_v1(uuid) TO authenticated;
COMMENT ON TABLE public.document_cleanup_jobs IS 'Durable deletion cleanup receipts; manager-only tenant-scoped read. No worker or new Storage grants. Pending jobs must block module-disable cutover.';
NOTIFY pgrst,'reload schema';
COMMIT;
