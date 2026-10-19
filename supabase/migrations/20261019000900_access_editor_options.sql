BEGIN;
CREATE FUNCTION public.company_access_options_v1(p_actor uuid,p_tenant uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM public.company_access_assert_manager(p_actor,p_tenant);
 IF (SELECT count(*) FROM (SELECT id FROM public.hr_departments WHERE tenant_id=p_tenant LIMIT 1001) x)>1000
 OR (SELECT count(*) FROM (SELECT id FROM public.hr_work_locations WHERE tenant_id=p_tenant LIMIT 1001) x)>1000
 OR (SELECT count(*) FROM (SELECT id FROM public.tenant_memberships WHERE tenant_id=p_tenant LIMIT 1001) x)>1000 THEN RAISE EXCEPTION 'ACCESS_OPTIONS_LIMIT';END IF;
 RETURN jsonb_build_object('schemaVersion',1,'actorId',p_actor,'tenantId',p_tenant,
 'people',coalesce((SELECT jsonb_agg(jsonb_build_object('id',m.user_id,'membershipId',m.id,'name',coalesce(nullif(btrim(p.display_name),''),'İsimsiz hesap'),'role',m.role) ORDER BY p.display_name,m.user_id) FROM public.tenant_memberships m JOIN public.profiles p ON p.id=m.user_id WHERE m.tenant_id=p_tenant),'[]'),
 'departments',coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'name',name,'closed',closed_on IS NOT NULL) ORDER BY name,id) FROM public.hr_departments WHERE tenant_id=p_tenant),'[]'),
 'locations',coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'name',name,'closed',closed_on IS NOT NULL) ORDER BY name,id) FROM public.hr_work_locations WHERE tenant_id=p_tenant),'[]'));
END $$;
REVOKE ALL ON FUNCTION public.company_access_options_v1(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.company_access_options_v1(uuid,uuid) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
