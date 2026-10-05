import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {sqlFile,fixture,active,verified,workspace,actualFunction} from './fixtures/module-database.mjs';
const {Client}=createRequire(import.meta.url)('pg');
const root=new URL(process.env.BPS_MODULE_TEST_DATABASE_URL??'postgres://bps_module_test@127.0.0.1:55439/postgres');
assert.ok(['127.0.0.1','localhost','[::1]'].includes(root.hostname),'Synthetic local DB only');
const name=`bps_announcements_${process.pid}_${Date.now()}`,url=new URL(root);url.pathname='/'+name;
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const client=()=>new Client({connectionString:url.href,query_timeout:10000,connectionTimeoutMillis:5000});
let admin,db,created=false;
async function user(c=db,actor=11,tenant=1){await c.query("SELECT set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:id(actor),active_tenant_id:id(tenant)})]);await c.query('SET ROLE authenticated');}
async function rollback(fn){await db.query('BEGIN');try{return await fn();}finally{await db.query('ROLLBACK');await db.query('RESET ROLE');}}

async function command(c=db,{action='create',target=null,tenant=id(1),body='Synthetic announcement'}={}){
 return (await c.query('SELECT * FROM announcement_execute_v1($1,$2,$3,$4)',[action,target,tenant,body])).rows[0];
}
async function off(c=db){await c.query("UPDATE tenant_module_settings SET enabled=false WHERE tenant_id=$1 AND module_key='announcements'",[id(1)]);}
before(async()=>{
 admin=new Client({connectionString:root.href});await admin.connect();await admin.query(`CREATE DATABASE ${name}`);created=true;db=client();await db.connect();
 await db.query(fixture+active+verified+workspace+actualFunction('20260926000100_multi_workspace_cutover.sql','current_user_role')+`
 CREATE TABLE profiles(id uuid PRIMARY KEY,role text);
 INSERT INTO profiles VALUES('${id(11)}','yonetici'),('${id(12)}','operasyon');
 `);
 for(const [n,role] of ['operasyon','ik','muhasebe','goruntuleyici'].entries()){
  await db.query('INSERT INTO profiles VALUES($1,$2)',[id(21+n),role]);await db.query('INSERT INTO tenant_memberships VALUES($1,$2,$3,$4)',[id(1),id(21+n),role,id(51+n)]);
 }
 const original=sqlFile('20260827000100_create_announcements.sql');await db.query(original.slice(original.indexOf('CREATE TABLE IF NOT EXISTS public.announcements')));
 await db.query('GRANT ALL ON announcements TO anon,authenticated,service_role');
 await db.query(sqlFile('20261005000100_tenant_module_foundation.sql'));
 const shared=sqlFile('20261005000200_task_module_gateway.sql');await db.query(shared.slice(shared.indexOf('CREATE FUNCTION public.workspace_module_enabled_v1'),shared.indexOf('-- Restrictive AND fences')));
 for(const file of ['20261005003000_announcement_module_commands.sql','20261005003100_announcement_direct_write_cutover.sql'])await db.query(sqlFile(file));
});
after(async()=>{if(db)await db.end();if(admin){if(created)await admin.query(`DROP DATABASE ${name} WITH(FORCE)`);await admin.end();}});
test('manager creates trimmed announcement with authoritative author and tenant, then deletes',()=>rollback(async()=>{
 await user();const row=await command(db,{body:'\u00a0 Announcement \n'});assert.equal(row.body,'Announcement');assert.equal(row.created_by,id(11));assert.equal(row.tenant_id,id(1));
 assert.equal((await command(db,{action:'delete',target:row.id,tenant:null,body:null})).id,row.id);
 await assert.rejects(command(db,{action:'delete',target:row.id,tenant:null,body:null}),e=>e.code==='42501');
}));
test('non-manager roles can read but cannot create or delete',async()=>{
 for(const actor of [21,22,23,24]){
  for(const action of ['create','delete'])await rollback(async()=>{await user();const row=await command();await user(db,actor);
   assert.equal((await db.query('SELECT * FROM announcements')).rowCount,1);
   await assert.rejects(command(db,action==='create'?{}:{action,target:row.id,body:null}),e=>e.code==='42501');
  });
 }
});
test('tenant forgery, stale claim and cross-tenant deletion are denied',async()=>{
 await rollback(async()=>{await user();await assert.rejects(command(db,{tenant:id(2)}),e=>e.code==='42501');});
 await rollback(async()=>{await user(db,11,2);await assert.rejects(command(),e=>e.code==='42501');});
 await rollback(async()=>{await db.query("UPDATE tenant_memberships SET role='yonetici' WHERE user_id=$1",[id(12)]);await user();const row=await command();await user(db,12,2);assert.equal((await db.query('SELECT * FROM announcements')).rowCount,0);await assert.rejects(command(db,{action:'delete',target:row.id,tenant:null,body:null}),e=>e.code==='42501');});
});
test('disabled announcements cannot be read, created or deleted',async()=>{
 for(const action of ['create','delete'])await rollback(async()=>{await user();const row=await command();await db.query('RESET ROLE');await off();await user();assert.equal((await db.query('SELECT * FROM announcements')).rowCount,0);await assert.rejects(command(db,action==='create'?{}:{action,target:row.id,body:null}),e=>e.code==='BM001');});
});
test('blank, oversized, null, unsupported and mismatched input fails',async()=>{
 for(const input of [{body:null},{body:'\u00a0\n'},{body:'x'.repeat(501)},{action:null},{action:'edit'},{target:id(40)},{tenant:null},{action:'delete',target:id(40),body:'x'}])await rollback(async()=>{await user();await assert.rejects(command(db,input),e=>e.code==='22023');});
});
test('table DML is denied and only authenticated has command execution',async()=>{
 for(const role of ['anon','authenticated','service_role'])for(const query of ["INSERT INTO announcements(tenant_id,body) VALUES('"+id(1)+"','x')","UPDATE announcements SET body='x'","DELETE FROM announcements","TRUNCATE announcements"])
  await rollback(async()=>{await db.query('SET LOCAL ROLE '+role);await assert.rejects(db.query(query),e=>e.code==='42501');});
 for(const role of ['anon','service_role'])await rollback(async()=>{await db.query('SET LOCAL ROLE '+role);await assert.rejects(command(),e=>e.code==='42501');});
});
test('ordinary read works inside READ ONLY transaction',()=>rollback(async()=>{await user();await db.query('SET TRANSACTION READ ONLY');assert.equal((await db.query('SELECT * FROM announcements')).rowCount,0);}));
test('configuration lock blocks writer, which rechecks disabled state after commit',async()=>{
 const a=client(),b=client();await a.connect();await b.connect();let pending;
 try{
  await a.query('BEGIN');await a.query('SELECT * FROM tenant_module_config WHERE tenant_id=$1 FOR UPDATE',[id(1)]);
  await user(b);const pid=(await b.query('SELECT pg_backend_pid() pid')).rows[0].pid;
  pending=command(b).then(()=>({code:'unexpected-success'}),e=>e);
  let waiting=false;for(let n=0;n<100;n++){if((await db.query('SELECT wait_event_type FROM pg_stat_activity WHERE pid=$1',[pid])).rows[0]?.wait_event_type==='Lock'){waiting=true;break;}await new Promise(r=>setTimeout(r,10));}
  assert.ok(waiting,'writer must wait on configuration');await off(a);await a.query('COMMIT');assert.equal((await pending).code,'BM001');
 }finally{await a.query('ROLLBACK');await a.end();await b.end();await db.query("UPDATE tenant_module_settings SET enabled=true WHERE tenant_id=$1 AND module_key='announcements'",[id(1)]);}
});
