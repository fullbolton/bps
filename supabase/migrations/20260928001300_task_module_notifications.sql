-- M2b: service-role task candidate filtering and fresh pre-send checks.
-- Expand before frontend. No client receives config-table or cross-tenant task access.
BEGIN;
SET LOCAL lock_timeout='15s';
CREATE FUNCTION public.workspace_module_snapshot_v1(p_tenant uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE tenant uuid:=p_tenant; config public.tenant_module_config; states jsonb;
BEGIN
 SELECT * INTO config FROM public.tenant_module_config WHERE tenant_id=tenant;
 IF NOT FOUND OR config.catalog_version<>1 THEN RAISE EXCEPTION 'MODULE_CONFIG_MISSING' USING ERRCODE='55000';END IF;
 SELECT jsonb_object_agg(module_key,enabled) INTO states FROM public.tenant_module_settings WHERE tenant_id=tenant;
 IF states IS NULL OR
  EXISTS(SELECT 1 FROM public.workspace_module_catalog_v1() c WHERE NOT states ? c.module_key) OR
  EXISTS(SELECT 1 FROM jsonb_object_keys(states) k WHERE NOT EXISTS(SELECT 1 FROM public.workspace_module_catalog_v1() c WHERE c.module_key=k)) THEN
  RAISE EXCEPTION 'MODULE_CONFIG_INCOMPLETE' USING ERRCODE='55000';
 END IF;
 IF EXISTS(SELECT 1 FROM public.workspace_module_catalog_v1() c CROSS JOIN LATERAL unnest(c.requires) dependency
   WHERE (states->>c.module_key)::boolean AND NOT (states->>dependency)::boolean) THEN
  RAISE EXCEPTION 'MODULE_CONFIG_DEPENDENCY' USING ERRCODE='55000';
 END IF;
 RETURN jsonb_build_object('schemaVersion',1,'catalogVersion',config.catalog_version,'configRevision',config.revision::text,'modules',states);
END $$;
REVOKE ALL ON FUNCTION public.workspace_module_snapshot_v1(uuid) FROM PUBLIC,anon,authenticated,service_role;
CREATE OR REPLACE FUNCTION public.current_workspace_modules_v1() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE context jsonb;
BEGIN
 context:=public.current_workspace_context();
 IF auth.uid() IS NULL OR context IS NULL OR context->>'actorId' IS DISTINCT FROM auth.uid()::text THEN
  RAISE EXCEPTION 'WORKSPACE_SCOPE' USING ERRCODE='42501';
 END IF;
 RETURN context || public.workspace_module_snapshot_v1((context->>'tenantId')::uuid);
END $$;

CREATE FUNCTION public.task_notification_modules_v1(p_tenant_ids uuid[])
RETURNS TABLE(tenant_id uuid,enabled boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE tenant uuid;
BEGIN
 IF p_tenant_ids IS NULL OR cardinality(p_tenant_ids) NOT BETWEEN 1 AND 500 OR array_position(p_tenant_ids,NULL) IS NOT NULL THEN
  RAISE EXCEPTION 'MODULE_TENANTS_INVALID' USING ERRCODE='22023';
 END IF;
 FOR tenant IN SELECT DISTINCT unnest(p_tenant_ids) ORDER BY 1 LOOP
  tenant_id:=tenant;
  enabled:=(public.workspace_module_snapshot_v1(tenant)->'modules'->>'tasks')::boolean;
  RETURN NEXT;
 END LOOP;
END $$;
CREATE FUNCTION public.task_notification_candidates_v1()
RETURNS TABLE(id uuid,title text,status text,due_date text,assigned_to_user_id uuid,tenant_id uuid,company_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 WITH tenants AS MATERIALIZED (
  SELECT DISTINCT t.tenant_id FROM public.tasks t WHERE t.status IN ('acik','devam_ediyor','gecikti')
 ), settings AS MATERIALIZED (
  SELECT t.tenant_id,(public.workspace_module_snapshot_v1(t.tenant_id)->'modules'->>'tasks')::boolean AS enabled FROM tenants t
 )
 SELECT t.id,t.title,t.status,t.due_date,t.assigned_to_user_id,t.tenant_id,t.company_id
 FROM public.tasks t JOIN settings s ON s.tenant_id=t.tenant_id AND s.enabled
 WHERE t.status IN ('acik','devam_ediyor','gecikti')
$$;
REVOKE ALL ON FUNCTION public.task_notification_modules_v1(uuid[]),public.task_notification_candidates_v1() FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.task_notification_modules_v1(uuid[]),public.task_notification_candidates_v1() TO service_role;
-- HTTP delivery cannot share this snapshot or lock. These checks do not promise
-- recall of already sent email or atomic cancellation of an in-flight provider call.
COMMIT;
