import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {sqlFile,fixture,active,verified,workspace,actualFunction} from './fixtures/module-database.mjs';
const {Client}=createRequire(import.meta.url)('pg');
const root=new URL(process.env.BPS_MODULE_TEST_DATABASE_URL??'postgres://bps_module_test@127.0.0.1:55439/postgres');
assert.ok(['127.0.0.1','localhost','[::1]'].includes(root.hostname),'Synthetic local DB only');
const name=`bps_company_commands_${process.pid}_${Date.now()}`,url=new URL(root);url.pathname='/'+name;
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const client=()=>new Client({connectionString:url.href,query_timeout:10000,connectionTimeoutMillis:5000});
let admin,db,created=false;
async function user(c=db,actor=11,tenant=1){await c.query("SELECT set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:id(actor),active_tenant_id:id(tenant)})]);await c.query('SET ROLE authenticated');}
async function rollback(fn){await db.query('BEGIN');try{return await fn();}finally{await db.query('ROLLBACK');await db.query('RESET ROLE');}}
async function command(c=db,{action='create',company=null,tenant=1,actor=11,input={name:'Synthetic new'}}={}){return (await c.query('SELECT * FROM company_execute_v1($1,$2,$3,$4,$5::jsonb)',[action,company===null?null:id(company),id(tenant),id(actor),JSON.stringify(input)])).rows;}
async function off(c=db){await c.query("UPDATE tenant_module_settings SET enabled=false WHERE tenant_id=$1 AND module_key NOT IN ('tasks','talent','announcements')",[id(1)]);}
async function waitLock(pid){for(let n=0;n<100;n++){await db.query('SELECT pg_stat_clear_snapshot()');if((await db.query('SELECT wait_event_type FROM pg_stat_activity WHERE pid=$1',[pid])).rows[0]?.wait_event_type==='Lock')return;await new Promise(r=>setTimeout(r,10));}throw Error('Expected lock wait');}
before(async()=>{
 admin=new Client({connectionString:root.href});await admin.connect();await admin.query(`CREATE DATABASE ${name}`);created=true;db=client();await db.connect();
 await db.query(fixture+active+verified+workspace+actualFunction('20260926000100_multi_workspace_cutover.sql','current_user_role')+`
 CREATE TABLE profiles(id uuid PRIMARY KEY,role text);
 INSERT INTO profiles VALUES('${id(11)}','yonetici'),('${id(12)}','operasyon');
 CREATE TABLE companies(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL REFERENCES tenants(id),name text NOT NULL,sector text,city text,status text NOT NULL DEFAULT 'aktif' CHECK(status IN('aday','aktif','pasif')),risk text NOT NULL DEFAULT 'dusuk' CHECK(risk IN('dusuk','orta','yuksek')),legacy_mock_id text,created_by uuid REFERENCES profiles(id),created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now());
 INSERT INTO companies(id,tenant_id,name,status,created_by) VALUES('${id(101)}','${id(1)}','Synthetic A','aktif','${id(11)}'),('${id(102)}','${id(2)}','Synthetic B','aktif','${id(12)}');
 ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
 -- No client DML grant in this isolated fixture: command must not depend on one.
 GRANT SELECT ON companies TO authenticated;
 CREATE POLICY read_company ON companies FOR SELECT TO authenticated USING(tenant_id=current_user_verified_tenant());
 CREATE TABLE changed_rows(id uuid);
 CREATE FUNCTION record_company_change() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN INSERT INTO public.changed_rows VALUES(NEW.id);RETURN NEW;END$$;
 CREATE TRIGGER changed AFTER UPDATE ON companies FOR EACH ROW EXECUTE FUNCTION record_company_change();
 `);
 const anchor=sqlFile('20260407000200_create_companies_anchor.sql');
 const start=anchor.indexOf('create or replace function public.companies_set_updated_at()');
 const end=anchor.indexOf('execute function public.companies_set_updated_at();',start);
 await db.query(anchor.slice(start,end+'execute function public.companies_set_updated_at();'.length));
 await db.query(sqlFile('20261005000100_tenant_module_foundation.sql'));
 const shared=sqlFile('20261005000200_task_module_gateway.sql');await db.query(shared.slice(shared.indexOf('CREATE FUNCTION public.workspace_module_enabled_v1'),shared.indexOf('-- Restrictive AND fences')));
 await db.query(sqlFile('20261005001000_company_commands.sql'));
 console.log('Synthetic company commands DB:',(await db.query('SHOW server_version')).rows[0].server_version);
});
after(async()=>{if(db)await db.end();if(admin){if(created)await admin.query(`DROP DATABASE ${name} WITH(FORCE)`);await admin.end();}});
test('create assigns verified tenant/actor and normalizes defaults without client DML privileges',async()=>{
 await rollback(async()=>{await user();const [row]=await command(db,{input:{name:'  New customer  ',city:'  İstanbul ',sector:' '}});assert.equal(row.name,'New customer');assert.equal(row.city,'İstanbul');assert.equal(row.sector,null);assert.equal(row.status,'aday');assert.equal(row.tenant_id,id(1));assert.equal(row.created_by,id(11));});
});
test('CSV status/risk values survive the same creation command',async()=>{
 await rollback(async()=>{await user();const [row]=await command(db,{input:{name:'Imported customer',status:'aktif',risk:'orta'}});assert.equal(row.status,'aktif');assert.equal(row.risk,'orta');});
});
test('status command changes only status and a repeat does not trigger another update',async()=>{
 await rollback(async()=>{await user();const before=(await db.query('SELECT * FROM companies WHERE id=$1',[id(101)])).rows[0];const opts={action:'status',company:101,input:{status:'pasif'}};const [row]=await command(db,opts);assert.deepEqual({...row,status:before.status,updated_at:before.updated_at},before);await command(db,opts);await db.query('RESET ROLE');assert.equal((await db.query('SELECT * FROM changed_rows')).rowCount,1);});
});
test('wrong actor, tenant, role and foreign company cannot write',async()=>{
 for(const opts of [{actor:12},{tenant:2},{action:'status',company:102,input:{status:'pasif'}}])await rollback(async()=>{await user();await assert.rejects(command(db,opts),e=>e.code==='42501');});
 await rollback(async()=>{await user(db,12,2);await assert.rejects(command(db,{actor:12,tenant:2}),e=>e.code==='42501');});
});
test('input keys, types, empty names and unsupported status values are rejected',async()=>{
 for(const input of [{name:''},{name:'\u00a0'},{name:'\t\n'},{name:'x',tenant_id:id(2)},{name:'x',id:id(103)},{name:'x',created_by:id(12)},{name:'x',legacy_mock_id:'f1'},{name:'x',status:'deleted'},{name:12},{name:'x',risk:'unknown'},null,[],{name:'x'.repeat(501)}])await rollback(async()=>{await user();await assert.rejects(command(db,{input}),e=>e.code==='BC400');});
 await rollback(async()=>{await user();await assert.rejects(command(db,{action:'status',company:101,input:{status:'aktif',name:'Other'}}),e=>e.code==='BC400');});
});
test('closed customers rejects both creation and status changes; malformed config fails closed',async()=>{
 for(const opts of [{},{action:'status',company:101,input:{status:'pasif'}}])await rollback(async()=>{await off();await user();await assert.rejects(command(db,opts),e=>e.code==='BM001');});
 await rollback(async()=>{await db.query("DELETE FROM tenant_module_settings WHERE tenant_id=$1 AND module_key='customers'",[id(1)]);await user();await assert.rejects(command(),e=>e.code==='55000');});
});
test('stale membership and repeatable read do not execute commands',async()=>{
 await rollback(async()=>{await db.query('DELETE FROM tenant_memberships WHERE user_id=$1',[id(11)]);await user();await assert.rejects(command(),e=>e.code==='42501');});
 await rollback(async()=>{await db.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');await user();await assert.rejects(command(),e=>e.code==='25000');});
});
test('anon and service role cannot execute the company command',async()=>{
 for(const role of ['anon','service_role'])await rollback(async()=>{await user();await db.query('RESET ROLE');await db.query('SET ROLE '+role);await assert.rejects(command(),e=>e.code==='42501');});
});
test('config writer wins: command waits before profile lock then sees disabled customers',async()=>{
 const writer=client(),control=client();await writer.connect();await control.connect();let pending;
 try{
  await control.query('BEGIN');await control.query('SELECT * FROM tenant_module_config WHERE tenant_id=$1 FOR UPDATE',[id(1)]);await off(control);
  await user(writer);const pid=(await writer.query('SELECT pg_backend_pid() pid')).rows[0].pid;
  pending=command(writer).then(value=>({value}),error=>({error}));await waitLock(pid);
  await db.query('BEGIN');await db.query('SELECT * FROM profiles WHERE id=$1 FOR UPDATE NOWAIT',[id(11)]);await db.query('ROLLBACK');
  await control.query('COMMIT');assert.equal((await pending).error.code,'BM001');
 }finally{await control.query('ROLLBACK');if(pending)await pending;await db.query('UPDATE tenant_module_settings SET enabled=true WHERE tenant_id=$1',[id(1)]);await writer.end();await control.end();}
});
test('company command wins: config updater waits until full business transaction ends',async()=>{
 const writer=client(),control=client();await writer.connect();await control.connect();let pending;
 try{
  await writer.query('BEGIN');await user(writer);await command(writer,{action:'status',company:101,input:{status:'pasif'}});
  const pid=(await control.query('SELECT pg_backend_pid() pid')).rows[0].pid;
  pending=control.query('UPDATE tenant_module_config SET revision=revision+1 WHERE tenant_id=$1',[id(1)]);await waitLock(pid);await writer.query('ROLLBACK');await pending;
 }finally{await writer.query('ROLLBACK');if(pending)await pending;await writer.end();await control.end();}
});
test('role is rechecked after waiting for membership profile lock',async()=>{
 const writer=client(),control=client();await writer.connect();await control.connect();let pending;
 try{
  await control.query('BEGIN');await control.query('SELECT * FROM profiles WHERE id=$1 FOR UPDATE',[id(11)]);await control.query("UPDATE tenant_memberships SET role='operasyon' WHERE user_id=$1",[id(11)]);
  await user(writer);const pid=(await writer.query('SELECT pg_backend_pid() pid')).rows[0].pid;
  pending=command(writer).then(value=>({value}),error=>({error}));await waitLock(pid);await control.query('COMMIT');assert.equal((await pending).error.code,'42501');
 }finally{await control.query('ROLLBACK');if(pending)await pending;await db.query("UPDATE tenant_memberships SET role='yonetici' WHERE user_id=$1",[id(11)]);await writer.end();await control.end();}
});
