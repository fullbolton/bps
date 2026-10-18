-- LOCAL CANDIDATE. Requires task and announcement candidates; no production apply.
BEGIN;
SET LOCAL lock_timeout='15s';
CREATE FUNCTION public.workspace_inbox_visible_v1(p_actor uuid,p_tenant uuid)
RETURNS TABLE(kind text,id uuid,created_at timestamptz,read_at timestamptz,payload jsonb)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE context jsonb; role_name text;
BEGIN
 context:=public.current_workspace_modules_v1();role_name:=context->>'role';
 IF p_actor IS NULL OR p_tenant IS NULL OR p_actor IS DISTINCT FROM auth.uid()
 OR context->>'actorId' IS DISTINCT FROM p_actor::text OR context->>'tenantId' IS DISTINCT FROM p_tenant::text
 OR NOT coalesce(role_name IN ('yonetici','operasyon','ik','muhasebe','goruntuleyici'),false) THEN
 RAISE EXCEPTION 'INBOX_SCOPE' USING ERRCODE='42501';END IF;
 IF role_name IN ('yonetici','operasyon','ik') THEN
 RETURN QUERY SELECT 'task_assignment'::text,v.id,v.created_at,v.read_at,
 jsonb_build_object('taskId',v.task_id,'title',v.title) FROM public.task_inbox_visible_v1(p_actor,p_tenant) v;
 END IF;
 RETURN QUERY SELECT 'announcement'::text,v.id,v.created_at,v.read_at,
 jsonb_build_object('announcementId',v.announcement_id,'body',v.body) FROM public.announcement_inbox_visible_v1(p_actor,p_tenant) v;
 IF role_name IN ('yonetici','operasyon') AND coalesce((context->'modules'->>'staffing')::boolean,false) THEN
 PERFORM public.ops_comment_context(p_actor,p_tenant);
 RETURN QUERY SELECT 'conversation'::text,n.message_id,m.created_at,n.read_at,
 jsonb_build_object('requestId',r.id,'companyId',c.id,'companyName',c.name,'workDate',r.work_date,'body',m.body)
 FROM public.ops_message_notifications n JOIN public.ops_messages m ON m.id=n.message_id AND m.tenant_id=n.tenant_id
 JOIN public.ops_daily_requests r ON r.id=n.request_id AND r.tenant_id=n.tenant_id
 JOIN public.companies c ON c.id=r.company_id AND c.tenant_id=r.tenant_id
 WHERE n.tenant_id=p_tenant AND n.recipient_id=p_actor;
 END IF;
END $$;
REVOKE ALL ON FUNCTION public.workspace_inbox_visible_v1(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.workspace_inbox_page_v1(p_actor uuid,p_tenant uuid,p_before_kind text DEFAULT NULL,p_before_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE anchor timestamptz; rows jsonb; unread bigint; more boolean;
BEGIN
 IF (p_before_kind IS NULL)<>(p_before_id IS NULL) OR (p_before_kind IS NOT NULL AND p_before_kind NOT IN ('task_assignment','announcement','conversation')) THEN
 RAISE EXCEPTION 'INBOX_CURSOR' USING ERRCODE='22023';END IF;
 IF p_before_id IS NOT NULL THEN
 SELECT v.created_at INTO anchor FROM public.workspace_inbox_visible_v1(p_actor,p_tenant) v WHERE v.kind=p_before_kind AND v.id=p_before_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'INBOX_CURSOR' USING ERRCODE='42501';END IF;
 END IF;
 WITH visible AS MATERIALIZED(SELECT * FROM public.workspace_inbox_visible_v1(p_actor,p_tenant)),
 page AS (SELECT * FROM visible WHERE p_before_id IS NULL OR (created_at,kind COLLATE "C",id)<(anchor,p_before_kind COLLATE "C",p_before_id)
 ORDER BY created_at DESC,kind COLLATE "C" DESC,id DESC LIMIT 31),
 bounded AS (SELECT * FROM page ORDER BY created_at DESC,kind COLLATE "C" DESC,id DESC LIMIT 30)
 SELECT (SELECT count(*) FROM visible WHERE read_at IS NULL),(SELECT count(*)>30 FROM page),
 (SELECT coalesce(jsonb_agg(to_jsonb(b) ORDER BY b.created_at DESC,b.kind COLLATE "C" DESC,b.id DESC),'[]'::jsonb) FROM bounded b)
 INTO unread,more,rows;
 RETURN jsonb_build_object('actorId',p_actor,'tenantId',p_tenant,'unread',unread,'items',rows,
 'nextCursor',CASE WHEN more THEN jsonb_build_object('kind',rows->29->>'kind','id',rows->29->>'id') ELSE NULL END);
END $$;
REVOKE ALL ON FUNCTION public.workspace_inbox_page_v1(uuid,uuid,text,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.workspace_inbox_page_v1(uuid,uuid,text,uuid) TO authenticated;

CREATE FUNCTION public.workspace_inbox_read_v1(p_actor uuid,p_tenant uuid,p_kind text,p_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' SET lock_timeout='5s' AS $$
BEGIN
 IF p_kind IS NULL OR p_kind NOT IN ('task_assignment','announcement','conversation') OR p_id IS NULL THEN
 RAISE EXCEPTION 'INBOX_INPUT' USING ERRCODE='22023';END IF;
 IF p_kind='task_assignment' THEN RETURN public.task_inbox_read_v1(p_actor,p_tenant,p_id);
 ELSIF p_kind='announcement' THEN RETURN public.announcement_inbox_read_v1(p_actor,p_tenant,p_id);
 ELSE RETURN public.ops_comment_read(p_actor,p_tenant,p_id);END IF;
END $$;
REVOKE ALL ON FUNCTION public.workspace_inbox_read_v1(uuid,uuid,text,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.workspace_inbox_read_v1(uuid,uuid,text,uuid) TO authenticated;
COMMIT;
