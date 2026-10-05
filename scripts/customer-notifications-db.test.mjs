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
 await db.query(sqlFile('20261005000100_tenant_module_foundation.sql'));
 const snapshot=sqlFile('20261005000500_task_module_notifications.sql');await db.query(snapshot.slice(snapshot.indexOf('CREATE FUNCTION public.workspace_module_snapshot_v1'),snapshot.indexOf('CREATE FUNCTION public.task_notification_modules_v1')));
 await db.query(sqlFile('20261005001600_customer_notification_modules.sql'));
 await db.query(`
 CREATE TABLE contracts(id uuid PRIMARY KEY,tenant_id uuid,company_id uuid,name text,status text,end_date date,responsible text);
 CREATE TABLE appointments(id uuid PRIMARY KEY,tenant_id uuid,company_id uuid,meeting_type text,attendee text,meeting_date date,status text);
 CREATE TABLE documents(id uuid PRIMARY KEY,tenant_id uuid,company_id uuid,contract_id uuid,name text,validity_date date);
 INSERT INTO contracts VALUES('${id(201)}','${id(1)}','${id(101)}','Contract A','aktif','2026-10-15',NULL),('${id(202)}','${id(2)}','${id(102)}','Contract B','aktif','2026-10-15',NULL),('${id(203)}','${id(1)}','${id(101)}','Draft','taslak','2026-10-15',NULL);
 INSERT INTO appointments VALUES('${id(301)}','${id(1)}','${id(101)}','ziyaret',NULL,'2026-10-01','planlandi'),('${id(302)}','${id(2)}','${id(102)}','ziyaret',NULL,'2026-10-01','planlandi'),('${id(303)}','${id(1)}','${id(101)}','ziyaret',NULL,'2026-10-01','iptal');
 INSERT INTO documents VALUES('${id(401)}','${id(1)}','${id(101)}',NULL,'Company A','2026-10-01'),('${id(402)}','${id(1)}','${id(101)}','${id(201)}','Contract doc A','2026-10-01'),('${id(403)}','${id(2)}','${id(102)}',NULL,'Company B','2026-10-01'),('${id(404)}','${id(1)}','${id(101)}',NULL,'No expiry',NULL);
 `);
 await db.query(sqlFile('20261005001700_notification_candidate_projections.sql'));
 await db.query('CREATE TABLE contacts(id uuid); CREATE TABLE notes(id uuid); GRANT SELECT ON companies,contacts,notes,contracts,appointments,documents TO service_role');
 await db.query(sqlFile('20261005001800_notification_service_read_cutover.sql'));

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

