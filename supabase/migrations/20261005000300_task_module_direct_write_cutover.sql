-- Contract phase: apply ONLY after the frontend using task_execute_v1 has been deployed.
-- Expand migration 001000 remains compatible with old task clients while all modules are enabled.
-- This contract denies stale clients instead of silently bypassing module checks.
BEGIN;
SET LOCAL lock_timeout='15s';
LOCK TABLE public.tasks IN ACCESS EXCLUSIVE MODE;
DO $$ BEGIN
 IF to_regprocedure('public.task_execute_v1(text,uuid,bigint,jsonb,uuid,uuid)') IS NULL THEN
  RAISE EXCEPTION 'TASK_GATEWAY_REQUIRED';
 END IF;
END $$;
-- No API client can bypass the new gateway with direct DML. Definer workflows remain M2b work.
REVOKE INSERT,UPDATE,DELETE ON public.tasks FROM PUBLIC,anon,authenticated,service_role;
DO $$ BEGIN
 IF has_any_column_privilege('authenticated','public.tasks','INSERT,UPDATE')
 OR has_table_privilege('authenticated','public.tasks','DELETE') THEN
  RAISE EXCEPTION 'TASK_DIRECT_WRITE_GRANT_REMAINS';
 END IF;
END $$;
NOTIFY pgrst,'reload schema';
COMMIT;
