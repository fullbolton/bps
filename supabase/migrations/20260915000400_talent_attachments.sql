-- Private person files. Onboarding access is limited to management/HR.
BEGIN;
SET LOCAL lock_timeout='5s';
CREATE TABLE public.talent_attachments (
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL,person_id uuid NOT NULL,
 actor_id uuid NOT NULL REFERENCES public.profiles(id),
 category text NOT NULL CHECK(category IN ('photo','cv','certificate','onboarding','other')),
 filename text NOT NULL CHECK(length(btrim(filename)) BETWEEN 1 AND 180),
 mime text NOT NULL CHECK(mime IN ('image/jpeg','image/png','application/pdf')),
 size integer NOT NULL CHECK(size BETWEEN 1 AND 10485760),
 sha256 text NOT NULL CHECK(sha256 ~ '^[a-f0-9]{64}$'),
 ready boolean NOT NULL DEFAULT false,created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 FOREIGN KEY(tenant_id,person_id) REFERENCES public.talent_people(tenant_id,id),
 CHECK(category<>'photo' OR mime IN ('image/jpeg','image/png'))
);
ALTER TABLE public.talent_attachments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.talent_attachments FROM PUBLIC,anon,authenticated;
CREATE INDEX talent_attachments_person ON public.talent_attachments(tenant_id,person_id,created_at DESC,id DESC);

CREATE FUNCTION public.talent_attachment_access(p_id uuid,p_upload boolean DEFAULT false)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.talent_attachments a
 WHERE a.id=p_id AND a.tenant_id=public.current_user_verified_tenant()
 AND (public.current_user_role() IN ('yonetici','ik') OR (public.current_user_role()='operasyon' AND a.category<>'onboarding'))
 AND CASE WHEN p_upload THEN a.actor_id=auth.uid() AND NOT a.ready ELSE a.ready END)
