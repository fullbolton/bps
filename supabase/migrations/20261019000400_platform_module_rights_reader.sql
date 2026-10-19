BEGIN;
CREATE FUNCTION public.platform_module_rights_v1(p_actor uuid,p_tenant uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE snapshot jsonb; rights jsonb; revision bigint; company text;
BEGIN
 IF p_actor IS NULL OR p_actor IS DISTINCT FROM auth.uid() OR NOT public.is_platform_admin() THEN
 RAISE EXCEPTION 'MODULE_ENTITLEMENT_SCOPE' USING ERRCODE='42501'; END IF;
 SELECT name INTO company FROM public.tenants WHERE id=p_tenant;
 IF NOT FOUND THEN RAISE EXCEPTION 'MODULE_CONFIG_MISSING' USING ERRCODE='55000'; END IF;
 snapshot:=public.workspace_module_snapshot_v2(p_tenant);
 SELECT c.revision INTO revision FROM public.tenant_module_entitlement_config c WHERE tenant_id=p_tenant;
 SELECT jsonb_object_agg(module_key,granted) INTO rights FROM public.tenant_module_entitlements WHERE tenant_id=p_tenant;
 IF revision IS NULL OR rights IS NULL OR (SELECT count(*) FROM jsonb_object_keys(rights))<>11
 OR EXISTS(SELECT FROM public.workspace_module_catalog_v2() c WHERE NOT rights ? c.module_key)
 THEN RAISE EXCEPTION 'MODULE_ENTITLEMENTS_INCOMPLETE' USING ERRCODE='55000'; END IF;
 RETURN jsonb_build_object('schemaVersion',1,'actorId',p_actor,'tenantId',p_tenant,'name',company,
 'revision',revision::text,'granted',rights,'enabled',snapshot->'modules',
 'ready',(SELECT jsonb_object_agg(module_key,module_key<>'hr') FROM public.workspace_module_catalog_v2()));
END $$;
REVOKE ALL ON FUNCTION public.platform_module_rights_v1(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.platform_module_rights_v1(uuid,uuid) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
