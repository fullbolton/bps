BEGIN; SET LOCAL lock_timeout='15s'; SET LOCAL statement_timeout='60s';LOCK TABLE supabase_migrations.schema_migrations IN EXCLUSIVE MODE; DO $gate$ BEGIN IF (SELECT array_agg(version ORDER BY version) FROM supabase_migrations.schema_migrations) IS DISTINCT FROM ARRAY['20260407000000','20260407000100','20260407000200','20260407000300','20260407000400','20260407000500','20260407000600','20260407000700','20260407000800','20260407000900','20260407001000','20260407001100','20260407001600','20260407001700','20260407001800','20260413000100','20260414000100','20260414000200','20260415000100','20260415000200','20260415000300','20260415000400','20260415000500','20260423000100','20260425000100','20260425000200','20260713000100','20260713000200','20260722000100','20260810000100','20260810000200','20260827000100','20260827000200','20260827000300','20260827000400','20260904000100','20260904000200','20260909000100','20260909000200','20260909000300','20260909000400','20260909000500','20260909000600','20260909000700','20260909000800','20260909000900','20260909001000','20260909001100','20260909001200','20260909001300','20260909001400','20260909001500','20260909001600','20260909001700','20260909001800','20260909001900','20260909002000','20260909002100','20260909002200','20260909002300','20260909002400','20260909002500','20260909002600','20260909002700','20260909002800','20260909002900','20260910000100','20260910000200','20260910000300','20260910000400','20260911000100','20260913000100','20260914000100','20260914000200','20260914000300','20260914000400','20260914000500','20260914000600','20260914000700','20260915000100','20260915000200','20260915000300','20260915000400','20260915000500','20260915000600','20260915000700','20260915000800','20260915000900','20260915001000','20260923000100','20260923000200','20260923000300','20260923000400','20260924000100','20260924000200','20260924000300','20260924000400','20260924000500','20260925000100','20260925000200','20260925000300','20260925000400','20260925000500','20260925000600','20260925000700','20260926000100','20260926000200','20260927000100','20260927000200','20260927000300','20260927000400','20260927000500','20260927000600','20260927000700','20260927000800','20260927000900','20260928000100','20260928000200','20260928000300','20260928000400','20260928000500','20260928000600','20260928000700','20260928000800','20261004001000','20261004001100','20261004001200','20261004001300','20261004001400','20261005000100','20261005000200','20261005000300','20261005000400','20261005000500','20261005000600','20261005000700','20261005000800','20261005000900','20261005001000','20261005001100','20261005001200','20261005001300','20261005001400','20261005001500','20261005001600','20261005001700','20261005001800','20261005001900','20261005002000','20261005002100','20261005002200','20261005002300','20261005002400','20261005002500','20261005002600','20261005002700','20261005002800','20261005002900','20261005003000','20261005003100','20261013000100','20261013000200','20261013000300','20261015000100','20261015000200','20261015000300','20261015000400','20261015000500','20261015000600','20261015000700','20261015000800','20261016000100','20261016000200','20261016000300','20261016000400','20261016000500','20261016000600','20261016000700','20261016000800','20261016000900','20261016001000','20261016001100','20261017000100','20261017000200','20261018000100','20261018000200']::text[] THEN RAISE EXCEPTION 'INBOX_LEDGER_DRIFT'; END IF; END $gate$;
SET LOCAL lock_timeout='15s';
DO $guard$
DECLARE signature text; expected text;
BEGIN
 FOR signature,expected IN SELECT key,value FROM jsonb_each_text('{"current_workspace_modules_v1()": "3440a576578b52477fa5f04463dce712", "ops_comment_context(uuid,uuid)": "47c58200bdbae28385722839011f4edf", "ops_comment_read(uuid,uuid,uuid)": "ba0f6df9707fee3f0bcd38c9169b1cad", "announcement_execute_v1(text,uuid,uuid,text)": "bf8d4c07e3e1aaf68e13ba8afd6283c7", "workspace_require_module_write_v1(uuid,text[])": "8abbd4876d6e24ec59c8feebd2a0ac12", "task_execute_v1(text,uuid,bigint,jsonb,uuid,uuid)": "4dfa8f1df630d4d8bfdf6ad0e334f238"}'::jsonb) LOOP
  IF to_regprocedure(signature) IS NULL OR md5(pg_get_functiondef(to_regprocedure(signature))) IS DISTINCT FROM expected THEN
   RAISE EXCEPTION 'INBOX_DEPENDENCY_DRIFT: %',signature;
  END IF;
 END LOOP;
