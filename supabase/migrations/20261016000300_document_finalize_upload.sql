-- General upload finalizer. Storage metadata is validated, not file bytes.
-- Existing unreserved legacy writes are not cut over in this migration.
BEGIN;
SET LOCAL lock_timeout='15s';
CREATE FUNCTION public.document_finalize_upload_v1(p_tenant uuid,p_id uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' SET lock_timeout='5s' AS $$
DECLARE actor uuid:=auth.uid();attempt public.document_upload_attempts;company uuid;path text;object storage.objects;existing public.documents;
 today date:=(statement_timestamp() AT TIME ZONE 'Europe/Istanbul')::date;label text;
BEGIN
 IF actor IS NULL OR p_tenant IS NULL OR p_tenant IS DISTINCT FROM public.current_user_verified_tenant() THEN RAISE EXCEPTION 'UPLOAD_SCOPE' USING ERRCODE='42501';END IF;
 PERFORM public.workspace_require_module_write_v1(p_tenant,ARRAY['documents']);
 PERFORM 1 FROM public.profiles WHERE id=actor FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'UPLOAD_SCOPE' USING ERRCODE='42501';END IF;
 PERFORM public.workspace_require_module_write_v1(p_tenant,ARRAY['documents']);
 IF public.current_user_verified_tenant() IS DISTINCT FROM p_tenant OR public.current_user_role() IS NULL OR public.current_user_role() NOT IN ('yonetici','operasyon','ik') THEN RAISE EXCEPTION 'UPLOAD_ROLE' USING ERRCODE='42501';END IF;
 SELECT company_id,storage_path INTO company,path FROM public.document_upload_attempts WHERE document_id=p_id AND tenant_id=p_tenant AND actor_id=actor;
 IF NOT FOUND THEN RAISE EXCEPTION 'UPLOAD_ATTEMPT_SCOPE' USING ERRCODE='42501';END IF;
 PERFORM 1 FROM public.companies WHERE id=company AND tenant_id=p_tenant AND status IS DISTINCT FROM 'pasif' FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'UPLOAD_COMPANY' USING ERRCODE='42501';END IF;
 -- Match document path guard lock order before taking the attempt row lock.
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(path,716));
 SELECT * INTO attempt FROM public.document_upload_attempts WHERE document_id=p_id AND tenant_id=p_tenant AND actor_id=actor FOR UPDATE;
 IF NOT FOUND OR attempt.company_id IS DISTINCT FROM company OR attempt.storage_path IS DISTINCT FROM path THEN RAISE EXCEPTION 'UPLOAD_ATTEMPT_CHANGED' USING ERRCODE='PT409';END IF;
 IF attempt.published_at IS NOT NULL THEN
  SELECT * INTO existing FROM public.documents WHERE id=p_id AND tenant_id=p_tenant;
  IF NOT FOUND OR existing.storage_path IS DISTINCT FROM path OR existing.created_by IS DISTINCT FROM actor OR existing.company_id IS DISTINCT FROM company THEN RAISE EXCEPTION 'UPLOAD_RECEIPT_MISSING' USING ERRCODE='23514';END IF;
  RETURN p_id;
 END IF;
 SELECT * INTO object FROM storage.objects WHERE bucket_id='documents' AND name=path FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'UPLOAD_FILE_MISSING' USING ERRCODE='22023';END IF;
 IF object.owner_id IS DISTINCT FROM actor::text OR object.metadata->>'mimetype' IS DISTINCT FROM 'application/pdf'
 OR jsonb_typeof(object.metadata->'size') IS DISTINCT FROM 'number'
 OR (object.metadata->>'size')::numeric IS DISTINCT FROM attempt.file_size::numeric THEN
  RAISE EXCEPTION 'UPLOAD_FILE_METADATA' USING ERRCODE='23514';END IF;
 SELECT display_name INTO label FROM public.profiles WHERE id=actor;
 INSERT INTO public.documents(id,tenant_id,company_id,name,category,validity_date,storage_path,created_by,uploaded_by,status)
 VALUES(p_id,p_tenant,company,attempt.name,attempt.category,attempt.validity_date,path,actor,label,
 CASE WHEN attempt.validity_date IS NULL THEN 'tam' WHEN attempt.validity_date<today THEN 'suresi_doldu' WHEN attempt.validity_date<=today+30 THEN 'suresi_yaklsiyor' ELSE 'tam' END);
 RETURN p_id;
END $$;
REVOKE ALL ON FUNCTION public.document_finalize_upload_v1(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.document_finalize_upload_v1(uuid,uuid) TO authenticated;

-- Reserved upload objects are immutable. Removal is only allowed once metadata
-- deletion has produced a durable cleanup job. Cancellation remains unavailable.
CREATE FUNCTION public.document_upload_object_guard_v1(p_bucket text,p_path text,p_delete boolean) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT CASE WHEN p_bucket<>'documents' OR NOT EXISTS(SELECT FROM public.document_upload_attempts WHERE storage_path=p_path) THEN true
 ELSE p_delete AND EXISTS(SELECT FROM public.document_cleanup_jobs WHERE storage_path=p_path AND completed_at IS NULL AND tenant_id=public.current_user_verified_tenant()) END
$$;
REVOKE ALL ON FUNCTION public.document_upload_object_guard_v1(text,text,boolean) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.document_upload_object_guard_v1(text,text,boolean) TO authenticated;
CREATE POLICY document_upload_update_fence ON storage.objects AS RESTRICTIVE FOR UPDATE TO authenticated
 USING(public.document_upload_object_guard_v1(bucket_id,name,false)) WITH CHECK(public.document_upload_object_guard_v1(bucket_id,name,false));
CREATE POLICY document_upload_delete_fence ON storage.objects AS RESTRICTIVE FOR DELETE TO authenticated
 USING(public.document_upload_object_guard_v1(bucket_id,name,true));
NOTIFY pgrst,'reload schema';
COMMIT;
