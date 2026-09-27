-- Requires 20260915000300. Read only, tenant-verified conversation history.
BEGIN;
SET LOCAL lock_timeout='5s';
CREATE FUNCTION public.talent_conversation_list(p_actor_id uuid,p_tenant_id uuid,p_person_id uuid,p_offset integer DEFAULT 0)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb;
BEGIN
 PERFORM public.talent_assert_scope(p_actor_id,p_tenant_id);
 IF p_offset IS NULL OR p_offset<0 OR p_offset>100000 THEN RAISE EXCEPTION 'CONVERSATION_VALIDATION'; END IF;
 PERFORM 1 FROM public.talent_people WHERE tenant_id=p_tenant_id AND id=p_person_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'TALENT_NOT_FOUND'; END IF;
 SELECT coalesce(jsonb_agg(x.payload ORDER BY x.recorded_at DESC,x.id DESC),'[]'::jsonb) INTO result FROM (
  SELECT c.id,c.recorded_at,jsonb_build_object('id',c.id,'tenantId',c.tenant_id,'personId',c.person_id,'requestId',c.request_id,'actorId',c.actor_id,'commandId',c.command_id,'channel',c.channel,'outcome',c.outcome,'note',c.note,'recordedAt',c.recorded_at) AS payload
  FROM public.talent_conversations c WHERE c.tenant_id=p_tenant_id AND c.person_id=p_person_id
  ORDER BY c.recorded_at DESC,c.id DESC LIMIT 21 OFFSET p_offset
 ) x;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.talent_conversation_list(uuid,uuid,uuid,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.talent_conversation_list(uuid,uuid,uuid,integer) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
