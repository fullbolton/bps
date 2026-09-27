-- NOT APPLIED TO PRODUCTION. Requires daily pilot and location import migrations.
BEGIN;
SET LOCAL lock_timeout='5s';
CREATE FUNCTION public.ops_execute_scoped(p_actor_id uuid,p_tenant_id uuid,p_command_id uuid,p_kind text,p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_actor uuid:=auth.uid();
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'OPS_UNAUTHENTICATED'; END IF;
  -- Serialize with the existing profile-lock protocol before checking the expected scope.
  PERFORM 1 FROM public.profiles WHERE id=v_actor FOR SHARE;
  IF p_actor_id IS DISTINCT FROM v_actor OR p_tenant_id IS NULL
    OR p_tenant_id IS DISTINCT FROM public.current_user_verified_tenant() THEN RAISE EXCEPTION 'OPS_SCOPE_CHANGED'; END IF;
  IF p_kind='location_import' THEN
    RETURN public.ops_import_locations(p_command_id,(p_payload->>'companyId')::uuid,p_payload->'rows');
  END IF;
  RETURN public.ops_mutate(p_command_id,p_kind,p_payload);
END $$;
REVOKE ALL ON FUNCTION public.ops_execute_scoped(uuid,uuid,uuid,text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ops_execute_scoped(uuid,uuid,uuid,text,jsonb) TO authenticated;
COMMIT;
