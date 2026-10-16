BEGIN;
SET LOCAL lock_timeout='15s';
ALTER TABLE public.document_cleanup_jobs ADD COLUMN document_name text;
-- Permanent path tombstones: once queued, a deleted object's path cannot be
-- attached to a new document. Serialize reference creation with enqueue.
CREATE FUNCTION public.document_cleanup_path_guard_v1() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NEW.storage_path IS NULL THEN RETURN NEW;END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(NEW.storage_path,716));
 IF EXISTS(SELECT FROM public.document_cleanup_jobs WHERE storage_path=NEW.storage_path) THEN
  RAISE EXCEPTION 'DOCUMENT_PATH_RETIRED' USING ERRCODE='23514';END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.document_cleanup_path_guard_v1() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER documents_cleanup_path_guard BEFORE INSERT OR UPDATE OF storage_path ON public.documents
 FOR EACH ROW EXECUTE FUNCTION public.document_cleanup_path_guard_v1();
CREATE OR REPLACE FUNCTION public.document_enqueue_cleanup_v1() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF OLD.storage_path IS NOT NULL AND length(OLD.storage_path)>0 THEN
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(OLD.storage_path,716));
  INSERT INTO public.document_cleanup_jobs(document_id,tenant_id,company_id,storage_path,requested_by,document_name)
  VALUES(OLD.id,OLD.tenant_id,OLD.company_id,OLD.storage_path,auth.uid(),OLD.name);
 END IF;
 RETURN OLD;
END $$;
CREATE INDEX document_cleanup_path_idx ON public.document_cleanup_jobs(storage_path);

-- This fence adds no permissive grant. Existing tenant, retained-version and
-- reserved-upload fences still apply to the actual Storage API delete.
CREATE FUNCTION public.document_cleanup_delete_allowed_v1(p_bucket text,p_path text) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF p_bucket<>'documents' OR NOT EXISTS(SELECT FROM public.document_cleanup_jobs WHERE storage_path=p_path) THEN RETURN true;END IF;
 RETURN public.current_user_role()='yonetici'
 AND EXISTS(SELECT FROM public.document_cleanup_jobs WHERE storage_path=p_path AND tenant_id=public.current_user_verified_tenant() AND completed_at IS NULL)
 AND NOT EXISTS(SELECT FROM public.documents WHERE storage_path=p_path)
 AND NOT EXISTS(SELECT FROM public.contract_document_versions WHERE storage_path=p_path);
END $$;
REVOKE ALL ON FUNCTION public.document_cleanup_delete_allowed_v1(text,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.document_cleanup_delete_allowed_v1(text,text) TO authenticated;
CREATE POLICY document_cleanup_delete_fence ON storage.objects AS RESTRICTIVE FOR DELETE TO authenticated
 USING(public.document_cleanup_delete_allowed_v1(bucket_id,name));

CREATE FUNCTION public.document_pending_cleanup_v1(p_tenant uuid,p_offset integer DEFAULT 0)
RETURNS TABLE(document_id uuid,document_name text,company_name text,created_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF p_tenant IS DISTINCT FROM public.current_user_verified_tenant() OR p_tenant IS NULL OR public.current_user_role() IS DISTINCT FROM 'yonetici' THEN
  RAISE EXCEPTION 'DOCUMENT_CLEANUP_SCOPE' USING ERRCODE='42501';END IF;
 IF p_offset IS NULL OR p_offset<0 THEN RAISE EXCEPTION 'OFFSET' USING ERRCODE='22023';END IF;
 RETURN QUERY SELECT j.document_id,j.document_name,c.name,j.created_at FROM public.document_cleanup_jobs j
 LEFT JOIN public.companies c ON c.id=j.company_id AND c.tenant_id=j.tenant_id
 WHERE j.tenant_id=p_tenant AND j.completed_at IS NULL ORDER BY j.created_at,j.document_id LIMIT 51 OFFSET p_offset;
END $$;
CREATE FUNCTION public.document_cleanup_target_v1(p_tenant uuid,p_document_id uuid) RETURNS text
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE path text;
BEGIN
 IF p_tenant IS DISTINCT FROM public.current_user_verified_tenant() OR p_tenant IS NULL OR public.current_user_role() IS DISTINCT FROM 'yonetici' THEN
  RAISE EXCEPTION 'DOCUMENT_CLEANUP_SCOPE' USING ERRCODE='42501';END IF;
 SELECT storage_path INTO path FROM public.document_cleanup_jobs WHERE document_id=p_document_id AND tenant_id=p_tenant;
 IF NOT FOUND THEN RAISE EXCEPTION 'DOCUMENT_CLEANUP_MISSING' USING ERRCODE='42501';END IF;
 RETURN path;
END $$;
REVOKE ALL ON FUNCTION public.document_pending_cleanup_v1(uuid,integer),public.document_cleanup_target_v1(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.document_pending_cleanup_v1(uuid,integer),public.document_cleanup_target_v1(uuid,uuid) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
