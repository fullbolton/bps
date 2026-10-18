BEGIN;
SET LOCAL lock_timeout='15s';
LOCK TABLE public.announcements IN SHARE ROW EXCLUSIVE MODE;
CREATE TABLE public.announcement_inbox_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 announcement_id uuid NOT NULL REFERENCES public.announcements(id) ON DELETE CASCADE,
 tenant_id uuid NOT NULL,
 recipient_id uuid NOT NULL,
 created_at timestamptz NOT NULL,
 read_at timestamptz,
 UNIQUE(announcement_id,recipient_id)
);
ALTER TABLE public.announcement_inbox_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.announcement_inbox_events FROM PUBLIC,anon,authenticated,service_role;
CREATE INDEX announcement_inbox_page ON public.announcement_inbox_events(tenant_id,recipient_id,created_at DESC,id DESC);
CREATE INDEX announcement_inbox_unread ON public.announcement_inbox_events(tenant_id,recipient_id) WHERE read_at IS NULL;
CREATE FUNCTION public.announcement_inbox_capture_v1() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 -- Snapshot the existing audience without taking profile/config locks out of order.
 INSERT INTO public.announcement_inbox_events(announcement_id,tenant_id,recipient_id,created_at)
 SELECT NEW.id,NEW.tenant_id,m.user_id,NEW.created_at FROM public.tenant_memberships m
 WHERE m.tenant_id=NEW.tenant_id AND m.user_id IS DISTINCT FROM NEW.created_by
 AND m.role IN ('yonetici','operasyon','ik','muhasebe','goruntuleyici');
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.announcement_inbox_capture_v1() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER announcement_inbox_capture AFTER INSERT ON public.announcements
 FOR EACH ROW EXECUTE FUNCTION public.announcement_inbox_capture_v1();
CREATE FUNCTION public.announcement_inbox_visible_v1(p_actor uuid,p_tenant uuid)
RETURNS TABLE(id uuid,announcement_id uuid,body text,created_at timestamptz,read_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE context jsonb;
BEGIN
 context:=public.current_workspace_modules_v1();
 IF p_actor IS NULL OR p_tenant IS NULL OR p_actor IS DISTINCT FROM auth.uid()
 OR context->>'actorId' IS DISTINCT FROM p_actor::text
 OR context->>'tenantId' IS DISTINCT FROM p_tenant::text
 OR NOT coalesce(context->>'role' IN ('yonetici','operasyon','ik','muhasebe','goruntuleyici'),false) THEN
 RAISE EXCEPTION 'INBOX_SCOPE' USING ERRCODE='42501';END IF;
 IF NOT coalesce((context->'modules'->>'announcements')::boolean,false) THEN RETURN;END IF;
 RETURN QUERY SELECT e.id,e.announcement_id,a.body,e.created_at,e.read_at
 FROM public.announcement_inbox_events e JOIN public.announcements a ON a.id=e.announcement_id AND a.tenant_id=e.tenant_id
 WHERE e.tenant_id=p_tenant AND e.recipient_id=p_actor;
END $$;
REVOKE ALL ON FUNCTION public.announcement_inbox_visible_v1(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.announcement_inbox_page_v1(p_actor uuid,p_tenant uuid,p_before uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE anchor timestamptz; rows jsonb; unread bigint; more boolean;
BEGIN
 IF p_before IS NOT NULL THEN
  SELECT v.created_at INTO anchor FROM public.announcement_inbox_visible_v1(p_actor,p_tenant) v WHERE v.id=p_before;
  IF NOT FOUND THEN RAISE EXCEPTION 'INBOX_CURSOR' USING ERRCODE='42501'; END IF;
 END IF;
 WITH visible AS MATERIALIZED(SELECT * FROM public.announcement_inbox_visible_v1(p_actor,p_tenant)),
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
REVOKE ALL ON FUNCTION public.announcement_inbox_page_v1(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.announcement_inbox_page_v1(uuid,uuid,uuid) TO authenticated;

CREATE FUNCTION public.announcement_inbox_read_v1(p_actor uuid,p_tenant uuid,p_event uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' SET lock_timeout='5s' AS $$
DECLARE source uuid;
BEGIN
 IF p_actor IS NULL OR p_actor IS DISTINCT FROM auth.uid() OR p_event IS NULL THEN
  RAISE EXCEPTION 'INBOX_SCOPE' USING ERRCODE='42501'; END IF;
 PERFORM public.workspace_require_module_write_v1(p_tenant,ARRAY['announcements']);
 PERFORM 1 FROM public.profiles WHERE id=p_actor FOR SHARE;
 SELECT e.announcement_id INTO source FROM public.announcement_inbox_events e
 WHERE e.id=p_event AND e.tenant_id=p_tenant AND e.recipient_id=p_actor;
 IF NOT FOUND THEN RAISE EXCEPTION 'INBOX_SOURCE' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM public.announcements WHERE id=source AND tenant_id=p_tenant FOR SHARE;
 -- Separate statement after waiting: re-evaluate membership, module and source state.
 IF NOT EXISTS(SELECT 1 FROM public.announcement_inbox_visible_v1(p_actor,p_tenant) WHERE id=p_event) THEN
  RAISE EXCEPTION 'INBOX_SOURCE' USING ERRCODE='42501'; END IF;
 UPDATE public.announcement_inbox_events SET read_at=coalesce(read_at,statement_timestamp())
 WHERE id=p_event AND tenant_id=p_tenant AND recipient_id=p_actor;
 IF NOT FOUND THEN RAISE EXCEPTION 'INBOX_SOURCE' USING ERRCODE='42501'; END IF;
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.announcement_inbox_read_v1(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.announcement_inbox_read_v1(uuid,uuid,uuid) TO authenticated;

COMMIT;
