-- M2b: guard existing task-producing workflows without replacing their live membership logic.
-- Pending/local. Apply after 000900 + 001000, before the new cron frontend.
-- The 001100 direct-DML contract still waits for authenticated frontend smoke.
BEGIN;
SET LOCAL lock_timeout='15s';
-- Exact signatures and exactly one anchor: schema drift aborts the entire migration.
-- CREATE OR REPLACE retains ownership/grants. No old overload is made callable.
DO $patch$
DECLARE patch record; definition text; function_id regprocedure;
BEGIN
 FOR patch IN SELECT * FROM (VALUES
('public.transfer_tasks_scoped(uuid,uuid,uuid,uuid,uuid,jsonb)',$old$  -- SHARE locks are mutually compatible$old$,$new$  PERFORM public.workspace_require_module_write_v1(p_tenant_id,ARRAY['tasks']);
  -- SHARE locks are mutually compatible$new$),
('public.create_contract_renewal_task(uuid,uuid,uuid,uuid,bigint,uuid,date,text)',$old$  -- Cooperates with transfer/admin locks.$old$,$new$  PERFORM public.workspace_require_module_write_v1(p_tenant_id,ARRAY['contracts','tasks']);
  -- Cooperates with transfer/admin locks.$new$),
('public.complete_appointment_scoped(uuid,uuid,uuid,text,text,boolean)',$old$  -- Same profile lock order$old$,$new$  PERFORM public.workspace_require_module_write_v1(p_tenant_id,CASE WHEN p_create_task THEN ARRAY['calendar','tasks'] ELSE ARRAY['calendar'] END);
  -- Same profile lock order$new$),
('public.task_transfer_directory(uuid,uuid)',$old$  IF public.current_user_role() IS DISTINCT FROM 'yonetici' THEN RAISE EXCEPTION 'TRANSFER_FORBIDDEN'; END IF;$old$,$new$  IF public.current_user_role() IS DISTINCT FROM 'yonetici' THEN RAISE EXCEPTION 'TRANSFER_FORBIDDEN'; END IF;
  IF NOT public.workspace_module_enabled_v1('tasks') THEN RAISE EXCEPTION 'MODULE_DISABLED' USING ERRCODE='BM001'; END IF;$new$),
('public.preview_task_transfer(uuid,uuid,uuid)',$old$  IF public.current_user_role() IS DISTINCT FROM 'yonetici' THEN RAISE EXCEPTION 'TRANSFER_FORBIDDEN'; END IF;$old$,$new$  IF public.current_user_role() IS DISTINCT FROM 'yonetici' THEN RAISE EXCEPTION 'TRANSFER_FORBIDDEN'; END IF;
  IF NOT public.workspace_module_enabled_v1('tasks') THEN RAISE EXCEPTION 'MODULE_DISABLED' USING ERRCODE='BM001'; END IF;$new$),
('public.preview_task_transfer(uuid,uuid,uuid)',$old$LEFT JOIN public.companies c ON c.id=s.company_id AND c.tenant_id=v_tenant$old$,$new$LEFT JOIN public.companies c ON c.id=s.company_id AND c.tenant_id=v_tenant AND (SELECT public.workspace_module_enabled_v1('customers'))$new$),
('public.transfer_tasks_scoped(uuid,uuid,uuid,uuid,uuid,jsonb)',$old$OR NOT EXISTS(SELECT 1 FROM public.companies c WHERE c.id=v_task.company_id AND c.tenant_id=v_tenant)$old$,$new$OR (v_task.company_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.companies c WHERE c.id=v_task.company_id AND c.tenant_id=v_tenant))$new$),
('public.contract_renewal_snapshot(uuid,uuid,uuid)',$old$AND public.current_user_role() IN ('yonetici','operasyon')$old$,$new$AND public.current_user_role() IN ('yonetici','operasyon')
   AND public.workspace_module_enabled_v1('contracts') AND public.workspace_module_enabled_v1('tasks')$new$),
('public.dashboard_activity(uuid,uuid)',$old$DECLARE v_result jsonb;$old$,$new$DECLARE v_result jsonb; v_modules jsonb;$new$),
('public.dashboard_activity(uuid,uuid)',$old$ -- Each source is bounded$old$,$new$ v_modules:=public.current_workspace_modules_v1()->'modules';
 -- Each source is bounded$new$),
('public.dashboard_activity(uuid,uuid)',$old$FROM public.ops_events e WHERE e.tenant_id=p_tenant_id$old$,$new$FROM public.ops_events e WHERE e.tenant_id=p_tenant_id AND (v_modules->>'staffing')::boolean$new$),
('public.dashboard_activity(uuid,uuid)',$old$WHERE h.tenant_id=p_tenant_id AND h.kind<>'baseline'$old$,$new$WHERE h.tenant_id=p_tenant_id AND h.kind<>'baseline' AND (v_modules->>'tasks')::boolean$new$),
('public.dashboard_activity(uuid,uuid)',$old$WHERE v.tenant_id=p_tenant_id AND v.origin='upload'$old$,$new$WHERE v.tenant_id=p_tenant_id AND v.origin='upload' AND (v_modules->>'contracts')::boolean$new$),
('public.dashboard_activity(uuid,uuid)',$old$WHERE e.tenant_id=p_tenant_id
 ORDER BY$old$,$new$WHERE e.tenant_id=p_tenant_id AND (v_modules->>'documents')::boolean
 ORDER BY$new$)
 ) AS edits(signature,old_text,new_text) LOOP
  function_id:=to_regprocedure(patch.signature);
  IF function_id IS NULL THEN RAISE EXCEPTION 'MODULE_WORKFLOW_MISSING: %',patch.signature; END IF;
  definition:=pg_get_functiondef(function_id);
  IF (length(definition)-length(replace(definition,patch.old_text,'')))/length(patch.old_text)<>1 THEN
   RAISE EXCEPTION 'MODULE_WORKFLOW_DRIFT: %',patch.signature;
  END IF;
  EXECUTE replace(definition,patch.old_text,patch.new_text);
 END LOOP;
END $patch$;
-- Appointment completion previously had no bounded business-lock wait.
ALTER FUNCTION public.complete_appointment_scoped(uuid,uuid,uuid,text,text,boolean) SET lock_timeout='5s';
COMMIT;
