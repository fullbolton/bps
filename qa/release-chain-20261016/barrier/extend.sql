-- Run after each migration batch while application traffic remains closed.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
DO $$ DECLARE r record;BEGIN
 IF session_user NOT IN ('postgres','supabase_admin') THEN RAISE EXCEPTION 'DIRECT_ADMIN_REQUIRED';END IF;
 FOR r IN SELECT n.nspname,c.relname,c.oid FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname IN ('public','storage') AND c.relkind IN ('r','p') ORDER BY n.nspname,c.relname LOOP
  EXECUTE format('LOCK TABLE %I.%I IN SHARE ROW EXCLUSIVE MODE',r.nspname,r.relname);
  IF EXISTS(SELECT FROM bps_release_guard.targets WHERE schema_name=r.nspname AND table_name=r.relname) THEN
   IF NOT EXISTS(SELECT FROM pg_trigger t WHERE t.tgrelid=r.oid AND t.tgname='bps_release_write_guard'
     AND t.tgfoid='bps_release_guard.reject_write()'::regprocedure AND t.tgenabled='O' AND t.tgtype=62) THEN
    RAISE EXCEPTION 'RELEASE_GUARD_DRIFT: %.%',r.nspname,r.relname;
   END IF;
  ELSE
   EXECUTE format('CREATE TRIGGER bps_release_write_guard BEFORE INSERT OR UPDATE OR DELETE OR TRUNCATE ON %I.%I FOR EACH STATEMENT EXECUTE FUNCTION bps_release_guard.reject_write()',r.nspname,r.relname);
   INSERT INTO bps_release_guard.targets VALUES(r.nspname,r.relname);
  END IF;
 END LOOP;
END $$;
COMMIT;