END $guard$;

LOCK TABLE public.tasks, public.task_assignment_history IN SHARE ROW EXCLUSIVE MODE;
CREATE TABLE public.task_inbox_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 task_id uuid NOT NULL,
 revision bigint NOT NULL,
 tenant_id uuid NOT NULL,
 recipient_id uuid NOT NULL,
 actor_id uuid,
 created_at timestamptz NOT NULL,
 read_at timestamptz,
 UNIQUE(task_id, revision),
 FOREIGN KEY(task_id,revision) REFERENCES public.task_assignment_history(task_id,revision) ON DELETE CASCADE
);
ALTER TABLE public.task_inbox_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.task_inbox_events FROM PUBLIC,anon,authenticated,service_role;
CREATE INDEX task_inbox_recipient_page ON public.task_inbox_events(tenant_id,recipient_id,created_at DESC,id DESC);
CREATE INDEX task_inbox_unread ON public.task_inbox_events(tenant_id,recipient_id) WHERE read_at IS NULL;
CREATE FUNCTION public.task_inbox_capture_v1() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 -- History is already in the source transaction; acquire no new config/profile locks.
 IF NEW.kind NOT IN ('created','assigned','reassigned') OR NEW.next_user_id IS NULL
   OR NEW.next_user_id IS NOT DISTINCT FROM NEW.actor_id THEN RETURN NEW; END IF;
 INSERT INTO public.task_inbox_events(task_id,revision,tenant_id,recipient_id,actor_id,created_at)
 SELECT NEW.task_id,NEW.revision,NEW.tenant_id,NEW.next_user_id,NEW.actor_id,NEW.recorded_at
 WHERE EXISTS(SELECT 1 FROM public.tasks t
   WHERE t.id=NEW.task_id AND t.tenant_id=NEW.tenant_id
     AND t.assigned_to_user_id=NEW.next_user_id AND t.status IN ('acik','devam_ediyor','gecikti'))
 AND EXISTS(SELECT 1 FROM public.tenant_memberships m WHERE m.tenant_id=NEW.tenant_id
   AND m.user_id=NEW.next_user_id AND m.role IN ('yonetici','operasyon','ik'));
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.task_inbox_capture_v1() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER task_inbox_capture AFTER INSERT ON public.task_assignment_history
 FOR EACH ROW EXECUTE FUNCTION public.task_inbox_capture_v1();

