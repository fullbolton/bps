BEGIN;
INSERT INTO companies(id,name,tenant_id) VALUES('00000000-0000-4000-8000-000000000941','Calendar synthetic','00000000-0000-4000-8000-000000000001');
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000011","active_tenant_id":"00000000-0000-4000-8000-000000000001"}',true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE r appointments; result jsonb; BEGIN
 SELECT * INTO r FROM appointment_execute_v1('create',NULL,'00000000-0000-4000-8000-000000000001','{"company_id":"00000000-0000-4000-8000-000000000941","meeting_date":"2026-10-13","meeting_type":"ziyaret"}');
 IF r.status<>'planlandi' THEN RAISE EXCEPTION 'CREATE_FAILED';END IF;
 PERFORM appointment_execute_v1('status',r.id,r.tenant_id,'{"status":"iptal","expected_status":"planlandi"}');
 PERFORM appointment_execute_v1('status',r.id,r.tenant_id,'{"status":"planlandi","expected_status":"iptal"}');
 SELECT complete_appointment_scoped(auth.uid(),r.tenant_id,r.id,'Synthetic result','Synthetic follow-up',true) INTO result;
 IF result->>'taskId' IS NULL THEN RAISE EXCEPTION 'FOLLOWUP_MISSING';END IF;
 BEGIN
  PERFORM appointment_execute_v1('status',r.id,r.tenant_id,'{"status":"planlandi","expected_status":"planlandi"}');
  RAISE EXCEPTION 'COMPLETED_APPOINTMENT_REOPENED';
 EXCEPTION WHEN SQLSTATE 'PT409' THEN NULL;
 END;
END $$;

RESET ROLE;
DO $$ BEGIN
 IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.documents'::regclass)
 OR (SELECT count(*) FROM pg_policies WHERE schemaname='public' AND tablename='documents'
 AND permissive='RESTRICTIVE' AND roles=ARRAY['authenticated']::name[] AND (
 (policyname='documents_command_insert_only' AND cmd='INSERT' AND with_check='false') OR
 (policyname='documents_command_update_only' AND cmd='UPDATE' AND qual='false' AND with_check='false') OR
 (policyname='documents_command_delete_only' AND cmd='DELETE' AND qual='false'))) <> 3 THEN
 RAISE EXCEPTION 'DOCUMENT_DIRECT_WRITE_POLICY_OPEN';
 END IF;
 IF EXISTS(SELECT 1 FROM pg_proc WHERE oid IN (
 'public.admin_manage_membership(uuid,uuid,text,text,text,uuid)'::regprocedure,
 'public.select_workspace(uuid,uuid,uuid,uuid)'::regprocedure,
 'public.preview_workspace_modules_v1(uuid,uuid,text,jsonb)'::regprocedure)
 AND prosrc LIKE '%ERRCODE=''40001''%') THEN
  RAISE EXCEPTION 'WORKSPACE_CONFLICT_RETRY_REMAINS';
 END IF;
END $$;
SELECT 'calendar lifecycle + follow-up task + stale conflict + document direct-write closure + workspace conflict codes passed';
ROLLBACK;
