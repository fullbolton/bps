import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {sqlFile,fixture,active,verified,workspace,actualFunction} from './fixtures/module-database.mjs';
const {Client}=createRequire(import.meta.url)('pg');
const root=new URL(process.env.BPS_MODULE_TEST_DATABASE_URL??'postgres://bps_module_test@127.0.0.1:55439/postgres');
assert.ok(['127.0.0.1','localhost','[::1]'].includes(root.hostname),'Synthetic local DB only');
const name=`bps_calendar_${process.pid}_${Date.now()}`,url=new URL(root);url.pathname='/'+name;
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
let admin,db,created=false;
async function user(actor=11,tenant=1){await db.query("SELECT set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:id(actor),active_tenant_id:id(tenant)})]);await db.query('SET ROLE authenticated');}
async function rollback(fn){await db.query('BEGIN');try{return await fn();}finally{await db.query('ROLLBACK');await db.query('RESET ROLE');}}
const input={company_id:id(41),meeting_date:'2026-10-13',meeting_type:'ziyaret'};
async function command(action='create',target=null,payload=input,tenant=id(1)){
 return (await db.query('SELECT * FROM appointment_execute_v1($1,$2,$3,$4)',[action,target,tenant,payload])).rows[0];
}
before(async()=>{
 admin=new Client({connectionString:root.href});await admin.connect();await admin.query(`CREATE DATABASE ${name}`);created=true;
 db=new Client({connectionString:url.href,query_timeout:10000});await db.connect();
 await db.query(fixture+active+verified+workspace+actualFunction('20260926000100_multi_workspace_cutover.sql','current_user_role')+`
 CREATE TABLE profiles(id uuid PRIMARY KEY,role text);
 INSERT INTO profiles VALUES('${id(11)}','yonetici'),('${id(12)}','operasyon');
 CREATE TABLE companies(id uuid PRIMARY KEY,tenant_id uuid);
 INSERT INTO companies VALUES('${id(41)}','${id(1)}'),('${id(42)}','${id(2)}'),('${id(43)}','${id(1)}');
 CREATE TABLE contracts(id uuid PRIMARY KEY,tenant_id uuid,company_id uuid);
 INSERT INTO contracts VALUES('${id(51)}','${id(1)}','${id(43)}');
 CREATE TABLE appointments(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid,company_id uuid,contract_id uuid,
 meeting_date text,meeting_time text,meeting_type text,attendee text,status text,result text,next_action text,created_by uuid,
 created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now());
 ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
 CREATE POLICY fixture_read ON appointments FOR SELECT TO authenticated USING(tenant_id=current_user_verified_tenant());
 GRANT ALL ON appointments TO authenticated,anon,service_role;
 `);
 await db.query(sqlFile('20261005000100_tenant_module_foundation.sql'));
 const shared=sqlFile('20261005000200_task_module_gateway.sql');await db.query(shared.slice(shared.indexOf('CREATE FUNCTION public.workspace_module_enabled_v1'),shared.indexOf('-- Restrictive AND fences')));
 for(const f of ['20261013000100_calendar_module_commands.sql','20261013000200_calendar_direct_write_cutover.sql'])await db.query(sqlFile(f));
});
after(async()=>{if(db)await db.end();if(admin){if(created)await admin.query(`DROP DATABASE ${name} WITH(FORCE)`);await admin.end();}});
test('create stamps author and status; status command detects stale state',()=>rollback(async()=>{
 await user();const a=await command();assert.equal(a.created_by,id(11));assert.equal(a.status,'planlandi');
 assert.equal((await command('status',a.id,{status:'iptal',expected_status:'planlandi'})).status,'iptal');
 await assert.rejects(command('status',a.id,{status:'planlandi',expected_status:'planlandi'}),e=>e.code==='PT409');
}));
test('cross-tenant company, forged tenant, stale claim and wrong-company contract fail',async()=>{
 for(const data of [{...input,company_id:id(42)},{...input,contract_id:id(51)}])await rollback(async()=>{await user();await assert.rejects(command('create',null,data),e=>e.code==='42501');});
 await rollback(async()=>{await user();await assert.rejects(command('create',null,input,id(2)),e=>e.code==='42501');});
 await rollback(async()=>{await user(11,2);await assert.rejects(command(),e=>e.code==='42501');});
});
test('disabled calendar hides records and blocks commands',()=>rollback(async()=>{
 await user();await command();await db.query('RESET ROLE');await db.query("UPDATE tenant_module_settings SET enabled=false WHERE tenant_id=$1 AND module_key='calendar'",[id(1)]);
 await user();assert.equal((await db.query('SELECT * FROM appointments')).rowCount,0);await assert.rejects(command(),e=>e.code==='BM001');
}));
test('completed appointments cannot be reopened through status command',()=>rollback(async()=>{
 await user();const a=await command();await db.query('RESET ROLE');await db.query("UPDATE appointments SET status='tamamlandi' WHERE id=$1",[a.id]);await user();
 await assert.rejects(command('status',a.id,{status:'planlandi',expected_status:'planlandi'}),e=>e.code==='PT409');
}));
test('unknown fields and impossible dates are rejected',async()=>{
 for(const data of [{...input,created_by:id(12)},{...input,meeting_date:'2026-02-30'},{...input,meeting_type:null},{...input,meeting_date:42}])await rollback(async()=>{await user();await assert.rejects(command('create',null,data));});
});
test('API roles cannot bypass gateway through direct DML',async()=>{
 for(const role of ['anon','authenticated','service_role'])for(const sql of ['INSERT INTO appointments DEFAULT VALUES','UPDATE appointments SET status=\'iptal\'','DELETE FROM appointments'])await rollback(async()=>{
  await db.query('SET LOCAL ROLE '+role);await assert.rejects(db.query(sql),e=>e.code==='42501');
 });
});
test('non-writing roles and anonymous callers cannot execute calendar writes',async()=>{
 for(const role of ['ik','muhasebe','goruntuleyici'])await rollback(async()=>{
  await db.query('UPDATE tenant_memberships SET role=$1 WHERE user_id=$2',[role,id(11)]);await user();
  await assert.rejects(command(),e=>e.code==='42501');
 });
 for(const role of ['anon','service_role'])await rollback(async()=>{
  await db.query('SET LOCAL ROLE '+role);await assert.rejects(command(),e=>e.code==='42501');
 });
});
test('reader works in read-only transaction',()=>rollback(async()=>{
 await db.query('SET TRANSACTION READ ONLY');await user();assert.equal((await db.query('SELECT * FROM appointments')).rowCount,0);
}));
test('writer waiting on configuration sees committed disabled module',async()=>{
 const a=new Client({connectionString:url.href}),b=new Client({connectionString:url.href});await a.connect();await b.connect();let pending;
 try{
  await a.query('BEGIN');await a.query('SELECT * FROM tenant_module_config WHERE tenant_id=$1 FOR UPDATE',[id(1)]);
  await b.query("SELECT set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:id(11),active_tenant_id:id(1)})]);await b.query('SET ROLE authenticated');
  const pid=(await b.query('SELECT pg_backend_pid() pid')).rows[0].pid;
  pending=b.query("SELECT * FROM appointment_execute_v1('create',NULL,$1,$2)",[id(1),input]).then(()=>({code:'unexpected-success'}),e=>e);
  let waiting=false;
  for(let i=0;i<100;i++){
   const r=await a.query('SELECT cardinality(pg_blocking_pids($1))>0 waiting',[pid]);
   if(r.rows[0].waiting){waiting=true;break;}await new Promise(resolve=>setTimeout(resolve,20));
  }
  assert.equal(waiting,true,'writer must actually wait for configuration lock');
  await a.query("UPDATE tenant_module_settings SET enabled=false WHERE tenant_id=$1 AND module_key='calendar'",[id(1)]);await a.query('COMMIT');
  assert.equal((await pending).code,'BM001');
 }finally{
  await a.query('ROLLBACK');if(pending)await pending;
  await db.query("UPDATE tenant_module_settings SET enabled=true WHERE tenant_id=$1 AND module_key='calendar'",[id(1)]);
  await a.end();await b.end();
 }
});
