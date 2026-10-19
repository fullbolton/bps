BEGIN;
CREATE FUNCTION public.hr_screen_context_v1(p_actor uuid,p_tenant uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE mode text:=public.hr_access_mode_v1(p_actor,p_tenant);manager boolean:=coalesce(public.current_user_role()='yonetici',false);writer text;
BEGIN
 IF NOT EXISTS(SELECT FROM public.tenant_module_settings s JOIN public.tenant_module_entitlements e USING(tenant_id,module_key) WHERE s.tenant_id=p_tenant AND s.module_key='hr' AND s.enabled AND e.granted) THEN RAISE EXCEPTION 'HR_MODULE_CLOSED';END IF;
 IF mode='legacy' OR manager THEN
  PERFORM public.hr_assert_access(p_actor,p_tenant);writer:='legacy';
 ELSE
  IF public.company_access_policy_v1(p_tenant,p_actor) IS NULL THEN RAISE EXCEPTION 'HR_CUSTOM_POLICY_REQUIRED';END IF;
  writer:='scoped';
 END IF;
 RETURN jsonb_build_object('schemaVersion',1,'actorId',p_actor,'tenantId',p_tenant,'mode',mode,'manager',manager,'writeMode',writer);
END $$;
REVOKE ALL ON FUNCTION public.hr_screen_context_v1(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.hr_screen_context_v1(uuid,uuid) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
