import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
const container='supabase_db_bps-supabase-acceptance';
const sql=q=>execFileSync('docker',['exec','-i',container,'psql','-X','-qAt','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1'],{input:q,encoding:'utf8',timeout:30000,stdio:['pipe','pipe','pipe']});
const read=name=>readFileSync(new URL('../supabase/migrations/'+name,import.meta.url),'utf8');
const body=s=>s.replace(/^BEGIN;/m,'').replace(/COMMIT;\s*$/,'');
const migration=read('20260928000600_company_tenant_foreign_keys.sql');
// The synthetic fixture predates production CASCADE on these two direct FKs.
// Align only inside the rollback transaction with measured production definitions.
const liveCompanyKeys=`ALTER TABLE tasks DROP CONSTRAINT tasks_company_id_fkey;ALTER TABLE tasks ADD CONSTRAINT tasks_company_id_fkey FOREIGN KEY(company_id) REFERENCES companies(id) ON DELETE CASCADE;ALTER TABLE appointments DROP CONSTRAINT appointments_company_id_fkey;ALTER TABLE appointments ADD CONSTRAINT appointments_company_id_fkey FOREIGN KEY(company_id) REFERENCES companies(id) ON DELETE CASCADE;`;
const baseline=liveCompanyKeys+body(read('20260915001000_independent_tasks.sql'))+body(read('20260915000600_related_company_boundaries.sql'));
const setup=`
INSERT INTO tenants(id) VALUES('11111111-1111-4111-8111-111111111111'),('22222222-2222-4222-8222-222222222222');
INSERT INTO companies(id,tenant_id,name,status) VALUES
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','Synthetic fence A','aktif'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','22222222-2222-4222-8222-222222222222','Synthetic fence B','aktif');
`;
const checks=`
DO $$ DECLARE
 a uuid:='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';b uuid:='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
 ta uuid:='11111111-1111-4111-8111-111111111111';tb uuid:='22222222-2222-4222-8222-222222222222';
 co uuid:=gen_random_uuid();ap uuid:=gen_random_uuid();tk uuid:=gen_random_uuid();ind uuid:=gen_random_uuid();
BEGIN
 INSERT INTO contracts(id,company_id,tenant_id,name) VALUES(co,a,ta,'Synthetic contract');
 INSERT INTO appointments(id,company_id,tenant_id,contract_id,meeting_date) VALUES(ap,a,ta,co,current_date);
 INSERT INTO tasks(id,company_id,tenant_id,contract_id,appointment_id,title) VALUES(tk,a,ta,co,ap,'Synthetic linked');
 INSERT INTO tasks(id,company_id,tenant_id,title,source_type) VALUES(ind,NULL,ta,'Synthetic independent','manuel');
 BEGIN INSERT INTO contracts(company_id,tenant_id,name) VALUES(b,ta,'Invalid'); RAISE EXCEPTION 'contract insert accepted'; EXCEPTION WHEN foreign_key_violation THEN NULL; END;
 BEGIN INSERT INTO appointments(company_id,tenant_id,meeting_date) VALUES(b,ta,current_date); RAISE EXCEPTION 'appointment insert accepted'; EXCEPTION WHEN foreign_key_violation THEN NULL; END;
 BEGIN INSERT INTO tasks(company_id,tenant_id,title) VALUES(b,ta,'Invalid'); RAISE EXCEPTION 'task insert accepted'; EXCEPTION WHEN foreign_key_violation THEN NULL; END;
 BEGIN UPDATE contracts SET tenant_id=tb WHERE id=co; RAISE EXCEPTION 'contract update accepted'; EXCEPTION WHEN foreign_key_violation THEN NULL; END;
 BEGIN UPDATE appointments SET tenant_id=tb WHERE id=ap; RAISE EXCEPTION 'appointment update accepted'; EXCEPTION WHEN foreign_key_violation THEN NULL; END;
 BEGIN UPDATE tasks SET tenant_id=tb WHERE id=tk; RAISE EXCEPTION 'task update accepted'; EXCEPTION WHEN foreign_key_violation THEN NULL; WHEN raise_exception THEN IF SQLERRM<>'TASK_CONTEXT_IMMUTABLE' THEN RAISE;END IF; END;
 BEGIN UPDATE companies SET tenant_id=tb WHERE id=a; RAISE EXCEPTION 'parent tenant move accepted'; EXCEPTION WHEN foreign_key_violation THEN NULL; END;
 BEGIN INSERT INTO tasks(company_id,tenant_id,title,source_type) VALUES(NULL,NULL,'Invalid','manuel'); RAISE EXCEPTION 'null tenant accepted'; EXCEPTION WHEN not_null_violation THEN NULL; END;
 BEGIN UPDATE tasks SET contract_id=co WHERE id=ind; RAISE EXCEPTION 'independent linked context accepted'; EXCEPTION WHEN check_violation THEN NULL; WHEN raise_exception THEN IF SQLERRM<>'TASK_CONTEXT_IMMUTABLE' THEN RAISE;END IF; END;
 DELETE FROM contracts WHERE id=co;
 IF NOT EXISTS(SELECT 1 FROM tasks WHERE id=tk AND contract_id IS NULL AND appointment_id=ap AND tenant_id=ta AND company_id=a) THEN RAISE EXCEPTION 'contract SET NULL changed';END IF;
 DELETE FROM companies WHERE id=a;
 IF EXISTS(SELECT 1 FROM tasks WHERE id=tk) OR EXISTS(SELECT 1 FROM appointments WHERE id=ap) THEN RAISE EXCEPTION 'company cascade changed';END IF;
 IF NOT EXISTS(SELECT 1 FROM tasks WHERE id=ind AND tenant_id=ta AND company_id IS NULL) THEN RAISE EXCEPTION 'independent task deleted';END IF;
END $$;
`;
function guard(){assert.equal(sql("select obj_description('public.tasks'::regclass)").trim(),'BPS synthetic task-prefill fixture v1');assert.equal(sql("select count(*) from pg_constraint where conname='tasks_company_tenant_fkey'").trim(),'0');}
test('tenant foreign keys: inserts, updates, parent changes, independent tasks and deletion semantics',()=>{
 guard();sql('BEGIN;'+baseline+body(migration)+setup+checks+'ROLLBACK;');guard();
});
for(const table of ['contracts','appointments','tasks'])test('existing mismatch in '+table+' aborts all changes',()=>{
 guard();const insert=table==='contracts'?"INSERT INTO contracts(company_id,tenant_id,name) VALUES('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','11111111-1111-4111-8111-111111111111','Bad');":table==='appointments'?"INSERT INTO appointments(company_id,tenant_id,meeting_date) VALUES('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','11111111-1111-4111-8111-111111111111',current_date);":"INSERT INTO tasks(company_id,tenant_id,title) VALUES('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','11111111-1111-4111-8111-111111111111','Bad');";
 assert.throws(()=>sql('BEGIN;'+baseline+setup+insert+body(migration)+'COMMIT;'),e=>String(e.stderr).includes('Existing company tenant mismatch on '+table));guard();
});
test('unexpected old deletion rule aborts migration',()=>{
 guard();assert.throws(()=>sql('BEGIN;'+baseline+'ALTER TABLE appointments DROP CONSTRAINT appointments_company_id_fkey;ALTER TABLE appointments ADD CONSTRAINT appointments_company_id_fkey FOREIGN KEY(company_id) REFERENCES companies(id) ON DELETE RESTRICT;'+body(migration)+'COMMIT;'),e=>String(e.stderr).includes('Unexpected company foreign key on appointments'));guard();
});

test('lock contention aborts before changes and leaves original constraints intact',async()=>{
 guard();
 const {spawn}=await import('node:child_process');
 const holder=spawn('docker',['exec','-i',container,'psql','-X','-qAt','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1'],{stdio:['pipe','pipe','pipe']});
 const ended=new Promise((resolve,reject)=>{holder.on('error',reject);holder.on('exit',code=>code===0?resolve():reject(Error('lock holder failed')));});
 const ready=new Promise((resolve,reject)=>{holder.stdout.on('data',data=>{if(String(data).includes('LOCK_READY'))resolve();});holder.on('exit',()=>reject(Error('lock holder ended before signal')));holder.on('error',reject);});
 holder.stdin.end("BEGIN;LOCK public.companies IN ACCESS SHARE MODE;SELECT 'LOCK_READY';SELECT pg_sleep(2);ROLLBACK;");
 try{await ready;assert.throws(()=>sql(migration.replace("lock_timeout = '15s'","lock_timeout = '250ms'")),e=>String(e.stderr).includes('lock timeout'));}finally{await ended;}
 guard();
});
