-- Only a trusted server verifier can attest downloaded bytes. No bucket or
-- upload policy is enabled here. SQL metadata alone never proves file content.
BEGIN;
CREATE TABLE public.hr_document_verifications (
 upload_id uuid PRIMARY KEY REFERENCES public.hr_document_uploads(id),
 object_id uuid NOT NULL UNIQUE,object_version text NOT NULL,
 verified_sha256 text NOT NULL CHECK(verified_sha256 ~ '^[a-f0-9]{64}$'),
 verified_size bigint NOT NULL CHECK(verified_size BETWEEN 5 AND 10485760),
 verified_at timestamptz NOT NULL DEFAULT statement_timestamp()
);
ALTER TABLE public.hr_document_verifications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.hr_document_verifications FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.hr_document_attest_v1(p_tenant uuid,p_actor uuid,p_upload uuid,p_object uuid,p_version text,p_size bigint,p_sha256 text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' SET lock_timeout='5s' AS $$
DECLARE attempt public.hr_document_uploads;obj storage.objects;previous public.hr_document_verifications;
BEGIN
 IF current_setting('transaction_isolation')<>'read committed' THEN RAISE EXCEPTION 'ACCESS_ISOLATION';END IF;
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'HR_VERIFIER_REQUIRED';END IF;
 PERFORM 1 FROM public.tenant_module_config WHERE tenant_id=p_tenant FOR UPDATE;
 SELECT * INTO attempt FROM public.hr_document_uploads WHERE id=p_upload AND tenant_id=p_tenant AND actor_id=p_actor FOR UPDATE;
 IF NOT FOUND OR attempt.state='cancelled' THEN RAISE EXCEPTION 'HR_UPLOAD_UNAVAILABLE';END IF;
 IF p_size IS DISTINCT FROM attempt.file_size OR p_sha256 IS DISTINCT FROM attempt.content_sha256 OR p_version IS NULL OR p_version='' THEN RAISE EXCEPTION 'HR_UPLOAD_CONTENT';END IF;
 SELECT * INTO obj FROM storage.objects WHERE bucket_id='hr-private' AND name=p_tenant::text||'/'||p_upload::text||'.pdf' FOR SHARE;
 IF NOT FOUND OR obj.id IS DISTINCT FROM p_object OR obj.version IS DISTINCT FROM p_version
 OR obj.owner_id IS DISTINCT FROM p_actor::text OR obj.metadata->>'mimetype' IS DISTINCT FROM 'application/pdf'
 OR jsonb_typeof(obj.metadata->'size') IS DISTINCT FROM 'number'
 OR (obj.metadata->>'size')::numeric IS DISTINCT FROM p_size::numeric THEN RAISE EXCEPTION 'HR_UPLOAD_OBJECT';END IF;
 SELECT * INTO previous FROM public.hr_document_verifications WHERE upload_id=p_upload;
 IF FOUND THEN
  IF previous.object_id IS DISTINCT FROM p_object OR previous.object_version IS DISTINCT FROM p_version OR previous.verified_sha256 IS DISTINCT FROM p_sha256 OR previous.verified_size IS DISTINCT FROM p_size THEN RAISE EXCEPTION 'HR_UPLOAD_VERIFICATION_CHANGED';END IF;
  RETURN;
 END IF;
 INSERT INTO public.hr_document_verifications(upload_id,object_id,object_version,verified_sha256,verified_size) VALUES(p_upload,p_object,p_version,p_sha256,p_size);
END $$;
CREATE FUNCTION public.hr_document_finish_v1(p_actor uuid,p_tenant uuid,p_upload uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' SET lock_timeout='5s' AS $$
DECLARE attempt public.hr_document_uploads;verification public.hr_document_verifications;obj storage.objects;path text;
BEGIN
 IF current_setting('transaction_isolation')<>'read committed' THEN RAISE EXCEPTION 'ACCESS_ISOLATION';END IF;
 PERFORM public.hr_access_mode_v1(p_actor,p_tenant);
 PERFORM 1 FROM public.tenant_module_config WHERE tenant_id=p_tenant FOR UPDATE;
 PERFORM 1 FROM public.profiles WHERE id=p_actor FOR SHARE;
 PERFORM 1 FROM public.tenants WHERE id=p_tenant FOR UPDATE;
 PERFORM 1 FROM public.tenant_memberships WHERE tenant_id=p_tenant AND user_id=p_actor FOR SHARE;
 SELECT * INTO attempt FROM public.hr_document_uploads WHERE id=p_upload AND tenant_id=p_tenant AND actor_id=p_actor FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'HR_FORBIDDEN';END IF;
 PERFORM public.hr_private_document_access_v1(p_actor,p_tenant,attempt.employee_id,true);
 IF attempt.state='cancelled' THEN RAISE EXCEPTION 'HR_UPLOAD_CANCELLED';END IF;
 path:=p_tenant::text||'/'||p_upload::text||'.pdf';
 SELECT * INTO verification FROM public.hr_document_verifications WHERE upload_id=p_upload;
 IF NOT FOUND THEN RAISE EXCEPTION 'HR_UPLOAD_NOT_VERIFIED';END IF;
 SELECT * INTO obj FROM storage.objects WHERE bucket_id='hr-private' AND name=path FOR SHARE;
 IF NOT FOUND OR obj.id IS DISTINCT FROM verification.object_id OR obj.version IS DISTINCT FROM verification.object_version
 OR obj.owner_id IS DISTINCT FROM p_actor::text OR obj.metadata->>'mimetype' IS DISTINCT FROM 'application/pdf'
 OR jsonb_typeof(obj.metadata->'size') IS DISTINCT FROM 'number'
 OR (obj.metadata->>'size')::numeric IS DISTINCT FROM verification.verified_size::numeric
 OR attempt.file_size IS DISTINCT FROM verification.verified_size OR attempt.content_sha256 IS DISTINCT FROM verification.verified_sha256 THEN RAISE EXCEPTION 'HR_UPLOAD_OBJECT';END IF;
 IF attempt.state='pending' THEN
  INSERT INTO public.hr_private_documents(id,tenant_id,employee_id,employment_id,title,storage_path,file_size,content_sha256,validity_date,created_by)
  VALUES(attempt.id,p_tenant,attempt.employee_id,attempt.employment_id,attempt.title,path,attempt.file_size,attempt.content_sha256,attempt.validity_date,p_actor);
  UPDATE public.hr_document_uploads SET state='published' WHERE id=p_upload;
 END IF;
 RETURN jsonb_build_object('schemaVersion',1,'actorId',p_actor,'tenantId',p_tenant,'employeeId',attempt.employee_id,'employmentId',attempt.employment_id,'id',attempt.id,'title',attempt.title,'size',attempt.file_size,'sha256',attempt.content_sha256,'validityDate',attempt.validity_date,'state','published');
END $$;
-- The user-scoped read supplies the exact object version before server readback.
CREATE FUNCTION public.hr_document_verification_context_v1(p_actor uuid,p_tenant uuid,p_upload uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE attempt public.hr_document_uploads;obj storage.objects;path text;
BEGIN
 PERFORM public.hr_access_mode_v1(p_actor,p_tenant);
 SELECT * INTO attempt FROM public.hr_document_uploads WHERE id=p_upload AND tenant_id=p_tenant AND actor_id=p_actor;
 IF NOT FOUND THEN RAISE EXCEPTION 'HR_FORBIDDEN';END IF;
 PERFORM public.hr_private_document_access_v1(p_actor,p_tenant,attempt.employee_id,true);
 IF attempt.state='cancelled' THEN RAISE EXCEPTION 'HR_UPLOAD_CANCELLED';END IF;
 path:=p_tenant::text||'/'||p_upload::text||'.pdf';
 SELECT * INTO obj FROM storage.objects WHERE bucket_id='hr-private' AND name=path;
 IF NOT FOUND OR obj.version IS NULL OR obj.version='' OR obj.owner_id IS DISTINCT FROM p_actor::text THEN RAISE EXCEPTION 'HR_UPLOAD_OBJECT';END IF;
 RETURN jsonb_build_object('schemaVersion',1,'actorId',p_actor,'tenantId',p_tenant,'employeeId',attempt.employee_id,'employmentId',attempt.employment_id,'id',attempt.id,'title',attempt.title,'size',attempt.file_size,'sha256',attempt.content_sha256,'validityDate',attempt.validity_date,'state',attempt.state,'objectId',obj.id,'objectVersion',obj.version,'path',path);
END $$;
REVOKE ALL ON FUNCTION public.hr_document_verification_context_v1(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.hr_document_verification_context_v1(uuid,uuid,uuid) TO authenticated;
-- Verified bytes must not be replaced between server readback and publication.
-- Object deletion remains closed until a separate cleanup protocol is installed.
CREATE FUNCTION public.hr_verified_object_guard_v1() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF OLD.bucket_id='hr-private' AND EXISTS(SELECT FROM public.hr_document_verifications WHERE object_id=OLD.id) THEN
  RAISE EXCEPTION 'HR_VERIFIED_OBJECT_IMMUTABLE';
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD;END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER hr_verified_object_guard BEFORE UPDATE OR DELETE ON storage.objects FOR EACH ROW EXECUTE FUNCTION public.hr_verified_object_guard_v1();
REVOKE ALL ON FUNCTION public.hr_document_attest_v1(uuid,uuid,uuid,uuid,text,bigint,text),public.hr_document_finish_v1(uuid,uuid,uuid),public.hr_verified_object_guard_v1() FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.hr_document_attest_v1(uuid,uuid,uuid,uuid,text,bigint,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.hr_document_finish_v1(uuid,uuid,uuid) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
