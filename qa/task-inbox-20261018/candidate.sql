-- LOCAL CANDIDATE ONLY: no reader/grant/UI rollout. No historical backfill.
BEGIN;
SET LOCAL lock_timeout='15s';
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
COMMIT;
