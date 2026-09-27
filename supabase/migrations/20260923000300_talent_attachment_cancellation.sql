-- Cancellation is a durable tombstone. Physical objects are removed only through Storage API.
BEGIN;
SET LOCAL lock_timeout='5s';
LOCK TABLE public.talent_attachments IN ACCESS EXCLUSIVE MODE;
ALTER TABLE public.talent_attachments ADD COLUMN cancelled boolean NOT NULL DEFAULT false;
ALTER TABLE public.talent_attachments ADD COLUMN cleaned boolean NOT NULL DEFAULT false;
ALTER TABLE public.talent_attachments ADD CONSTRAINT attachment_cancel_state CHECK(NOT(ready AND cancelled) AND (NOT cleaned OR cancelled));
CREATE OR REPLACE FUNCTION public.talent_attachment_access(p_id uuid,p_upload boolean DEFAULT false)
RETURNS boolean LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE a public.talent_attachments;
BEGIN
 -- Share lock spans the Storage metadata INSERT transaction. Cancellation waits
 -- for an accepted upload; a later upload sees the tombstone and is rejected.
 IF p_upload THEN SELECT * INTO a FROM public.talent_attachments WHERE id=p_id AND tenant_id=public.current_user_verified_tenant() AND actor_id=auth.uid() FOR SHARE;
 ELSE SELECT * INTO a FROM public.talent_attachments WHERE id=p_id; END IF;
 IF NOT FOUND OR a.tenant_id IS DISTINCT FROM public.current_user_verified_tenant() OR a.cancelled THEN RETURN false; END IF;
 IF coalesce(public.current_user_role(),'') NOT IN ('yonetici','ik','operasyon') OR (a.category='onboarding' AND public.current_user_role()='operasyon') THEN RETURN false; END IF;
 RETURN CASE WHEN p_upload THEN a.actor_id=auth.uid() AND NOT a.ready ELSE a.ready END;
END $$;
CREATE FUNCTION public.talent_attachment_can_cleanup(p_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.talent_attachments a WHERE a.id=p_id AND a.actor_id=auth.uid()
 AND a.tenant_id=public.current_user_verified_tenant() AND a.cancelled AND NOT a.ready
 AND (public.current_user_role() IN ('yonetici','ik') OR (public.current_user_role()='operasyon' AND a.category<>'onboarding')))
$$;
CREATE FUNCTION public.talent_attachment_cancel(p_actor_id uuid,p_tenant_id uuid,p_id uuid,p_finish boolean DEFAULT false)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE a public.talent_attachments;
BEGIN
 PERFORM public.talent_assert_scope(p_actor_id,p_tenant_id);
 SELECT * INTO STRICT a FROM public.talent_attachments WHERE id=p_id AND tenant_id=p_tenant_id AND actor_id=p_actor_id FOR UPDATE;
 IF a.category='onboarding' AND public.current_user_role() NOT IN ('yonetici','ik') THEN RAISE EXCEPTION 'TALENT_FORBIDDEN'; END IF;
 IF a.ready THEN RAISE EXCEPTION 'ATTACHMENT_ALREADY_READY'; END IF;
 IF p_finish THEN
  IF NOT a.cancelled OR EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='person-files' AND name=p_id::text) THEN RAISE EXCEPTION 'ATTACHMENT_CLEANUP_PENDING'; END IF;
  UPDATE public.talent_attachments SET cleaned=true WHERE id=p_id;
 ELSE UPDATE public.talent_attachments SET cancelled=true WHERE id=p_id; END IF;
 RETURN true;
END $$;
-- Storage removal requires SELECT as well as DELETE. Only the cancelling owner
-- can access the cancelled object, and normal ready files still cannot be deleted.
DROP POLICY person_files_no_delete ON storage.objects;
CREATE POLICY person_files_no_delete ON storage.objects AS RESTRICTIVE FOR DELETE TO authenticated USING(bucket_id<>'person-files' OR public.talent_attachment_can_cleanup(CASE WHEN name ~ '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$' THEN name::uuid ELSE NULL END));
CREATE POLICY person_files_cancel_delete ON storage.objects FOR DELETE TO authenticated USING(bucket_id='person-files' AND public.talent_attachment_can_cleanup(CASE WHEN name ~ '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$' THEN name::uuid ELSE NULL END));
CREATE POLICY person_files_cancel_read ON storage.objects FOR SELECT TO authenticated USING(bucket_id='person-files' AND public.talent_attachment_can_cleanup(CASE WHEN name ~ '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$' THEN name::uuid ELSE NULL END));
DROP POLICY person_files_read_fence ON storage.objects;
CREATE POLICY person_files_read_fence ON storage.objects AS RESTRICTIVE FOR SELECT TO authenticated USING(bucket_id<>'person-files' OR public.talent_attachment_access(CASE WHEN name ~ '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$' THEN name::uuid ELSE NULL END,false) OR public.talent_attachment_can_cleanup(CASE WHEN name ~ '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$' THEN name::uuid ELSE NULL END));
REVOKE ALL ON FUNCTION public.talent_attachment_can_cleanup(uuid),public.talent_attachment_cancel(uuid,uuid,uuid,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.talent_attachment_can_cleanup(uuid),public.talent_attachment_cancel(uuid,uuid,uuid,boolean) TO authenticated;
CREATE OR REPLACE FUNCTION public.talent_attachment_pending(p_actor_id uuid,p_tenant_id uuid,p_person_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb;
BEGIN
 PERFORM public.talent_assert_scope(p_actor_id,p_tenant_id);
 PERFORM 1 FROM public.talent_people WHERE id=p_person_id AND tenant_id=p_tenant_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'TALENT_NOT_FOUND'; END IF;
 SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.created_at DESC,t.id DESC),'[]'::jsonb) INTO result FROM (
  SELECT a.id,a.person_id,a.category,a.filename,a.mime,a.size,a.created_at
  FROM public.talent_attachments a
  WHERE a.tenant_id=p_tenant_id AND a.person_id=p_person_id AND a.actor_id=p_actor_id AND NOT a.ready AND NOT a.cleaned
  AND (public.current_user_role() IN ('yonetici','ik') OR a.category<>'onboarding')
  ORDER BY a.created_at DESC,a.id DESC LIMIT 51
 ) t;
 RETURN result;
END $$;
NOTIFY pgrst,'reload schema';
COMMIT;
