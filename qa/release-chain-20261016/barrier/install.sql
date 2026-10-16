-- LOCAL-TESTED RELEASE TOOL; NOT an automatically applied migration.
-- Execute only as direct postgres/supabase_admin, never an API connection.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
DO $$ BEGIN
 IF session_user NOT IN ('postgres','supabase_admin') THEN RAISE EXCEPTION 'DIRECT_ADMIN_REQUIRED';END IF;
 -- TRIGGER privilege alone permits installation but does not permit DROP TRIGGER.
 -- Refuse before any changes unless this same role can safely reopen every table.
 IF EXISTS(SELECT FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
   WHERE n.nspname IN ('public','storage') AND c.relkind IN ('r','p')
   AND NOT pg_has_role(current_user,c.relowner,'USAGE')) THEN
  RAISE EXCEPTION 'RELEASE_GUARD_OWNER_PRIVILEGES_REQUIRED';
 END IF;
END $$;
CREATE SCHEMA bps_release_guard;
REVOKE ALL ON SCHEMA bps_release_guard FROM PUBLIC;
CREATE TABLE bps_release_guard.targets(schema_name text,table_name text,PRIMARY KEY(schema_name,table_name));
REVOKE ALL ON bps_release_guard.targets FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION bps_release_guard.reject_write() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 -- SECURITY DEFINER RPCs change current_user, but not the connection's session_user.
 -- API authenticator and Storage login must therefore remain blocked inside RPCs.
 IF session_user NOT IN ('postgres','supabase_admin') THEN
  RAISE EXCEPTION 'BPS_RELEASE_MAINTENANCE' USING ERRCODE='PT503';
 END IF;
 RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION bps_release_guard.reject_write() FROM PUBLIC,anon,authenticated,service_role;
DO $$ DECLARE r record;BEGIN
 FOR r IN SELECT n.nspname,c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname IN ('public','storage') AND c.relkind IN ('r','p') ORDER BY n.nspname,c.relname LOOP
  -- Waits for existing DML transactions; ordinary SELECT remains possible.
  EXECUTE format('LOCK TABLE %I.%I IN SHARE ROW EXCLUSIVE MODE',r.nspname,r.relname);
  EXECUTE format('CREATE TRIGGER bps_release_write_guard BEFORE INSERT OR UPDATE OR DELETE OR TRUNCATE ON %I.%I FOR EACH STATEMENT EXECUTE FUNCTION bps_release_guard.reject_write()',r.nspname,r.relname);
  INSERT INTO bps_release_guard.targets VALUES(r.nspname,r.relname);
 END LOOP;
END $$;
COMMIT;
