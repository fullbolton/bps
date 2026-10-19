BEGIN; SET LOCAL statement_timeout='60s'; SET LOCAL lock_timeout='5s';
LOCK TABLE supabase_migrations.schema_migrations IN EXCLUSIVE MODE;
DO $guard$ BEGIN
IF (SELECT array_agg(version ORDER BY version) FROM supabase_migrations.schema_migrations) IS DISTINCT FROM ARRAY['20260407000000','20260407000100','20260407000200','20260407000300','20260407000400','20260407000500','20260407000600','20260407000700','20260407000800','20260407000900','20260407001000','20260407001100','20260407001600','20260407001700','20260407001800','20260413000100','20260414000100','20260414000200','20260415000100','20260415000200','20260415000300','20260415000400','20260415000500','20260423000100','20260425000100','20260425000200','20260713000100','20260713000200','20260722000100','20260810000100','20260810000200','20260827000100','20260827000200','20260827000300','20260827000400','20260904000100','20260904000200','20260909000100','20260909000200','20260909000300','20260909000400','20260909000500','20260909000600','20260909000700','20260909000800','20260909000900','20260909001000','20260909001100','20260909001200','20260909001300','20260909001400','20260909001500','20260909001600','20260909001700','20260909001800','20260909001900','20260909002000','20260909002100','20260909002200','20260909002300','20260909002400','20260909002500','20260909002600','20260909002700','20260909002800','20260909002900','20260910000100','20260910000200','20260910000300','20260910000400','20260911000100','20260913000100','20260914000100','20260914000200','20260914000300','20260914000400','20260914000500','20260914000600','20260914000700','20260915000100','20260915000200','20260915000300','20260915000400','20260915000500','20260915000600','20260915000700','20260915000800','20260915000900','20260915001000','20260923000100','20260923000200','20260923000300','20260923000400','20260924000100','20260924000200','20260924000300','20260924000400','20260924000500','20260925000100','20260925000200','20260925000300','20260925000400','20260925000500','20260925000600','20260925000700','20260926000100','20260926000200','20260927000100','20260927000200','20260927000300','20260927000400','20260927000500','20260927000600','20260927000700','20260927000800','20260927000900','20260928000100','20260928000200','20260928000300','20260928000400','20260928000500','20260928000600','20260928000700','20260928000800','20261004001000','20261004001100','20261004001200','20261004001300','20261004001400','20261005000100','20261005000200','20261005000300','20261005000400','20261005000500','20261005000600','20261005000700','20261005000800','20261005000900','20261005001000','20261005001100','20261005001200','20261005001300','20261005001400','20261005001500','20261005001600','20261005001700','20261005001800','20261005001900','20261005002000','20261005002100','20261005002200','20261005002300','20261005002400','20261005002500','20261005002600','20261005002700','20261005002800','20261005002900','20261005003000','20261005003100','20261013000100','20261013000200','20261013000300','20261015000100','20261015000200','20261015000300','20261015000400','20261015000500','20261015000600','20261015000700','20261015000800','20261016000100','20261016000200','20261016000300','20261016000400','20261016000500','20261016000600','20261016000700','20261016000800','20261016000900','20261016001000','20261016001100','20261017000100','20261017000200','20261018000100','20261018000200','20261018000300','20261018000400','20261018000500','20261018000600','20261019000100','20261019000200','20261019000300','20261019000400','20261019000500','20261019000600','20261019000700','20261019000800','20261019000900','20261019001000','20261019001100','20261019001200','20261019001300','20261019001400','20261019001500','20261019001600','20261019001700','20261019001800','20261019001900','20261019002000','20261019002100','20261019002200','20261019002300','20261019002400','20261019002500']::text[] THEN RAISE EXCEPTION 'LIVE_LEDGER_CHANGED'; END IF;
IF to_regnamespace('bps_release_guard') IS NOT NULL THEN RAISE EXCEPTION 'RELEASE_BARRIER_PRESENT'; END IF;
END $guard$;

