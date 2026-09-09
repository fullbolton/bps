-- Manual, bounded task transfer. Does not terminate membership or replace legacy policies.
BEGIN;
SET LOCAL lock_timeout='15s';
CREATE INDEX tasks_active_assignee_transfer ON public.tasks(tenant_id,assigned_to_user_id,id)
  WHERE status IN ('acik','devam_ediyor','gecikti');
CREATE TABLE public.task_transfer_receipts (
  command_id uuid PRIMARY KEY, actor_id uuid NOT NULL, tenant_id uuid NOT NULL,
  source_id uuid NOT NULL, target_id uuid NOT NULL, snapshot jsonb NOT NULL,
  result jsonb, recorded_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE public.task_transfer_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.task_transfer_receipts FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.task_transfer_directory(p_actor_id uuid,p_tenant_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE v_tenant uuid:=public.current_user_verified_tenant(); v_result jsonb;
BEGIN
  IF auth.uid() IS NULL OR p_actor_id IS DISTINCT FROM auth.uid() OR v_tenant IS NULL OR p_tenant_id IS DISTINCT FROM v_tenant THEN RAISE EXCEPTION 'TRANSFER_SCOPE'; END IF;
  IF public.current_user_role() IS DISTINCT FROM 'yonetici' THEN RAISE EXCEPTION 'TRANSFER_FORBIDDEN'; END IF;
  SELECT jsonb_build_object(
    'sources',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',s.assigned_to_user_id,'name',p.display_name,'count',s.n) ORDER BY s.assigned_to_user_id)
      FROM (SELECT assigned_to_user_id,count(*) n FROM public.tasks WHERE tenant_id=v_tenant AND assigned_to_user_id IS NOT NULL AND status IN ('acik','devam_ediyor','gecikti') GROUP BY assigned_to_user_id) s
      LEFT JOIN public.profiles p ON p.id=s.assigned_to_user_id AND EXISTS(SELECT 1 FROM public.tenant_memberships m WHERE m.user_id=p.id AND m.tenant_id=v_tenant)), '[]'::jsonb),
    'targets',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',p.id,'name',p.display_name) ORDER BY p.id) FROM public.profiles p
      WHERE p.role IN ('yonetici','operasyon','ik') AND EXISTS(SELECT 1 FROM public.tenant_memberships m WHERE m.user_id=p.id AND m.tenant_id=v_tenant)), '[]'::jsonb)) INTO v_result;
  RETURN v_result;
END $$;

CREATE FUNCTION public.preview_task_transfer(p_actor_id uuid,p_tenant_id uuid,p_source_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE v_tenant uuid:=public.current_user_verified_tenant();
BEGIN
  IF auth.uid() IS NULL OR p_actor_id IS DISTINCT FROM auth.uid() OR v_tenant IS NULL OR p_tenant_id IS DISTINCT FROM v_tenant THEN RAISE EXCEPTION 'TRANSFER_SCOPE'; END IF;
  IF public.current_user_role() IS DISTINCT FROM 'yonetici' THEN RAISE EXCEPTION 'TRANSFER_FORBIDDEN'; END IF;
  IF p_source_id IS NULL THEN RAISE EXCEPTION 'TRANSFER_VALIDATION'; END IF;
  -- STABLE: count and bounded rows share the caller statement's snapshot.
  RETURN jsonb_build_object('sourceId',p_source_id,
    'total',(SELECT count(*) FROM public.tasks WHERE tenant_id=v_tenant AND assigned_to_user_id=p_source_id AND status IN ('acik','devam_ediyor','gecikti')),
    'tasks',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',s.id,'revision',s.revision,'title',s.title,'companyName',c.name) ORDER BY s.id)
      FROM (SELECT id,revision,title,company_id FROM public.tasks WHERE tenant_id=v_tenant AND assigned_to_user_id=p_source_id AND status IN ('acik','devam_ediyor','gecikti') ORDER BY id LIMIT 100) s
      LEFT JOIN public.companies c ON c.id=s.company_id AND c.tenant_id=v_tenant),'[]'::jsonb));
END $$;

