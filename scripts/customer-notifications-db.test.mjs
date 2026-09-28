import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {sqlFile,fixture,active,verified,workspace} from './fixtures/module-database.mjs';
const {Client}=createRequire(import.meta.url)('pg');
const root=new URL(process.env.BPS_MODULE_TEST_DATABASE_URL??'postgres://bps_module_test@127.0.0.1:55439/postgres');
assert.ok(['127.0.0.1','localhost','[::1]'].includes(root.hostname));
const name=`bps_customer_notifications_${process.pid}_${Date.now()}`,url=new URL(root);url.pathname='/'+name;
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
let admin,db,created=false;
async function rollback(fn){await db.query('BEGIN');try{return await fn();}finally{await db.query('ROLLBACK');await db.query('RESET ROLE');}}
const modules=(ids=[id(1)],module='calendar')=>db.query('SELECT * FROM customer_notification_modules_v1($1,$2)',[ids,module]);
const names=(companies=[id(101)],tenants=[id(1)],module='calendar')=>db.query('SELECT * FROM notification_company_names_v1($1,$2,$3)',[companies,tenants,module]);
before(async()=>{
 admin=new Client({connectionString:root.href});await admin.connect();await admin.query(`CREATE DATABASE ${name}`);created=true;
 db=new Client({connectionString:url.href});await db.connect();await db.query(fixture+active+verified+workspace);
 await db.query(`CREATE TABLE companies(id uuid PRIMARY KEY,tenant_id uuid REFERENCES tenants(id),name text,secret text);INSERT INTO companies VALUES('${id(101)}','${id(1)}','Synthetic A','SECRET'),('${id(102)}','${id(2)}','Synthetic B','SECRET');`);
 await db.query(sqlFile('20260928000900_tenant_module_foundation.sql'));
 const snapshot=sqlFile('20260928001300_task_module_notifications.sql');await db.query(snapshot.slice(snapshot.indexOf('CREATE FUNCTION public.workspace_module_snapshot_v1'),snapshot.indexOf('CREATE FUNCTION public.task_notification_modules_v1')));
 await db.query(sqlFile('20260928002400_customer_notification_modules.sql'));
});
after(async()=>{if(db)await db.end();if(admin){if(created)await admin.query(`DROP DATABASE ${name} WITH(FORCE)`);await admin.end();}});
test('only service role can execute the two notification projections',async()=>{
 for(const role of ['anon','authenticated'])for(const fn of [modules,names])await rollback(async()=>{await db.query(`SET LOCAL ROLE ${role}`);await assert.rejects(fn(),e=>e.code==='42501');});
 await rollback(async()=>{await db.query('SET LOCAL ROLE service_role');assert.equal((await modules()).rows[0].enabled,true);assert.deepEqual((await names()).rows,[{id:id(101),tenant_id:id(1),name:'Synthetic A'}]);});
});
test('a company cannot resolve through another tenant, even for the service role',async()=>{
 await rollback(async()=>{await db.query('SET LOCAL ROLE service_role');await assert.rejects(names([id(102)],[id(1)]),e=>e.code==='42501');});
});
test('module-specific disabling is isolated between tenants and blocks the corresponding names',async()=>{
 for(const module of ['calendar','contracts'])await rollback(async()=>{
  await db.query('UPDATE tenant_module_settings SET enabled=false WHERE tenant_id=$1 AND module_key=$2',[id(1),module]);await db.query('SET LOCAL ROLE service_role');
  assert.deepEqual((await modules([id(1),id(2)],module)).rows,[{tenant_id:id(1),enabled:false},{tenant_id:id(2),enabled:true}]);
  assert.equal((await names([id(102)],[id(2)],module)).rows[0].name,'Synthetic B');await assert.rejects(names(undefined,undefined,module),e=>e.code==='BM001');
 });
});
test('turning customers off with dependent modules off prevents either company projection',async()=>{
 for(const module of ['calendar','contracts'])await rollback(async()=>{await db.query("UPDATE tenant_module_settings SET enabled=false WHERE tenant_id=$1 AND module_key NOT IN ('tasks','talent','announcements')",[id(1)]);await db.query('SET LOCAL ROLE service_role');await assert.rejects(names(undefined,undefined,module),e=>e.code==='BM001');});
});
test('incomplete settings and broken dependencies raise errors rather than enabled or disabled defaults',async()=>{
 for(const sql of ["DELETE FROM tenant_module_settings WHERE tenant_id=$1 AND module_key='calendar'","UPDATE tenant_module_settings SET enabled=false WHERE tenant_id=$1 AND module_key='customers'"])await rollback(async()=>{await db.query(sql,[id(1)]);await db.query('SET LOCAL ROLE service_role');await assert.rejects(modules(),e=>e.code==='55000');});
});
test('invalid modules, excessive and null tenant arrays are rejected',async()=>{
 for(const [ids,module] of [[[],'calendar'],[[null],'calendar'],[Array(501).fill(id(1)),'calendar'],[[id(1)],'tasks'],[[id(1)],null]])await rollback(async()=>{await db.query('SET LOCAL ROLE service_role');await assert.rejects(modules(ids,module),e=>e.code==='22023');});
});
test('company arrays must be bounded, unique and pairwise complete',async()=>{
 for(const [ids,tenants] of [[[],[]],[[id(101)],[]],[[id(101),id(101)],[id(1),id(1)]],[[null],[id(1)]],[Array(101).fill(id(101)),Array(101).fill(id(1))]])await rollback(async()=>{await db.query('SET LOCAL ROLE service_role');await assert.rejects(names(ids,tenants),e=>e.code==='22023');});
});
test('unknown tenant configuration and missing company fail closed',async()=>{
 await rollback(async()=>{await db.query('SET LOCAL ROLE service_role');await assert.rejects(modules([id(99)]),e=>e.code==='55000');});
 await rollback(async()=>{await db.query('SET LOCAL ROLE service_role');await assert.rejects(names([id(999)]),e=>e.code==='42501');});
});
