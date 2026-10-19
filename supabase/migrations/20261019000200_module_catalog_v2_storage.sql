-- Catalog 2 storage expansion. HR remains unavailable; no activation grant is added.
-- Existing v1 clients retain their exact ten-key wire contract.
BEGIN;
SET LOCAL lock_timeout='15s';
LOCK TABLE public.tenants IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE public.tenant_module_config IN SHARE ROW EXCLUSIVE MODE;
DO $$ BEGIN IF md5((SELECT prosrc FROM pg_proc WHERE oid='public.change_workspace_modules_v1(uuid,uuid,uuid,uuid,text,uuid,jsonb)'::regprocedure)) IS DISTINCT FROM 'f40a3272dfc1a440f28562446b66830a' THEN RAISE EXCEPTION 'MODULE_WRITER_SOURCE_CHANGED'; END IF; END $$;

DO $$ BEGIN
 IF md5((SELECT prosrc FROM pg_proc WHERE oid='public.workspace_module_snapshot_v1(uuid)'::regprocedure)) IS DISTINCT FROM 'a5fc86a99bcc3c72b3375f5dd269c6ff' THEN RAISE EXCEPTION 'MODULE_SOURCE_CHANGED: workspace_module_snapshot_v1'; END IF;
 IF md5((SELECT prosrc FROM pg_proc WHERE oid='public.tenant_module_key_guard_v1()'::regprocedure)) IS DISTINCT FROM 'a18621d95296ef70bbc477ce908a95d7' THEN RAISE EXCEPTION 'MODULE_SOURCE_CHANGED: tenant_module_key_guard_v1'; END IF;
 IF md5((SELECT prosrc FROM pg_proc WHERE oid='public.tenant_module_bootstrap_v1(uuid)'::regprocedure)) IS DISTINCT FROM '00ff5878750f20b0e2fd7fa045ae9aef' THEN RAISE EXCEPTION 'MODULE_SOURCE_CHANGED: tenant_module_bootstrap_v1'; END IF;
 IF md5((SELECT prosrc FROM pg_proc WHERE oid='public.workspace_module_history_v2(uuid,uuid)'::regprocedure)) IS DISTINCT FROM 'eaf546ebdc4890ba5a89efb53f1c2a0d' THEN RAISE EXCEPTION 'MODULE_SOURCE_CHANGED: workspace_module_history_v2'; END IF;
END $$;

CREATE FUNCTION public.workspace_module_catalog_v2() RETURNS TABLE(module_key text,requires text[])
LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT * FROM public.workspace_module_catalog_v1() UNION ALL SELECT 'hr',ARRAY[]::text[]
$$;
REVOKE ALL ON FUNCTION public.workspace_module_catalog_v2() FROM PUBLIC,anon,authenticated,service_role;
ALTER TABLE public.tenant_module_config DROP CONSTRAINT tenant_module_config_catalog_version_check;
ALTER TABLE public.tenant_module_config ADD CONSTRAINT tenant_module_config_catalog_version_check CHECK(catalog_version IN(1,2));
ALTER TABLE public.tenant_module_changes DROP CONSTRAINT module_history_before_catalog_known;
ALTER TABLE public.tenant_module_changes DROP CONSTRAINT module_history_after_catalog_known;
ALTER TABLE public.tenant_module_changes DROP CONSTRAINT tenant_module_changes_kind_check;
ALTER TABLE public.tenant_module_changes ADD CONSTRAINT module_history_before_catalog_known CHECK(before_catalog_version IN(1,2)),
 ADD CONSTRAINT module_history_after_catalog_known CHECK(after_catalog_version IN(1,2)),
 ADD CONSTRAINT tenant_module_changes_kind_check CHECK(kind IN('bootstrap','settings','catalog_upgrade'));
