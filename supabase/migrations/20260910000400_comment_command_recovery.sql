-- Recovery fence for an uncertain comment send. Local-only until acceptance/release.
BEGIN;
SET LOCAL lock_timeout='5s';
CREATE TABLE public.ops_closed_comment_commands (
 tenant_id uuid NOT NULL, actor_id uuid NOT NULL REFERENCES public.profiles(id), command_id uuid NOT NULL,
 request_id uuid NOT NULL, closed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(tenant_id,actor_id,command_id),
 FOREIGN KEY(tenant_id,request_id) REFERENCES public.ops_daily_requests(tenant_id,id)
);
ALTER TABLE public.ops_closed_comment_commands ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ops_closed_comment_commands FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.ops_comment_send(p_actor_id uuid,p_tenant_id uuid,p_command_id uuid,p_request_id uuid,p_body text,p_parent_id uuid,p_mentions uuid[])
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE m public.ops_messages; v_mentions uuid[]; v_parent_author uuid; v_users uuid[]; v_body text;
BEGIN
 PERFORM public.ops_comment_context(p_actor_id,p_tenant_id);
 IF p_command_id IS NULL OR p_request_id IS NULL OR p_body IS NULL OR p_mentions IS NULL
 OR cardinality(p_mentions)>10 OR array_position(p_mentions,NULL) IS NOT NULL THEN RAISE EXCEPTION 'COMM_INPUT'; END IF;
 v_body:=btrim(replace(replace(p_body,E'\r\n',E'\n'),E'\r',E'\n'));
 IF length(v_body) NOT BETWEEN 1 AND 4000 OR v_body !~ '[^[:space:]]' THEN RAISE EXCEPTION 'COMM_INPUT'; END IF;
 SELECT coalesce(array_agg(DISTINCT x ORDER BY x),'{}'::uuid[]) INTO v_mentions FROM unnest(p_mentions) x;
 IF p_parent_id IS NOT NULL THEN
  SELECT author_id INTO v_parent_author FROM public.ops_messages WHERE tenant_id=p_tenant_id AND request_id=p_request_id AND id=p_parent_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'COMM_PARENT'; END IF;
 END IF;
 -- Sorted profile locks agree with administrative profile-first membership changes.
 v_users:=array_append(array_append(v_mentions,p_actor_id),v_parent_author);
 PERFORM 1 FROM public.profiles WHERE id=ANY(v_users) ORDER BY id FOR SHARE;
 PERFORM 1 FROM public.tenant_memberships WHERE tenant_id=p_tenant_id AND user_id=ANY(v_users) ORDER BY user_id FOR SHARE;
 PERFORM public.ops_comment_context(p_actor_id,p_tenant_id);
 IF EXISTS(SELECT 1 FROM unnest(v_mentions) x WHERE NOT EXISTS(
  SELECT 1 FROM public.tenant_memberships t JOIN public.profiles p ON p.id=t.user_id
  WHERE t.user_id=x AND t.tenant_id=p_tenant_id AND p.role IN ('yonetici','operasyon'))) THEN RAISE EXCEPTION 'COMM_RECIPIENT'; END IF;
 PERFORM 1 FROM public.ops_daily_requests WHERE tenant_id=p_tenant_id AND id=p_request_id FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'COMM_SOURCE'; END IF;
 -- Serializes only retries of this actor/tenant/command. Hash collisions only serialize extra work.
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_tenant_id::text||p_actor_id::text||p_command_id::text,0));
 IF EXISTS(SELECT 1 FROM public.ops_closed_comment_commands WHERE tenant_id=p_tenant_id AND actor_id=p_actor_id AND command_id=p_command_id) THEN RAISE EXCEPTION 'COMM_CLOSED'; END IF;
 SELECT * INTO m FROM public.ops_messages WHERE tenant_id=p_tenant_id AND author_id=p_actor_id AND command_id=p_command_id;
 IF FOUND THEN
  IF m.request_id IS DISTINCT FROM p_request_id OR m.body IS DISTINCT FROM v_body OR m.parent_id IS DISTINCT FROM p_parent_id OR m.mention_ids IS DISTINCT FROM v_mentions THEN RAISE EXCEPTION 'COMM_COMMAND_CONFLICT'; END IF;
 ELSE
  INSERT INTO public.ops_messages(tenant_id,request_id,author_id,command_id,body,parent_id,mention_ids)
  VALUES(p_tenant_id,p_request_id,p_actor_id,p_command_id,v_body,p_parent_id,v_mentions) RETURNING * INTO m;
  INSERT INTO public.ops_message_notifications(tenant_id,request_id,message_id,recipient_id)
  SELECT p_tenant_id,p_request_id,m.id,p.id FROM public.profiles p JOIN public.tenant_memberships t ON t.user_id=p.id
  WHERE t.tenant_id=p_tenant_id AND p.id=ANY(array_append(v_mentions,v_parent_author))
    AND p.id<>p_actor_id AND p.role IN ('yonetici','operasyon');
 END IF;
 RETURN jsonb_build_object('commandId',p_command_id,'actorId',p_actor_id,'tenantId',p_tenant_id,'requestId',p_request_id,'messageId',m.id);
