import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {sqlFile,fixture,active,verified,workspace,actualFunction} from './fixtures/module-database.mjs';
const {Client}=createRequire(import.meta.url)('pg');
const root=new URL(process.env.BPS_MODULE_TEST_DATABASE_URL??'postgres://bps_module_test@127.0.0.1:55439/postgres');
assert.ok(['127.0.0.1','localhost','[::1]'].includes(root.hostname),'Synthetic local DB only');
const name=`bps_customer_modules_${process.pid}_${Date.now()}`,url=new URL(root);url.pathname='/'+name;
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
let admin,db,created=false;
const migration=sqlFile('20260928001700_customer_module_reads.sql');
const tables=['companies','contacts','notes'];
const legacy=sqlFile('20260827000300_remove_partner_role.sql');
function policy(name){const start=legacy.indexOf('CREATE POLICY '+name),end=legacy.indexOf('\n  );',start);assert.ok(start>=0&&end>start);return legacy.slice(start,end+6);}
async function asUser(actor=11,tenant=1){await db.query("SELECT set_config('request.jwt.claims',$1,true)",[JSON.stringify({sub:id(actor),active_tenant_id:id(tenant)})]);await db.query('SET LOCAL ROLE authenticated');}
async function rollback(fn){await db.query('BEGIN');try{return await fn();}finally{await db.query('ROLLBACK');}}
async function closeCustomers(){await db.query("UPDATE tenant_module_settings SET enabled=false WHERE tenant_id=$1 AND module_key NOT IN ('tasks','talent','announcements')",[id(1)]);}
async function counts(){const result=[];for(const table of tables)result.push((await db.query('SELECT id FROM '+table)).rowCount);return result;}
before(async()=>{
 admin=new Client({connectionString:root.href});await admin.connect();await admin.query(`CREATE DATABASE ${name}`);created=true;
 db=new Client({connectionString:url.href,query_timeout:10000});await db.connect();
 await db.query(fixture+active+verified+workspace+actualFunction('20260926000100_multi_workspace_cutover.sql','current_user_role')+`
 CREATE TABLE profiles(id uuid PRIMARY KEY,role text,display_name text);
 CREATE TABLE companies(id uuid PRIMARY KEY,tenant_id uuid NOT NULL REFERENCES tenants(id),name text,status text,legacy_mock_id text);
 CREATE TABLE contacts(id uuid PRIMARY KEY,company_id uuid REFERENCES companies(id),full_name text);
 CREATE TABLE notes(id uuid PRIMARY KEY,tenant_id uuid REFERENCES tenants(id),company_id uuid REFERENCES companies(id),body text);
 INSERT INTO companies VALUES('${id(101)}','${id(1)}','Synthetic A','aktif',NULL),('${id(102)}','${id(2)}','Synthetic B','aktif',NULL);
 INSERT INTO contacts VALUES('${id(201)}','${id(101)}','Contact A'),('${id(202)}','${id(102)}','Contact B');
 INSERT INTO notes VALUES('${id(301)}','${id(1)}','${id(101)}','Note A'),('${id(302)}','${id(2)}','${id(102)}','Note B');
 `);
 for(const [index,role] of ['yonetici','operasyon','ik','muhasebe','goruntuleyici','partner'].entries()){
  const actor=21+index;
  await db.query('INSERT INTO profiles VALUES($1,$2,$2)',[id(actor),role]);
  await db.query('INSERT INTO tenant_memberships VALUES($1,$2,$3,$4)',[id(1),id(actor),role,id(51+index)]);
 }
 await db.query(`INSERT INTO profiles VALUES('${id(11)}','yonetici','Manager A'),('${id(12)}','operasyon','Manager B')`);
 for(const table of tables)await db.query(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY; GRANT SELECT ON ${table} TO authenticated`);
 for(const name of ['companies_select_role_or_scope','contacts_select_role_or_scope','notes_select_role_or_scope'])await db.query(policy(name));
 await db.query(sqlFile('20260928000900_tenant_module_foundation.sql'));
 const shared=sqlFile('20260928001000_task_module_gateway.sql');await db.query(shared.slice(shared.indexOf('CREATE FUNCTION public.workspace_module_enabled_v1'),shared.indexOf('-- Restrictive AND fences')));
 await db.query(sqlFile('20260928001400_task_company_projection.sql'));
 await db.query(migration);
 console.log('Synthetic customers DB:',(await db.query('SHOW server_version')).rows[0].server_version);
});
after(async()=>{if(db)await db.end();if(admin){if(created)await admin.query(`DROP DATABASE ${name} WITH(FORCE)`);await admin.end();}});
test('customer read gates preserve repository role policy matrix',async()=>{
 const expected=[[1,1,1],[1,1,1],[1,0,1],[1,0,0],[1,0,0],[0,0,0]];
 for(let i=0;i<expected.length;i++)await rollback(async()=>{await asUser(21+i);assert.deepEqual(await counts(),expected[i]);});
});
test('customer reads retain tenant identity and never leak a foreign contact',async()=>{
 await rollback(async()=>{await asUser();for(const [index,table] of tables.entries())assert.equal((await db.query('SELECT id FROM '+table)).rows[0].id,id([101,201,301][index]));});
 await rollback(async()=>{await asUser(12,2);assert.deepEqual(await counts(),[1,1,1]);assert.equal((await db.query('SELECT id FROM contacts')).rows[0].id,id(202));});
});
test('closed customer module hides all three sets and task company choices without deleting records',async()=>{
 await rollback(async()=>{await closeCustomers();await asUser();assert.deepEqual(await counts(),[0,0,0]);assert.equal((await db.query('SELECT * FROM task_company_choices_v1()')).rowCount,0);await db.query('RESET ROLE');for(const table of tables)assert.equal((await db.query('SELECT id FROM '+table)).rowCount,2);});
});
test('closing tenant A leaves tenant B customer reads unchanged',async()=>{
 await rollback(async()=>{await closeCustomers();await asUser(12,2);assert.deepEqual(await counts(),[1,1,1]);});
});
test('a stale claim after membership removal returns no customer data',async()=>{
 await rollback(async()=>{await db.query('DELETE FROM tenant_memberships WHERE user_id=$1',[id(11)]);await asUser();const result=await db.query('SELECT * FROM companies').then(value=>({value}),error=>({error}));if(result.error)assert.equal(result.error.code,'42501');else assert.equal(result.value.rowCount,0);});
});
test('missing config and invalid dependency snapshots do not become enabled',async()=>{
 for(const query of ["DELETE FROM tenant_module_settings WHERE tenant_id=$1 AND module_key='customers'","UPDATE tenant_module_settings SET enabled=false WHERE tenant_id=$1 AND module_key='customers'"]){
  for(const table of tables)await rollback(async()=>{await db.query(query,[id(1)]);await asUser();await assert.rejects(db.query('SELECT * FROM '+table),e=>e.code==='55000');});
 }
});
test('a permissive policy cannot OR around the module read fence',async()=>{
 await rollback(async()=>{for(const table of tables)await db.query(`CREATE POLICY extra_allow ON ${table} FOR SELECT TO authenticated USING(true)`);await closeCustomers();await asUser();assert.deepEqual(await counts(),[0,0,0]);});
});
test('migration aborts if any target RLS is disabled and rolls back prior policy work',async()=>{
 await rollback(async()=>{
  for(const table of tables)await db.query(`DROP POLICY ${table}_module_read_v1 ON ${table}`);
  await db.query('ALTER TABLE notes DISABLE ROW LEVEL SECURITY');
  await assert.rejects(db.query(migration.replace(/^BEGIN;$/m,'').replace(/^COMMIT;$/m,'')),/CUSTOMER_READ_SCHEMA_DRIFT/);
 });
 assert.equal((await db.query("SELECT count(*) FROM pg_policies WHERE policyname IN('companies_module_read_v1','contacts_module_read_v1','notes_module_read_v1')")).rows[0].count,'3');
});
