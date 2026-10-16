-- Explicit reopen, only AFTER compatible application and post-deploy checks.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
DO $$ DECLARE r record;BEGIN
 IF NOT (session_user IN ('postgres','supabase_admin') OR (session_user='cli_login_postgres' AND current_user='postgres' AND pg_has_role(session_user,'postgres','MEMBER'))) THEN RAISE EXCEPTION 'DIRECT_ADMIN_REQUIRED';END IF;
 FOR r IN SELECT * FROM bps_release_guard.targets ORDER BY schema_name,table_name LOOP
  IF NOT EXISTS(SELECT FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname=r.schema_name AND c.relname=r.table_name AND t.tgname='bps_release_write_guard'
    AND t.tgfoid='bps_release_guard.reject_write()'::regprocedure AND t.tgenabled='O') THEN
   RAISE EXCEPTION 'RELEASE_GUARD_DRIFT: %.%',r.schema_name,r.table_name;
  END IF;
  EXECUTE format('DROP TRIGGER bps_release_write_guard ON %I.%I',r.schema_name,r.table_name);
 END LOOP;
END $$;
DROP TABLE bps_release_guard.targets;
DROP FUNCTION bps_release_guard.reject_write();
DROP SCHEMA bps_release_guard;
COMMIT;
