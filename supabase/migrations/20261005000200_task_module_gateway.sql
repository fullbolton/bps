-- M2a: shared module barriers and the task CRUD gateway. Not the module-disable rollout.
-- M2b must cover definer projections, related workflows and service-role consumers.
BEGIN;
SET LOCAL lock_timeout='15s';
LOCK TABLE public.tasks,public.task_assignment_history IN ACCESS EXCLUSIVE MODE;

CREATE FUNCTION public.workspace_module_enabled_v1(p_module text) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE context jsonb;
BEGIN
 IF p_module IS NULL OR NOT EXISTS(SELECT FROM public.workspace_module_catalog_v1() c WHERE c.module_key=p_module) THEN
  RAISE EXCEPTION 'MODULE_UNKNOWN' USING ERRCODE='22023';
 END IF;
 context:=public.current_workspace_modules_v1();
 RETURN (context->'modules'->>p_module)::boolean;
END $$;
REVOKE ALL ON FUNCTION public.workspace_module_enabled_v1(text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.workspace_module_enabled_v1(text) TO authenticated;

CREATE FUNCTION public.workspace_require_module_write_v1(p_tenant uuid,p_modules text[]) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' SET lock_timeout='5s' AS $$
DECLARE context jsonb;module text;
BEGIN
 IF current_setting('transaction_isolation')<>'read committed' THEN RAISE EXCEPTION 'MODULE_ISOLATION' USING ERRCODE='25000';END IF;
 IF auth.uid() IS NULL OR p_tenant IS NULL OR p_tenant IS DISTINCT FROM public.current_user_verified_tenant() THEN
  RAISE EXCEPTION 'MODULE_SCOPE' USING ERRCODE='42501';
 END IF;
 IF p_modules IS NULL OR cardinality(p_modules) NOT BETWEEN 1 AND 10
  OR EXISTS(SELECT FROM unnest(p_modules) k WHERE k IS NULL OR NOT EXISTS(SELECT FROM public.workspace_module_catalog_v1() c WHERE c.module_key=k)) THEN
  RAISE EXCEPTION 'MODULE_UNKNOWN' USING ERRCODE='22023';
 END IF;
 -- This must precede profile and business row locks in every controlled writer.
 PERFORM 1 FROM public.tenant_module_config WHERE tenant_id=p_tenant FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'MODULE_CONFIG_MISSING' USING ERRCODE='55000';END IF;
 -- New statement after waiting: never reuse the pre-lock configuration or membership.
 context:=public.current_workspace_modules_v1();
 IF context->>'tenantId' IS DISTINCT FROM p_tenant::text THEN RAISE EXCEPTION 'MODULE_SCOPE' USING ERRCODE='42501';END IF;
 FOREACH module IN ARRAY p_modules LOOP
  IF NOT (context->'modules'->>module)::boolean THEN RAISE EXCEPTION 'MODULE_DISABLED' USING ERRCODE='BM001';END IF;
 END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.workspace_require_module_write_v1(uuid,text[]) FROM PUBLIC,anon,authenticated,service_role;

-- Restrictive AND fences do not replace or widen the existing role policies.
CREATE POLICY tasks_module_read_v1 ON public.tasks AS RESTRICTIVE FOR SELECT TO authenticated
USING(tenant_id=public.current_user_verified_tenant() AND (SELECT public.workspace_module_enabled_v1('tasks')));
CREATE POLICY task_history_module_read_v1 ON public.task_assignment_history AS RESTRICTIVE FOR SELECT TO authenticated
USING(tenant_id=public.current_user_verified_tenant() AND (SELECT public.workspace_module_enabled_v1('tasks')));

CREATE FUNCTION public.task_execute_v1(
 p_action text,p_task_id uuid DEFAULT NULL,p_revision bigint DEFAULT NULL,p_input jsonb DEFAULT '{}',
 p_expected_tenant uuid DEFAULT NULL,p_expected_actor uuid DEFAULT NULL
) RETURNS SETOF public.tasks
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' SET lock_timeout='5s' AS $$
DECLARE actor uuid:=auth.uid();tenant uuid;role text;target uuid;target_name text;target_role text;
 row public.tasks;company_status text;company uuid;contract uuid;appointment uuid;source text;required text[]:=ARRAY['tasks'];
 trim_chars CONSTANT text:=U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF';
BEGIN
 tenant:=public.current_user_verified_tenant();
 IF actor IS NULL OR tenant IS NULL OR (p_expected_tenant IS NOT NULL AND p_expected_tenant<>tenant)
  OR (p_expected_actor IS NOT NULL AND p_expected_actor<>actor) THEN RAISE EXCEPTION 'TASK_SCOPE' USING ERRCODE='42501';END IF;
 IF p_action IS NULL OR p_action NOT IN('create','update','claim','complete') OR jsonb_typeof(p_input) IS DISTINCT FROM 'object' THEN
  RAISE EXCEPTION 'TASK_INPUT' USING ERRCODE='BT400';END IF;
 IF EXISTS(SELECT FROM jsonb_each(p_input) e WHERE jsonb_typeof(e.value) NOT IN('string','null')) THEN RAISE EXCEPTION 'TASK_INPUT' USING ERRCODE='BT400';END IF;
 IF p_action='create' THEN
  IF p_expected_tenant IS NULL OR p_task_id IS NOT NULL OR p_revision IS NOT NULL
   OR (p_input-ARRAY['company_id','contract_id','appointment_id','title','assigned_to_user_id','due_date','source_type','source_ref','priority'])<>'{}' THEN
   RAISE EXCEPTION 'TASK_INPUT' USING ERRCODE='BT400';END IF;
  company:=(p_input->>'company_id')::uuid;contract:=(p_input->>'contract_id')::uuid;appointment:=(p_input->>'appointment_id')::uuid;
  source:=coalesce(p_input->>'source_type','manuel');
  IF company IS NOT NULL THEN required:=array_append(required,'customers');END IF;
  IF contract IS NOT NULL OR source='sozlesme' THEN required:=array_append(required,'contracts');END IF;
  IF appointment IS NOT NULL OR source='randevu' THEN required:=array_append(required,'calendar');END IF;
 ELSE
  IF p_task_id IS NULL OR p_revision IS NULL OR p_revision NOT BETWEEN 0 AND 9007199254740990 THEN RAISE EXCEPTION 'TASK_INPUT' USING ERRCODE='BT400';END IF;
  IF p_action='update' THEN
   IF p_input='{}' OR (p_input-ARRAY['title','assigned_to_user_id','due_date','priority','status'])<>'{}' THEN RAISE EXCEPTION 'TASK_INPUT' USING ERRCODE='BT400';END IF;
  ELSIF p_input<>'{}' THEN RAISE EXCEPTION 'TASK_INPUT' USING ERRCODE='BT400';END IF;
 END IF;
 IF (p_action='create' OR p_input ? 'title') AND (p_input->>'title' IS NULL OR length(btrim(p_input->>'title',trim_chars)) NOT BETWEEN 1 AND 2000) THEN RAISE EXCEPTION 'TASK_INPUT' USING ERRCODE='BT400';END IF;
 IF p_input ? 'priority' AND (p_input->>'priority' IS NULL OR p_input->>'priority' NOT IN('dusuk','normal','yuksek','kritik')) THEN RAISE EXCEPTION 'TASK_INPUT' USING ERRCODE='BT400';END IF;
 IF p_input ? 'status' AND (p_input->>'status' IS NULL OR p_input->>'status' NOT IN('acik','devam_ediyor','gecikti','tamamlandi','iptal')) THEN RAISE EXCEPTION 'TASK_INPUT' USING ERRCODE='BT400';END IF;
 IF p_input->>'due_date' IS NOT NULL THEN
  IF p_input->>'due_date' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' OR to_char((p_input->>'due_date')::date,'YYYY-MM-DD')<>p_input->>'due_date' THEN RAISE EXCEPTION 'TASK_INPUT' USING ERRCODE='BT400';END IF;
 END IF;
 target:=CASE WHEN p_action='claim' THEN actor ELSE (p_input->>'assigned_to_user_id')::uuid END;
 PERFORM public.workspace_require_module_write_v1(tenant,required);
 PERFORM 1 FROM public.profiles WHERE id IN(actor,target) ORDER BY id FOR SHARE;
 -- Profiles serialize with membership writers; recheck after this wait as well.
 PERFORM public.workspace_require_module_write_v1(tenant,required);
 role:=public.current_user_role();
 IF role IS NULL OR role NOT IN('yonetici','operasyon','ik') THEN RAISE EXCEPTION 'TASK_FORBIDDEN' USING ERRCODE='BT403';END IF;
 IF (p_action='claim' OR (p_action='update' AND p_input ? 'assigned_to_user_id')) AND role NOT IN('yonetici','operasyon') THEN RAISE EXCEPTION 'TASK_FORBIDDEN' USING ERRCODE='BT403';END IF;
 IF target IS NOT NULL THEN
  SELECT p.display_name,m.role INTO target_name,target_role FROM public.profiles p JOIN public.tenant_memberships m ON m.user_id=p.id AND m.tenant_id=tenant WHERE p.id=target;
  IF NOT FOUND THEN RAISE EXCEPTION 'TASK_ASSIGNEE_MEMBERSHIP' USING ERRCODE='BP002';END IF;
  IF target_role NOT IN('yonetici','operasyon','ik') THEN RAISE EXCEPTION 'TASK_ASSIGNEE_ROLE' USING ERRCODE='BP003';END IF;
 END IF;
 IF p_action='create' THEN
  IF (contract IS NOT NULL OR appointment IS NOT NULL) AND role NOT IN('yonetici','operasyon') THEN RAISE EXCEPTION 'TASK_FORBIDDEN' USING ERRCODE='BT403';END IF;
  IF company IS NOT NULL THEN
   SELECT c.status INTO company_status FROM public.companies c WHERE c.id=company AND c.tenant_id=tenant FOR SHARE;
   IF NOT FOUND THEN RAISE EXCEPTION 'TASK_SCOPE' USING ERRCODE='42501';END IF;
   IF company_status IS NULL OR company_status NOT IN('aday','aktif') THEN RAISE EXCEPTION 'TASK_COMPANY_PASSIVE' USING ERRCODE='BT405';END IF;
  END IF;
  IF contract IS NOT NULL AND NOT EXISTS(SELECT FROM public.contracts c WHERE c.id=contract AND c.tenant_id=tenant AND c.company_id=company) THEN RAISE EXCEPTION 'TASK_SCOPE' USING ERRCODE='42501';END IF;
  IF appointment IS NOT NULL AND NOT EXISTS(SELECT FROM public.appointments a WHERE a.id=appointment AND a.tenant_id=tenant AND a.company_id=company) THEN RAISE EXCEPTION 'TASK_SCOPE' USING ERRCODE='42501';END IF;
  INSERT INTO public.tasks(tenant_id,company_id,contract_id,appointment_id,title,assigned_to_user_id,assigned_to,due_date,source_type,source_ref,priority,status,created_by)
  VALUES(tenant,company,contract,appointment,btrim(p_input->>'title',trim_chars),target,target_name,p_input->>'due_date',source,p_input->>'source_ref',coalesce(p_input->>'priority','normal'),'acik',actor)
  RETURNING * INTO row;
 ELSE
  SELECT * INTO row FROM public.tasks WHERE id=p_task_id AND tenant_id=tenant FOR NO KEY UPDATE;
  IF NOT FOUND OR row.revision<>p_revision THEN RAISE EXCEPTION 'TASK_CONFLICT' USING ERRCODE='BT409';END IF;
  IF p_action='claim' THEN
   IF row.assigned_to_user_id IS NOT NULL OR row.assigned_to IS NOT NULL OR row.status NOT IN('acik','devam_ediyor','gecikti') THEN RAISE EXCEPTION 'TASK_CONFLICT' USING ERRCODE='BT409';END IF;
   UPDATE public.tasks SET assigned_to_user_id=actor,assigned_to=target_name WHERE id=row.id RETURNING * INTO row;
  ELSIF p_action='complete' THEN
   IF row.status NOT IN('acik','devam_ediyor','gecikti') OR (role<>'yonetici' AND row.assigned_to_user_id IS DISTINCT FROM actor) THEN RAISE EXCEPTION 'TASK_CONFLICT' USING ERRCODE='BT409';END IF;
   UPDATE public.tasks SET status='tamamlandi' WHERE id=row.id RETURNING * INTO row;
  ELSE
   UPDATE public.tasks SET title=CASE WHEN p_input ? 'title' THEN btrim(p_input->>'title',trim_chars) ELSE row.title END,
    assigned_to_user_id=CASE WHEN p_input ? 'assigned_to_user_id' THEN target ELSE row.assigned_to_user_id END,
    assigned_to=CASE WHEN p_input ? 'assigned_to_user_id' THEN target_name ELSE row.assigned_to END,
    due_date=CASE WHEN p_input ? 'due_date' THEN p_input->>'due_date' ELSE row.due_date END,
    priority=CASE WHEN p_input ? 'priority' THEN p_input->>'priority' ELSE row.priority END,
    status=CASE WHEN p_input ? 'status' THEN p_input->>'status' ELSE row.status END
   WHERE id=row.id RETURNING * INTO row;
  END IF;
 END IF;
 RETURN NEXT row;
END $$;
REVOKE ALL ON FUNCTION public.task_execute_v1(text,uuid,bigint,jsonb,uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.task_execute_v1(text,uuid,bigint,jsonb,uuid,uuid) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
