-- Read surfaces for local conversation UI; not applied to production.
BEGIN;
SET LOCAL lock_timeout='5s';
CREATE FUNCTION public.ops_comment_people(p_actor_id uuid,p_tenant_id uuid,p_request_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM public.ops_comment_context(p_actor_id,p_tenant_id);
 IF NOT EXISTS(SELECT 1 FROM public.ops_daily_requests WHERE tenant_id=p_tenant_id AND id=p_request_id) THEN RAISE EXCEPTION 'COMM_SOURCE'; END IF;
 RETURN (SELECT coalesce(jsonb_agg(jsonb_build_object('id',p.id,'name',coalesce(nullif(p.display_name,''),'Kullanıcı')) ORDER BY p.display_name,p.id),'[]')
 FROM public.profiles p JOIN public.tenant_memberships t ON t.user_id=p.id
 WHERE t.tenant_id=p_tenant_id AND p.role IN ('yonetici','operasyon'));
END $$;
REVOKE ALL ON FUNCTION public.ops_comment_people(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ops_comment_people(uuid,uuid,uuid) TO authenticated;

CREATE FUNCTION public.ops_comment_inbox_page(p_actor_id uuid,p_tenant_id uuid,p_before uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE v_before timestamptz;
BEGIN
 PERFORM public.ops_comment_context(p_actor_id,p_tenant_id);
 IF p_before IS NOT NULL THEN
  SELECT m.created_at INTO v_before FROM public.ops_message_notifications n JOIN public.ops_messages m ON m.id=n.message_id AND m.tenant_id=n.tenant_id
  WHERE n.tenant_id=p_tenant_id AND n.recipient_id=p_actor_id AND n.message_id=p_before;
  IF NOT FOUND THEN RAISE EXCEPTION 'COMM_CURSOR'; END IF;
 END IF;
 RETURN jsonb_build_object('unread',(SELECT count(*) FROM public.ops_message_notifications WHERE tenant_id=p_tenant_id AND recipient_id=p_actor_id AND read_at IS NULL),
 'items',(SELECT coalesce(jsonb_agg(to_jsonb(q) ORDER BY q.created_at DESC,q.message_id DESC),'[]') FROM (
 SELECT n.message_id,n.request_id,n.read_at,m.created_at,m.author_id,m.body,r.company_id,r.work_date,c.name AS company_name
 FROM public.ops_message_notifications n JOIN public.ops_messages m ON m.id=n.message_id AND m.tenant_id=n.tenant_id
 JOIN public.ops_daily_requests r ON r.id=n.request_id AND r.tenant_id=n.tenant_id
 JOIN public.companies c ON c.id=r.company_id AND c.tenant_id=r.tenant_id
 WHERE n.tenant_id=p_tenant_id AND n.recipient_id=p_actor_id AND (p_before IS NULL OR (m.created_at,m.id)<(v_before,p_before))
 ORDER BY m.created_at DESC,m.id DESC LIMIT 30) q));
END $$;
REVOKE ALL ON FUNCTION public.ops_comment_inbox_page(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ops_comment_inbox_page(uuid,uuid,uuid) TO authenticated;
COMMIT;
