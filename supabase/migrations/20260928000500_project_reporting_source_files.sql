BEGIN;
SET LOCAL lock_timeout='5s';
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES('project-sources','project-sources',false,2097152,ARRAY['text/csv','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'])
ON CONFLICT(id) DO NOTHING;
DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM storage.buckets WHERE id='project-sources' AND NOT public AND file_size_limit=2097152) THEN RAISE EXCEPTION 'Private bounded project-sources bucket required';END IF;END $$;
CREATE TABLE public.reporting_import_files(
 tenant_id uuid NOT NULL,batch_id uuid NOT NULL,name text NOT NULL CHECK(length(name) BETWEEN 1 AND 200),
 path text NOT NULL UNIQUE,sha256 text NOT NULL CHECK(sha256 ~ '^[0-9a-f]{64}$'),size integer NOT NULL CHECK(size BETWEEN 1 AND 2097152),created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,batch_id),FOREIGN KEY(tenant_id,batch_id) REFERENCES public.reporting_imports(tenant_id,id)
);
ALTER TABLE public.reporting_import_files ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.reporting_import_files FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.reporting_source_access(p_name text,p_write boolean) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT p_name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f]{64}\.(csv|xlsx)$'
 AND EXISTS(SELECT 1 FROM public.reporting_imports i WHERE i.tenant_id=public.current_user_verified_tenant()
 AND i.tenant_id::text=split_part(p_name,'/',1) AND i.id::text=split_part(p_name,'/',2)
 AND public.current_user_role() IN ('yonetici','operasyon')
 AND (i.actor_id=auth.uid() OR public.current_user_role()='yonetici')
 AND (NOT p_write OR (i.status='pending' AND NOT EXISTS(SELECT 1 FROM public.reporting_import_files f WHERE f.tenant_id=i.tenant_id AND f.batch_id=i.id))))
$$;
REVOKE ALL ON FUNCTION public.reporting_source_access(text,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.reporting_source_access(text,boolean) TO authenticated;
CREATE POLICY project_sources_read ON storage.objects FOR SELECT TO authenticated USING(bucket_id='project-sources' AND public.reporting_source_access(name,false));
CREATE POLICY project_sources_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK(bucket_id='project-sources' AND public.reporting_source_access(name,true));
-- Restrictive fences keep unrelated permissive policies from widening this bucket.
CREATE POLICY project_sources_read_fence ON storage.objects AS RESTRICTIVE FOR SELECT TO authenticated USING(bucket_id<>'project-sources' OR public.reporting_source_access(name,false));
CREATE POLICY project_sources_insert_fence ON storage.objects AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK(bucket_id<>'project-sources' OR public.reporting_source_access(name,true));
CREATE POLICY project_sources_update_fence ON storage.objects AS RESTRICTIVE FOR UPDATE TO authenticated USING(bucket_id<>'project-sources') WITH CHECK(bucket_id<>'project-sources');
CREATE POLICY project_sources_delete_fence ON storage.objects AS RESTRICTIVE FOR DELETE TO authenticated USING(bucket_id<>'project-sources');
CREATE POLICY project_sources_anon_fence ON storage.objects AS RESTRICTIVE FOR ALL TO anon USING(bucket_id<>'project-sources') WITH CHECK(bucket_id<>'project-sources');
CREATE FUNCTION public.reporting_source_file(p_actor uuid,p_tenant uuid,p_batch uuid,p_name text DEFAULT NULL,p_hash text DEFAULT NULL,p_size integer DEFAULT NULL,p_extension text DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' SET lock_timeout='5s' AS $$
DECLARE item public.reporting_imports;f public.reporting_import_files;object_path text;
BEGIN
 PERFORM public.reporting_assert_scope(p_actor,p_tenant,true);
 SELECT * INTO item FROM public.reporting_imports WHERE tenant_id=p_tenant AND id=p_batch FOR UPDATE;
 IF NOT FOUND OR (item.actor_id<>p_actor AND public.current_user_role()<>'yonetici') THEN RAISE EXCEPTION 'REPORT_FORBIDDEN';END IF;
 SELECT * INTO f FROM public.reporting_import_files WHERE tenant_id=p_tenant AND batch_id=p_batch;
 IF p_name IS NOT NULL THEN
  IF p_hash IS NULL OR p_hash !~ '^[0-9a-f]{64}$' OR p_size IS NULL OR p_size NOT BETWEEN 1 AND 2097152 OR p_extension IS NULL OR p_extension NOT IN ('csv','xlsx') OR length(p_name) NOT BETWEEN 1 AND 200 OR p_name ~ '[[:cntrl:]]' THEN RAISE EXCEPTION 'REPORT_INPUT';END IF;
  object_path:=p_tenant::text||'/'||p_batch::text||'/'||p_hash||'.'||p_extension;
  IF f.path IS NOT NULL THEN
   IF f.path<>object_path OR f.size<>p_size THEN RAISE EXCEPTION 'REPORT_SOURCE_EXISTS';END IF;
  ELSE
   IF item.status<>'pending' THEN RAISE EXCEPTION 'REPORT_IMPORT_STATE';END IF;
   IF NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='project-sources' AND name=object_path AND (metadata->>'size')::bigint=p_size) THEN RAISE EXCEPTION 'REPORT_SOURCE_MISSING';END IF;
   INSERT INTO public.reporting_import_files(tenant_id,batch_id,name,path,sha256,size) VALUES(p_tenant,p_batch,p_name,object_path,p_hash,p_size) RETURNING * INTO f;
  END IF;
 END IF;
 IF f.path IS NULL THEN RETURN NULL;END IF;
 RETURN jsonb_build_object('name',f.name,'path',f.path,'sha256',f.sha256,'size',f.size);
END $$;
REVOKE ALL ON FUNCTION public.reporting_source_file(uuid,uuid,uuid,text,text,integer,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.reporting_source_file(uuid,uuid,uuid,text,text,integer,text) TO authenticated;
COMMIT;
