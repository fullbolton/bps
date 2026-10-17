-- Inventory only. Text signals do not prove safety or complete call-graph reachability.
SELECT jsonb_build_object(
 'functions', (SELECT jsonb_agg(jsonb_build_object(
   'signature',p.oid::regprocedure::text,'owner',p.proowner::regrole::text,
   'definer',p.prosecdef,'config',p.proconfig,'bodyMd5',md5(p.prosrc),
   'anonymousExecute',has_function_privilege('anon',p.oid,'execute'),
   'authenticatedExecute',has_function_privilege('authenticated',p.oid,'execute'),
   'serviceExecute',has_function_privilege('service_role',p.oid,'execute'),
   'writeTextSignal',p.prosrc ~* '\m(insert|update|delete|merge|truncate)\M',
   'dynamicSqlSignal',p.prosrc ~* '\mexecute\M',
   'directGuardSignal',position('workspace_require_module_write_v1' in p.prosrc)>0
 ) ORDER BY p.oid::regprocedure::text) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.prokind='f'),
 'triggers',(SELECT jsonb_agg(jsonb_build_object('table',t.tgrelid::regclass::text,'name',t.tgname,'function',t.tgfoid::regprocedure::text,'enabled',t.tgenabled,'definition',pg_get_triggerdef(t.oid)) ORDER BY t.tgrelid::regclass::text,t.tgname) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND NOT t.tgisinternal),
 'foreignKeys',(SELECT jsonb_agg(jsonb_build_object('table',c.conrelid::regclass::text,'name',c.conname,'target',c.confrelid::regclass::text,'definition',pg_get_constraintdef(c.oid)) ORDER BY c.conrelid::regclass::text,c.conname) FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace WHERE n.nspname='public' AND c.contype='f')
);
