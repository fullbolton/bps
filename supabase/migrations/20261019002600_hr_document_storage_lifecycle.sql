BEGIN;
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
