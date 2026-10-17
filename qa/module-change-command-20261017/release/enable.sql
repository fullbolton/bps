-- Separate controlled activation, AFTER install/rehearsal and before UI flag.
BEGIN;
SET LOCAL lock_timeout='15s';
DO $gate$
DECLARE f record;
BEGIN
 SELECT proowner::regrole::text owner,prosecdef,proconfig,md5(prosrc) hash INTO f
 FROM pg_proc WHERE oid=to_regprocedure('public.change_workspace_modules_v1(uuid,uuid,uuid,uuid,text,uuid,jsonb)');
 IF NOT FOUND OR f.owner<>'postgres' OR NOT f.prosecdef OR f.hash<>'f40a3272dfc1a440f28562446b66830a'
 OR NOT coalesce(f.proconfig @> ARRAY['search_path=""','lock_timeout=5s'], false) THEN
  RAISE EXCEPTION 'MODULE_ACTIVATION_DRIFT';
 END IF;
 IF has_function_privilege('anon','public.change_workspace_modules_v1(uuid,uuid,uuid,uuid,text,uuid,jsonb)','EXECUTE')
 OR has_function_privilege('service_role','public.change_workspace_modules_v1(uuid,uuid,uuid,uuid,text,uuid,jsonb)','EXECUTE') THEN
  RAISE EXCEPTION 'MODULE_ACTIVATION_ACL_DRIFT';
 END IF;
END $gate$;
GRANT EXECUTE ON FUNCTION public.change_workspace_modules_v1(uuid,uuid,uuid,uuid,text,uuid,jsonb) TO authenticated;
COMMIT;