$$;
REVOKE ALL ON FUNCTION public.talent_attachment_access(uuid,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.talent_attachment_access(uuid,boolean) TO authenticated;
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES('person-files','person-files',false,10485760,ARRAY['image/jpeg','image/png','application/pdf']);
CREATE POLICY person_files_read ON storage.objects FOR SELECT TO authenticated
USING(bucket_id='person-files' AND public.talent_attachment_access(CASE WHEN name ~ '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$' THEN name::uuid ELSE NULL END,false));
CREATE POLICY person_files_insert ON storage.objects FOR INSERT TO authenticated
WITH CHECK(bucket_id='person-files' AND public.talent_attachment_access(CASE WHEN name ~ '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$' THEN name::uuid ELSE NULL END,true));

-- Existing broad policies must not widen this bucket's boundary.
CREATE POLICY person_files_read_fence ON storage.objects AS RESTRICTIVE FOR SELECT TO authenticated
USING(bucket_id<>'person-files' OR public.talent_attachment_access(CASE WHEN name ~ '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$' THEN name::uuid ELSE NULL END,false));
CREATE POLICY person_files_insert_fence ON storage.objects AS RESTRICTIVE FOR INSERT TO authenticated
WITH CHECK(bucket_id<>'person-files' OR public.talent_attachment_access(CASE WHEN name ~ '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$' THEN name::uuid ELSE NULL END,true));
CREATE POLICY person_files_no_update ON storage.objects AS RESTRICTIVE FOR UPDATE TO authenticated USING(bucket_id<>'person-files') WITH CHECK(bucket_id<>'person-files');
CREATE POLICY person_files_no_delete ON storage.objects AS RESTRICTIVE FOR DELETE TO authenticated USING(bucket_id<>'person-files');
CREATE POLICY person_files_no_anon ON storage.objects AS RESTRICTIVE FOR ALL TO anon USING(bucket_id<>'person-files') WITH CHECK(bucket_id<>'person-files');

CREATE FUNCTION public.talent_attachment_reserve(p_actor_id uuid,p_tenant_id uuid,p_input jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE a public.talent_attachments; v_id uuid;
BEGIN
 PERFORM public.talent_assert_scope(p_actor_id,p_tenant_id);
 IF jsonb_typeof(p_input) IS DISTINCT FROM 'object' OR NOT(p_input ?& ARRAY['id','personId','category','filename','mime','size','sha256']) OR (SELECT count(*) FROM jsonb_object_keys(p_input))<>7 THEN RAISE EXCEPTION 'ATTACHMENT_INVALID'; END IF;
 IF p_input->>'category'='onboarding' AND public.current_user_role() NOT IN ('yonetici','ik') THEN RAISE EXCEPTION 'TALENT_FORBIDDEN'; END IF;
 v_id:=(p_input->>'id')::uuid;
 INSERT INTO public.talent_attachments(id,tenant_id,person_id,actor_id,category,filename,mime,size,sha256)
 VALUES(v_id,p_tenant_id,(p_input->>'personId')::uuid,p_actor_id,p_input->>'category',btrim(p_input->>'filename'),p_input->>'mime',(p_input->>'size')::integer,p_input->>'sha256') ON CONFLICT(id) DO NOTHING;
 SELECT * INTO STRICT a FROM public.talent_attachments WHERE id=v_id;
 IF a.tenant_id<>p_tenant_id OR a.actor_id<>p_actor_id OR a.person_id<>(p_input->>'personId')::uuid OR a.category<>p_input->>'category' OR a.filename<>btrim(p_input->>'filename') OR a.mime<>p_input->>'mime' OR a.size<>(p_input->>'size')::integer OR a.sha256<>p_input->>'sha256' THEN RAISE EXCEPTION 'TALENT_COMMAND'; END IF;
 RETURN jsonb_build_object('id',a.id,'ready',a.ready);
END $$;
CREATE FUNCTION public.talent_attachment_finish(p_actor_id uuid,p_tenant_id uuid,p_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE a public.talent_attachments;
BEGIN
 PERFORM public.talent_assert_scope(p_actor_id,p_tenant_id);
 SELECT * INTO STRICT a FROM public.talent_attachments WHERE id=p_id AND tenant_id=p_tenant_id AND actor_id=p_actor_id FOR UPDATE;
 IF a.category='onboarding' AND public.current_user_role() NOT IN ('yonetici','ik') THEN RAISE EXCEPTION 'TALENT_FORBIDDEN'; END IF;
 IF NOT EXISTS(SELECT 1 FROM storage.objects o WHERE bucket_id='person-files' AND name=p_id::text AND (o.metadata->>'size')::bigint=a.size AND o.metadata->>'mimetype'=a.mime) THEN RAISE EXCEPTION 'ATTACHMENT_NOT_UPLOADED'; END IF;
 UPDATE public.talent_attachments SET ready=true WHERE id=p_id;RETURN true;
END $$;
CREATE FUNCTION public.talent_attachment_list(p_actor_id uuid,p_tenant_id uuid,p_person_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb;
BEGIN
 PERFORM public.talent_assert_scope(p_actor_id,p_tenant_id);
 PERFORM 1 FROM public.talent_people WHERE id=p_person_id AND tenant_id=p_tenant_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'TALENT_NOT_FOUND'; END IF;
 SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.created_at DESC,t.id DESC),'[]') INTO result FROM (
 SELECT a.id,a.person_id,a.category,a.filename,a.mime,a.size,a.created_at FROM public.talent_attachments a
 WHERE a.tenant_id=p_tenant_id AND a.person_id=p_person_id AND a.ready
 AND (public.current_user_role() IN ('yonetici','ik') OR a.category<>'onboarding')
 ORDER BY a.created_at DESC,a.id DESC LIMIT 51) t;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.talent_attachment_reserve(uuid,uuid,jsonb),public.talent_attachment_finish(uuid,uuid,uuid),public.talent_attachment_list(uuid,uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.talent_attachment_reserve(uuid,uuid,jsonb),public.talent_attachment_finish(uuid,uuid,uuid),public.talent_attachment_list(uuid,uuid,uuid) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