END $$;
REVOKE ALL ON FUNCTION public.ops_comment_send(uuid,uuid,uuid,uuid,text,uuid,uuid[]) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ops_comment_send(uuid,uuid,uuid,uuid,text,uuid,uuid[]) TO authenticated;

CREATE FUNCTION public.ops_comment_resolve(p_actor_id uuid,p_tenant_id uuid,p_command_id uuid,p_request_id uuid,p_body text,p_parent_id uuid,p_mentions uuid[])
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE m public.ops_messages; v_mentions uuid[]; v_body text;
BEGIN
 PERFORM public.ops_comment_context(p_actor_id,p_tenant_id);
 IF p_command_id IS NULL OR p_request_id IS NULL OR p_body IS NULL OR p_mentions IS NULL OR cardinality(p_mentions)>10 OR array_position(p_mentions,NULL) IS NOT NULL THEN RAISE EXCEPTION 'COMM_INPUT'; END IF;
 v_body:=btrim(replace(replace(p_body,E'\r\n',E'\n'),E'\r',E'\n'));
 IF length(v_body) NOT BETWEEN 1 AND 4000 OR v_body !~ '[^[:space:]]' THEN RAISE EXCEPTION 'COMM_INPUT'; END IF;
 SELECT coalesce(array_agg(DISTINCT x ORDER BY x),'{}'::uuid[]) INTO v_mentions FROM unnest(p_mentions) x;
 PERFORM 1 FROM public.profiles WHERE id=p_actor_id FOR SHARE;
 PERFORM 1 FROM public.tenant_memberships WHERE user_id=p_actor_id AND tenant_id=p_tenant_id FOR SHARE;
 PERFORM public.ops_comment_context(p_actor_id,p_tenant_id);
 PERFORM 1 FROM public.ops_daily_requests WHERE tenant_id=p_tenant_id AND id=p_request_id FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'COMM_SOURCE'; END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_tenant_id::text||p_actor_id::text||p_command_id::text,0));
 SELECT * INTO m FROM public.ops_messages WHERE tenant_id=p_tenant_id AND author_id=p_actor_id AND command_id=p_command_id;
 IF FOUND THEN
  IF m.request_id IS DISTINCT FROM p_request_id OR m.body IS DISTINCT FROM v_body OR m.parent_id IS DISTINCT FROM p_parent_id OR m.mention_ids IS DISTINCT FROM v_mentions THEN RAISE EXCEPTION 'COMM_COMMAND_CONFLICT'; END IF;
  RETURN jsonb_build_object('status','sent','messageId',m.id,'commandId',p_command_id,'actorId',p_actor_id,'tenantId',p_tenant_id,'requestId',p_request_id);
 END IF;
 IF EXISTS(SELECT 1 FROM public.ops_closed_comment_commands WHERE tenant_id=p_tenant_id AND actor_id=p_actor_id AND command_id=p_command_id AND request_id<>p_request_id) THEN RAISE EXCEPTION 'COMM_COMMAND_CONFLICT'; END IF;
 INSERT INTO public.ops_closed_comment_commands(tenant_id,actor_id,command_id,request_id) VALUES(p_tenant_id,p_actor_id,p_command_id,p_request_id) ON CONFLICT DO NOTHING;
 RETURN jsonb_build_object('status','closed','commandId',p_command_id,'actorId',p_actor_id,'tenantId',p_tenant_id,'requestId',p_request_id);
END $$;
REVOKE ALL ON FUNCTION public.ops_comment_resolve(uuid,uuid,uuid,uuid,text,uuid,uuid[]) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ops_comment_resolve(uuid,uuid,uuid,uuid,text,uuid,uuid[]) TO authenticated;
COMMIT;
