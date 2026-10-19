SELECT jsonb_build_object(
 'measured_at',clock_timestamp(),
 'waiting_locks',(SELECT count(*) FROM pg_locks WHERE NOT granted),
 'active_transactions',(SELECT count(*) FROM pg_stat_activity WHERE datname=current_database() AND pid<>pg_backend_pid() AND xact_start IS NOT NULL),
 'oldest_transaction_seconds',(SELECT coalesce(max(extract(epoch FROM clock_timestamp()-xact_start)),0) FROM pg_stat_activity WHERE datname=current_database() AND pid<>pg_backend_pid()),
 'targets',(SELECT jsonb_agg(jsonb_build_object('table',c.relname,'bytes',pg_total_relation_size(c.oid),'estimated_rows',c.reltuples) ORDER BY c.relname) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname IN('tenant_module_config','tenant_module_settings','tenant_module_changes'))
) AS load;
