-- Read-only production baseline and schema inspection for block 1.
BEGIN READ ONLY;
SELECT version,name FROM supabase_migrations.schema_migrations WHERE version >= '20260909000100' ORDER BY version;
SELECT table_name,column_name,data_type FROM information_schema.columns
WHERE table_schema='public' AND table_name IN ('ops_assignments','ops_daily_requests','ops_start_plans','ops_start_events','ops_commands','companies') ORDER BY table_name,ordinal_position;
SELECT p.oid::regprocedure::text AS signature,r.rolname AS owner,p.prosecdef,p.proconfig,p.proacl::text,md5(pg_get_functiondef(p.oid)) AS definition_md5
FROM pg_proc p JOIN pg_roles r ON r.oid=p.proowner
WHERE p.pronamespace='public'::regnamespace AND p.proname IN ('ops_start_board_filtered','ops_start_execute','ops_import_locations','ops_create_request_batch','ops_resize_request','ops_replace_assignment','ops_replace_assignment_before_start','ops_set_directory_active','ops_mutate','workspace_setup') ORDER BY 1;
COMMIT;
