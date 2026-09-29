-- Read-only advisory preview. Not a permission to disable modules.
-- No configuration mutation or business grant is introduced.
BEGIN;
SET LOCAL lock_timeout='15s';
CREATE FUNCTION public.preview_workspace_modules_v1(
 p_expected_actor uuid,p_expected_tenant uuid,p_expected_revision text,p_modules jsonb
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE context jsonb; tenant uuid; disabled text[]; dependencies jsonb; checks jsonb:='[]'; present boolean;
 today date := (statement_timestamp() AT TIME ZONE 'Europe/Istanbul')::date;
BEGIN
 context:=public.current_workspace_modules_v1();
 IF p_expected_actor IS NULL OR p_expected_tenant IS NULL
 OR context->>'actorId' IS DISTINCT FROM p_expected_actor::text
 OR context->>'tenantId' IS DISTINCT FROM p_expected_tenant::text
 OR context->>'role' IS DISTINCT FROM 'yonetici' THEN
  RAISE EXCEPTION 'MODULE_PREVIEW_SCOPE' USING ERRCODE='42501';
 END IF;
 tenant:=p_expected_tenant;
 IF p_expected_revision IS NULL OR context->>'configRevision' IS DISTINCT FROM p_expected_revision THEN
  RAISE EXCEPTION 'MODULE_PREVIEW_STALE' USING ERRCODE='40001';
 END IF;
 IF jsonb_typeof(p_modules) IS DISTINCT FROM 'object' THEN
  RAISE EXCEPTION 'MODULE_PREVIEW_INPUT' USING ERRCODE='22023';
 END IF;
 IF (SELECT count(*) FROM jsonb_object_keys(p_modules))<>(SELECT count(*) FROM public.workspace_module_catalog_v1())
 OR EXISTS(SELECT FROM public.workspace_module_catalog_v1() c WHERE NOT p_modules ? c.module_key)
 OR EXISTS(SELECT FROM jsonb_each(p_modules) e WHERE jsonb_typeof(e.value)<>'boolean') THEN
  RAISE EXCEPTION 'MODULE_PREVIEW_INPUT' USING ERRCODE='22023';
 END IF;
 SELECT coalesce(array_agg(c.module_key ORDER BY c.module_key),ARRAY[]::text[]) INTO disabled
 FROM public.workspace_module_catalog_v1() c WHERE (context->'modules'->>c.module_key)::boolean AND NOT (p_modules->>c.module_key)::boolean;
 SELECT coalesce(jsonb_agg(jsonb_build_object('module',c.module_key,'requires',d) ORDER BY c.module_key,d),'[]') INTO dependencies
 FROM public.workspace_module_catalog_v1() c CROSS JOIN LATERAL unnest(c.requires) d
 WHERE (p_modules->>c.module_key)::boolean AND NOT (p_modules->>d)::boolean;
 IF 'tasks'=ANY(disabled) THEN
  SELECT EXISTS(SELECT FROM public.tasks WHERE tenant_id=tenant AND (status IS NULL OR status NOT IN ('tamamlandi','iptal'))) INTO present;
  checks:=checks||jsonb_build_array(jsonb_build_object('module','tasks','code','unfinished_tasks','blocking',present));
 END IF;
 IF 'calendar'=ANY(disabled) THEN
  SELECT EXISTS(SELECT FROM public.appointments WHERE tenant_id=tenant AND (status IS NULL OR status NOT IN ('tamamlandi','iptal'))) INTO present;
  checks:=checks||jsonb_build_array(jsonb_build_object('module','calendar','code','unfinished_appointments','blocking',present));
 END IF;
 IF 'contracts'=ANY(disabled) THEN
  SELECT EXISTS(SELECT FROM public.contracts WHERE tenant_id=tenant AND (status IS NULL OR status NOT IN ('suresi_doldu','feshedildi'))) INTO present;
  checks:=checks||jsonb_build_array(jsonb_build_object('module','contracts','code','unfinished_contracts','blocking',present));
 END IF;
 IF 'talent'=ANY(disabled) THEN
  SELECT EXISTS(SELECT FROM public.talent_import_rows WHERE tenant_id=tenant AND (status IS NULL OR status NOT IN ('created','updated','unchanged','held','blocked','cancelled','reverted'))) INTO present;
  checks:=checks||jsonb_build_array(jsonb_build_object('module','talent','code','pending_talent_import','blocking',present));
 END IF;
 IF 'staffing'=ANY(disabled) THEN
  SELECT EXISTS(SELECT FROM public.staffing_demands WHERE tenant_id=tenant AND (status IS NULL OR status NOT IN ('tamamen_doldu','iptal'))) INTO present;
  checks:=checks||jsonb_build_array(jsonb_build_object('module','staffing','code','open_staffing_demands','blocking',present));
 END IF;
 IF 'staffing'=ANY(disabled) THEN
  SELECT EXISTS(SELECT FROM public.ops_daily_requests WHERE tenant_id=tenant AND (lifecycle IS DISTINCT FROM 'cancelled' AND work_date >= today)) INTO present;
  checks:=checks||jsonb_build_array(jsonb_build_object('module','staffing','code','upcoming_requests','blocking',present));
 END IF;
 IF 'staffing'=ANY(disabled) THEN
  SELECT EXISTS(SELECT FROM public.ops_assignments WHERE tenant_id=tenant AND (removed_at IS NULL AND work_date >= today)) INTO present;
  checks:=checks||jsonb_build_array(jsonb_build_object('module','staffing','code','upcoming_assignments','blocking',present));
 END IF;
 IF 'staffing'=ANY(disabled) THEN
  SELECT EXISTS(SELECT FROM public.ops_work_records WHERE tenant_id=tenant AND (status IS DISTINCT FROM 'approved')) INTO present;
  checks:=checks||jsonb_build_array(jsonb_build_object('module','staffing','code','unapproved_work','blocking',present));
 END IF;
 IF 'staffing'=ANY(disabled) THEN
  SELECT EXISTS(SELECT FROM public.ops_fixed_roster WHERE tenant_id=tenant AND (NOT cancelled AND (ends_on IS NULL OR ends_on >= today))) INTO present;
  checks:=checks||jsonb_build_array(jsonb_build_object('module','staffing','code','active_roster','blocking',present));
 END IF;
 IF 'staffing'=ANY(disabled) THEN
  SELECT EXISTS(SELECT FROM public.ops_schedules WHERE tenant_id=tenant AND (coalesce((plan->>'archived')::boolean,false) = false AND ((plan->>'end') IS NULL OR (plan->>'end')::date >= today))) INTO present;
  checks:=checks||jsonb_build_array(jsonb_build_object('module','staffing','code','active_schedules','blocking',present));
 END IF;
 IF 'reporting'=ANY(disabled) THEN
  SELECT EXISTS(SELECT FROM public.reporting_periods WHERE tenant_id=tenant AND (status IS DISTINCT FROM 'closed')) INTO present;
  checks:=checks||jsonb_build_array(jsonb_build_object('module','reporting','code','open_reporting_periods','blocking',present));
 END IF;
 IF 'reporting'=ANY(disabled) THEN
  SELECT EXISTS(SELECT FROM public.reporting_imports WHERE tenant_id=tenant AND (status IS NULL OR status NOT IN ('approved','cancelled'))) INTO present;
  checks:=checks||jsonb_build_array(jsonb_build_object('module','reporting','code','pending_reporting_imports','blocking',present));
 END IF;
 IF 'customers'=ANY(disabled) THEN
  SELECT EXISTS(SELECT FROM public.tasks WHERE tenant_id=tenant AND company_id IS NOT NULL AND (status IS NULL OR status NOT IN ('tamamlandi','iptal'))) INTO present;
  checks:=checks||jsonb_build_array(jsonb_build_object('module','customers','code','customer_linked_tasks','blocking',present));
 END IF;
 IF 'calendar'=ANY(disabled) THEN
  SELECT EXISTS(SELECT FROM public.tasks WHERE tenant_id=tenant AND appointment_id IS NOT NULL AND (status IS NULL OR status NOT IN ('tamamlandi','iptal'))) INTO present;
  checks:=checks||jsonb_build_array(jsonb_build_object('module','calendar','code','appointment_linked_tasks','blocking',present));
 END IF;
 IF 'contracts'=ANY(disabled) THEN
  SELECT EXISTS(SELECT FROM public.tasks WHERE tenant_id=tenant AND contract_id IS NOT NULL AND (status IS NULL OR status NOT IN ('tamamlandi','iptal'))) INTO present;
  checks:=checks||jsonb_build_array(jsonb_build_object('module','contracts','code','contract_linked_tasks','blocking',present));
 END IF;
 RETURN jsonb_build_object('schemaVersion',1,'context',context,'requested',p_modules,
 'disabled',to_jsonb(disabled),'dependencies',dependencies,'checks',checks,
 'assessmentDate',today::text,'advisoryOnly',true,'mutationAvailable',false);
END $$;
REVOKE ALL ON FUNCTION public.preview_workspace_modules_v1(uuid,uuid,text,jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.preview_workspace_modules_v1(uuid,uuid,text,jsonb) TO authenticated;
COMMENT ON FUNCTION public.preview_workspace_modules_v1(uuid,uuid,text,jsonb) IS
 'Manager-only snapshot of dependency violations and known open-work blockers. Not exhaustive authorization. Future mutation must lock config, revalidate membership/revision and rerun blockers after every writer joins the barrier.';
COMMIT;
