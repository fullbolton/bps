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
CREATE TABLE companies(id uuid PRIMARY KEY,tenant_id uuid NOT NULL REFERENCES tenants(id),name text,status text);
CREATE TABLE contracts(id uuid PRIMARY KEY,company_id uuid NOT NULL REFERENCES companies(id),tenant_id uuid NOT NULL REFERENCES tenants(id));
CREATE TABLE appointments(id uuid PRIMARY KEY,company_id uuid NOT NULL REFERENCES companies(id),tenant_id uuid NOT NULL REFERENCES tenants(id));
INSERT INTO profiles VALUES('${id(11)}','Manager','yonetici'),('${id(12)}','Other tenant','operasyon');
${roles.slice(1).map((r,i)=>`INSERT INTO profiles VALUES('${id(21+i)}','Member ${i}','${r}');INSERT INTO tenant_memberships VALUES('${id(1)}','${id(21+i)}','${r}','${id(121+i)}');`).join('\n')}
INSERT INTO companies VALUES('${id(101)}','${id(1)}','Synthetic customer','aktif'),('${id(102)}','${id(2)}','Foreign customer','aktif');
INSERT INTO contracts VALUES('${id(201)}','${id(101)}','${id(1)}'),('${id(202)}','${id(102)}','${id(2)}');
INSERT INTO appointments VALUES('${id(301)}','${id(101)}','${id(1)}');
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
 ALTER TABLE tasks ADD COLUMN tenant_id uuid NOT NULL REFERENCES tenants(id),ADD COLUMN assigned_to_user_id uuid REFERENCES profiles(id);
 ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
 CREATE POLICY tasks_read ON tasks FOR SELECT TO authenticated USING(tenant_id=current_user_verified_tenant() AND current_user_role() IN('yonetici','operasyon','ik'));
 CREATE POLICY tasks_old_write ON tasks FOR ALL TO authenticated USING(tenant_id=current_user_verified_tenant()) WITH CHECK(tenant_id=current_user_verified_tenant());
 GRANT SELECT,INSERT,UPDATE,DELETE ON tasks TO authenticated;
 `+body(sqlFile('20260909001300_task_assignment_history.sql'))+body(sqlFile('20260915001000_independent_tasks.sql'))+taskGuard+`
 CREATE TRIGGER tasks_guard_active_assignee BEFORE INSERT OR UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION tasks_guard_active_assignee();
 `);
 await db.query(sqlFile('20260928000900_tenant_module_foundation.sql'));
 await db.query(sqlFile('20260928001000_task_module_gateway.sql'));
 assert.equal((await db.query("SELECT has_table_privilege('authenticated','tasks','INSERT,UPDATE') allowed")).rows[0].allowed,true);
 await db.query(sqlFile('20260928001100_task_module_direct_write_cutover.sql'));
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
