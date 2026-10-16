-- Read-only role/session metadata; excludes query text, addresses and business rows.
BEGIN READ ONLY;
SET LOCAL statement_timeout='15s';
SET LOCAL ROLE postgres;
SELECT jsonb_build_object(
 'measuredAt',clock_timestamp(),
 'sessionUser',session_user,'currentUser',current_user,
 'storageTriggerPrivilege',has_table_privilege(current_user,'storage.objects','TRIGGER'),
 'storageOwnerRoleUsage',(SELECT pg_has_role(current_user,relowner,'USAGE') FROM pg_class WHERE oid='storage.objects'::regclass),
 'sessions',(SELECT coalesce(jsonb_agg(x),'[]') FROM (SELECT usename,backend_type,state,count(*) AS count FROM pg_stat_activity WHERE datname=current_database() AND pid<>pg_backend_pid() GROUP BY usename,backend_type,state ORDER BY usename,backend_type,state)x),
 'roles',(SELECT coalesce(jsonb_agg(x),'[]') FROM (SELECT rolname,rolcanlogin,rolsuper,rolbypassrls FROM pg_roles WHERE rolcanlogin OR rolname IN ('anon','authenticated','service_role') ORDER BY rolname)x),
 'extensions',(SELECT coalesce(jsonb_agg(extname ORDER BY extname),'[]') FROM pg_extension WHERE extname IN ('pg_cron','pg_net')),
 'cronTableExists',to_regclass('cron.job') IS NOT NULL);
ROLLBACK;
