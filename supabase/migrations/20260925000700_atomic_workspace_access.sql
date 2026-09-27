BEGIN;
SET LOCAL lock_timeout='15s';
-- One STABLE statement snapshot supplies both identity and authorization to the UI.
-- This is preparatory: current_user_role remains the existing role authority.
CREATE OR REPLACE FUNCTION public.current_workspace_context() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE
 v_actor uuid:=auth.uid();v_tenant uuid:=public.current_user_verified_tenant();
 v_name text;v_role text;
BEGIN
 IF v_actor IS NULL OR v_tenant IS NULL THEN RAISE EXCEPTION 'WORKSPACE_SCOPE' USING ERRCODE='42501';END IF;
 SELECT t.name INTO v_name FROM public.tenants t
 WHERE t.id=v_tenant AND EXISTS(SELECT 1 FROM public.tenant_memberships m WHERE m.user_id=v_actor AND m.tenant_id=t.id);
 v_role:=public.current_user_role();
 IF v_name IS NULL OR btrim(v_name)='' OR v_role IS NULL OR v_role NOT IN ('yonetici','partner','operasyon','ik','muhasebe','goruntuleyici') THEN
  RAISE EXCEPTION 'WORKSPACE_SCOPE' USING ERRCODE='42501';
 END IF;
 RETURN jsonb_build_object('actorId',v_actor,'tenantId',v_tenant,'name',btrim(v_name),'role',v_role);
END $$;
COMMENT ON FUNCTION public.current_workspace_context() IS 'Atomic verified company identity and current role from one statement snapshot. Does not grant memberships or implement company switching. Existing callers may ignore the additive role field.';
REVOKE ALL ON FUNCTION public.current_workspace_context() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.current_workspace_context() TO authenticated;
COMMIT;
