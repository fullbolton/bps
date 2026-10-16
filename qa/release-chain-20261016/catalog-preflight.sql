-- Read-only metadata only. No business, auth-user or Storage-object rows.
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout='30s';
SET LOCAL lock_timeout='5s';
SELECT jsonb_build_object(
 'measuredAt',clock_timestamp(),
 'database',current_database(),
 'serverVersion',current_setting('server_version'),
 'migrations',(SELECT coalesce(jsonb_agg(version ORDER BY version),'[]'::jsonb) FROM supabase_migrations.schema_migrations),
 'functions',(SELECT coalesce(jsonb_agg(jsonb_build_object(
   'signature',p.oid::regprocedure::text,'definitionMd5',md5(pg_get_functiondef(p.oid)),
   'owner',pg_get_userbyid(p.proowner),'securityDefiner',p.prosecdef,'acl',p.proacl::text)
   ORDER BY p.oid::regprocedure::text),'[]'::jsonb)
   FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='public' AND p.prokind='f'),
 'tables',(SELECT coalesce(jsonb_agg(jsonb_build_object('schema',n.nspname,'table',c.relname,
   'rls',c.relrowsecurity,'forceRls',c.relforcerowsecurity) ORDER BY n.nspname,c.relname),'[]'::jsonb)
   FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
   WHERE n.nspname IN ('public','storage') AND c.relkind IN ('r','p')),
 'policies',(SELECT coalesce(jsonb_agg(jsonb_build_object('schema',schemaname,'table',tablename,
   'name',policyname,'mode',permissive,'roles',roles,'command',cmd,
   'usingMd5',md5(qual),'checkMd5',md5(with_check)) ORDER BY schemaname,tablename,policyname),'[]'::jsonb)
   FROM pg_policies WHERE schemaname IN ('public','storage'))
);
ROLLBACK;
