import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
const container='supabase_db_bps-supabase-acceptance';
const sql=q=>execFileSync('docker',['exec','-i',container,'psql','-X','-qAt','-U','postgres','-v','ON_ERROR_STOP=1'],{input:q,encoding:'utf8',timeout:30000});
test('project foundation on guarded synthetic database, rolled back',()=>{
 assert.equal(sql("select obj_description('public.tasks'::regclass)").trim(),'BPS synthetic task-prefill fixture v1');
 assert.equal(sql("select to_regclass('public.reporting_projects') is null").trim(),'t');
 const migration=readFileSync('supabase/migrations/20260928000100_project_reporting_foundation.sql','utf8').replace(/COMMIT;\s*$/,'');
 const checks=`
CREATE FUNCTION pg_temp.expect_error(q text, marker text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE caught boolean:=false;
BEGIN BEGIN EXECUTE q; EXCEPTION WHEN OTHERS THEN
 IF position(marker IN SQLERRM)=0 THEN RAISE;END IF;caught:=true;
END;IF NOT caught THEN RAISE EXCEPTION 'Expected error: %',marker;END IF;END $$;
SELECT set_config('request.jwt.claims',jsonb_build_object('sub',user_id,'app_metadata',jsonb_build_object('active_tenant',tenant_id))::text,true)
FROM tenant_memberships m JOIN profiles p ON p.id=m.user_id WHERE tenant_id='00000000-0000-4000-8000-000000000001' AND role='operasyon' LIMIT 1;
SET LOCAL ROLE authenticated;
DO $$ DECLARE actor uuid:=auth.uid(); tenant uuid:='00000000-0000-4000-8000-000000000001';command uuid:=gen_random_uuid();r jsonb;payload jsonb;pid uuid; BEGIN
 payload:='{"action":"create","companyId":"00000000-0000-4000-8000-000000000020","code":"QA-PROJECT","name":"Synthetic project","kind":"idp"}';
 r:=public.reporting_project_execute(actor,tenant,command,payload);pid:=(r->>'projectId')::uuid;
 IF public.reporting_project_execute(actor,tenant,command,payload)<>r THEN RAISE EXCEPTION 'Retry differs';END IF;
 PERFORM pg_temp.expect_error(format('select public.reporting_project_execute(%L,%L,%L,%L)',actor,tenant,command,payload||'{"name":"changed"}'::jsonb),'REPORT_COMMAND_MISMATCH');
 PERFORM pg_temp.expect_error(format('select public.reporting_project_execute(%L,%L,%L,%L)',actor,tenant,gen_random_uuid(),payload||'{"code":"FOREIGN","companyId":"00000000-0000-4000-8000-000000000021"}'::jsonb),'REPORT_COMPANY');
 PERFORM pg_temp.expect_error(format('select public.reporting_project_execute(%L,%L,%L,%L)',actor,tenant,gen_random_uuid(),payload),'duplicate key');
 payload:=jsonb_build_object('action','link_location','projectId',pid,'revision',1,'locationId','00000000-0000-4000-8000-000000000100','from','2026-09-01','until',null);
 PERFORM public.reporting_project_execute(actor,tenant,gen_random_uuid(),payload);
 PERFORM pg_temp.expect_error(format('select public.reporting_project_execute(%L,%L,%L,%L)',actor,tenant,gen_random_uuid(),payload),'REPORT_CONFLICT');
 PERFORM pg_temp.expect_error(format('select public.reporting_project_execute(%L,%L,%L,%L)',actor,tenant,gen_random_uuid(),payload||'{"revision":2}'::jsonb),'REPORT_LOCATION_OVERLAP');
 payload:=jsonb_build_object('action','open_period','projectId',pid,'revision',2,'month','2026-09');
 PERFORM public.reporting_project_execute(actor,tenant,gen_random_uuid(),payload);
 PERFORM pg_temp.expect_error(format('select public.reporting_project_execute(%L,%L,%L,%L)',actor,tenant,gen_random_uuid(),payload||'{"revision":3}'::jsonb),'duplicate key');
 IF public.reporting_project_detail(actor,tenant,pid,0,0)->'locations'->>'total'<>'1'
 OR public.reporting_project_detail(actor,tenant,pid,0,0)->'periods'->>'total'<>'1' THEN RAISE EXCEPTION 'Detail count';END IF;
 IF jsonb_array_length(public.reporting_project_detail(actor,tenant,pid,50,50)->'locations'->'rows')<>0 THEN RAISE EXCEPTION 'Pagination';END IF;
 PERFORM pg_temp.expect_error(format('select public.reporting_project_detail(%L,%L,%L,0,0)',actor,'00000000-0000-4000-8000-000000000002',pid),'REPORT_SCOPE');
 IF public.reporting_project_list(actor,tenant,0)->>'total'<>'1' THEN RAISE EXCEPTION 'List count';END IF;
 PERFORM pg_temp.expect_error(format('select public.reporting_project_list(%L,%L,0)',actor,'00000000-0000-4000-8000-000000000002'),'REPORT_SCOPE');
 PERFORM pg_temp.expect_error('select * from public.reporting_projects','permission denied');
END $$;
RESET ROLE;
SET LOCAL ROLE authenticated;
DO $$ DECLARE actor uuid:=auth.uid();tenant uuid:='00000000-0000-4000-8000-000000000001';pid uuid;BEGIN
 pid:=(public.reporting_project_list(actor,tenant,0)->'rows'->0->>'id')::uuid;
 PERFORM pg_temp.expect_error(format('select public.reporting_project_execute(%L,%L,%L,%L)',actor,tenant,gen_random_uuid(),jsonb_build_object('action','close_period','projectId',pid,'revision',3,'month','2026-09','reason','Kontrol tamamlandı')),'REPORT_FORBIDDEN');
END $$;
RESET ROLE;
UPDATE profiles SET role='yonetici' WHERE id=auth.uid();
SET LOCAL ROLE authenticated;
DO $$ DECLARE actor uuid:=auth.uid();tenant uuid:='00000000-0000-4000-8000-000000000001';pid uuid;payload jsonb;cmd uuid:=gen_random_uuid();r jsonb;BEGIN
 pid:=(public.reporting_project_list(actor,tenant,0)->'rows'->0->>'id')::uuid;
 payload:=jsonb_build_object('action','edit_project','projectId',pid,'revision',3,'name','Düzeltilmiş proje','kind','fixed','reason','Hizmet türü düzeltildi');
 PERFORM public.reporting_project_execute(actor,tenant,gen_random_uuid(),payload);
 IF public.reporting_project_detail(actor,tenant,pid,0,0)->>'name'<>'Düzeltilmiş proje' THEN RAISE EXCEPTION 'Edit not persisted';END IF;
 payload:=jsonb_build_object('action','close_period','projectId',pid,'revision',4,'month','2026-09','reason','Kontrol tamamlandı');
 PERFORM pg_temp.expect_error(format('select public.reporting_project_execute(%L,%L,%L,%L)',actor,tenant,gen_random_uuid(),payload||'{"reason":""}'::jsonb),'REPORT_REASON');
 r:=public.reporting_project_execute(actor,tenant,cmd,payload);
 IF public.reporting_project_execute(actor,tenant,cmd,payload)<>r THEN RAISE EXCEPTION 'Close retry';END IF;
 IF public.reporting_project_detail(actor,tenant,pid,0,0)->'periods'->'rows'->0->>'status'<>'closed' THEN RAISE EXCEPTION 'Not closed';END IF;
 payload:=jsonb_build_object('action','edit_location','projectId',pid,'revision',5,'locationId','00000000-0000-4000-8000-000000000100','originalFrom','2026-09-01','from','2026-10-01','until',null,'reason','Başlangıç düzeltmesi');
 PERFORM pg_temp.expect_error(format('select public.reporting_project_execute(%L,%L,%L,%L)',actor,tenant,gen_random_uuid(),payload),'REPORT_PERIOD_CLOSED');
 PERFORM public.reporting_project_execute(actor,tenant,gen_random_uuid(),jsonb_build_object('action','reopen_period','projectId',pid,'revision',5,'month','2026-09','reason','Kaynak rapor düzeltilecek'));
 PERFORM public.reporting_project_execute(actor,tenant,gen_random_uuid(),payload||'{"revision":6}'::jsonb);
 IF public.reporting_project_detail(actor,tenant,pid,0,0)->'locations'->'rows'->0->>'validFrom'<>'2026-10-01' THEN RAISE EXCEPTION 'Location correction';END IF;
 IF public.reporting_project_detail(actor,tenant,pid,0,0)->'periods'->'rows'->0->>'lastReason'<>'Kaynak rapor düzeltilecek' THEN RAISE EXCEPTION 'Reason missing';END IF;
END $$;
RESET ROLE;
DO $$ BEGIN IF (SELECT count(*) FROM reporting_period_events)<>2 THEN RAISE EXCEPTION 'Audit count';END IF; END $$;
UPDATE profiles SET role='ik' WHERE id=auth.uid();
SET LOCAL ROLE authenticated;
SELECT pg_temp.expect_error(format('select public.reporting_project_execute(%L,%L,%L,%L)',auth.uid(),'00000000-0000-4000-8000-000000000001',gen_random_uuid(),'{"action":"create"}'),'REPORT_FORBIDDEN');
RESET ROLE;
UPDATE profiles SET role='partner' WHERE id=auth.uid();
SET LOCAL ROLE authenticated;
SELECT pg_temp.expect_error(format('select public.reporting_project_list(%L,%L,0)',auth.uid(),'00000000-0000-4000-8000-000000000001'),'REPORT_FORBIDDEN');
RESET ROLE;
UPDATE profiles SET role='goruntuleyici' WHERE id=auth.uid();
SET LOCAL ROLE authenticated;
SELECT pg_temp.expect_error(format('select public.reporting_project_list(%L,%L,0)',auth.uid(),'00000000-0000-4000-8000-000000000001'),'REPORT_FORBIDDEN');
RESET ROLE;
SET LOCAL ROLE anon;
SELECT pg_temp.expect_error('select public.reporting_project_list(null,null,0)','permission denied');
RESET ROLE;
ROLLBACK;
`;
 sql(migration+checks);
 assert.equal(sql("select to_regclass('public.reporting_projects') is null").trim(),'t');
});
