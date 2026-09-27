-- Requires local acceptance before any future production apply.
-- Existing task policies are deliberately unchanged. Deploy this before CAS code.
BEGIN;
SET LOCAL lock_timeout='15s';
LOCK TABLE public.tasks IN ACCESS EXCLUSIVE MODE;

ALTER TABLE public.tasks ADD COLUMN revision bigint NOT NULL DEFAULT 0
  CHECK(revision BETWEEN 0 AND 9007199254740991);
CREATE TABLE public.task_assignment_history (
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  revision bigint NOT NULL CHECK(revision BETWEEN 0 AND 9007199254740991),
  tenant_id uuid NOT NULL,
  kind text NOT NULL CHECK(kind IN ('baseline','created','assigned','reassigned','unassigned')),
  previous_user_id uuid,
  next_user_id uuid,
  actor_id uuid,
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(task_id,revision)
);
ALTER TABLE public.task_assignment_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY task_assignment_history_read ON public.task_assignment_history
  FOR SELECT TO authenticated USING (
    tenant_id=public.current_user_verified_tenant()
    AND EXISTS(SELECT 1 FROM public.tasks t WHERE t.id=task_id AND t.tenant_id=task_assignment_history.tenant_id)
  );
REVOKE ALL ON public.task_assignment_history FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.task_assignment_history TO authenticated;

INSERT INTO public.task_assignment_history(task_id,revision,tenant_id,kind,next_user_id)
SELECT id,revision,tenant_id,'baseline',assigned_to_user_id FROM public.tasks;

CREATE FUNCTION public.tasks_advance_revision() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
  IF TG_OP='INSERT' THEN NEW.revision:=0;
  ELSE
    IF NEW.id IS DISTINCT FROM OLD.id OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
       OR NEW.company_id IS DISTINCT FROM OLD.company_id THEN RAISE EXCEPTION 'TASK_CONTEXT_IMMUTABLE'; END IF;
    NEW.revision:=OLD.revision+1;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER tasks_advance_revision BEFORE INSERT OR UPDATE ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.tasks_advance_revision();

CREATE FUNCTION public.tasks_record_assignment() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF TG_OP='INSERT' THEN
    INSERT INTO public.task_assignment_history(task_id,revision,tenant_id,kind,next_user_id,actor_id)
    VALUES(NEW.id,NEW.revision,NEW.tenant_id,'created',NEW.assigned_to_user_id,auth.uid());
  ELSIF NEW.assigned_to_user_id IS DISTINCT FROM OLD.assigned_to_user_id THEN
    INSERT INTO public.task_assignment_history(task_id,revision,tenant_id,kind,previous_user_id,next_user_id,actor_id)
    VALUES(NEW.id,NEW.revision,NEW.tenant_id,
      CASE WHEN NEW.assigned_to_user_id IS NULL THEN 'unassigned'
           WHEN OLD.assigned_to_user_id IS NULL THEN 'assigned' ELSE 'reassigned' END,
      OLD.assigned_to_user_id,NEW.assigned_to_user_id,auth.uid());
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER tasks_record_assignment AFTER INSERT OR UPDATE ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.tasks_record_assignment();
REVOKE ALL ON FUNCTION public.tasks_advance_revision(),public.tasks_record_assignment() FROM PUBLIC,anon,authenticated;
COMMIT;