CREATE OR REPLACE FUNCTION public.tenant_module_key_guard_v1() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT EXISTS(SELECT FROM public.workspace_module_catalog_v2() c WHERE c.module_key=NEW.module_key) THEN
  RAISE EXCEPTION 'MODULE_UNKNOWN' USING ERRCODE='23514'; END IF;
 -- HR activation requires a later entitlement-aware release, not a config edit.
 IF NEW.module_key='hr' AND NEW.enabled THEN RAISE EXCEPTION 'MODULE_HR_UNAVAILABLE' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE FUNCTION public.workspace_module_snapshot_v2(p_tenant uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE config public.tenant_module_config; states jsonb; expected_count integer;
BEGIN
 SELECT * INTO config FROM public.tenant_module_config WHERE tenant_id=p_tenant;
 IF NOT FOUND OR config.catalog_version NOT IN(1,2) THEN RAISE EXCEPTION 'MODULE_CONFIG_MISSING' USING ERRCODE='55000'; END IF;
 SELECT jsonb_object_agg(module_key,enabled) INTO states FROM public.tenant_module_settings WHERE tenant_id=p_tenant;
 expected_count:=CASE WHEN config.catalog_version=1 THEN 10 ELSE 11 END;
 IF states IS NULL OR (SELECT count(*) FROM jsonb_object_keys(states))<>expected_count
 OR EXISTS(SELECT FROM public.workspace_module_catalog_v1() c WHERE NOT states ? c.module_key)
 OR (config.catalog_version=2 AND NOT states ? 'hr')
 OR EXISTS(SELECT FROM jsonb_object_keys(states) k WHERE NOT EXISTS(SELECT FROM public.workspace_module_catalog_v2() c WHERE c.module_key=k))
 THEN RAISE EXCEPTION 'MODULE_CONFIG_INCOMPLETE' USING ERRCODE='55000'; END IF;
 IF EXISTS(SELECT FROM public.workspace_module_catalog_v1() c CROSS JOIN LATERAL unnest(c.requires) d
 WHERE (states->>c.module_key)::boolean AND NOT (states->>d)::boolean)
 THEN RAISE EXCEPTION 'MODULE_CONFIG_DEPENDENCY' USING ERRCODE='55000'; END IF;
 RETURN jsonb_build_object('schemaVersion',1,'catalogVersion',config.catalog_version,'configRevision',config.revision::text,'modules',states);
END $$;
REVOKE ALL ON FUNCTION public.workspace_module_snapshot_v2(uuid) FROM PUBLIC,anon,authenticated,service_role;
CREATE OR REPLACE FUNCTION public.workspace_module_snapshot_v1(p_tenant uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE snapshot jsonb;
BEGIN
 snapshot:=public.workspace_module_snapshot_v2(p_tenant);
 RETURN snapshot || jsonb_build_object('catalogVersion',1,'modules',(snapshot->'modules')-'hr');
END $$;
CREATE FUNCTION public.current_workspace_modules_v2() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE context jsonb;
BEGIN
 context:=public.current_workspace_context();
 IF auth.uid() IS NULL OR context IS NULL OR context->>'actorId' IS DISTINCT FROM auth.uid()::text THEN
 RAISE EXCEPTION 'WORKSPACE_SCOPE' USING ERRCODE='42501'; END IF;
 RETURN context || public.workspace_module_snapshot_v2((context->>'tenantId')::uuid);
END $$;
REVOKE ALL ON FUNCTION public.current_workspace_modules_v2() FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.current_workspace_modules_v2() TO authenticated;
CREATE OR REPLACE FUNCTION public.change_workspace_modules_v1(
 p_actor uuid,p_tenant uuid,p_membership_version uuid,p_selection_version uuid,
 p_revision text,p_command uuid,p_modules jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path='' SET lock_timeout='5s' AS $$
DECLARE context jsonb; assessment jsonb; fingerprint text;
 receipt public.tenant_module_changes; next_revision bigint; stored_before jsonb; stored_after jsonb; stored_version integer;
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
  RETURN jsonb_build_object('schemaVersion',1,'actorId',p_actor,'tenantId',p_tenant,'commandId',p_command,'revision',receipt.after_revision::text,'modules',receipt.after_state-'hr','replayed',true);
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
 SELECT catalog_version INTO stored_version FROM public.tenant_module_config WHERE tenant_id=p_tenant;
 SELECT jsonb_object_agg(module_key,enabled) INTO stored_before FROM public.tenant_module_settings WHERE tenant_id=p_tenant;
 UPDATE public.tenant_module_settings s SET enabled=(p_modules->>s.module_key)::boolean WHERE tenant_id=p_tenant AND p_modules ? s.module_key;
 SELECT jsonb_object_agg(module_key,enabled) INTO stored_after FROM public.tenant_module_settings WHERE tenant_id=p_tenant;
 UPDATE public.tenant_module_config SET revision=revision+1,updated_at=clock_timestamp(),updated_by=p_actor
 WHERE tenant_id=p_tenant RETURNING revision INTO next_revision;
 INSERT INTO public.tenant_module_changes(tenant_id,command_id,actor_id,kind,request_hash,before_revision,after_revision,before_state,after_state,before_catalog_version,after_catalog_version)
 VALUES(p_tenant,p_command,p_actor,'settings',fingerprint,next_revision-1,next_revision,stored_before,stored_after,stored_version,stored_version);
 RETURN jsonb_build_object('schemaVersion',1,'actorId',p_actor,'tenantId',p_tenant,'commandId',p_command,'revision',next_revision::text,'modules',p_modules,'replayed',false);
END $$;
CREATE OR REPLACE FUNCTION public.workspace_module_history_v2(p_actor uuid,p_tenant uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE context jsonb; entries jsonb;
BEGIN
 context:=public.current_workspace_modules_v2();
 IF p_actor IS DISTINCT FROM auth.uid()
 OR context->>'actorId' IS DISTINCT FROM p_actor::text
 OR context->>'tenantId' IS DISTINCT FROM p_tenant::text
 OR context->>'role' IS DISTINCT FROM 'yonetici' THEN
  RAISE EXCEPTION 'WORKSPACE_SCOPE' USING ERRCODE='42501';
 END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object(
  'kind',c.kind,'revision',c.after_revision::text,'createdAt',c.created_at,
  'actorName',CASE WHEN c.kind IN('bootstrap','catalog_upgrade') THEN NULL ELSE coalesce(nullif(btrim(p.display_name),''),'Eski ekip üyesi') END,
  'before',c.before_state,'after',c.after_state,
  'beforeCatalogVersion',c.before_catalog_version,'afterCatalogVersion',c.after_catalog_version) ORDER BY c.after_revision DESC),'[]'::jsonb)
 INTO entries FROM (SELECT kind,after_revision,created_at,actor_id,before_state,after_state,before_catalog_version,after_catalog_version FROM public.tenant_module_changes
 WHERE tenant_id=p_tenant ORDER BY after_revision DESC LIMIT 20) c
 LEFT JOIN public.profiles p ON p.id=c.actor_id;
 RETURN jsonb_build_object('historySchemaVersion',2,'context',context,'entries',entries);
END $$;

CREATE OR REPLACE FUNCTION public.tenant_module_bootstrap_v1(p_tenant uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE initial_state jsonb;
BEGIN
 INSERT INTO public.tenant_module_config(tenant_id,catalog_version) VALUES(p_tenant,2);
 INSERT INTO public.tenant_module_settings(tenant_id,module_key,enabled)
 SELECT p_tenant,c.module_key,c.module_key<>'hr' FROM public.workspace_module_catalog_v2() c;
 SELECT jsonb_object_agg(module_key,enabled) INTO initial_state FROM public.tenant_module_settings WHERE tenant_id=p_tenant;
 INSERT INTO public.tenant_module_changes(tenant_id,command_id,actor_id,kind,request_hash,before_revision,after_revision,before_state,after_state,before_catalog_version,after_catalog_version)
 VALUES(p_tenant,gen_random_uuid(),NULL,'bootstrap',encode(sha256(convert_to(initial_state::text,'UTF8')),'hex'),0,1,'{}',initial_state,2,2);
END $$;
DO $$ DECLARE item record; before_snapshot jsonb; after_snapshot jsonb; BEGIN
 FOR item IN SELECT tenant_id,revision FROM public.tenant_module_config WHERE catalog_version=1 ORDER BY tenant_id LOOP
  before_snapshot:=public.workspace_module_snapshot_v2(item.tenant_id)->'modules';
  INSERT INTO public.tenant_module_settings(tenant_id,module_key,enabled) VALUES(item.tenant_id,'hr',false);
  UPDATE public.tenant_module_config SET catalog_version=2,revision=revision+1,updated_at=clock_timestamp(),updated_by=NULL WHERE tenant_id=item.tenant_id;
  after_snapshot:=public.workspace_module_snapshot_v2(item.tenant_id)->'modules';
  INSERT INTO public.tenant_module_changes(tenant_id,command_id,actor_id,kind,request_hash,before_revision,after_revision,before_state,after_state,before_catalog_version,after_catalog_version)
  VALUES(item.tenant_id,gen_random_uuid(),NULL,'catalog_upgrade',encode(sha256(convert_to(after_snapshot::text,'UTF8')),'hex'),item.revision,item.revision+1,before_snapshot,after_snapshot,1,2);
 END LOOP;
END $$;
NOTIFY pgrst,'reload schema';
COMMIT;
