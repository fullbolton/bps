-- Stops new client invocations; does not undo committed settings or in-flight calls.
BEGIN;
REVOKE ALL ON FUNCTION public.change_workspace_modules_v1(uuid,uuid,uuid,uuid,text,uuid,jsonb) FROM PUBLIC,anon,authenticated,service_role;
COMMIT;
