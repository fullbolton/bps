-- Run after each migration batch while application traffic remains closed.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
DO $$ DECLARE r record;BEGIN
 IF NOT (session_user IN ('postgres','supabase_admin') OR (session_user='cli_login_postgres' AND current_user='postgres' AND pg_has_role(session_user,'postgres','MEMBER'))) THEN RAISE EXCEPTION 'DIRECT_ADMIN_REQUIRED';END IF;
 -- TRIGGER privilege alone permits installation but does not permit DROP TRIGGER.
 -- Refuse before any changes unless this same role can safely reopen every table.
 IF EXISTS(SELECT FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
   WHERE (n.nspname='public' OR (n.nspname='storage' AND c.relname IN ('objects','buckets','prefixes','s3_multipart_uploads','s3_multipart_uploads_parts'))) AND c.relkind IN ('r','p')
   AND NOT (pg_has_role(current_user,c.relowner,'USAGE') OR
    coalesce((coalesce(nullif(current_setting('supautils.drop_trigger_grants',true),'')::jsonb,'{}'::jsonb)->current_user) ? (n.nspname||'.'||c.relname),false))) THEN
  RAISE EXCEPTION 'RELEASE_GUARD_OWNER_PRIVILEGES_REQUIRED';
 END IF;
 FOR r IN SELECT n.nspname,c.relname,c.oid FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE (n.nspname='public' OR (n.nspname='storage' AND c.relname IN ('objects','buckets','prefixes','s3_multipart_uploads','s3_multipart_uploads_parts'))) AND c.relkind IN ('r','p') ORDER BY n.nspname,c.relname LOOP
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
