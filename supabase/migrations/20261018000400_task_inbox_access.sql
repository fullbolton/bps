BEGIN;
SET LOCAL lock_timeout='15s';
CREATE FUNCTION public.task_inbox_visible_v1(p_actor uuid,p_tenant uuid)
RETURNS TABLE(id uuid,task_id uuid,title text,created_at timestamptz,read_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE context jsonb;
BEGIN
 context:=public.current_workspace_modules_v1();
 IF p_actor IS NULL OR p_tenant IS NULL OR p_actor IS DISTINCT FROM auth.uid()
 OR context->>'actorId' IS DISTINCT FROM p_actor::text
 OR context->>'tenantId' IS DISTINCT FROM p_tenant::text
 OR NOT coalesce(context->>'role' IN ('yonetici','operasyon','ik'),false) THEN
  RAISE EXCEPTION 'INBOX_SCOPE' USING ERRCODE='42501'; END IF;
 IF NOT coalesce((context->'modules'->>'tasks')::boolean,false) THEN RETURN; END IF;
 RETURN QUERY SELECT e.id,e.task_id,t.title,e.created_at,e.read_at
 FROM public.task_inbox_events e JOIN public.tasks t ON t.id=e.task_id AND t.tenant_id=e.tenant_id
 WHERE e.tenant_id=p_tenant AND e.recipient_id=p_actor AND t.assigned_to_user_id=p_actor
 AND t.status IN ('acik','devam_ediyor','gecikti')
 -- Text/status edits advance task revision without replacing an assignment.
 -- A later assignment invalidates the old event even if reassigned back to this user.
 AND NOT EXISTS(SELECT 1 FROM public.task_assignment_history h WHERE h.task_id=e.task_id
   AND h.revision>e.revision AND h.kind IN ('assigned','reassigned','unassigned'));
END $$;
REVOKE ALL ON FUNCTION public.task_inbox_visible_v1(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.task_inbox_page_v1(p_actor uuid,p_tenant uuid,p_before uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE anchor timestamptz; rows jsonb; unread bigint; more boolean;
BEGIN
 IF p_before IS NOT NULL THEN
  SELECT v.created_at INTO anchor FROM public.task_inbox_visible_v1(p_actor,p_tenant) v WHERE v.id=p_before;
  IF NOT FOUND THEN RAISE EXCEPTION 'INBOX_CURSOR' USING ERRCODE='42501'; END IF;
 END IF;
 WITH visible AS MATERIALIZED(SELECT * FROM public.task_inbox_visible_v1(p_actor,p_tenant)),
 page AS (SELECT * FROM visible WHERE p_before IS NULL OR (created_at,id)<(anchor,p_before)
   ORDER BY created_at DESC,id DESC LIMIT 31),
 bounded AS (SELECT * FROM page ORDER BY created_at DESC,id DESC LIMIT 30)
 SELECT (SELECT count(*) FROM visible WHERE read_at IS NULL),
   (SELECT count(*)>30 FROM page),
   (SELECT coalesce(jsonb_agg(to_jsonb(b) ORDER BY b.created_at DESC,b.id DESC),'[]'::jsonb) FROM bounded b)
 INTO unread,more,rows;
 RETURN jsonb_build_object('actorId',p_actor,'tenantId',p_tenant,'unread',unread,'items',rows,
   'nextCursor',CASE WHEN more THEN rows->29->>'id' ELSE NULL END);
END $$;
REVOKE ALL ON FUNCTION public.task_inbox_page_v1(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.task_inbox_page_v1(uuid,uuid,uuid) TO authenticated;

CREATE FUNCTION public.task_inbox_read_v1(p_actor uuid,p_tenant uuid,p_event uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' SET lock_timeout='5s' AS $$
DECLARE source uuid;
BEGIN
 IF p_actor IS NULL OR p_actor IS DISTINCT FROM auth.uid() OR p_event IS NULL THEN
  RAISE EXCEPTION 'INBOX_SCOPE' USING ERRCODE='42501'; END IF;
 PERFORM public.workspace_require_module_write_v1(p_tenant,ARRAY['tasks']);
 PERFORM 1 FROM public.profiles WHERE id=p_actor FOR SHARE;
 SELECT e.task_id INTO source FROM public.task_inbox_events e
 WHERE e.id=p_event AND e.tenant_id=p_tenant AND e.recipient_id=p_actor;
 IF NOT FOUND THEN RAISE EXCEPTION 'INBOX_SOURCE' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM public.tasks WHERE id=source AND tenant_id=p_tenant FOR SHARE;
 -- Separate statement after waiting: re-evaluate membership, module and source state.
 IF NOT EXISTS(SELECT 1 FROM public.task_inbox_visible_v1(p_actor,p_tenant) WHERE id=p_event) THEN
  RAISE EXCEPTION 'INBOX_SOURCE' USING ERRCODE='42501'; END IF;
 UPDATE public.task_inbox_events SET read_at=coalesce(read_at,statement_timestamp())
 WHERE id=p_event AND tenant_id=p_tenant AND recipient_id=p_actor;
 IF NOT FOUND THEN RAISE EXCEPTION 'INBOX_SOURCE' USING ERRCODE='42501'; END IF;
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.task_inbox_read_v1(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.task_inbox_read_v1(uuid,uuid,uuid) TO authenticated;
COMMIT;