INSERT INTO supabase_migrations.schema_migrations(version,name,statements) VALUES ('20261018000300','task_inbox_capture',ARRAY['BEGIN;
SET LOCAL lock_timeout=''15s'';
DO $guard$
DECLARE signature text; expected text;
BEGIN
 FOR signature,expected IN SELECT key,value FROM jsonb_each_text(''{"current_workspace_modules_v1()": "3440a576578b52477fa5f04463dce712", "ops_comment_context(uuid,uuid)": "47c58200bdbae28385722839011f4edf", "ops_comment_read(uuid,uuid,uuid)": "ba0f6df9707fee3f0bcd38c9169b1cad", "announcement_execute_v1(text,uuid,uuid,text)": "bf8d4c07e3e1aaf68e13ba8afd6283c7", "workspace_require_module_write_v1(uuid,text[])": "8abbd4876d6e24ec59c8feebd2a0ac12", "task_execute_v1(text,uuid,bigint,jsonb,uuid,uuid)": "4dfa8f1df630d4d8bfdf6ad0e334f238"}''::jsonb) LOOP
  IF to_regprocedure(signature) IS NULL OR md5(pg_get_functiondef(to_regprocedure(signature))) IS DISTINCT FROM expected THEN
   RAISE EXCEPTION ''INBOX_DEPENDENCY_DRIFT: %'',signature;
  END IF;
 END LOOP;
END $guard$;

LOCK TABLE public.tasks, public.task_assignment_history IN SHARE ROW EXCLUSIVE MODE;
CREATE TABLE public.task_inbox_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 task_id uuid NOT NULL,
 revision bigint NOT NULL,
 tenant_id uuid NOT NULL,
 recipient_id uuid NOT NULL,
 actor_id uuid,
 created_at timestamptz NOT NULL,
 read_at timestamptz,
 UNIQUE(task_id, revision),
 FOREIGN KEY(task_id,revision) REFERENCES public.task_assignment_history(task_id,revision) ON DELETE CASCADE
);
ALTER TABLE public.task_inbox_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.task_inbox_events FROM PUBLIC,anon,authenticated,service_role;
CREATE INDEX task_inbox_recipient_page ON public.task_inbox_events(tenant_id,recipient_id,created_at DESC,id DESC);
CREATE INDEX task_inbox_unread ON public.task_inbox_events(tenant_id,recipient_id) WHERE read_at IS NULL;
CREATE FUNCTION public.task_inbox_capture_v1() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='''' AS $$
BEGIN
 -- History is already in the source transaction; acquire no new config/profile locks.
 IF NEW.kind NOT IN (''created'',''assigned'',''reassigned'') OR NEW.next_user_id IS NULL
   OR NEW.next_user_id IS NOT DISTINCT FROM NEW.actor_id THEN RETURN NEW; END IF;
 INSERT INTO public.task_inbox_events(task_id,revision,tenant_id,recipient_id,actor_id,created_at)
 SELECT NEW.task_id,NEW.revision,NEW.tenant_id,NEW.next_user_id,NEW.actor_id,NEW.recorded_at
 WHERE EXISTS(SELECT 1 FROM public.tasks t
   WHERE t.id=NEW.task_id AND t.tenant_id=NEW.tenant_id
     AND t.assigned_to_user_id=NEW.next_user_id AND t.status IN (''acik'',''devam_ediyor'',''gecikti''))
 AND EXISTS(SELECT 1 FROM public.tenant_memberships m WHERE m.tenant_id=NEW.tenant_id
   AND m.user_id=NEW.next_user_id AND m.role IN (''yonetici'',''operasyon'',''ik''));
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.task_inbox_capture_v1() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER task_inbox_capture AFTER INSERT ON public.task_assignment_history
 FOR EACH ROW EXECUTE FUNCTION public.task_inbox_capture_v1();
COMMIT;
']);
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

INSERT INTO supabase_migrations.schema_migrations(version,name,statements) VALUES ('20261018000400','task_inbox_access',ARRAY['BEGIN;
SET LOCAL lock_timeout=''15s'';
CREATE FUNCTION public.task_inbox_visible_v1(p_actor uuid,p_tenant uuid)
RETURNS TABLE(id uuid,task_id uuid,title text,created_at timestamptz,read_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='''' AS $$
DECLARE context jsonb;
BEGIN
 context:=public.current_workspace_modules_v1();
 IF p_actor IS NULL OR p_tenant IS NULL OR p_actor IS DISTINCT FROM auth.uid()
 OR context->>''actorId'' IS DISTINCT FROM p_actor::text
 OR context->>''tenantId'' IS DISTINCT FROM p_tenant::text
 OR NOT coalesce(context->>''role'' IN (''yonetici'',''operasyon'',''ik''),false) THEN
  RAISE EXCEPTION ''INBOX_SCOPE'' USING ERRCODE=''42501''; END IF;
 IF NOT coalesce((context->''modules''->>''tasks'')::boolean,false) THEN RETURN; END IF;
 RETURN QUERY SELECT e.id,e.task_id,t.title,e.created_at,e.read_at
 FROM public.task_inbox_events e JOIN public.tasks t ON t.id=e.task_id AND t.tenant_id=e.tenant_id
 WHERE e.tenant_id=p_tenant AND e.recipient_id=p_actor AND t.assigned_to_user_id=p_actor
 AND t.status IN (''acik'',''devam_ediyor'',''gecikti'')
 -- Text/status edits advance task revision without replacing an assignment.
 -- A later assignment invalidates the old event even if reassigned back to this user.
 AND NOT EXISTS(SELECT 1 FROM public.task_assignment_history h WHERE h.task_id=e.task_id
   AND h.revision>e.revision AND h.kind IN (''assigned'',''reassigned'',''unassigned''));
END $$;
REVOKE ALL ON FUNCTION public.task_inbox_visible_v1(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.task_inbox_page_v1(p_actor uuid,p_tenant uuid,p_before uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='''' AS $$
DECLARE anchor timestamptz; rows jsonb; unread bigint; more boolean;
BEGIN
 IF p_before IS NOT NULL THEN
  SELECT v.created_at INTO anchor FROM public.task_inbox_visible_v1(p_actor,p_tenant) v WHERE v.id=p_before;
  IF NOT FOUND THEN RAISE EXCEPTION ''INBOX_CURSOR'' USING ERRCODE=''42501''; END IF;
 END IF;
 WITH visible AS MATERIALIZED(SELECT * FROM public.task_inbox_visible_v1(p_actor,p_tenant)),
 page AS (SELECT * FROM visible WHERE p_before IS NULL OR (created_at,id)<(anchor,p_before)
   ORDER BY created_at DESC,id DESC LIMIT 31),
 bounded AS (SELECT * FROM page ORDER BY created_at DESC,id DESC LIMIT 30)
 SELECT (SELECT count(*) FROM visible WHERE read_at IS NULL),
   (SELECT count(*)>30 FROM page),
   (SELECT coalesce(jsonb_agg(to_jsonb(b) ORDER BY b.created_at DESC,b.id DESC),''[]''::jsonb) FROM bounded b)
 INTO unread,more,rows;
 RETURN jsonb_build_object(''actorId'',p_actor,''tenantId'',p_tenant,''unread'',unread,''items'',rows,
   ''nextCursor'',CASE WHEN more THEN rows->29->>''id'' ELSE NULL END);
END $$;
REVOKE ALL ON FUNCTION public.task_inbox_page_v1(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.task_inbox_page_v1(uuid,uuid,uuid) TO authenticated;

CREATE FUNCTION public.task_inbox_read_v1(p_actor uuid,p_tenant uuid,p_event uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='''' SET lock_timeout=''5s'' AS $$
DECLARE source uuid;
BEGIN
 IF p_actor IS NULL OR p_actor IS DISTINCT FROM auth.uid() OR p_event IS NULL THEN
  RAISE EXCEPTION ''INBOX_SCOPE'' USING ERRCODE=''42501''; END IF;
 PERFORM public.workspace_require_module_write_v1(p_tenant,ARRAY[''tasks'']);
 PERFORM 1 FROM public.profiles WHERE id=p_actor FOR SHARE;
 SELECT e.task_id INTO source FROM public.task_inbox_events e
 WHERE e.id=p_event AND e.tenant_id=p_tenant AND e.recipient_id=p_actor;
 IF NOT FOUND THEN RAISE EXCEPTION ''INBOX_SOURCE'' USING ERRCODE=''42501''; END IF;
 PERFORM 1 FROM public.tasks WHERE id=source AND tenant_id=p_tenant FOR SHARE;
 -- Separate statement after waiting: re-evaluate membership, module and source state.
 IF NOT EXISTS(SELECT 1 FROM public.task_inbox_visible_v1(p_actor,p_tenant) WHERE id=p_event) THEN
  RAISE EXCEPTION ''INBOX_SOURCE'' USING ERRCODE=''42501''; END IF;
 UPDATE public.task_inbox_events SET read_at=coalesce(read_at,statement_timestamp())
 WHERE id=p_event AND tenant_id=p_tenant AND recipient_id=p_actor;
 IF NOT FOUND THEN RAISE EXCEPTION ''INBOX_SOURCE'' USING ERRCODE=''42501''; END IF;
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.task_inbox_read_v1(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.task_inbox_read_v1(uuid,uuid,uuid) TO authenticated;
COMMIT;
']);
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


INSERT INTO supabase_migrations.schema_migrations(version,name,statements) VALUES ('20261018000500','announcement_inbox',ARRAY['BEGIN;
SET LOCAL lock_timeout=''15s'';
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
LANGUAGE plpgsql SECURITY DEFINER SET search_path='''' AS $$
BEGIN
 -- Snapshot the existing audience without taking profile/config locks out of order.
 INSERT INTO public.announcement_inbox_events(announcement_id,tenant_id,recipient_id,created_at)
 SELECT NEW.id,NEW.tenant_id,m.user_id,NEW.created_at FROM public.tenant_memberships m
 WHERE m.tenant_id=NEW.tenant_id AND m.user_id IS DISTINCT FROM NEW.created_by
 AND m.role IN (''yonetici'',''operasyon'',''ik'',''muhasebe'',''goruntuleyici'');
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.announcement_inbox_capture_v1() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER announcement_inbox_capture AFTER INSERT ON public.announcements
 FOR EACH ROW EXECUTE FUNCTION public.announcement_inbox_capture_v1();
CREATE FUNCTION public.announcement_inbox_visible_v1(p_actor uuid,p_tenant uuid)
RETURNS TABLE(id uuid,announcement_id uuid,body text,created_at timestamptz,read_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='''' AS $$
DECLARE context jsonb;
BEGIN
 context:=public.current_workspace_modules_v1();
 IF p_actor IS NULL OR p_tenant IS NULL OR p_actor IS DISTINCT FROM auth.uid()
 OR context->>''actorId'' IS DISTINCT FROM p_actor::text
 OR context->>''tenantId'' IS DISTINCT FROM p_tenant::text
 OR NOT coalesce(context->>''role'' IN (''yonetici'',''operasyon'',''ik'',''muhasebe'',''goruntuleyici''),false) THEN
 RAISE EXCEPTION ''INBOX_SCOPE'' USING ERRCODE=''42501'';END IF;
 IF NOT coalesce((context->''modules''->>''announcements'')::boolean,false) THEN RETURN;END IF;
 RETURN QUERY SELECT e.id,e.announcement_id,a.body,e.created_at,e.read_at
 FROM public.announcement_inbox_events e JOIN public.announcements a ON a.id=e.announcement_id AND a.tenant_id=e.tenant_id
 WHERE e.tenant_id=p_tenant AND e.recipient_id=p_actor;
END $$;
REVOKE ALL ON FUNCTION public.announcement_inbox_visible_v1(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.announcement_inbox_page_v1(p_actor uuid,p_tenant uuid,p_before uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='''' AS $$
DECLARE anchor timestamptz; rows jsonb; unread bigint; more boolean;
BEGIN
 IF p_before IS NOT NULL THEN
  SELECT v.created_at INTO anchor FROM public.announcement_inbox_visible_v1(p_actor,p_tenant) v WHERE v.id=p_before;
  IF NOT FOUND THEN RAISE EXCEPTION ''INBOX_CURSOR'' USING ERRCODE=''42501''; END IF;
 END IF;
 WITH visible AS MATERIALIZED(SELECT * FROM public.announcement_inbox_visible_v1(p_actor,p_tenant)),
 page AS (SELECT * FROM visible WHERE p_before IS NULL OR (created_at,id)<(anchor,p_before)
   ORDER BY created_at DESC,id DESC LIMIT 31),
 bounded AS (SELECT * FROM page ORDER BY created_at DESC,id DESC LIMIT 30)
 SELECT (SELECT count(*) FROM visible WHERE read_at IS NULL),
   (SELECT count(*)>30 FROM page),
   (SELECT coalesce(jsonb_agg(to_jsonb(b) ORDER BY b.created_at DESC,b.id DESC),''[]''::jsonb) FROM bounded b)
 INTO unread,more,rows;
 RETURN jsonb_build_object(''actorId'',p_actor,''tenantId'',p_tenant,''unread'',unread,''items'',rows,
   ''nextCursor'',CASE WHEN more THEN rows->29->>''id'' ELSE NULL END);
END $$;
REVOKE ALL ON FUNCTION public.announcement_inbox_page_v1(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.announcement_inbox_page_v1(uuid,uuid,uuid) TO authenticated;

CREATE FUNCTION public.announcement_inbox_read_v1(p_actor uuid,p_tenant uuid,p_event uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='''' SET lock_timeout=''5s'' AS $$
DECLARE source uuid;
BEGIN
 IF p_actor IS NULL OR p_actor IS DISTINCT FROM auth.uid() OR p_event IS NULL THEN
  RAISE EXCEPTION ''INBOX_SCOPE'' USING ERRCODE=''42501''; END IF;
 PERFORM public.workspace_require_module_write_v1(p_tenant,ARRAY[''announcements'']);
 PERFORM 1 FROM public.profiles WHERE id=p_actor FOR SHARE;
 SELECT e.announcement_id INTO source FROM public.announcement_inbox_events e
 WHERE e.id=p_event AND e.tenant_id=p_tenant AND e.recipient_id=p_actor;
 IF NOT FOUND THEN RAISE EXCEPTION ''INBOX_SOURCE'' USING ERRCODE=''42501''; END IF;
 PERFORM 1 FROM public.announcements WHERE id=source AND tenant_id=p_tenant FOR SHARE;
 -- Separate statement after waiting: re-evaluate membership, module and source state.
 IF NOT EXISTS(SELECT 1 FROM public.announcement_inbox_visible_v1(p_actor,p_tenant) WHERE id=p_event) THEN
  RAISE EXCEPTION ''INBOX_SOURCE'' USING ERRCODE=''42501''; END IF;
 UPDATE public.announcement_inbox_events SET read_at=coalesce(read_at,statement_timestamp())
 WHERE id=p_event AND tenant_id=p_tenant AND recipient_id=p_actor;
 IF NOT FOUND THEN RAISE EXCEPTION ''INBOX_SOURCE'' USING ERRCODE=''42501''; END IF;
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.announcement_inbox_read_v1(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.announcement_inbox_read_v1(uuid,uuid,uuid) TO authenticated;

COMMIT;
']);-- LOCAL CANDIDATE. Requires task and announcement candidates; no production apply.

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

INSERT INTO supabase_migrations.schema_migrations(version,name,statements) VALUES ('20261018000600','workspace_inbox',ARRAY['-- LOCAL CANDIDATE. Requires task and announcement candidates; no production apply.
BEGIN;
SET LOCAL lock_timeout=''15s'';
CREATE FUNCTION public.workspace_inbox_visible_v1(p_actor uuid,p_tenant uuid)
RETURNS TABLE(kind text,id uuid,created_at timestamptz,read_at timestamptz,payload jsonb)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='''' AS $$
DECLARE context jsonb; role_name text;
BEGIN
 context:=public.current_workspace_modules_v1();role_name:=context->>''role'';
 IF p_actor IS NULL OR p_tenant IS NULL OR p_actor IS DISTINCT FROM auth.uid()
 OR context->>''actorId'' IS DISTINCT FROM p_actor::text OR context->>''tenantId'' IS DISTINCT FROM p_tenant::text
 OR NOT coalesce(role_name IN (''yonetici'',''operasyon'',''ik'',''muhasebe'',''goruntuleyici''),false) THEN
 RAISE EXCEPTION ''INBOX_SCOPE'' USING ERRCODE=''42501'';END IF;
 IF role_name IN (''yonetici'',''operasyon'',''ik'') THEN
 RETURN QUERY SELECT ''task_assignment''::text,v.id,v.created_at,v.read_at,
 jsonb_build_object(''taskId'',v.task_id,''title'',v.title) FROM public.task_inbox_visible_v1(p_actor,p_tenant) v;
 END IF;
 RETURN QUERY SELECT ''announcement''::text,v.id,v.created_at,v.read_at,
 jsonb_build_object(''announcementId'',v.announcement_id,''body'',v.body) FROM public.announcement_inbox_visible_v1(p_actor,p_tenant) v;
 IF role_name IN (''yonetici'',''operasyon'') AND coalesce((context->''modules''->>''staffing'')::boolean,false) THEN
 PERFORM public.ops_comment_context(p_actor,p_tenant);
 RETURN QUERY SELECT ''conversation''::text,n.message_id,m.created_at,n.read_at,
 jsonb_build_object(''requestId'',r.id,''companyId'',c.id,''companyName'',c.name,''workDate'',r.work_date,''body'',m.body)
 FROM public.ops_message_notifications n JOIN public.ops_messages m ON m.id=n.message_id AND m.tenant_id=n.tenant_id
 JOIN public.ops_daily_requests r ON r.id=n.request_id AND r.tenant_id=n.tenant_id
 JOIN public.companies c ON c.id=r.company_id AND c.tenant_id=r.tenant_id
 WHERE n.tenant_id=p_tenant AND n.recipient_id=p_actor;
 END IF;
END $$;
REVOKE ALL ON FUNCTION public.workspace_inbox_visible_v1(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.workspace_inbox_page_v1(p_actor uuid,p_tenant uuid,p_before_kind text DEFAULT NULL,p_before_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='''' AS $$
DECLARE anchor timestamptz; rows jsonb; unread bigint; more boolean;
BEGIN
 IF (p_before_kind IS NULL)<>(p_before_id IS NULL) OR (p_before_kind IS NOT NULL AND p_before_kind NOT IN (''task_assignment'',''announcement'',''conversation'')) THEN
 RAISE EXCEPTION ''INBOX_CURSOR'' USING ERRCODE=''22023'';END IF;
 IF p_before_id IS NOT NULL THEN
 SELECT v.created_at INTO anchor FROM public.workspace_inbox_visible_v1(p_actor,p_tenant) v WHERE v.kind=p_before_kind AND v.id=p_before_id;
 IF NOT FOUND THEN RAISE EXCEPTION ''INBOX_CURSOR'' USING ERRCODE=''42501'';END IF;
 END IF;
 WITH visible AS MATERIALIZED(SELECT * FROM public.workspace_inbox_visible_v1(p_actor,p_tenant)),
 page AS (SELECT * FROM visible WHERE p_before_id IS NULL OR (created_at,kind COLLATE "C",id)<(anchor,p_before_kind COLLATE "C",p_before_id)
 ORDER BY created_at DESC,kind COLLATE "C" DESC,id DESC LIMIT 31),
 bounded AS (SELECT * FROM page ORDER BY created_at DESC,kind COLLATE "C" DESC,id DESC LIMIT 30)
 SELECT (SELECT count(*) FROM visible WHERE read_at IS NULL),(SELECT count(*)>30 FROM page),
 (SELECT coalesce(jsonb_agg(to_jsonb(b) ORDER BY b.created_at DESC,b.kind COLLATE "C" DESC,b.id DESC),''[]''::jsonb) FROM bounded b)
 INTO unread,more,rows;
 RETURN jsonb_build_object(''actorId'',p_actor,''tenantId'',p_tenant,''unread'',unread,''items'',rows,
 ''nextCursor'',CASE WHEN more THEN jsonb_build_object(''kind'',rows->29->>''kind'',''id'',rows->29->>''id'') ELSE NULL END);
END $$;
REVOKE ALL ON FUNCTION public.workspace_inbox_page_v1(uuid,uuid,text,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.workspace_inbox_page_v1(uuid,uuid,text,uuid) TO authenticated;

CREATE FUNCTION public.workspace_inbox_read_v1(p_actor uuid,p_tenant uuid,p_kind text,p_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='''' SET lock_timeout=''5s'' AS $$
BEGIN
 IF p_kind IS NULL OR p_kind NOT IN (''task_assignment'',''announcement'',''conversation'') OR p_id IS NULL THEN
 RAISE EXCEPTION ''INBOX_INPUT'' USING ERRCODE=''22023'';END IF;
 IF p_kind=''task_assignment'' THEN RETURN public.task_inbox_read_v1(p_actor,p_tenant,p_id);
 ELSIF p_kind=''announcement'' THEN RETURN public.announcement_inbox_read_v1(p_actor,p_tenant,p_id);
 ELSE RETURN public.ops_comment_read(p_actor,p_tenant,p_id);END IF;
END $$;
REVOKE ALL ON FUNCTION public.workspace_inbox_read_v1(uuid,uuid,text,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.workspace_inbox_read_v1(uuid,uuid,text,uuid) TO authenticated;
COMMIT;
']);COMMIT;