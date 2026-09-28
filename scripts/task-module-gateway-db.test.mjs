import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {sqlFile,fixture,active,verified,workspace,actualFunction} from './fixtures/module-database.mjs';
const {Client}=createRequire(import.meta.url)('pg');
const adminUrl=new URL(process.env.BPS_MODULE_TEST_DATABASE_URL??'postgres://bps_module_test@127.0.0.1:55439/postgres');
assert.ok(['127.0.0.1','localhost','[::1]'].includes(adminUrl.hostname));
const name=`bps_module_acceptance_tasks_${process.pid}_${Date.now()}`;
const url=new URL(adminUrl);url.pathname='/'+name;
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
let admin,db,created=false;
const client=()=>new Client({connectionString:url.href,connectionTimeoutMillis:5000,query_timeout:10000});
const roles=['yonetici','operasyon','ik','partner','muhasebe','goruntuleyici'];
const roleActor=index=>index===0?11:20+index;
const baseTask=sqlFile('20260407000800_create_tasks.sql').split('-- RLS:')[0];
const currentRole=actualFunction('20260926000100_multi_workspace_cutover.sql','current_user_role');
const taskGuard=actualFunction('20260926000100_multi_workspace_cutover.sql','tasks_guard_active_assignee');
const body=sql=>sql.replace(/^BEGIN;\s*$/m,'').replace(/COMMIT;\s*$/,'');
const setup=`
CREATE TABLE profiles(id uuid PRIMARY KEY,display_name text,role text);
CREATE TABLE companies(legacy_mock_id text,finance_secret numeric DEFAULT 999999, id uuid PRIMARY KEY,tenant_id uuid NOT NULL REFERENCES tenants(id),name text,status text);
CREATE TABLE contracts(name text DEFAULT 'Synthetic contract',renewal_target_date date,end_date date, id uuid PRIMARY KEY,company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,tenant_id uuid NOT NULL REFERENCES tenants(id));
CREATE TABLE appointments(status text DEFAULT 'planlandi',result text,next_action text,updated_at timestamptz DEFAULT now(), id uuid PRIMARY KEY,company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,tenant_id uuid NOT NULL REFERENCES tenants(id));
INSERT INTO profiles VALUES('${id(11)}','Manager','yonetici'),('${id(12)}','Other tenant','operasyon');
${roles.slice(1).map((r,i)=>`INSERT INTO profiles VALUES('${id(21+i)}','Member ${i}','${r}');INSERT INTO tenant_memberships VALUES('${id(1)}','${id(21+i)}','${r}','${id(121+i)}');`).join('\n')}
INSERT INTO companies(id,tenant_id,name,status) VALUES('${id(101)}','${id(1)}','Synthetic customer','aktif'),('${id(102)}','${id(2)}','Foreign customer','aktif');
INSERT INTO contracts(id,company_id,tenant_id) VALUES('${id(201)}','${id(101)}','${id(1)}'),('${id(202)}','${id(102)}','${id(2)}');
INSERT INTO appointments(id,company_id,tenant_id) VALUES('${id(301)}','${id(101)}','${id(1)}');
`;
async function claims(c,actor=11,tenant=1){await c.query("SELECT set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:id(actor),active_tenant_id:id(tenant)})]);}
async function asUser(c,actor=11,tenant=1){await claims(c,actor,tenant);await c.query('SET ROLE authenticated');}
async function rollback(fn){await db.query('BEGIN');try{return await fn();}finally{await db.query('ROLLBACK');await db.query('RESET ROLE');}}
async function execute(c,action,input={},task=null,revision=null,expectedTenant=null,expectedActor=null){
 const r=await c.query('SELECT * FROM task_execute_v1($1,$2,$3,$4::jsonb,$5,$6)',[action,task,revision,JSON.stringify(input),expectedTenant,expectedActor]);return r.rows[0];
}
async function create(c,input={}){return execute(c,'create',{title:'Synthetic task',company_id:null,...input},null,null,id(1));}
async function disabled(c,module='tasks'){await c.query("UPDATE tenant_module_settings SET enabled=false WHERE tenant_id=$1 AND module_key=$2",[id(1),module]);}
async function waiting(c,pid){for(let i=0;i<100;i++){await c.query('SELECT pg_stat_clear_snapshot()');const r=await c.query('SELECT wait_event_type FROM pg_stat_activity WHERE pid=$1',[pid]);if(r.rows[0]?.wait_event_type==='Lock')return;await new Promise(r=>setTimeout(r,10));}throw Error('Expected lock wait');}
before(async()=>{
 admin=new Client({connectionString:adminUrl.href,connectionTimeoutMillis:5000,query_timeout:10000});await admin.connect();await admin.query(`CREATE DATABASE ${name}`);created=true;
 db=client();await db.connect();
 await db.query(fixture+setup+active+verified+workspace+currentRole+baseTask+`
 ALTER TABLE tasks ADD COLUMN tenant_id uuid NOT NULL REFERENCES tenants(id),ADD COLUMN assigned_to_user_id uuid REFERENCES profiles(id) ON DELETE SET NULL;
 ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
 CREATE POLICY tasks_read ON tasks FOR SELECT TO authenticated USING(tenant_id=current_user_verified_tenant() AND current_user_role() IN('yonetici','operasyon','ik'));
 CREATE POLICY tasks_old_write ON tasks FOR ALL TO authenticated USING(tenant_id=current_user_verified_tenant()) WITH CHECK(tenant_id=current_user_verified_tenant());
 GRANT SELECT,INSERT,UPDATE,DELETE ON tasks TO authenticated;
 `+body(sqlFile('20260909001300_task_assignment_history.sql'))+body(sqlFile('20260915001000_independent_tasks.sql'))+taskGuard+`
 CREATE TRIGGER tasks_guard_active_assignee BEFORE INSERT OR UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION tasks_guard_active_assignee();
 `);

 await db.query(sqlFile('20260909001400_appointment_completion.sql'));
 await db.query(sqlFile('20260909001500_task_transfer.sql'));
 await db.query(sqlFile('20260909001700_contract_renewal_task.sql'));
 // Apply the exact three task-workflow role replacements from the workspace cutover.
 const rolePatch=sqlFile('20260926000100_multi_workspace_cutover.sql');
 const matches=[...rolePatch.matchAll(/\('([^']+)',\$old\$([\s\S]*?)\$old\$,\$new\$([\s\S]*?)\$new\$,1\)/g)]
  .filter(m=>/^public\.(task_transfer_directory|transfer_tasks_scoped|create_contract_renewal_task)\(/.test(m[1]));
 assert.equal(matches.length,3);
 for(const [,signature,oldText,newText] of matches){
  const definition=(await db.query('SELECT pg_get_functiondef($1::regprocedure) def',[signature])).rows[0].def;
  assert.equal(definition.split(oldText).length,2);await db.query(definition.replace(oldText,newText));
 }
 await db.query(`
 CREATE TABLE ops_events(id uuid,tenant_id uuid,entity_id uuid,created_at timestamptz,kind text);
 CREATE TABLE ops_locations(id uuid,tenant_id uuid,name text);
 CREATE TABLE ops_workers(id uuid,tenant_id uuid,name text);
 CREATE TABLE ops_daily_requests(id uuid,tenant_id uuid,position text,work_date date);
 CREATE TABLE ops_assignments(id uuid,tenant_id uuid,worker_id uuid,work_date date);
 CREATE TABLE contract_document_versions(id uuid,tenant_id uuid,contract_id uuid,company_id uuid,recorded_at timestamptz,name text,origin text);
 CREATE TABLE documents(id uuid,tenant_id uuid,company_id uuid,contract_id uuid,storage_path text,name text);
 `);
 await db.query(sqlFile('20260913000100_company_document_activity.sql'));
 await db.query(sqlFile('20260928000900_tenant_module_foundation.sql'));
 await db.query(sqlFile('20260928001000_task_module_gateway.sql'));
 assert.equal((await db.query("SELECT has_table_privilege('authenticated','tasks','INSERT,UPDATE') allowed")).rows[0].allowed,true);
 await db.query(sqlFile('20260928001100_task_module_direct_write_cutover.sql'));
 await db.query(sqlFile('20260928001200_task_module_workflows.sql'));
 await db.query(sqlFile('20260928001300_task_module_notifications.sql'));

 // Effective task parent keys from 20260915000600 + 20260928000600, without unrelated tables.
 await db.query(`
 ALTER TABLE companies ADD UNIQUE(tenant_id,id);
 ALTER TABLE tasks DROP CONSTRAINT tasks_company_id_fkey, ADD CONSTRAINT tasks_company_tenant_fkey FOREIGN KEY(tenant_id,company_id) REFERENCES companies(tenant_id,id) ON DELETE CASCADE;
 ALTER TABLE contracts ADD UNIQUE(id,company_id,tenant_id);
 ALTER TABLE appointments ADD UNIQUE(id,company_id,tenant_id);
 ALTER TABLE tasks DROP CONSTRAINT tasks_contract_id_fkey,DROP CONSTRAINT tasks_appointment_id_fkey,
 ADD CONSTRAINT tasks_contract_company_tenant_fkey FOREIGN KEY(contract_id,company_id,tenant_id) REFERENCES contracts(id,company_id,tenant_id) ON DELETE SET NULL(contract_id),
 ADD CONSTRAINT tasks_appointment_company_tenant_fkey FOREIGN KEY(appointment_id,company_id,tenant_id) REFERENCES appointments(id,company_id,tenant_id) ON DELETE SET NULL(appointment_id);
 ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
 CREATE POLICY company_fixture_read ON companies FOR SELECT TO authenticated USING(tenant_id=current_user_verified_tenant());
 GRANT SELECT ON companies TO authenticated;
 `);
 await db.query(sqlFile('20260928001400_task_company_projection.sql'));
 await db.query(sqlFile('20260928001500_preserve_task_relations.sql'));
 console.log('Task gateway synthetic PostgreSQL:',(await db.query('SHOW server_version')).rows[0].server_version);
});
after(async()=>{if(db)await db.end();if(admin){if(created)await admin.query(`DROP DATABASE ${name} WITH (FORCE)`);await admin.end();}});

test('company-free task creation derives creator and assignee label, then revision advances on edit',()=>rollback(async()=>{
 await asUser(db);const row=await create(db,{assigned_to_user_id:id(21)});
 assert.equal(row.company_id,null);assert.equal(row.created_by,id(11));assert.equal(row.assigned_to,'Member 0');assert.equal(row.revision,'0');
 const updated=await execute(db,'update',{title:'Updated'},row.id,0);assert.equal(updated.revision,'1');assert.equal(updated.title,'Updated');
 const history=await db.query('SELECT * FROM task_assignment_history WHERE task_id=$1',[row.id]);assert.equal(history.rowCount,1);
}));
test('authenticated cannot bypass gateway with direct DML or call private lock helper',async()=>{
 for(const query of ["INSERT INTO tasks(tenant_id,title) VALUES('"+id(1)+"','Bypass')","UPDATE tasks SET title='Bypass'","DELETE FROM tasks","SELECT workspace_require_module_write_v1('"+id(1)+"',ARRAY['tasks'])"]){
  await rollback(async()=>{await asUser(db);await assert.rejects(db.query(query),e=>e.code==='42501');});
 }
});
test('missing or disabled module configuration blocks mutation, disabled tasks hide table and history reads',async()=>{
 await rollback(async()=>{
  await asUser(db);const row=await create(db);await db.query('RESET ROLE');await disabled(db);await asUser(db);
  assert.equal((await db.query('SELECT * FROM tasks WHERE id=$1',[row.id])).rowCount,0);
  assert.equal((await db.query('SELECT * FROM task_assignment_history WHERE task_id=$1',[row.id])).rowCount,0);
  await assert.rejects(execute(db,'update',{title:'No'},row.id,0),e=>e.code==='BM001');
 });
 await rollback(async()=>{await db.query('DELETE FROM tenant_module_config WHERE tenant_id=$1',[id(1)]);await asUser(db);await assert.rejects(create(db),e=>e.code==='55000');});
});
test('all six live roles: only manager, operations and HR can create',async()=>{
 for(let i=0;i<roles.length;i++)await rollback(async()=>{await asUser(db,roleActor(i));if(i<3)assert.ok((await create(db)).id);else await assert.rejects(create(db),e=>e.code==='BT403');});
});
test('HR cannot reassign and non-owner quick completion cannot masquerade as manager',async()=>{
 await rollback(async()=>{await asUser(db);const row=await create(db,{assigned_to_user_id:id(11)});await asUser(db,22);await assert.rejects(execute(db,'update',{assigned_to_user_id:id(22)},row.id,0),e=>e.code==='BT403');});
 await rollback(async()=>{await asUser(db);const row=await create(db,{assigned_to_user_id:id(11)});await asUser(db,21);await assert.rejects(execute(db,'complete',{},row.id,0),e=>e.code==='BT409');});
 await rollback(async()=>{await asUser(db);const row=await create(db,{assigned_to_user_id:id(21)});await asUser(db,21);assert.equal((await execute(db,'complete',{},row.id,0)).status,'tamamlandi');});
});
test('forged fields, invalid dates/types, foreign relations and stale revisions are rejected',async()=>{
 for(const patch of [{assigned_to:'Forged'},{created_by:id(12)},{status:'tamamlandi'},{title:null},{title:'\u00a0\ufeff'},{title:12},{due_date:'2026-02-30'},{due_date:'tomorrow'},{priority:null},{company_id:id(102)},{company_id:id(101),contract_id:id(202)}]){
  await rollback(async()=>{await asUser(db);await assert.rejects(create(db,patch));});
 }
 await rollback(async()=>{await asUser(db);const row=await create(db);await execute(db,'update',{title:'First'},row.id,0);await assert.rejects(execute(db,'update',{title:'Stale'},row.id,0),e=>e.code==='BT409');});
});
test('foreign task, mismatched expected actor/tenant and nonmember assignee fail',async()=>{
 await rollback(async()=>{await asUser(db);const row=await create(db);await asUser(db,12,2);await assert.rejects(execute(db,'update',{title:'Cross tenant'},row.id,0),e=>e.code==='BT409');});
 for(const [tenant,actor] of [[id(2),id(11)],[id(1),id(12)]])await rollback(async()=>{await asUser(db);await assert.rejects(execute(db,'create',{title:'No'},null,null,tenant,actor),e=>e.code==='42501');});
 await rollback(async()=>{await asUser(db);await assert.rejects(create(db,{assigned_to_user_id:id(12)}),e=>e.code==='BP002');});
});
test('linked creation requires the source module while independent tasks remain available',async()=>{
 await rollback(async()=>{await disabled(db,'contracts');await asUser(db);assert.ok((await create(db)).id);await assert.rejects(create(db,{company_id:id(101),contract_id:id(201)}),e=>e.code==='BM001');});
});
test('two simultaneous claims have exactly one winner and one assignment event',async()=>{
 const a=client(),b=client();await a.connect();await b.connect();
 try{
  await asUser(a);const row=await create(a);await asUser(b,21);
  const results=await Promise.allSettled([execute(a,'claim',{},row.id,0),execute(b,'claim',{},row.id,0)]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
  assert.equal(results.find(r=>r.status==='rejected').reason.code,'BT409');
  assert.equal((await db.query("SELECT count(*)::int n FROM task_assignment_history WHERE task_id=$1 AND kind='assigned'",[row.id])).rows[0].n,1);
 }finally{await a.end();await b.end();}
});
test('config change winning the lock makes a waiting write see disabled state after commit',async()=>{
 const a=client(),b=client();await a.connect();await b.connect();
 try{
  await a.query('BEGIN');await a.query('SELECT 1 FROM tenant_module_config WHERE tenant_id=$1 FOR UPDATE',[id(1)]);
  await asUser(b);const pid=(await b.query('SELECT pg_backend_pid() pid')).rows[0].pid;
  const pending=create(b).then(()=>({ok:true}),e=>({code:e.code}));
  try{await waiting(a,pid);await disabled(a);await a.query('COMMIT');assert.deepEqual(await pending,{code:'BM001'});}
  finally{await a.query('ROLLBACK');await pending;}
 }finally{await a.query("UPDATE tenant_module_settings SET enabled=true WHERE tenant_id=$1 AND module_key='tasks'",[id(1)]);await a.end();await b.end();}
});
test('a writing transaction holds its configuration barrier until commit; independent writers share it',async()=>{
 const a=client(),b=client(),changer=client();await Promise.all([a.connect(),b.connect(),changer.connect()]);
 try{
  await a.query('BEGIN');await asUser(a);await create(a);
  // A second writer is not serialized behind A's config lock.
  await asUser(b,21);assert.ok((await create(b)).id);
  const pid=(await changer.query('SELECT pg_backend_pid() pid')).rows[0].pid;
  await changer.query('BEGIN');const pending=changer.query('SELECT 1 FROM tenant_module_config WHERE tenant_id=$1 FOR UPDATE',[id(1)]);
  try{await waiting(db,pid);await a.query('COMMIT');await pending;}finally{await a.query('ROLLBACK');await changer.query('ROLLBACK');}
 }finally{await Promise.all([a.end(),b.end(),changer.end()]);}
});
test('role revoked while waiting for the profile lock is rechecked after the lock',async()=>{
 const a=client(),b=client();await a.connect();await b.connect();
 try{
  await a.query('BEGIN');await a.query('SELECT 1 FROM profiles WHERE id=$1 FOR UPDATE',[id(21)]);
  await asUser(b,21);const pid=(await b.query('SELECT pg_backend_pid() pid')).rows[0].pid;
  const pending=create(b).then(()=>({ok:true}),e=>({code:e.code}));
  try{await waiting(a,pid);await a.query("UPDATE tenant_memberships SET role='goruntuleyici' WHERE user_id=$1",[id(21)]);await a.query('COMMIT');assert.deepEqual(await pending,{code:'BT403'});}
  finally{await a.query('ROLLBACK');await pending;}
 }finally{await a.query("UPDATE tenant_memberships SET role='operasyon' WHERE user_id=$1",[id(21)]);await a.end();await b.end();}
});

test('passive company rejects new work; HR cannot use an unreadable contract or appointment',async()=>{
 await rollback(async()=>{await db.query("UPDATE companies SET status='pasif' WHERE id=$1",[id(101)]);await asUser(db);await assert.rejects(create(db,{company_id:id(101)}),e=>e.code==='BT405');});
 for(const relation of [{contract_id:id(201)},{appointment_id:id(301)}])await rollback(async()=>{await asUser(db,22);await assert.rejects(create(db,{company_id:id(101),...relation}),e=>e.code==='BT403');});
});
test('repeatable-read writes are refused rather than using a stale post-lock snapshot',async()=>{
 await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ');
 try{await asUser(db);await assert.rejects(create(db),e=>e.code==='25000');}finally{await db.query('ROLLBACK');await db.query('RESET ROLE');}
});

test('contract removes an explicit column-level write grant as well as table grants',()=>rollback(async()=>{
 await db.query('GRANT UPDATE(title) ON tasks TO authenticated');
 await db.query(body(sqlFile('20260928001100_task_module_direct_write_cutover.sql')));
 assert.equal((await db.query("SELECT has_any_column_privilege('authenticated','tasks','INSERT,UPDATE') allowed")).rows[0].allowed,false);
}));
test('inherited write privilege drift aborts contract migration instead of leaving a bypass',()=>rollback(async()=>{
 const group='bps_task_legacy_'+process.pid;
 await db.query(`CREATE ROLE ${group};GRANT UPDATE ON tasks TO ${group};GRANT ${group} TO authenticated`);
 await assert.rejects(db.query(body(sqlFile('20260928001100_task_module_direct_write_cutover.sql'))),e=>e.message.includes('TASK_DIRECT_WRITE_GRANT_REMAINS'));
}));

const transfer=(c,task,command=id(500))=>c.query('SELECT transfer_tasks_scoped($1,$2,$3,$1,$4,$5) result',[id(11),id(1),command,id(21),JSON.stringify([{id:task.id,revision:Number(task.revision)}])]);
const renewal=c=>c.query("SELECT create_contract_renewal_task($1,$2,$3,$4,0,$5,'2026-10-01','Synthetic basis') result",[id(11),id(1),id(201),id(501),id(21)]);
const appointment=(c,createTask=true)=>c.query("SELECT complete_appointment_scoped($1,$2,$3,'Synthetic result','Follow up',$4) result",[id(11),id(1),id(301),createTask]);

test('task transfer supports independent tasks, live membership roles and idempotent replay',()=>rollback(async()=>{
 await db.query("UPDATE profiles SET role='goruntuleyici' WHERE id=$1",[id(21)]);
 await asUser(db);const row=await create(db,{assigned_to_user_id:id(11)});
 const first=await transfer(db,row);assert.equal(first.rows[0].result.moved,1);
 assert.deepEqual((await transfer(db,row)).rows,first.rows);
 assert.equal((await db.query('SELECT assigned_to_user_id FROM tasks WHERE id=$1',[row.id])).rows[0].assigned_to_user_id,id(21));
}));

test('disabled task module rejects all three workflow mutations including receipt replays',async()=>{
 for(const action of ['transfer','renewal','appointment']) await rollback(async()=>{
  await asUser(db);const row=await create(db,{assigned_to_user_id:id(11)});
  const run=()=>action==='transfer'?transfer(db,row):action==='renewal'?renewal(db):appointment(db);
  await run();await db.query('RESET ROLE');await disabled(db);await asUser(db);
  await assert.rejects(run(),e=>e.code==='BM001');
 });
});

test('calendar completion without a follow-up works with tasks off, but calendar off rejects it',async()=>{
 await rollback(async()=>{await disabled(db);await asUser(db);assert.equal((await appointment(db,false)).rows[0].result.taskId,null);});
 await rollback(async()=>{await disabled(db,'calendar');await asUser(db);await assert.rejects(appointment(db,false),e=>e.code==='BM001');});
 await rollback(async()=>{await disabled(db,'contracts');await asUser(db);await assert.rejects(renewal(db),e=>e.code==='BM001');});
});

test('failed appointment task request does not complete the appointment or leave a receipt',async()=>{
 await rollback(async()=>{
  await disabled(db);await asUser(db);await db.query('SAVEPOINT failed_command');
  await assert.rejects(appointment(db),e=>e.code==='BM001');await db.query('ROLLBACK TO failed_command');await db.query('RESET ROLE');
  assert.equal((await db.query('SELECT status FROM appointments WHERE id=$1',[id(301)])).rows[0].status,'planlandi');
  assert.equal((await db.query('SELECT count(*)::int n FROM appointment_completion_receipts')).rows[0].n,0);
 });
});

test('definer reads obey module gates and hide company projection when only tasks remain enabled',async()=>{
 await rollback(async()=>{
  await asUser(db);await create(db,{company_id:id(101),assigned_to_user_id:id(11)});await renewal(db);
  assert.ok((await db.query('SELECT contract_renewal_snapshot($1,$2,$3) value',[id(11),id(1),id(201)])).rows[0].value.task);
  await db.query('RESET ROLE');await disabled(db);await asUser(db);
  assert.equal((await db.query('SELECT contract_renewal_snapshot($1,$2,$3) value',[id(11),id(1),id(201)])).rows[0].value,null);
  for(const query of ['SELECT task_transfer_directory($1,$2)','SELECT preview_task_transfer($1,$2,$1)']){
   await db.query('SAVEPOINT denied_read');await assert.rejects(db.query(query,[id(11),id(1)]),e=>e.code==='BM001');await db.query('ROLLBACK TO denied_read');
  }
 });
 await rollback(async()=>{
  await asUser(db);await create(db,{company_id:id(101),assigned_to_user_id:id(11)});await db.query('RESET ROLE');
  await db.query("UPDATE tenant_module_settings SET enabled=false WHERE tenant_id=$1 AND module_key<>'tasks'",[id(1)]);await asUser(db);
  const preview=(await db.query('SELECT preview_task_transfer($1,$2,$1) value',[id(11),id(1)])).rows[0].value;
  assert.ok(preview.tasks.length>0);assert.ok(preview.tasks.every(t=>t.companyName===null));
 });
});

test('dashboard activity excludes each disabled source without suppressing enabled task activity',()=>rollback(async()=>{
 await asUser(db);await create(db,{assigned_to_user_id:id(11)});await db.query('RESET ROLE');
 await db.query(`INSERT INTO ops_events VALUES('${id(701)}','${id(1)}','${id(701)}',now(),'worker');
 INSERT INTO ops_workers VALUES('${id(701)}','${id(1)}','Synthetic worker');
 INSERT INTO contract_document_versions VALUES('${id(702)}','${id(1)}','${id(201)}','${id(101)}',now(),'Synthetic contract file','upload');
 INSERT INTO documents VALUES('${id(703)}','${id(1)}','${id(101)}',NULL,'synthetic/file','Synthetic document');`);
 await asUser(db);
 const events=async()=>(await db.query('SELECT dashboard_activity($1,$2) value',[id(11),id(1)])).rows[0].value;
 for(const prefix of ['ops:','task:','pdf:','document:'])assert.ok((await events()).some(e=>e.id.startsWith(prefix)),prefix);
 await db.query('RESET ROLE');for(const mod of ['staffing','contracts','documents'])await disabled(db,mod);await asUser(db);
 assert.ok((await events()).every(e=>e.id.startsWith('task:')));
 await db.query('RESET ROLE');await disabled(db);await asUser(db);assert.deepEqual(await events(),[]);
}));

test('config barrier is first for every workflow and waiting commands see the newly disabled module',async()=>{
 for(const action of ['transfer','renewal','appointment']){
  const a=client(),b=client();await Promise.all([a.connect(),b.connect()]);
  try{
   await asUser(b);const row=await create(b,{assigned_to_user_id:id(11)});
   await a.query('BEGIN');await a.query('SELECT 1 FROM tenant_module_config WHERE tenant_id=$1 FOR UPDATE',[id(1)]);
   const pid=(await b.query('SELECT pg_backend_pid() pid')).rows[0].pid;
   const pending=(action==='transfer'?transfer(b,row,id(600)):action==='renewal'?renewal(b):appointment(b)).then(()=>({ok:true}),e=>({code:e.code}));
   try{
    await waiting(a,pid);
    // NOWAIT proves the blocked workflow has not already acquired its profile SHARE lock.
    await a.query('SELECT 1 FROM profiles WHERE id=$1 FOR UPDATE NOWAIT',[id(11)]);
    await disabled(a);await a.query('COMMIT');assert.deepEqual(await pending,{code:'BM001'});
   }finally{await a.query('ROLLBACK');await pending;}
  }finally{await a.query("UPDATE tenant_module_settings SET enabled=true WHERE tenant_id=$1 AND module_key='tasks'",[id(1)]);await Promise.all([a.end(),b.end()]);}
 }
});

test('workflow role and cross-tenant restrictions remain intact',async()=>{
 for(const run of [c=>c.query('SELECT task_transfer_directory($1,$2)',[id(21),id(1)]),c=>c.query("SELECT create_contract_renewal_task($1,$2,$3,$4,0,$1,'2026-10-01','basis')",[id(21),id(1),id(201),id(502)])]){
  await rollback(async()=>{await asUser(db,21);await assert.rejects(run(db),e=>e.message.includes('FORBIDDEN'));});
 }
 await rollback(async()=>{await asUser(db,12,2);await assert.rejects(appointment(db),e=>e.message==='APPT_SCOPE_CHANGED');});
 await rollback(async()=>{await db.query("UPDATE profiles SET role='goruntuleyici' WHERE id=$1",[id(21)]);await asUser(db);assert.ok((await renewal(db)).rows[0].result.taskId);});
});

test('service-only task notification RPC filters disabled tenants and refuses incomplete config',async()=>{
 await rollback(async()=>{
  await asUser(db);const row=await create(db);await db.query('RESET ROLE');await db.query('SET ROLE service_role');
  assert.ok((await db.query('SELECT * FROM task_notification_candidates_v1()')).rows.some(t=>t.id===row.id));
  assert.deepEqual((await db.query('SELECT * FROM task_notification_modules_v1($1)',[[id(1),id(1)]])).rows,[{tenant_id:id(1),enabled:true}]);
  await db.query('RESET ROLE');await disabled(db);await db.query('SET ROLE service_role');
  assert.ok((await db.query('SELECT * FROM task_notification_candidates_v1()')).rows.every(t=>t.tenant_id!==id(1)));
  assert.equal((await db.query('SELECT * FROM task_notification_modules_v1($1)',[[id(1)]])).rows[0].enabled,false);
 });
 await rollback(async()=>{await db.query('DELETE FROM tenant_module_settings WHERE tenant_id=$1 AND module_key=$2',[id(1),'tasks']);await db.query('SET ROLE service_role');await assert.rejects(db.query('SELECT * FROM task_notification_candidates_v1()'),e=>e.code==='55000');});
 for(const role of ['anon','authenticated'])await rollback(async()=>{await db.query('SET ROLE '+role);await assert.rejects(db.query('SELECT * FROM task_notification_candidates_v1()'),e=>e.code==='42501');});
 await rollback(async()=>{await db.query('SET ROLE service_role');await assert.rejects(db.query('SELECT workspace_module_snapshot_v1($1)',[id(1)]),e=>e.code==='42501');});
});

test('shared configuration validator preserves scope, completeness and dependency failures',async()=>{
 await rollback(async()=>{await asUser(db,12,2);assert.equal((await db.query('SELECT current_workspace_modules_v1() value')).rows[0].value.tenantId,id(2));});
 await rollback(async()=>{await disabled(db,'customers');await asUser(db);await assert.rejects(db.query('SELECT current_workspace_modules_v1()'),e=>e.code==='55000');});
});

test('workflow patch aborts on unexpected function definition rather than silently skipping a guard',()=>rollback(async()=>{
 await assert.rejects(db.query(body(sqlFile('20260928001200_task_module_workflows.sql'))),e=>e.message.includes('MODULE_WORKFLOW_DRIFT'));
}));

test('task company projection returns only display columns and retains tenant, module, role and company RLS',async()=>{
 await rollback(async()=>{
  await asUser(db);const rows=(await db.query('SELECT * FROM task_company_choices_v1()')).rows;
  assert.equal(rows.length,1);assert.equal(rows[0].id,id(101));
  assert.deepEqual(Object.keys(rows[0]).sort(),['id','tenant_id','name','legacy_mock_id','status'].sort());
 });
 await rollback(async()=>{
  await db.query('DROP POLICY company_fixture_read ON companies');await asUser(db);
  assert.equal((await db.query('SELECT * FROM task_company_choices_v1()')).rowCount,0);
 });
 for(const actor of [23,24,25])await rollback(async()=>{await asUser(db,actor);assert.equal((await db.query('SELECT * FROM task_company_choices_v1()')).rowCount,0);});
 await rollback(async()=>{await disabled(db);await asUser(db);assert.equal((await db.query('SELECT * FROM task_company_choices_v1()')).rowCount,0);});
 await rollback(async()=>{
  await db.query("UPDATE tenant_module_settings SET enabled=false WHERE tenant_id=$1 AND module_key<>'tasks'",[id(1)]);
  await asUser(db);assert.equal((await db.query('SELECT * FROM task_company_choices_v1()')).rowCount,0);
  assert.ok((await create(db)).id);
 });
});

test('parent hard deletion cannot delete task history or detach task context, even with tasks disabled',async()=>{
 for(const target of ['companies','contracts','appointments','creator','assignee'])await rollback(async()=>{
  await asUser(db);const row=await create(db,{company_id:id(101),contract_id:id(201),appointment_id:id(301),assigned_to_user_id:id(21)});
  await db.query('RESET ROLE');await disabled(db);await db.query('SAVEPOINT delete_parent');
  const table=target==='creator'||target==='assignee'?'profiles':target;
  const key={companies:101,contracts:201,appointments:301,creator:11,assignee:21}[target];
  await assert.rejects(db.query(`DELETE FROM ${table} WHERE id=$1`,[id(key)]),e=>e.code==='23503');
  await db.query('ROLLBACK TO delete_parent');
  const unchanged=(await db.query('SELECT * FROM tasks WHERE id=$1',[row.id])).rows[0];
  assert.equal(unchanged.revision,row.revision);assert.equal(unchanged.contract_id,id(201));assert.equal(unchanged.appointment_id,id(301));
  assert.equal((await db.query('SELECT count(*)::int n FROM task_assignment_history WHERE task_id=$1',[row.id])).rows[0].n,1);
 });
});

test('unreferenced parent deletion and deactivation remain possible; schema drift aborts the preservation migration',async()=>{
 await rollback(async()=>{
  await db.query("INSERT INTO companies(id,tenant_id,name,status) VALUES($1,$2,'Unreferenced','aktif')",[id(888),id(1)]);
  assert.equal((await db.query('DELETE FROM companies WHERE id=$1',[id(888)])).rowCount,1);
  await asUser(db);await create(db,{company_id:id(101)});await db.query('RESET ROLE');
  assert.equal((await db.query("UPDATE companies SET status='pasif' WHERE id=$1",[id(101)])).rowCount,1);
 });
 await rollback(async()=>{await assert.rejects(db.query(body(sqlFile('20260928001500_preserve_task_relations.sql'))),e=>e.message.includes('TASK_RELATION_DRIFT'));});
});

test('parent deletion waiting behind a new task cannot erase that task after its commit',async()=>{
 const writer=client(),remover=client();await Promise.all([writer.connect(),remover.connect()]);
 try{
  await db.query("INSERT INTO companies(id,tenant_id,name,status) VALUES($1,$2,'Concurrent parent','aktif')",[id(889),id(1)]);
  await writer.query('BEGIN');await asUser(writer);const row=await create(writer,{company_id:id(889)});
  const pid=(await remover.query('SELECT pg_backend_pid() pid')).rows[0].pid;
  const pending=remover.query('DELETE FROM companies WHERE id=$1',[id(889)]).then(()=>({ok:true}),e=>({code:e.code}));
  try{await waiting(db,pid);await writer.query('COMMIT');assert.deepEqual(await pending,{code:'23503'});}
  finally{await writer.query('ROLLBACK');await pending;}
  assert.equal((await db.query('SELECT count(*)::int n FROM task_assignment_history WHERE task_id=$1',[row.id])).rows[0].n,1);
 }finally{await Promise.all([writer.end(),remover.end()]);}
});
