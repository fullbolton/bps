BEGIN; SET LOCAL statement_timeout='60s'; SET LOCAL lock_timeout='5s';
LOCK TABLE supabase_migrations.schema_migrations IN EXCLUSIVE MODE;
DO $guard$ BEGIN
IF (SELECT array_agg(version ORDER BY version) FROM supabase_migrations.schema_migrations) IS DISTINCT FROM ARRAY['20260407000000','20260407000100','20260407000200','20260407000300','20260407000400','20260407000500','20260407000600','20260407000700','20260407000800','20260407000900','20260407001000','20260407001100','20260407001600','20260407001700','20260407001800','20260413000100','20260414000100','20260414000200','20260415000100','20260415000200','20260415000300','20260415000400','20260415000500','20260423000100','20260425000100','20260425000200','20260713000100','20260713000200','20260722000100','20260810000100','20260810000200','20260827000100','20260827000200','20260827000300','20260827000400','20260904000100','20260904000200','20260909000100','20260909000200','20260909000300','20260909000400','20260909000500','20260909000600','20260909000700','20260909000800','20260909000900','20260909001000','20260909001100','20260909001200','20260909001300','20260909001400','20260909001500','20260909001600','20260909001700','20260909001800','20260909001900','20260909002000','20260909002100','20260909002200','20260909002300','20260909002400','20260909002500','20260909002600','20260909002700','20260909002800','20260909002900','20260910000100','20260910000200','20260910000300','20260910000400','20260911000100','20260913000100','20260914000100','20260914000200','20260914000300','20260914000400','20260914000500','20260914000600','20260914000700','20260915000100','20260915000200','20260915000300','20260915000400','20260915000500','20260915000600','20260915000700','20260915000800','20260915000900','20260915001000','20260923000100','20260923000200','20260923000300','20260923000400','20260924000100','20260924000200','20260924000300','20260924000400','20260924000500','20260925000100','20260925000200','20260925000300','20260925000400','20260925000500','20260925000600','20260925000700','20260926000100','20260926000200','20260927000100','20260927000200','20260927000300','20260927000400','20260927000500','20260927000600','20260927000700','20260927000800','20260927000900','20260928000100','20260928000200','20260928000300','20260928000400','20260928000500','20260928000600','20260928000700','20260928000800','20261004001000','20261004001100','20261004001200','20261004001300','20261004001400','20261005000100','20261005000200','20261005000300','20261005000400','20261005000500','20261005000600','20261005000700','20261005000800','20261005000900','20261005001000','20261005001100','20261005001200','20261005001300','20261005001400','20261005001500','20261005001600','20261005001700','20261005001800','20261005001900','20261005002000','20261005002100','20261005002200','20261005002300','20261005002400','20261005002500','20261005002600','20261005002700','20261005002800','20261005002900','20261005003000','20261005003100','20261013000100','20261013000200','20261013000300','20261015000100','20261015000200','20261015000300','20261015000400','20261015000500','20261015000600','20261015000700','20261015000800','20261016000100','20261016000200','20261016000300','20261016000400','20261016000500','20261016000600','20261016000700','20261016000800','20261016000900','20261016001000','20261016001100','20261017000100','20261017000200','20261018000100','20261018000200','20261018000300','20261018000400','20261018000500','20261018000600','20261019000100','20261019000200','20261019000300','20261019000400','20261019000500','20261019000600','20261019000700','20261019000800','20261019000900','20261019001000','20261019001100','20261019001200','20261019001300','20261019001400','20261019001500','20261019001600','20261019001700','20261019001800','20261019001900','20261019002000','20261019002100','20261019002200','20261019002300','20261019002400']::text[] THEN RAISE EXCEPTION 'LIVE_LEDGER_CHANGED'; END IF;
IF to_regnamespace('bps_release_guard') IS NOT NULL THEN RAISE EXCEPTION 'RELEASE_BARRIER_PRESENT'; END IF;
END $guard$;
-- Only a trusted server verifier can attest downloaded bytes. No bucket or
-- upload policy is enabled here. SQL metadata alone never proves file content.

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

INSERT INTO supabase_migrations.schema_migrations(version,name,statements) VALUES('20261019002500','hr_document_verified_finalize',ARRAY[$bps_source$-- Only a trusted server verifier can attest downloaded bytes. No bucket or
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
$bps_source$]);
COMMIT;
