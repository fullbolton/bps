-- A1: read only identity for the caller's verified workspace, for every member role.
-- Does not add memberships, change role/claim semantics or expose tenant tables.
BEGIN;
SET LOCAL lock_timeout = '15s';

CREATE FUNCTION public.current_workspace_context()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_tenant uuid := public.current_user_verified_tenant();
  v_name text;
BEGIN
  IF v_actor IS NULL OR v_tenant IS NULL THEN
    RAISE EXCEPTION 'WORKSPACE_SCOPE' USING ERRCODE = '42501';
  END IF;
  SELECT t.name INTO v_name FROM public.tenants t
  WHERE t.id = v_tenant AND EXISTS (
    SELECT 1 FROM public.tenant_memberships m
    WHERE m.user_id = v_actor AND m.tenant_id = t.id
  );
  IF NOT FOUND OR v_name IS NULL OR btrim(v_name) = '' THEN
    RAISE EXCEPTION 'WORKSPACE_SCOPE' USING ERRCODE = '42501';
  END IF;
  RETURN jsonb_build_object('actorId', v_actor, 'tenantId', v_tenant, 'name', btrim(v_name));
END;
$$;
COMMENT ON FUNCTION public.current_workspace_context() IS
  'Read-only current verified workspace identity. No selector, membership management, role expansion or tenant directory.';
REVOKE ALL ON FUNCTION public.current_workspace_context() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_workspace_context() TO authenticated;

-- The definer must see membership/tenant rows; an RLS-filtered lookup must not
-- silently pretend a valid workspace does not exist after deployment.
DO $$
DECLARE v_owner oid; v_table regclass;
BEGIN
  SELECT proowner INTO v_owner FROM pg_proc WHERE oid = 'public.current_workspace_context()'::regprocedure;
  FOREACH v_table IN ARRAY ARRAY['public.tenants'::regclass, 'public.tenant_memberships'::regclass]
  LOOP
    IF NOT has_table_privilege(v_owner, v_table, 'SELECT') OR NOT EXISTS (
      SELECT 1 FROM pg_roles r CROSS JOIN pg_class c WHERE r.oid = v_owner AND c.oid = v_table
      AND (r.rolsuper OR r.rolbypassrls OR NOT c.relrowsecurity
        OR (pg_has_role(v_owner, c.relowner, 'USAGE') AND NOT c.relforcerowsecurity))
    ) THEN RAISE EXCEPTION 'Workspace context owner must read %', v_table; END IF;
  END LOOP;
END;
$$;
COMMIT;