const candidates={appointments:()=>db.query("SELECT * FROM appointment_notification_candidates_v1('2026-10-01') ORDER BY id"),contracts:()=>db.query('SELECT * FROM contract_notification_candidates_v1() ORDER BY id'),documents:()=>db.query("SELECT * FROM document_notification_candidates_v1('2026-10-01') ORDER BY id")};
const documentState=(ids=[id(401),id(402)],tenants=[id(1),id(1)])=>db.query('SELECT * FROM document_notification_state_v1($1,$2)',[ids,tenants]);
test('all candidate and document-state RPCs are service-only',async()=>{
 for(const role of ['anon','authenticated'])for(const fn of [...Object.values(candidates),documentState])await rollback(async()=>{await db.query(`SET LOCAL ROLE ${role}`);await assert.rejects(fn(),e=>e.code==='42501');});
});
test('SQL candidates preserve source date/status filters and expose only notification columns',async()=>{
 await rollback(async()=>{await db.query('SET LOCAL ROLE service_role');assert.deepEqual((await candidates.appointments()).rows.map(r=>r.id),[id(301),id(302)]);assert.deepEqual((await candidates.contracts()).rows.map(r=>r.id),[id(201),id(202)]);const docs=(await candidates.documents()).rows;assert.deepEqual(docs.map(r=>r.id),[id(401),id(402),id(403)]);assert.deepEqual(Object.keys(docs[0]).sort(),['id','name','tenant_id','validity_date']);assert.equal((await db.query("SELECT * FROM appointment_notification_candidates_v1('2026-10-02')")).rowCount,0);});
});
test('contract off preserves company documents but removes linked documents and contract candidates',async()=>{
 await rollback(async()=>{await db.query("UPDATE tenant_module_settings SET enabled=false WHERE tenant_id=$1 AND module_key='contracts'",[id(1)]);await db.query('SET LOCAL ROLE service_role');assert.deepEqual((await candidates.documents()).rows.map(r=>r.id),[id(401),id(403)]);assert.deepEqual((await candidates.contracts()).rows.map(r=>r.id),[id(202)]);assert.deepEqual((await documentState()).rows.map(r=>r.enabled),[true,false]);});
});
test('documents/calendar off prevents SQL candidates for only that tenant',async()=>{
 await rollback(async()=>{await db.query("UPDATE tenant_module_settings SET enabled=false WHERE tenant_id=$1 AND module_key IN ('documents','contracts','calendar')",[id(1)]);await db.query('SET LOCAL ROLE service_role');assert.deepEqual((await candidates.documents()).rows.map(r=>r.id),[id(403)]);assert.deepEqual((await candidates.appointments()).rows.map(r=>r.id),[id(302)]);assert.deepEqual((await documentState()).rows.map(r=>r.enabled),[false,false]);});
});
test('foreign-company or foreign-tenant contract links are excluded, not projected',async()=>{
 await rollback(async()=>{await db.query('UPDATE documents SET contract_id=$1 WHERE id=$2',[id(202),id(402)]);await db.query('SET LOCAL ROLE service_role');assert.deepEqual((await candidates.documents()).rows.map(r=>r.id),[id(401),id(403)]);assert.equal((await documentState()).rows[1].enabled,false);});
});
test('document state uses current relationship and acknowledges removed records as ineligible',async()=>{
 await rollback(async()=>{await db.query("UPDATE tenant_module_settings SET enabled=false WHERE tenant_id=$1 AND module_key='contracts'",[id(1)]);assert.equal((await documentState()).rows[0].enabled,true);await db.query('UPDATE documents SET contract_id=$1 WHERE id=$2',[id(201),id(401)]);assert.equal((await documentState()).rows[0].enabled,false);await db.query('DELETE FROM documents WHERE id=$1',[id(402)]);await db.query('SET LOCAL ROLE service_role');assert.deepEqual((await documentState()).rows.map(r=>r.enabled),[false,false]);assert.equal((await documentState([id(403)],[id(1)])).rows[0].enabled,false);});
});
test('candidate readers fail on incomplete configuration instead of silently treating it as disabled',async()=>{
 for(const fn of [...Object.values(candidates),documentState])await rollback(async()=>{await db.query("DELETE FROM tenant_module_settings WHERE tenant_id=$1 AND module_key='tasks'",[id(1)]);await db.query('SET LOCAL ROLE service_role');await assert.rejects(fn(),e=>e.code==='55000');});
});
test('document-state inputs reject missing, excessive and duplicate pairs',async()=>{
 for(const [ids,tenants] of [[[],[]],[[id(401)],[]],[[null],[id(1)]],[[id(401),id(401)],[id(1),id(1)]],[Array(501).fill(id(401)),Array(501).fill(id(1))]])await rollback(async()=>{await db.query('SET LOCAL ROLE service_role');await assert.rejects(documentState(ids,tenants),e=>e.code==='22023');});
});

test('service raw SELECT is denied after cutover while all notification projections remain usable',async()=>{
 for(const table of ['companies','contacts','notes','contracts','appointments','documents'])await rollback(async()=>{await db.query('SET LOCAL ROLE service_role');await assert.rejects(db.query('SELECT * FROM '+table),e=>e.code==='42501');});
 await rollback(async()=>{await db.query('SET LOCAL ROLE service_role');assert.equal((await names()).rowCount,1);assert.equal((await candidates.appointments()).rowCount,2);assert.equal((await candidates.contracts()).rowCount,2);assert.equal((await candidates.documents()).rowCount,3);assert.equal((await documentState()).rowCount,2);});
});
test('service read cutover rejects inherited column access instead of claiming closure',async()=>{
 await rollback(async()=>{await db.query(`CREATE ROLE notification_read_${process.pid}; GRANT SELECT(name) ON companies TO notification_read_${process.pid}; GRANT notification_read_${process.pid} TO service_role`);await assert.rejects(db.query(sqlFile('20261005001800_notification_service_read_cutover.sql').replace(/^BEGIN;$/m,'').replace(/^COMMIT;$/m,'')),/NOTIFICATION_READ_PRIVILEGE_DRIFT/);});
});
