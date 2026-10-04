-- Read-only: no lead contents, phone numbers or emails.
BEGIN READ ONLY;
SELECT tablename,policyname,cmd,permissive,roles,qual,with_check FROM pg_policies
WHERE schemaname='public' AND tablename IN ('demo_requests','critical_dates','appointments','contracts','documents','staffing_demands','tasks','workforce_summary');
SELECT (SELECT count(*) FROM public.tenants) tenants,(SELECT count(*) FROM public.demo_requests) demo_rows;
SELECT rolname,rolconfig,rolsuper,rolbypassrls FROM pg_roles WHERE rolname IN ('authenticator','anon','authenticated','service_role');
SELECT a.attname,format_type(a.atttypid,a.atttypmod) data_type,a.attnotnull,pg_get_expr(d.adbin,d.adrelid) default_expression
FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
WHERE a.attrelid='public.critical_dates'::regclass AND a.attnum>0 AND NOT a.attisdropped;
SELECT grantee,privilege_type FROM information_schema.role_table_grants WHERE table_schema='public' AND table_name='demo_requests';
SELECT table_name,column_name,grantee,privilege_type FROM information_schema.column_privileges WHERE table_schema='public' AND table_name IN ('demo_requests','critical_dates');
SELECT pg_get_functiondef(to_regprocedure('public.current_user_verified_tenant()'));
SELECT pg_get_functiondef(to_regprocedure('public.current_user_role()'));
SELECT pg_get_functiondef(to_regprocedure('public.is_platform_admin()'));
COMMIT;
