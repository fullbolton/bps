-- Read-only metadata/aggregates. No employee records or file contents.
SELECT jsonb_build_object(
 'measured_at',clock_timestamp(),
 'versions',(SELECT jsonb_agg(version ORDER BY version) FROM supabase_migrations.schema_migrations),
 'approved_hr_gates',(SELECT count(*) FROM public.hr_access_release_gates WHERE approved),
 'scoped_companies',(SELECT count(*) FROM public.company_hr_access_modes WHERE mode='scoped'),
 'hr_enabled',(SELECT count(*) FROM public.tenant_module_settings WHERE module_key='hr' AND enabled),
 'release_barrier',to_regnamespace('bps_release_guard'),
 'waiting_locks',(SELECT count(*) FROM pg_locks WHERE NOT granted),
 'active_transactions',(SELECT count(*) FROM pg_stat_activity WHERE datname=current_database() AND pid<>pg_backend_pid() AND xact_start IS NOT NULL),
 'storage_policies',(SELECT coalesce(jsonb_agg(p ORDER BY policyname),'[]') FROM pg_policies p WHERE schemaname='storage' AND tablename='objects'),
 'storage_triggers',(SELECT coalesce(jsonb_agg(jsonb_build_object('name',tgname,'definition',pg_get_triggerdef(oid),'enabled',tgenabled) ORDER BY tgname),'[]') FROM pg_trigger WHERE tgrelid='storage.objects'::regclass AND NOT tgisinternal),
 'hr_bucket',(SELECT jsonb_build_object('id',id,'public',public,'file_size_limit',file_size_limit,'allowed_mime_types',allowed_mime_types) FROM storage.buckets WHERE id='hr-private'),
 'target_sizes',(SELECT jsonb_agg(jsonb_build_object('table',relname,'bytes',pg_total_relation_size(c.oid),'estimated_rows',reltuples) ORDER BY relname) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname IN ('hr_employees','hr_employment_periods','hr_assignments','tenant_module_settings','tenant_module_entitlements'))
) AS preflight;
