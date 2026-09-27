-- NOT APPLIED TO PRODUCTION. Requires 000100, 000200 and 000300 pilot migrations.
BEGIN;
SET LOCAL lock_timeout='5s';
CREATE FUNCTION public.ops_reconcile_commands(p_actor_id uuid,p_tenant_id uuid,p_command_ids uuid[],p_close boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' SET lock_timeout='3s' AS $$
DECLARE v_actor uuid:=auth.uid(); v_role text; v_id uuid; v_cmd public.ops_commands%ROWTYPE;
  v_status text; v_output jsonb:='[]'::jsonb;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'OPS_UNAUTHENTICATED'; END IF;
  PERFORM 1 FROM public.profiles WHERE id=v_actor FOR SHARE;
  IF p_actor_id IS DISTINCT FROM v_actor OR p_tenant_id IS NULL
    OR p_tenant_id IS DISTINCT FROM public.current_user_verified_tenant() THEN RAISE EXCEPTION 'OPS_SCOPE_CHANGED'; END IF;
  v_role:=public.current_user_role();
  IF v_role IS NULL OR v_role NOT IN ('yonetici','operasyon') THEN RAISE EXCEPTION 'OPS_FORBIDDEN'; END IF;
  IF p_command_ids IS NULL OR p_close IS NULL OR cardinality(p_command_ids)>50
    OR array_position(p_command_ids,NULL) IS NOT NULL
    OR cardinality(p_command_ids)<>(SELECT count(DISTINCT x) FROM unnest(p_command_ids) x) THEN RAISE EXCEPTION 'OPS_VALIDATION'; END IF;
  -- Sorted order prevents opposite-order batches from deadlocking on command rows.
  FOR v_id IN SELECT x FROM unnest(p_command_ids) x ORDER BY x LOOP
    IF p_close THEN
      -- Same unique key as both write RPCs: either the write commits first, or this
      -- terminal marker wins. A late write then fails the existing kind/payload check.
      INSERT INTO public.ops_commands(tenant_id,actor_id,id,kind,payload,result)
        VALUES(p_tenant_id,v_actor,v_id,'closed','{}',jsonb_build_object('commandId',v_id,'closed',true))
        ON CONFLICT DO NOTHING;
      SELECT * INTO v_cmd FROM public.ops_commands
        WHERE tenant_id=p_tenant_id AND actor_id=v_actor AND id=v_id FOR UPDATE;
    ELSE
      SELECT * INTO v_cmd FROM public.ops_commands
        WHERE tenant_id=p_tenant_id AND actor_id=v_actor AND id=v_id;
    END IF;
    v_status:=CASE WHEN NOT FOUND OR v_cmd.result IS NULL THEN 'unknown'
      WHEN v_cmd.kind='closed' THEN 'closed' ELSE 'confirmed' END;
    IF p_close AND v_status='unknown' THEN RAISE EXCEPTION 'OPS_UNVERIFIABLE'; END IF;
    v_output:=v_output||jsonb_build_array(jsonb_build_object('id',v_id,'status',v_status));
  END LOOP;
  RETURN v_output;
END $$;
REVOKE ALL ON FUNCTION public.ops_reconcile_commands(uuid,uuid,uuid[],boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ops_reconcile_commands(uuid,uuid,uuid[],boolean) TO authenticated;
COMMIT;
