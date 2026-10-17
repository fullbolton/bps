BEGIN; SET LOCAL lock_timeout='15s'; SET LOCAL statement_timeout='60s';
LOCK TABLE supabase_migrations.schema_migrations IN EXCLUSIVE MODE;
DO $ledger$ BEGIN IF (SELECT array_agg(version ORDER BY version) FROM supabase_migrations.schema_migrations) IS DISTINCT FROM ARRAY['20260407000000','20260407000100','20260407000200','20260407000300','20260407000400','20260407000500','20260407000600','20260407000700','20260407000800','20260407000900','20260407001000','20260407001100','20260407001600','20260407001700','20260407001800','20260413000100','20260414000100','20260414000200','20260415000100','20260415000200','20260415000300','20260415000400','20260415000500','20260423000100','20260425000100','20260425000200','20260713000100','20260713000200','20260722000100','20260810000100','20260810000200','20260827000100','20260827000200','20260827000300','20260827000400','20260904000100','20260904000200','20260909000100','20260909000200','20260909000300','20260909000400','20260909000500','20260909000600','20260909000700','20260909000800','20260909000900','20260909001000','20260909001100','20260909001200','20260909001300','20260909001400','20260909001500','20260909001600','20260909001700','20260909001800','20260909001900','20260909002000','20260909002100','20260909002200','20260909002300','20260909002400','20260909002500','20260909002600','20260909002700','20260909002800','20260909002900','20260910000100','20260910000200','20260910000300','20260910000400','20260911000100','20260913000100','20260914000100','20260914000200','20260914000300','20260914000400','20260914000500','20260914000600','20260914000700','20260915000100','20260915000200','20260915000300','20260915000400','20260915000500','20260915000600','20260915000700','20260915000800','20260915000900','20260915001000','20260923000100','20260923000200','20260923000300','20260923000400','20260924000100','20260924000200','20260924000300','20260924000400','20260924000500','20260925000100','20260925000200','20260925000300','20260925000400','20260925000500','20260925000600','20260925000700','20260926000100','20260926000200','20260927000100','20260927000200','20260927000300','20260927000400','20260927000500','20260927000600','20260927000700','20260927000800','20260927000900','20260928000100','20260928000200','20260928000300','20260928000400','20260928000500','20260928000600','20260928000700','20260928000800','20261004001000','20261004001100','20261004001200','20261004001300','20261004001400','20261005000100','20261005000200','20261005000300','20261005000400','20261005000500','20261005000600','20261005000700','20261005000800','20261005000900','20261005001000','20261005001100','20261005001200','20261005001300','20261005001400','20261005001500','20261005001600','20261005001700','20261005001800','20261005001900','20261005002000','20261005002100','20261005002200','20261005002300','20261005002400','20261005002500','20261005002600','20261005002700','20261005002800','20261005002900','20261005003000','20261005003100','20261013000100','20261013000200','20261013000300','20261015000100','20261015000200','20261015000300','20261015000400','20261015000500','20261015000600','20261015000700','20261015000800','20261016000100','20261016000200','20261016000300','20261016000400','20261016000500','20261016000600','20261016000700','20261016000800','20261016000900','20261016001000','20261016001100']::text[] THEN RAISE EXCEPTION 'MODULE_RELEASE_LEDGER_DRIFT'; END IF; END $ledger$;
-- Legacy staffing boundaries. Does not grant or enable module configuration changes.
SET LOCAL lock_timeout='15s';
LOCK TABLE public.staffing_demands,public.workforce_summary IN ACCESS EXCLUSIVE MODE;
DO $guard$
DECLARE relation regclass; name text;
BEGIN
 IF to_regprocedure('public.workspace_require_module_write_v1(uuid,text[])') IS NULL
 OR to_regprocedure('public.workspace_module_enabled_v1(text)') IS NULL THEN
  RAISE EXCEPTION 'LEGACY_STAFFING_MODULE_PREREQUISITE';
 END IF;
 FOREACH name IN ARRAY ARRAY['staffing_demands','workforce_summary'] LOOP
  relation:=to_regclass('public.'||name);
  IF NOT EXISTS(SELECT FROM pg_class WHERE oid=relation AND relkind='r' AND relrowsecurity)
   OR NOT EXISTS(SELECT FROM pg_attribute WHERE attrelid=relation AND attname='tenant_id'
    AND atttypid='uuid'::regtype AND attnotnull AND NOT attisdropped) THEN
   RAISE EXCEPTION 'LEGACY_STAFFING_MODULE_SCHEMA: %',name;
  END IF;
 END LOOP;
