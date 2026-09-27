-- Show incomplete uploads to their owner; never infer completion from a client timeout.
BEGIN;
SET LOCAL lock_timeout='5s';
CREATE FUNCTION public.talent_attachment_pending(p_actor_id uuid,p_tenant_id uuid,p_person_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb;
BEGIN
 PERFORM public.talent_assert_scope(p_actor_id,p_tenant_id);
 PERFORM 1 FROM public.talent_people WHERE id=p_person_id AND tenant_id=p_tenant_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'TALENT_NOT_FOUND'; END IF;
 SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.created_at DESC,t.id DESC),'[]'::jsonb) INTO result FROM (
  SELECT a.id,a.person_id,a.category,a.filename,a.mime,a.size,a.created_at
  FROM public.talent_attachments a
  WHERE a.tenant_id=p_tenant_id AND a.person_id=p_person_id AND a.actor_id=p_actor_id AND NOT a.ready
  AND (public.current_user_role() IN ('yonetici','ik') OR a.category<>'onboarding')
  ORDER BY a.created_at DESC,a.id DESC LIMIT 51
 ) t;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.talent_attachment_pending(uuid,uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.talent_attachment_pending(uuid,uuid,uuid) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
