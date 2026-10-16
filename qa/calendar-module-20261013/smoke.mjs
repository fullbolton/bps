// Local schema snapshot + synthetic seed only; every change rolls back.
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
const files=['20261013000100_calendar_module_commands.sql','20261013000200_calendar_direct_write_cutover.sql'];
const migrations=files.map(f=>readFileSync(new URL('../../supabase/migrations/'+f,import.meta.url),'utf8').replace(/^BEGIN;$/m,'').replace(/^COMMIT;$/m,''));
const sql='BEGIN;\n'+migrations.join('\n')+`
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
ROLLBACK;`;
process.stdout.write(execFileSync('docker',['exec','-i','supabase_db_bps-supabase-acceptance','psql','-U','postgres','-d','bps_module_chain_20261005','-v','ON_ERROR_STOP=1'],{input:sql,encoding:'utf8'}));