CREATE FUNCTION public.transfer_tasks_scoped(p_actor_id uuid,p_tenant_id uuid,p_command_id uuid,p_source_id uuid,p_target_id uuid,p_tasks jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' SET lock_timeout='5s' AS $$
DECLARE v_actor uuid:=auth.uid(); v_tenant uuid; v_snapshot jsonb; v_count int; v_locked int:=0;
  v_name text; v_target_role text; v_receipt public.task_transfer_receipts%ROWTYPE; v_task record; v_result jsonb;
BEGIN
  IF v_actor IS NULL OR p_actor_id IS DISTINCT FROM v_actor THEN RAISE EXCEPTION 'TRANSFER_SCOPE'; END IF;
  IF p_command_id IS NULL OR p_source_id IS NULL OR p_target_id IS NULL OR p_source_id=p_target_id THEN RAISE EXCEPTION 'TRANSFER_VALIDATION'; END IF;
  -- SHARE locks are mutually compatible and do not conflict with task FK KEY SHARE.
  -- Admin membership mutation uses profile FOR UPDATE. Always lock before fresh checks.
  PERFORM 1 FROM public.profiles WHERE id IN (v_actor,p_target_id) ORDER BY id FOR SHARE;
  SELECT public.current_user_verified_tenant() INTO v_tenant;
  IF v_tenant IS NULL OR p_tenant_id IS DISTINCT FROM v_tenant THEN RAISE EXCEPTION 'TRANSFER_SCOPE'; END IF;
  IF public.current_user_role() IS DISTINCT FROM 'yonetici' THEN RAISE EXCEPTION 'TRANSFER_FORBIDDEN'; END IF;
  SELECT p.display_name,p.role INTO v_name,v_target_role FROM public.profiles p WHERE p.id=p_target_id
    AND EXISTS(SELECT 1 FROM public.tenant_memberships m WHERE m.user_id=p.id AND m.tenant_id=v_tenant);
  IF NOT FOUND THEN RAISE EXCEPTION 'TRANSFER_TARGET'; END IF;
  IF v_target_role IS NULL OR v_target_role NOT IN ('yonetici','operasyon','ik') THEN RAISE EXCEPTION 'TRANSFER_TARGET_ROLE'; END IF;
  BEGIN
    IF jsonb_typeof(p_tasks) IS DISTINCT FROM 'array' OR jsonb_array_length(p_tasks) NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'invalid'; END IF;
    IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_tasks) e WHERE jsonb_typeof(e) IS DISTINCT FROM 'object'
      OR jsonb_typeof(e->'id') IS DISTINCT FROM 'string' OR jsonb_typeof(e->'revision') IS DISTINCT FROM 'number'
      OR (e-'id'-'revision')<>'{}'::jsonb) THEN RAISE EXCEPTION 'invalid'; END IF;
    SELECT jsonb_agg(jsonb_build_object('id',x.id,'revision',x.revision) ORDER BY x.id),count(*) INTO v_snapshot,v_count
      FROM (SELECT (e->>'id')::uuid id,(e->>'revision')::bigint revision FROM jsonb_array_elements(p_tasks) e) x;
    IF (SELECT count(DISTINCT (e->>'id')::uuid) FROM jsonb_array_elements(v_snapshot) e)<>v_count
      OR EXISTS(SELECT 1 FROM jsonb_array_elements(v_snapshot) e WHERE (e->>'revision')::bigint NOT BETWEEN 0 AND 9007199254740990) THEN RAISE EXCEPTION 'invalid'; END IF;
  EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION 'TRANSFER_VALIDATION'; END;

  INSERT INTO public.task_transfer_receipts(command_id,actor_id,tenant_id,source_id,target_id,snapshot)
    VALUES(p_command_id,v_actor,v_tenant,p_source_id,p_target_id,v_snapshot) ON CONFLICT DO NOTHING;
  SELECT * INTO v_receipt FROM public.task_transfer_receipts WHERE command_id=p_command_id FOR UPDATE;
  IF v_receipt.actor_id IS DISTINCT FROM v_actor OR v_receipt.tenant_id IS DISTINCT FROM v_tenant
    OR v_receipt.source_id IS DISTINCT FROM p_source_id OR v_receipt.target_id IS DISTINCT FROM p_target_id OR v_receipt.snapshot IS DISTINCT FROM v_snapshot THEN RAISE EXCEPTION 'TRANSFER_COMMAND'; END IF;
  IF v_receipt.result IS NOT NULL THEN RETURN v_receipt.result; END IF;

  FOR v_task IN SELECT t.*,e.revision expected_revision FROM public.tasks t
    JOIN jsonb_to_recordset(v_snapshot) AS e(id uuid,revision bigint) ON e.id=t.id
    WHERE t.tenant_id=v_tenant ORDER BY t.id FOR NO KEY UPDATE OF t
  LOOP
    IF v_task.assigned_to_user_id IS DISTINCT FROM p_source_id OR v_task.revision<>v_task.expected_revision
      OR v_task.status NOT IN ('acik','devam_ediyor','gecikti')
      OR NOT EXISTS(SELECT 1 FROM public.companies c WHERE c.id=v_task.company_id AND c.tenant_id=v_tenant) THEN RAISE EXCEPTION 'TRANSFER_CONFLICT'; END IF;
    UPDATE public.tasks SET assigned_to_user_id=p_target_id,assigned_to=COALESCE(NULLIF(btrim(v_name),''),'İsimsiz üye'),updated_at=clock_timestamp() WHERE id=v_task.id;
    v_locked:=v_locked+1;
  END LOOP;
  IF v_locked<>v_count THEN RAISE EXCEPTION 'TRANSFER_CONFLICT'; END IF;
  v_result:=jsonb_build_object('commandId',p_command_id,'sourceId',p_source_id,'targetId',p_target_id,'moved',v_locked);
  UPDATE public.task_transfer_receipts SET result=v_result WHERE command_id=p_command_id;
  RETURN v_result;
END $$;
REVOKE ALL ON FUNCTION public.task_transfer_directory(uuid,uuid),public.preview_task_transfer(uuid,uuid,uuid),public.transfer_tasks_scoped(uuid,uuid,uuid,uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.task_transfer_directory(uuid,uuid),public.preview_task_transfer(uuid,uuid,uuid),public.transfer_tasks_scoped(uuid,uuid,uuid,uuid,uuid,jsonb) TO authenticated;
COMMIT;