END $guard$;
CREATE FUNCTION public.legacy_staffing_write_barrier_v1() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' SET lock_timeout='5s' AS $$
DECLARE tenant uuid;
BEGIN
 IF auth.role()='authenticated' THEN
  tenant:=public.current_user_verified_tenant();
  PERFORM public.workspace_require_module_write_v1(tenant,ARRAY['staffing']);
  PERFORM 1 FROM public.profiles WHERE id=auth.uid() FOR SHARE;
  PERFORM public.workspace_require_module_write_v1(tenant,ARRAY['staffing']);
 END IF;
 RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION public.legacy_staffing_write_barrier_v1() FROM PUBLIC,anon,authenticated,service_role;
-- Statement triggers acquire config before UPDATE/DELETE lock business rows.
CREATE TRIGGER staffing_demands_module_write BEFORE INSERT OR UPDATE OR DELETE ON public.staffing_demands
FOR EACH STATEMENT EXECUTE FUNCTION public.legacy_staffing_write_barrier_v1();
CREATE TRIGGER workforce_summary_module_write BEFORE INSERT OR UPDATE OR DELETE ON public.workforce_summary
FOR EACH STATEMENT EXECUTE FUNCTION public.legacy_staffing_write_barrier_v1();
CREATE POLICY staffing_demands_module_fence ON public.staffing_demands AS RESTRICTIVE FOR ALL TO authenticated
USING (tenant_id=public.current_user_verified_tenant() AND (SELECT public.workspace_module_enabled_v1('staffing')))
WITH CHECK (tenant_id=public.current_user_verified_tenant() AND (SELECT public.workspace_module_enabled_v1('staffing')));
CREATE POLICY workforce_summary_module_fence ON public.workforce_summary AS RESTRICTIVE FOR ALL TO authenticated
USING (tenant_id=public.current_user_verified_tenant() AND (SELECT public.workspace_module_enabled_v1('staffing')))
WITH CHECK (tenant_id=public.current_user_verified_tenant() AND (SELECT public.workspace_module_enabled_v1('staffing')));
INSERT INTO supabase_migrations.schema_migrations(version,name,statements) VALUES ('20261017000100','legacy_staffing_module_barriers',ARRAY['-- Legacy staffing boundaries. Does not grant or enable module configuration changes.
BEGIN;
SET LOCAL lock_timeout=''15s'';
LOCK TABLE public.staffing_demands,public.workforce_summary IN ACCESS EXCLUSIVE MODE;
DO $guard$
DECLARE relation regclass; name text;
BEGIN
 IF to_regprocedure(''public.workspace_require_module_write_v1(uuid,text[])'') IS NULL
 OR to_regprocedure(''public.workspace_module_enabled_v1(text)'') IS NULL THEN
  RAISE EXCEPTION ''LEGACY_STAFFING_MODULE_PREREQUISITE'';
 END IF;
 FOREACH name IN ARRAY ARRAY[''staffing_demands'',''workforce_summary''] LOOP
  relation:=to_regclass(''public.''||name);
  IF NOT EXISTS(SELECT FROM pg_class WHERE oid=relation AND relkind=''r'' AND relrowsecurity)
   OR NOT EXISTS(SELECT FROM pg_attribute WHERE attrelid=relation AND attname=''tenant_id''
    AND atttypid=''uuid''::regtype AND attnotnull AND NOT attisdropped) THEN
   RAISE EXCEPTION ''LEGACY_STAFFING_MODULE_SCHEMA: %'',name;
  END IF;
 END LOOP;
END $guard$;
CREATE FUNCTION public.legacy_staffing_write_barrier_v1() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='''' SET lock_timeout=''5s'' AS $$
DECLARE tenant uuid;
BEGIN
 IF auth.role()=''authenticated'' THEN
  tenant:=public.current_user_verified_tenant();
  PERFORM public.workspace_require_module_write_v1(tenant,ARRAY[''staffing'']);
  PERFORM 1 FROM public.profiles WHERE id=auth.uid() FOR SHARE;
  PERFORM public.workspace_require_module_write_v1(tenant,ARRAY[''staffing'']);
 END IF;
 RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION public.legacy_staffing_write_barrier_v1() FROM PUBLIC,anon,authenticated,service_role;
-- Statement triggers acquire config before UPDATE/DELETE lock business rows.
CREATE TRIGGER staffing_demands_module_write BEFORE INSERT OR UPDATE OR DELETE ON public.staffing_demands
FOR EACH STATEMENT EXECUTE FUNCTION public.legacy_staffing_write_barrier_v1();
CREATE TRIGGER workforce_summary_module_write BEFORE INSERT OR UPDATE OR DELETE ON public.workforce_summary
FOR EACH STATEMENT EXECUTE FUNCTION public.legacy_staffing_write_barrier_v1();
CREATE POLICY staffing_demands_module_fence ON public.staffing_demands AS RESTRICTIVE FOR ALL TO authenticated
USING (tenant_id=public.current_user_verified_tenant() AND (SELECT public.workspace_module_enabled_v1(''staffing'')))
WITH CHECK (tenant_id=public.current_user_verified_tenant() AND (SELECT public.workspace_module_enabled_v1(''staffing'')));
CREATE POLICY workforce_summary_module_fence ON public.workforce_summary AS RESTRICTIVE FOR ALL TO authenticated
USING (tenant_id=public.current_user_verified_tenant() AND (SELECT public.workspace_module_enabled_v1(''staffing'')))
WITH CHECK (tenant_id=public.current_user_verified_tenant() AND (SELECT public.workspace_module_enabled_v1(''staffing'')));
COMMIT;
']);
-- An expired/terminated contract can still have an unfinished file reservation.
-- Advisory preview and future atomic closer must not strand that upload.
SET LOCAL lock_timeout='15s';
DO $patch$
DECLARE target regprocedure:=to_regprocedure('public.preview_workspace_modules_v1(uuid,uuid,text,jsonb)'); definition text;
 anchor text:=$old$ RETURN jsonb_build_object('schemaVersion',1,'context',context,'requested',p_modules,$old$;
 addition text:=$new$ IF 'contracts'=ANY(disabled) THEN
  SELECT EXISTS(SELECT FROM public.contract_pdf_upload_commands
   WHERE tenant_id=tenant AND state IN ('pending','publishing')) INTO present;
  checks:=checks||jsonb_build_array(jsonb_build_object('module','contracts','code','pending_contract_upload','blocking',present));
 END IF;
$new$;
BEGIN
 IF target IS NULL OR (SELECT md5(prosrc) FROM pg_proc WHERE oid=target) IS DISTINCT FROM '4cde00fbcf8756586146ad19aba5d398' THEN
  RAISE EXCEPTION 'MODULE_PREVIEW_BODY_DRIFT';END IF;
 definition:=pg_get_functiondef(target);
 IF (length(definition)-length(replace(definition,anchor,'')))/length(anchor)<>1 THEN
  RAISE EXCEPTION 'MODULE_PREVIEW_ANCHOR';END IF;
 EXECUTE replace(definition,anchor,addition||anchor);
END $patch$;
NOTIFY pgrst,'reload schema';
INSERT INTO supabase_migrations.schema_migrations(version,name,statements) VALUES ('20261017000200','contract_upload_module_preview',ARRAY['-- An expired/terminated contract can still have an unfinished file reservation.
-- Advisory preview and future atomic closer must not strand that upload.
BEGIN;
SET LOCAL lock_timeout=''15s'';
DO $patch$
DECLARE target regprocedure:=to_regprocedure(''public.preview_workspace_modules_v1(uuid,uuid,text,jsonb)''); definition text;
 anchor text:=$old$ RETURN jsonb_build_object(''schemaVersion'',1,''context'',context,''requested'',p_modules,$old$;
 addition text:=$new$ IF ''contracts''=ANY(disabled) THEN
  SELECT EXISTS(SELECT FROM public.contract_pdf_upload_commands
   WHERE tenant_id=tenant AND state IN (''pending'',''publishing'')) INTO present;
  checks:=checks||jsonb_build_array(jsonb_build_object(''module'',''contracts'',''code'',''pending_contract_upload'',''blocking'',present));
 END IF;
$new$;
BEGIN
 IF target IS NULL OR (SELECT md5(prosrc) FROM pg_proc WHERE oid=target) IS DISTINCT FROM ''4cde00fbcf8756586146ad19aba5d398'' THEN
  RAISE EXCEPTION ''MODULE_PREVIEW_BODY_DRIFT'';END IF;
 definition:=pg_get_functiondef(target);
 IF (length(definition)-length(replace(definition,anchor,'''')))/length(anchor)<>1 THEN
  RAISE EXCEPTION ''MODULE_PREVIEW_ANCHOR'';END IF;
 EXECUTE replace(definition,anchor,addition||anchor);
END $patch$;
NOTIFY pgrst,''reload schema'';
COMMIT;
']);
-- Installs the reviewed atomic command with all client EXECUTE privileges revoked.
-- Enable only after write-boundary acceptance and release preflight.
SET LOCAL lock_timeout='15s';
CREATE FUNCTION public.change_workspace_modules_v1(
 p_actor uuid,p_tenant uuid,p_membership_version uuid,p_selection_version uuid,
 p_revision text,p_command uuid,p_modules jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path='' SET lock_timeout='5s' AS $$
DECLARE context jsonb; assessment jsonb; fingerprint text;
 receipt public.tenant_module_changes; next_revision bigint;
BEGIN
 IF current_setting('transaction_isolation')<>'read committed' THEN
  RAISE EXCEPTION 'MODULE_ISOLATION' USING ERRCODE='25000';
 END IF;
 IF p_actor IS NULL OR auth.uid() IS DISTINCT FROM p_actor OR p_tenant IS NULL
  OR p_tenant IS DISTINCT FROM public.current_user_verified_tenant()
  OR p_command IS NULL OR p_membership_version IS NULL OR p_revision IS NULL THEN
  RAISE EXCEPTION 'MODULE_CHANGE_SCOPE' USING ERRCODE='42501';
 END IF;
 -- Same order as business commands: config, profile, then live membership snapshot.
 PERFORM 1 FROM public.tenant_module_config WHERE tenant_id=p_tenant FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'MODULE_CONFIG_MISSING' USING ERRCODE='55000';END IF;
 PERFORM 1 FROM public.profiles WHERE id=p_actor FOR SHARE;
 context:=public.current_workspace_modules_v1();
 IF context->>'actorId' IS DISTINCT FROM p_actor::text
  OR context->>'tenantId' IS DISTINCT FROM p_tenant::text
  OR context->>'role' IS DISTINCT FROM 'yonetici'
  OR context->>'membershipVersion' IS DISTINCT FROM p_membership_version::text
  OR context->>'selectionVersion' IS DISTINCT FROM p_selection_version::text THEN
  RAISE EXCEPTION 'MODULE_CHANGE_SCOPE' USING ERRCODE='42501';
 END IF;
 fingerprint:=encode(sha256(convert_to(jsonb_build_object(
  'actor',p_actor,'tenant',p_tenant,'membership',p_membership_version,
  'selection',p_selection_version,'revision',p_revision,'modules',p_modules)::text,'UTF8')),'hex');
 SELECT * INTO receipt FROM public.tenant_module_changes WHERE tenant_id=p_tenant AND command_id=p_command;
 IF FOUND THEN
  IF receipt.kind<>'settings' OR receipt.actor_id IS DISTINCT FROM p_actor OR receipt.request_hash<>fingerprint THEN
   RAISE EXCEPTION 'MODULE_COMMAND_REUSED' USING ERRCODE='22023';
  END IF;
  RETURN jsonb_build_object('schemaVersion',1,'actorId',p_actor,'tenantId',p_tenant,'commandId',p_command,'revision',receipt.after_revision::text,'modules',receipt.after_state,'replayed',true);
 END IF;
 -- Separate post-lock statement: committed work from a waiting writer is visible.
 assessment:=public.preview_workspace_modules_v1(p_actor,p_tenant,p_revision,p_modules);
 -- Fail closed if a future helper revision omits a required assessment.
 IF jsonb_typeof(assessment) IS DISTINCT FROM 'object'
 OR assessment->'schemaVersion' IS DISTINCT FROM '1'::jsonb
 OR assessment->'context' IS DISTINCT FROM context
 OR assessment->'requested' IS DISTINCT FROM p_modules
 OR jsonb_typeof(assessment->'dependencies') IS DISTINCT FROM 'array'
 OR jsonb_typeof(assessment->'checks') IS DISTINCT FROM 'array' THEN
  RAISE EXCEPTION 'MODULE_ASSESSMENT_INVALID' USING ERRCODE='55000';
 END IF;
 IF EXISTS(SELECT FROM jsonb_array_elements(assessment->'checks') c
  WHERE jsonb_typeof(c->'blocking') IS DISTINCT FROM 'boolean') THEN
  RAISE EXCEPTION 'MODULE_ASSESSMENT_INVALID' USING ERRCODE='55000';
 END IF;
 -- Generated from MODULE_CHANGE_CHECKS; fixture test verifies exact agreement.
 IF (SELECT coalesce(jsonb_agg(jsonb_build_object('module',m,'code',code) ORDER BY m,code),'[]'::jsonb)
  FROM (VALUES
   ('tasks','unfinished_tasks'),
   ('calendar','unfinished_appointments'),
   ('contracts','unfinished_contracts'),
   ('talent','pending_talent_import'),
   ('talent','pending_talent_files'),
   ('staffing','open_staffing_demands'),
   ('staffing','upcoming_requests'),
   ('staffing','upcoming_assignments'),
   ('staffing','unapproved_work'),
   ('staffing','active_roster'),
   ('staffing','active_schedules'),
   ('reporting','open_reporting_periods'),
   ('reporting','pending_reporting_imports'),
   ('customers','customer_linked_tasks'),
   ('calendar','appointment_linked_tasks'),
   ('contracts','contract_linked_tasks'),
   ('documents','pending_document_cleanup'),
   ('documents','pending_document_upload'),
   ('contracts','pending_contract_upload')
  ) expected(m,code) WHERE (context->'modules'->>m)::boolean AND NOT (p_modules->>m)::boolean)
 IS DISTINCT FROM (SELECT coalesce(jsonb_agg(jsonb_build_object('module',c->>'module','code',c->>'code') ORDER BY c->>'module',c->>'code'),'[]'::jsonb)
  FROM jsonb_array_elements(assessment->'checks') c) THEN
  RAISE EXCEPTION 'MODULE_ASSESSMENT_INVALID' USING ERRCODE='55000';
 END IF;
 IF jsonb_array_length(assessment->'dependencies')>0 OR EXISTS(
  SELECT FROM jsonb_array_elements(assessment->'checks') c WHERE (c->>'blocking')::boolean
 ) THEN RAISE EXCEPTION 'MODULE_CHANGE_BLOCKED' USING ERRCODE='23514';END IF;
 IF context->'modules'=p_modules THEN RAISE EXCEPTION 'MODULE_CHANGE_EMPTY' USING ERRCODE='22023';END IF;
 UPDATE public.tenant_module_settings s SET enabled=(p_modules->>s.module_key)::boolean WHERE tenant_id=p_tenant;
 UPDATE public.tenant_module_config SET revision=revision+1,updated_at=clock_timestamp(),updated_by=p_actor
 WHERE tenant_id=p_tenant RETURNING revision INTO next_revision;
 INSERT INTO public.tenant_module_changes(tenant_id,command_id,actor_id,kind,request_hash,before_revision,after_revision,before_state,after_state)
 VALUES(p_tenant,p_command,p_actor,'settings',fingerprint,next_revision-1,next_revision,context->'modules',p_modules);
 RETURN jsonb_build_object('schemaVersion',1,'actorId',p_actor,'tenantId',p_tenant,'commandId',p_command,'revision',next_revision::text,'modules',p_modules,'replayed',false);
END $$;
REVOKE ALL ON FUNCTION public.change_workspace_modules_v1(uuid,uuid,uuid,uuid,text,uuid,jsonb) FROM PUBLIC,anon,authenticated,service_role;
INSERT INTO supabase_migrations.schema_migrations(version,name,statements) VALUES ('20261018000100','workspace_module_change_command',ARRAY['-- Installs the reviewed atomic command with all client EXECUTE privileges revoked.
-- Enable only after write-boundary acceptance and release preflight.
BEGIN;
SET LOCAL lock_timeout=''15s'';
CREATE FUNCTION public.change_workspace_modules_v1(
 p_actor uuid,p_tenant uuid,p_membership_version uuid,p_selection_version uuid,
 p_revision text,p_command uuid,p_modules jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path='''' SET lock_timeout=''5s'' AS $$
DECLARE context jsonb; assessment jsonb; fingerprint text;
 receipt public.tenant_module_changes; next_revision bigint;
BEGIN
 IF current_setting(''transaction_isolation'')<>''read committed'' THEN
  RAISE EXCEPTION ''MODULE_ISOLATION'' USING ERRCODE=''25000'';
 END IF;
 IF p_actor IS NULL OR auth.uid() IS DISTINCT FROM p_actor OR p_tenant IS NULL
  OR p_tenant IS DISTINCT FROM public.current_user_verified_tenant()
  OR p_command IS NULL OR p_membership_version IS NULL OR p_revision IS NULL THEN
  RAISE EXCEPTION ''MODULE_CHANGE_SCOPE'' USING ERRCODE=''42501'';
 END IF;
 -- Same order as business commands: config, profile, then live membership snapshot.
 PERFORM 1 FROM public.tenant_module_config WHERE tenant_id=p_tenant FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION ''MODULE_CONFIG_MISSING'' USING ERRCODE=''55000'';END IF;
 PERFORM 1 FROM public.profiles WHERE id=p_actor FOR SHARE;
 context:=public.current_workspace_modules_v1();
 IF context->>''actorId'' IS DISTINCT FROM p_actor::text
  OR context->>''tenantId'' IS DISTINCT FROM p_tenant::text
  OR context->>''role'' IS DISTINCT FROM ''yonetici''
  OR context->>''membershipVersion'' IS DISTINCT FROM p_membership_version::text
  OR context->>''selectionVersion'' IS DISTINCT FROM p_selection_version::text THEN
  RAISE EXCEPTION ''MODULE_CHANGE_SCOPE'' USING ERRCODE=''42501'';
 END IF;
 fingerprint:=encode(sha256(convert_to(jsonb_build_object(
  ''actor'',p_actor,''tenant'',p_tenant,''membership'',p_membership_version,
  ''selection'',p_selection_version,''revision'',p_revision,''modules'',p_modules)::text,''UTF8'')),''hex'');
 SELECT * INTO receipt FROM public.tenant_module_changes WHERE tenant_id=p_tenant AND command_id=p_command;
 IF FOUND THEN
  IF receipt.kind<>''settings'' OR receipt.actor_id IS DISTINCT FROM p_actor OR receipt.request_hash<>fingerprint THEN
   RAISE EXCEPTION ''MODULE_COMMAND_REUSED'' USING ERRCODE=''22023'';
  END IF;
  RETURN jsonb_build_object(''schemaVersion'',1,''actorId'',p_actor,''tenantId'',p_tenant,''commandId'',p_command,''revision'',receipt.after_revision::text,''modules'',receipt.after_state,''replayed'',true);
 END IF;
 -- Separate post-lock statement: committed work from a waiting writer is visible.
 assessment:=public.preview_workspace_modules_v1(p_actor,p_tenant,p_revision,p_modules);
 -- Fail closed if a future helper revision omits a required assessment.
 IF jsonb_typeof(assessment) IS DISTINCT FROM ''object''
 OR assessment->''schemaVersion'' IS DISTINCT FROM ''1''::jsonb
 OR assessment->''context'' IS DISTINCT FROM context
 OR assessment->''requested'' IS DISTINCT FROM p_modules
 OR jsonb_typeof(assessment->''dependencies'') IS DISTINCT FROM ''array''
 OR jsonb_typeof(assessment->''checks'') IS DISTINCT FROM ''array'' THEN
  RAISE EXCEPTION ''MODULE_ASSESSMENT_INVALID'' USING ERRCODE=''55000'';
 END IF;
 IF EXISTS(SELECT FROM jsonb_array_elements(assessment->''checks'') c
  WHERE jsonb_typeof(c->''blocking'') IS DISTINCT FROM ''boolean'') THEN
  RAISE EXCEPTION ''MODULE_ASSESSMENT_INVALID'' USING ERRCODE=''55000'';
 END IF;
 -- Generated from MODULE_CHANGE_CHECKS; fixture test verifies exact agreement.
 IF (SELECT coalesce(jsonb_agg(jsonb_build_object(''module'',m,''code'',code) ORDER BY m,code),''[]''::jsonb)
  FROM (VALUES
   (''tasks'',''unfinished_tasks''),
   (''calendar'',''unfinished_appointments''),
   (''contracts'',''unfinished_contracts''),
   (''talent'',''pending_talent_import''),
   (''talent'',''pending_talent_files''),
   (''staffing'',''open_staffing_demands''),
   (''staffing'',''upcoming_requests''),
   (''staffing'',''upcoming_assignments''),
   (''staffing'',''unapproved_work''),
   (''staffing'',''active_roster''),
   (''staffing'',''active_schedules''),
   (''reporting'',''open_reporting_periods''),
   (''reporting'',''pending_reporting_imports''),
   (''customers'',''customer_linked_tasks''),
   (''calendar'',''appointment_linked_tasks''),
   (''contracts'',''contract_linked_tasks''),
   (''documents'',''pending_document_cleanup''),
   (''documents'',''pending_document_upload''),
   (''contracts'',''pending_contract_upload'')
  ) expected(m,code) WHERE (context->''modules''->>m)::boolean AND NOT (p_modules->>m)::boolean)
 IS DISTINCT FROM (SELECT coalesce(jsonb_agg(jsonb_build_object(''module'',c->>''module'',''code'',c->>''code'') ORDER BY c->>''module'',c->>''code''),''[]''::jsonb)
  FROM jsonb_array_elements(assessment->''checks'') c) THEN
  RAISE EXCEPTION ''MODULE_ASSESSMENT_INVALID'' USING ERRCODE=''55000'';
 END IF;
 IF jsonb_array_length(assessment->''dependencies'')>0 OR EXISTS(
  SELECT FROM jsonb_array_elements(assessment->''checks'') c WHERE (c->>''blocking'')::boolean
 ) THEN RAISE EXCEPTION ''MODULE_CHANGE_BLOCKED'' USING ERRCODE=''23514'';END IF;
 IF context->''modules''=p_modules THEN RAISE EXCEPTION ''MODULE_CHANGE_EMPTY'' USING ERRCODE=''22023'';END IF;
 UPDATE public.tenant_module_settings s SET enabled=(p_modules->>s.module_key)::boolean WHERE tenant_id=p_tenant;
 UPDATE public.tenant_module_config SET revision=revision+1,updated_at=clock_timestamp(),updated_by=p_actor
 WHERE tenant_id=p_tenant RETURNING revision INTO next_revision;
 INSERT INTO public.tenant_module_changes(tenant_id,command_id,actor_id,kind,request_hash,before_revision,after_revision,before_state,after_state)
 VALUES(p_tenant,p_command,p_actor,''settings'',fingerprint,next_revision-1,next_revision,context->''modules'',p_modules);
 RETURN jsonb_build_object(''schemaVersion'',1,''actorId'',p_actor,''tenantId'',p_tenant,''commandId'',p_command,''revision'',next_revision::text,''modules'',p_modules,''replayed'',false);
END $$;
REVOKE ALL ON FUNCTION public.change_workspace_modules_v1(uuid,uuid,uuid,uuid,text,uuid,jsonb) FROM PUBLIC,anon,authenticated,service_role;
COMMIT;
']);
NOTIFY pgrst,'reload schema';
COMMIT;
