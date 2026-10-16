-- Retire cancelled paths permanently; deletion stays in the manager cleanup queue.
BEGIN;
SET LOCAL lock_timeout='15s';
CREATE FUNCTION public.document_cancel_upload_v1(p_tenant uuid,p_id uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' SET lock_timeout='5s' AS $$
DECLARE actor uuid:=auth.uid();a public.document_upload_attempts;path text;
BEGIN
 IF actor IS NULL OR p_tenant IS NULL OR p_tenant IS DISTINCT FROM public.current_user_verified_tenant() THEN RAISE EXCEPTION 'UPLOAD_SCOPE' USING ERRCODE='42501';END IF;
 PERFORM public.workspace_require_module_write_v1(p_tenant,ARRAY['documents']);
 PERFORM 1 FROM public.profiles WHERE id=actor FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'UPLOAD_SCOPE' USING ERRCODE='42501';END IF;
 PERFORM public.workspace_require_module_write_v1(p_tenant,ARRAY['documents']);
 IF public.current_user_verified_tenant() IS DISTINCT FROM p_tenant OR public.current_user_role() IS NULL OR public.current_user_role() NOT IN ('yonetici','operasyon','ik') THEN RAISE EXCEPTION 'UPLOAD_SCOPE' USING ERRCODE='42501';END IF;
 SELECT storage_path INTO path FROM public.document_upload_attempts WHERE document_id=p_id AND tenant_id=p_tenant AND actor_id=actor;
 IF NOT FOUND THEN RAISE EXCEPTION 'UPLOAD_ATTEMPT_SCOPE' USING ERRCODE='42501';END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(path,716));
 SELECT * INTO a FROM public.document_upload_attempts WHERE document_id=p_id AND tenant_id=p_tenant AND actor_id=actor FOR UPDATE;
 IF NOT FOUND OR a.storage_path IS DISTINCT FROM path THEN RAISE EXCEPTION 'UPLOAD_ATTEMPT_CHANGED' USING ERRCODE='PT409';END IF;
 IF a.published_at IS NOT NULL OR EXISTS(SELECT FROM public.documents WHERE id=p_id OR storage_path=path)
 OR EXISTS(SELECT FROM public.contract_document_versions WHERE storage_path=path) THEN RAISE EXCEPTION 'UPLOAD_ALREADY_PUBLISHED' USING ERRCODE='23514';END IF;
 INSERT INTO public.document_cleanup_jobs(document_id,tenant_id,company_id,storage_path,requested_by,document_name)
 VALUES(p_id,p_tenant,a.company_id,path,actor,a.name) ON CONFLICT(document_id) DO NOTHING;
 IF NOT EXISTS(SELECT FROM public.document_cleanup_jobs WHERE document_id=p_id AND tenant_id=p_tenant AND storage_path=path) THEN RAISE EXCEPTION 'UPLOAD_CANCEL_CONFLICT' USING ERRCODE='23514';END IF;
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.document_cancel_upload_v1(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.document_cancel_upload_v1(uuid,uuid) TO authenticated;

-- Volatile trigger re-reads committed tombstones after acquiring the path lock.
CREATE FUNCTION public.document_storage_retired_path_v1() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NEW.bucket_id<>'documents' THEN RETURN NEW;END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(NEW.name,716));
 IF EXISTS(SELECT FROM public.document_cleanup_jobs WHERE storage_path=NEW.name) THEN
  RAISE EXCEPTION 'DOCUMENT_PATH_RETIRED' USING ERRCODE='23514';END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.document_storage_retired_path_v1() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER document_storage_retired_path BEFORE INSERT ON storage.objects
 FOR EACH ROW EXECUTE FUNCTION public.document_storage_retired_path_v1();

-- Cancelled attempts leave the upload inventory; cleanup remains a separate blocker.
DO $patch$
DECLARE f regprocedure;definition text;anchor text;replacement text;
BEGIN
 f:=to_regprocedure('public.document_pending_uploads_v1(uuid,integer)');
 anchor:='a.published_at IS NULL AND';
 replacement:='a.published_at IS NULL AND NOT EXISTS(SELECT FROM public.document_cleanup_jobs j WHERE j.storage_path=a.storage_path) AND';
 IF f IS NULL THEN RAISE EXCEPTION 'UPLOAD_LIST_MISSING';END IF;
 definition:=pg_get_functiondef(f);
 IF (length(definition)-length(replace(definition,anchor,'')))/length(anchor)<>1 THEN RAISE EXCEPTION 'UPLOAD_LIST_ANCHOR';END IF;
 EXECUTE replace(definition,anchor,replacement);
 f:=to_regprocedure('public.preview_workspace_modules_v1(uuid,uuid,text,jsonb)');
 anchor:='SELECT EXISTS(SELECT FROM public.document_upload_attempts WHERE tenant_id=tenant AND published_at IS NULL) INTO present;';
 replacement:='SELECT EXISTS(SELECT FROM public.document_upload_attempts a WHERE a.tenant_id=tenant AND a.published_at IS NULL AND NOT EXISTS(SELECT FROM public.document_cleanup_jobs j WHERE j.storage_path=a.storage_path)) INTO present;';
 IF f IS NULL THEN RAISE EXCEPTION 'MODULE_PREVIEW_MISSING';END IF;
 definition:=pg_get_functiondef(f);
 IF (length(definition)-length(replace(definition,anchor,'')))/length(anchor)<>1 THEN RAISE EXCEPTION 'MODULE_PREVIEW_ANCHOR';END IF;
 EXECUTE replace(definition,anchor,replacement);
END $patch$;
NOTIFY pgrst,'reload schema';
COMMIT;