ALTER TABLE public.hr_document_uploads ADD COLUMN cleanup_requested boolean NOT NULL DEFAULT false;
CREATE FUNCTION public.hr_document_cancel_request_v1(p_actor uuid,p_tenant uuid,p_upload uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' SET lock_timeout='5s' AS $$
DECLARE attempt public.hr_document_uploads;
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
 IF attempt.state='published' THEN RAISE EXCEPTION 'HR_UPLOAD_PUBLISHED';END IF;
 UPDATE public.hr_document_uploads SET cleanup_requested=true WHERE id=p_upload;
 RETURN jsonb_build_object('schemaVersion',1,'actorId',p_actor,'tenantId',p_tenant,'id',p_upload,'cleanupRequested',true);
END $$;
REVOKE ALL ON FUNCTION public.hr_document_cancel_request_v1(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.hr_document_cancel_request_v1(uuid,uuid,uuid) TO authenticated;
-- Patch the not-yet-released verifier/finalizer to honour the terminal cleanup intent.
DO $$ DECLARE source text; signature text; BEGIN
 FOREACH signature IN ARRAY ARRAY['public.hr_document_attest_v1(uuid,uuid,uuid,uuid,text,bigint,text)','public.hr_document_finish_v1(uuid,uuid,uuid)','public.hr_document_verification_context_v1(uuid,uuid,uuid)'] LOOP
  SELECT pg_get_functiondef(signature::regprocedure) INTO source;
  IF strpos(source,'attempt.state=''cancelled''')=0 THEN RAISE EXCEPTION 'HR_UPLOAD_SOURCE_CHANGED';END IF;
  source:=replace(source,'attempt.state=''cancelled''','(attempt.state=''cancelled'' OR attempt.cleanup_requested)');
  EXECUTE source;
 END LOOP;
END $$;
CREATE FUNCTION public.hr_storage_access_v1(p_path text,p_operation text,p_owner text DEFAULT NULL) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid:=auth.uid();tenant uuid:=public.current_user_verified_tenant();attempt public.hr_document_uploads;
BEGIN
 IF actor IS NULL OR tenant IS NULL OR (p_operation IS NULL OR p_operation NOT IN('read','insert','delete')) THEN RETURN false;END IF;
 IF p_path IS NULL OR p_path !~ '^[a-f0-9-]{36}/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.pdf$' OR split_part(p_path,'/',1)<>tenant::text THEN RETURN false;END IF;
 SELECT * INTO attempt FROM public.hr_document_uploads WHERE tenant_id=tenant AND id=left(split_part(p_path,'/',2),36)::uuid;
 IF NOT FOUND THEN RETURN false;END IF;
 IF p_operation='read' AND attempt.state='published' THEN
  PERFORM public.hr_private_document_access_v1(actor,tenant,attempt.employee_id,false);RETURN true;
 END IF;
 IF attempt.actor_id<>actor OR attempt.state<>'pending' THEN RETURN false;END IF;
 PERFORM public.hr_private_document_access_v1(actor,tenant,attempt.employee_id,true);
 IF p_operation='insert' THEN RETURN NOT attempt.cleanup_requested AND p_owner=actor::text;END IF;
 IF p_operation='delete' THEN RETURN attempt.cleanup_requested;END IF;
 RETURN true;
EXCEPTION WHEN SQLSTATE 'P0001' OR insufficient_privilege THEN RETURN false;
END $$;
REVOKE ALL ON FUNCTION public.hr_storage_access_v1(text,text,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.hr_storage_access_v1(text,text,text) TO authenticated;
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types) VALUES('hr-private','hr-private',false,10485760,ARRAY['application/pdf']);
CREATE POLICY hr_storage_read ON storage.objects FOR SELECT TO authenticated USING(bucket_id='hr-private' AND public.hr_storage_access_v1(name,'read'));
CREATE POLICY hr_storage_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK(bucket_id='hr-private' AND public.hr_storage_access_v1(name,'insert',owner_id));
CREATE POLICY hr_storage_delete ON storage.objects FOR DELETE TO authenticated USING(bucket_id='hr-private' AND public.hr_storage_access_v1(name,'delete'));
CREATE POLICY hr_storage_read_fence ON storage.objects AS RESTRICTIVE FOR SELECT TO authenticated USING(bucket_id<>'hr-private' OR public.hr_storage_access_v1(name,'read'));
CREATE POLICY hr_storage_insert_fence ON storage.objects AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK(bucket_id<>'hr-private' OR public.hr_storage_access_v1(name,'insert',owner_id));
CREATE POLICY hr_storage_delete_fence ON storage.objects AS RESTRICTIVE FOR DELETE TO authenticated USING(bucket_id<>'hr-private' OR public.hr_storage_access_v1(name,'delete'));
CREATE POLICY hr_storage_update_fence ON storage.objects AS RESTRICTIVE FOR UPDATE TO authenticated USING(bucket_id<>'hr-private') WITH CHECK(bucket_id<>'hr-private');
CREATE POLICY hr_storage_anon_fence ON storage.objects AS RESTRICTIVE FOR ALL TO anon USING(bucket_id<>'hr-private') WITH CHECK(bucket_id<>'hr-private');
CREATE FUNCTION public.hr_storage_write_barrier_v1() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' SET lock_timeout='5s' AS $$
DECLARE tenant uuid;path text;owner text;bucket text;operation text;
BEGIN
 IF TG_OP='DELETE' THEN bucket:=OLD.bucket_id;path:=OLD.name;owner:=OLD.owner_id;operation:='delete';
 ELSE bucket:=NEW.bucket_id;path:=NEW.name;owner:=NEW.owner_id;operation:='insert';END IF;
 IF bucket<>'hr-private' THEN IF TG_OP='DELETE' THEN RETURN OLD;ELSE RETURN NEW;END IF;END IF;
 IF auth.role()='authenticated' THEN
  IF current_setting('transaction_isolation')<>'read committed' THEN RAISE EXCEPTION 'ACCESS_ISOLATION';END IF;
  tenant:=public.current_user_verified_tenant();
  PERFORM 1 FROM public.tenant_module_config WHERE tenant_id=tenant FOR UPDATE;
  PERFORM 1 FROM public.profiles WHERE id=auth.uid() FOR SHARE;
  PERFORM 1 FROM public.tenants WHERE id=tenant FOR UPDATE;
  IF NOT public.hr_storage_access_v1(path,operation,owner) THEN RAISE EXCEPTION 'HR_STORAGE_FORBIDDEN';END IF;
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD;END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.hr_storage_write_barrier_v1() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER hr_storage_write_barrier BEFORE INSERT OR DELETE ON storage.objects FOR EACH ROW EXECUTE FUNCTION public.hr_storage_write_barrier_v1();
CREATE OR REPLACE FUNCTION public.hr_verified_object_guard_v1() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF OLD.bucket_id='hr-private' AND EXISTS(SELECT FROM public.hr_document_verifications WHERE object_id=OLD.id) THEN
  IF TG_OP<>'DELETE' OR NOT EXISTS(SELECT FROM public.hr_document_uploads u JOIN public.hr_document_verifications v ON v.upload_id=u.id WHERE v.object_id=OLD.id AND u.state='pending' AND u.cleanup_requested) THEN
   RAISE EXCEPTION 'HR_VERIFIED_OBJECT_IMMUTABLE';
  END IF;
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD;END IF;RETURN NEW;
END $$;
NOTIFY pgrst,'reload schema';

INSERT INTO supabase_migrations.schema_migrations(version,name,statements) VALUES('20261019002600','hr_document_storage_lifecycle',ARRAY[$bps_source$BEGIN;
ALTER TABLE public.hr_document_uploads ADD COLUMN cleanup_requested boolean NOT NULL DEFAULT false;
CREATE FUNCTION public.hr_document_cancel_request_v1(p_actor uuid,p_tenant uuid,p_upload uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' SET lock_timeout='5s' AS $$
DECLARE attempt public.hr_document_uploads;
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
 IF attempt.state='published' THEN RAISE EXCEPTION 'HR_UPLOAD_PUBLISHED';END IF;
 UPDATE public.hr_document_uploads SET cleanup_requested=true WHERE id=p_upload;
 RETURN jsonb_build_object('schemaVersion',1,'actorId',p_actor,'tenantId',p_tenant,'id',p_upload,'cleanupRequested',true);
END $$;
REVOKE ALL ON FUNCTION public.hr_document_cancel_request_v1(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.hr_document_cancel_request_v1(uuid,uuid,uuid) TO authenticated;
-- Patch the not-yet-released verifier/finalizer to honour the terminal cleanup intent.
DO $$ DECLARE source text; signature text; BEGIN
 FOREACH signature IN ARRAY ARRAY['public.hr_document_attest_v1(uuid,uuid,uuid,uuid,text,bigint,text)','public.hr_document_finish_v1(uuid,uuid,uuid)','public.hr_document_verification_context_v1(uuid,uuid,uuid)'] LOOP
  SELECT pg_get_functiondef(signature::regprocedure) INTO source;
  IF strpos(source,'attempt.state=''cancelled''')=0 THEN RAISE EXCEPTION 'HR_UPLOAD_SOURCE_CHANGED';END IF;
  source:=replace(source,'attempt.state=''cancelled''','(attempt.state=''cancelled'' OR attempt.cleanup_requested)');
  EXECUTE source;
 END LOOP;
END $$;
CREATE FUNCTION public.hr_storage_access_v1(p_path text,p_operation text,p_owner text DEFAULT NULL) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid:=auth.uid();tenant uuid:=public.current_user_verified_tenant();attempt public.hr_document_uploads;
BEGIN
 IF actor IS NULL OR tenant IS NULL OR (p_operation IS NULL OR p_operation NOT IN('read','insert','delete')) THEN RETURN false;END IF;
 IF p_path IS NULL OR p_path !~ '^[a-f0-9-]{36}/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.pdf$' OR split_part(p_path,'/',1)<>tenant::text THEN RETURN false;END IF;
 SELECT * INTO attempt FROM public.hr_document_uploads WHERE tenant_id=tenant AND id=left(split_part(p_path,'/',2),36)::uuid;
 IF NOT FOUND THEN RETURN false;END IF;
 IF p_operation='read' AND attempt.state='published' THEN
  PERFORM public.hr_private_document_access_v1(actor,tenant,attempt.employee_id,false);RETURN true;
 END IF;
 IF attempt.actor_id<>actor OR attempt.state<>'pending' THEN RETURN false;END IF;
 PERFORM public.hr_private_document_access_v1(actor,tenant,attempt.employee_id,true);
 IF p_operation='insert' THEN RETURN NOT attempt.cleanup_requested AND p_owner=actor::text;END IF;
 IF p_operation='delete' THEN RETURN attempt.cleanup_requested;END IF;
 RETURN true;
EXCEPTION WHEN SQLSTATE 'P0001' OR insufficient_privilege THEN RETURN false;
END $$;
REVOKE ALL ON FUNCTION public.hr_storage_access_v1(text,text,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.hr_storage_access_v1(text,text,text) TO authenticated;
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types) VALUES('hr-private','hr-private',false,10485760,ARRAY['application/pdf']);
CREATE POLICY hr_storage_read ON storage.objects FOR SELECT TO authenticated USING(bucket_id='hr-private' AND public.hr_storage_access_v1(name,'read'));
CREATE POLICY hr_storage_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK(bucket_id='hr-private' AND public.hr_storage_access_v1(name,'insert',owner_id));
CREATE POLICY hr_storage_delete ON storage.objects FOR DELETE TO authenticated USING(bucket_id='hr-private' AND public.hr_storage_access_v1(name,'delete'));
CREATE POLICY hr_storage_read_fence ON storage.objects AS RESTRICTIVE FOR SELECT TO authenticated USING(bucket_id<>'hr-private' OR public.hr_storage_access_v1(name,'read'));
CREATE POLICY hr_storage_insert_fence ON storage.objects AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK(bucket_id<>'hr-private' OR public.hr_storage_access_v1(name,'insert',owner_id));
CREATE POLICY hr_storage_delete_fence ON storage.objects AS RESTRICTIVE FOR DELETE TO authenticated USING(bucket_id<>'hr-private' OR public.hr_storage_access_v1(name,'delete'));
CREATE POLICY hr_storage_update_fence ON storage.objects AS RESTRICTIVE FOR UPDATE TO authenticated USING(bucket_id<>'hr-private') WITH CHECK(bucket_id<>'hr-private');
CREATE POLICY hr_storage_anon_fence ON storage.objects AS RESTRICTIVE FOR ALL TO anon USING(bucket_id<>'hr-private') WITH CHECK(bucket_id<>'hr-private');
CREATE FUNCTION public.hr_storage_write_barrier_v1() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' SET lock_timeout='5s' AS $$
DECLARE tenant uuid;path text;owner text;bucket text;operation text;
BEGIN
 IF TG_OP='DELETE' THEN bucket:=OLD.bucket_id;path:=OLD.name;owner:=OLD.owner_id;operation:='delete';
 ELSE bucket:=NEW.bucket_id;path:=NEW.name;owner:=NEW.owner_id;operation:='insert';END IF;
 IF bucket<>'hr-private' THEN IF TG_OP='DELETE' THEN RETURN OLD;ELSE RETURN NEW;END IF;END IF;
 IF auth.role()='authenticated' THEN
  IF current_setting('transaction_isolation')<>'read committed' THEN RAISE EXCEPTION 'ACCESS_ISOLATION';END IF;
  tenant:=public.current_user_verified_tenant();
  PERFORM 1 FROM public.tenant_module_config WHERE tenant_id=tenant FOR UPDATE;
  PERFORM 1 FROM public.profiles WHERE id=auth.uid() FOR SHARE;
  PERFORM 1 FROM public.tenants WHERE id=tenant FOR UPDATE;
  IF NOT public.hr_storage_access_v1(path,operation,owner) THEN RAISE EXCEPTION 'HR_STORAGE_FORBIDDEN';END IF;
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD;END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.hr_storage_write_barrier_v1() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER hr_storage_write_barrier BEFORE INSERT OR DELETE ON storage.objects FOR EACH ROW EXECUTE FUNCTION public.hr_storage_write_barrier_v1();
CREATE OR REPLACE FUNCTION public.hr_verified_object_guard_v1() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF OLD.bucket_id='hr-private' AND EXISTS(SELECT FROM public.hr_document_verifications WHERE object_id=OLD.id) THEN
  IF TG_OP<>'DELETE' OR NOT EXISTS(SELECT FROM public.hr_document_uploads u JOIN public.hr_document_verifications v ON v.upload_id=u.id WHERE v.object_id=OLD.id AND u.state='pending' AND u.cleanup_requested) THEN
   RAISE EXCEPTION 'HR_VERIFIED_OBJECT_IMMUTABLE';
  END IF;
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD;END IF;RETURN NEW;
END $$;
NOTIFY pgrst,'reload schema';
COMMIT;
$bps_source$]);
COMMIT;
