-- Request conversation foundation. Not applied to production. No email or escalation.
BEGIN;
SET LOCAL lock_timeout='5s';
CREATE UNIQUE INDEX ops_requests_conversation_key ON public.ops_daily_requests(tenant_id,id);
CREATE TABLE public.ops_messages (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL,
 request_id uuid NOT NULL, author_id uuid NOT NULL REFERENCES public.profiles(id),
 command_id uuid NOT NULL, body text NOT NULL CHECK(length(btrim(body)) BETWEEN 1 AND 4000),
 parent_id uuid, mention_ids uuid[] NOT NULL CHECK(cardinality(mention_ids)<=10),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(tenant_id,author_id,command_id), UNIQUE(tenant_id,request_id,id),
 FOREIGN KEY(tenant_id,request_id) REFERENCES public.ops_daily_requests(tenant_id,id),
 FOREIGN KEY(tenant_id,request_id,parent_id) REFERENCES public.ops_messages(tenant_id,request_id,id)
);
CREATE INDEX ops_messages_page ON public.ops_messages(tenant_id,request_id,created_at DESC,id DESC);
CREATE TABLE public.ops_message_notifications (
 tenant_id uuid NOT NULL, request_id uuid NOT NULL, message_id uuid NOT NULL,
 recipient_id uuid NOT NULL REFERENCES public.profiles(id), read_at timestamptz,
 PRIMARY KEY(tenant_id,recipient_id,message_id),
 FOREIGN KEY(tenant_id,request_id,message_id) REFERENCES public.ops_messages(tenant_id,request_id,id)
);
ALTER TABLE public.ops_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ops_message_notifications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ops_messages,public.ops_message_notifications FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.ops_comment_context(p_actor_id uuid,p_tenant_id uuid) RETURNS void
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF p_actor_id IS NULL OR auth.uid() IS DISTINCT FROM p_actor_id OR p_tenant_id IS NULL
 OR public.current_user_verified_tenant() IS DISTINCT FROM p_tenant_id
 OR coalesce(public.current_user_role(),'') NOT IN ('yonetici','operasyon') THEN RAISE EXCEPTION 'COMM_FORBIDDEN'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.ops_comment_context(uuid,uuid) FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.ops_comment_send(p_actor_id uuid,p_tenant_id uuid,p_command_id uuid,p_request_id uuid,p_body text,p_parent_id uuid,p_mentions uuid[])
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

CREATE FUNCTION public.ops_comment_list(p_actor_id uuid,p_tenant_id uuid,p_request_id uuid,p_before uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE v_before timestamptz;
BEGIN
 PERFORM public.ops_comment_context(p_actor_id,p_tenant_id);
 IF NOT EXISTS(SELECT 1 FROM public.ops_daily_requests WHERE tenant_id=p_tenant_id AND id=p_request_id) THEN RAISE EXCEPTION 'COMM_SOURCE'; END IF;
 IF p_before IS NOT NULL THEN
  SELECT created_at INTO v_before FROM public.ops_messages WHERE tenant_id=p_tenant_id AND request_id=p_request_id AND id=p_before;
  IF NOT FOUND THEN RAISE EXCEPTION 'COMM_CURSOR'; END IF;
 END IF;
 RETURN (SELECT coalesce(jsonb_agg(to_jsonb(q) ORDER BY q.created_at DESC,q.id DESC),'[]'::jsonb) FROM (
  SELECT id,author_id,body,parent_id,mention_ids,created_at FROM public.ops_messages
  WHERE tenant_id=p_tenant_id AND request_id=p_request_id AND (p_before IS NULL OR (created_at,id)<(v_before,p_before))
  ORDER BY created_at DESC,id DESC LIMIT 30) q);
END $$;
REVOKE ALL ON FUNCTION public.ops_comment_list(uuid,uuid,uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ops_comment_list(uuid,uuid,uuid,uuid) TO authenticated;

CREATE FUNCTION public.ops_comment_inbox(p_actor_id uuid,p_tenant_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM public.ops_comment_context(p_actor_id,p_tenant_id);
 RETURN jsonb_build_object('unread',(SELECT count(*) FROM public.ops_message_notifications WHERE tenant_id=p_tenant_id AND recipient_id=p_actor_id AND read_at IS NULL),
 'items',(SELECT coalesce(jsonb_agg(to_jsonb(q) ORDER BY q.created_at DESC,q.message_id DESC),'[]'::jsonb) FROM (
  SELECT n.message_id,n.request_id,n.read_at,m.created_at,m.author_id,m.body,r.company_id,r.work_date
  FROM public.ops_message_notifications n JOIN public.ops_messages m ON m.id=n.message_id AND m.tenant_id=n.tenant_id
  JOIN public.ops_daily_requests r ON r.id=n.request_id AND r.tenant_id=n.tenant_id
  WHERE n.tenant_id=p_tenant_id AND n.recipient_id=p_actor_id ORDER BY m.created_at DESC,m.id DESC LIMIT 30) q));
END $$;
REVOKE ALL ON FUNCTION public.ops_comment_inbox(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ops_comment_inbox(uuid,uuid) TO authenticated;

CREATE FUNCTION public.ops_comment_read(p_actor_id uuid,p_tenant_id uuid,p_message_id uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM public.ops_comment_context(p_actor_id,p_tenant_id);
 UPDATE public.ops_message_notifications SET read_at=coalesce(read_at,clock_timestamp())
 WHERE tenant_id=p_tenant_id AND recipient_id=p_actor_id AND message_id=p_message_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'COMM_NOTIFICATION'; END IF;
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.ops_comment_read(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ops_comment_read(uuid,uuid,uuid) TO authenticated;
COMMIT;
