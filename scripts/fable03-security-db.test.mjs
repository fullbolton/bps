import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {sqlFile,fixture,active,verified,actualFunction} from './fixtures/security-boundary-database.mjs';
const {Client}=createRequire(import.meta.url)('pg');
const url=new URL(process.env.BPS_MODULE_TEST_DATABASE_URL??'postgres://bps_module_test@127.0.0.1:55439/postgres');assert.ok(['127.0.0.1','localhost','[::1]'].includes(url.hostname));
const name=`bps_fable03_${process.pid}_${Date.now()}`,id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;let admin,db,created=false;
const migration=()=>sqlFile('20261004001000_demo_and_critical_date_boundaries.sql');
before(async()=>{
 admin=new Client({connectionString:url.href});await admin.connect();await admin.query(`CREATE DATABASE ${name}`);created=true;const target=new URL(url);target.pathname='/'+name;db=new Client({connectionString:target.href});await db.connect();await db.query(fixture+active+verified);
 await db.query(`CREATE TABLE profiles(id uuid PRIMARY KEY,is_platform_admin boolean DEFAULT false);INSERT INTO profiles VALUES('${id(11)}',false),('${id(12)}',false),('${id(13)}',true),('${id(14)}',false);
 INSERT INTO tenant_memberships VALUES('${id(2)}','${id(11)}','operasyon','${id(33)}'),('${id(1)}','${id(14)}','yonetici','${id(34)}');`);
 await db.query(actualFunction('20260926000100_multi_workspace_cutover.sql','current_user_role'));
 await db.query(actualFunction('20260827000400_platform_admin_rpcs.sql','is_platform_admin'));
 await db.query(sqlFile('20260414000100_create_demo_requests.sql')+sqlFile('20260414000200_close_demo_requests_public_insert.sql')+sqlFile('20260407001100_create_critical_dates.sql'));
 await db.query(`ALTER TABLE critical_dates ADD COLUMN tenant_id uuid NOT NULL DEFAULT '${id(1)}';GRANT SELECT,INSERT,UPDATE,DELETE ON critical_dates TO authenticated;
 INSERT INTO demo_requests(full_name,company_name,email) VALUES('Synthetic lead','Synthetic company','synthetic@example.invalid');
 INSERT INTO critical_dates(id,title,deadline_date,created_by,tenant_id) VALUES('${id(80)}','A','2026-11-01','${id(14)}','${id(1)}'),('${id(81)}','B','2026-11-01','${id(12)}','${id(2)}');`);
 // Establish the reported issue on original policies before installing the candidate.
 await db.query('BEGIN');await auth();assert.equal((await db.query('SELECT * FROM demo_requests')).rowCount,1);
 await db.query(`INSERT INTO critical_dates(title,deadline_date,tenant_id,created_by) VALUES('Cross-tenant','2026-11-01','${id(2)}','${id(12)}')`);await db.query('ROLLBACK');
 await db.query(migration());
});
after(async()=>{if(db)await db.end();if(admin){if(created)await admin.query(`DROP DATABASE ${name} WITH(FORCE)`);await admin.end();}});
async function run(fn){await db.query('BEGIN');try{await fn();}finally{await db.query('ROLLBACK');}}
async function auth(actor=11,tenant=1){
 await db.query('RESET ROLE');const membership=(await db.query('SELECT version FROM tenant_memberships WHERE user_id=$1 AND tenant_id=$2',[id(actor),id(tenant)])).rows[0];
 if(membership)await db.query('INSERT INTO workspace_selections VALUES($1,$2,$3) ON CONFLICT(user_id) DO UPDATE SET tenant_id=excluded.tenant_id,version=excluded.version',[id(actor),id(tenant),id(90)]);
 await db.query("SELECT set_config('request.jwt.claims',$1,true)",[JSON.stringify({sub:id(actor),active_tenant_id:id(tenant),workspace_membership_version:membership?.version,workspace_selection_version:id(90)})]);await db.query('SET LOCAL ROLE authenticated');
}
async function deny(query,params=[]){await db.query('SAVEPOINT rejected');await assert.rejects(db.query(query,params),e=>['42501','23514'].includes(e.code));await db.query('ROLLBACK TO rejected');}
test('tenant managers cannot read leads, including with an extra broad permissive policy',()=>run(async()=>{await db.query('CREATE POLICY accidental_demo_read ON demo_requests FOR SELECT TO authenticated USING(true)');await auth();assert.equal((await db.query('SELECT * FROM demo_requests')).rowCount,0);await auth(14);assert.equal((await db.query('SELECT * FROM demo_requests')).rowCount,0);}));
test('platform admin can read global leads without tenant membership but cannot mutate from browser',()=>run(async()=>{await auth(13);assert.equal((await db.query('SELECT * FROM demo_requests')).rowCount,1);await deny("UPDATE demo_requests SET status='closed'");await deny('DELETE FROM demo_requests');await deny("INSERT INTO demo_requests(full_name,company_name,email) VALUES('x','x','x')");}));
test('anonymous access is closed; service intake remains possible',()=>run(async()=>{await db.query('SET LOCAL ROLE anon');await deny('SELECT * FROM demo_requests');await deny("INSERT INTO demo_requests(full_name,company_name,email) VALUES('x','x','x')");await db.query('SET LOCAL ROLE service_role');await db.query("INSERT INTO demo_requests(full_name,company_name,email) VALUES('server','server','server@example.invalid')");}));
test('manager inserts own tenant with own author, rejects foreign tenant and forged author',()=>run(async()=>{await auth();await db.query(`INSERT INTO critical_dates(title,deadline_date,tenant_id,created_by) VALUES('Own','2026-11-01','${id(1)}','${id(11)}')`);await deny(`INSERT INTO critical_dates(title,deadline_date,tenant_id,created_by) VALUES('Other','2026-11-01','${id(2)}','${id(11)}')`);await deny(`INSERT INTO critical_dates(title,deadline_date,tenant_id,created_by) VALUES('Forged','2026-11-01','${id(1)}','${id(12)}')`);}));
test('same-tenant manager edits another author record without claiming authorship',()=>run(async()=>{await auth();const r=await db.query('UPDATE critical_dates SET title=$1 WHERE id=$2 RETURNING created_by',['Edited',id(80)]);assert.equal(r.rowCount,1);assert.equal(r.rows[0].created_by,id(14));await deny('UPDATE critical_dates SET created_by=$1 WHERE id=$2',[id(11),id(80)]);await deny('UPDATE critical_dates SET tenant_id=$1 WHERE id=$2',[id(2),id(80)]);}));
test('unfiltered manager delete stays inside active tenant even with broad permissive grants',()=>run(async()=>{await db.query('CREATE POLICY accidental_critical_all ON critical_dates FOR ALL TO authenticated USING(true) WITH CHECK(true)');await auth();assert.equal((await db.query('SELECT * FROM critical_dates')).rowCount,1);assert.equal((await db.query('DELETE FROM critical_dates')).rowCount,1);await db.query('RESET ROLE');assert.equal((await db.query('SELECT * FROM critical_dates WHERE tenant_id=$1',[id(2)])).rowCount,1);}));
test('A manager selected into B as operator cannot write even with permissive policy',()=>run(async()=>{await db.query('CREATE POLICY accidental_critical_all ON critical_dates FOR ALL TO authenticated USING(true) WITH CHECK(true)');await auth(11,2);assert.equal((await db.query('SELECT * FROM critical_dates')).rowCount,1);assert.equal((await db.query("UPDATE critical_dates SET title='Denied'")).rowCount,0);assert.equal((await db.query('DELETE FROM critical_dates')).rowCount,0);await deny(`INSERT INTO critical_dates(title,deadline_date,tenant_id,created_by) VALUES('Denied','2026-11-01','${id(2)}','${id(11)}')`);}));
test('unknown tenant claim exposes no deadlines and cannot insert',()=>run(async()=>{await auth(11,99);assert.equal((await db.query('SELECT * FROM critical_dates')).rowCount,0);await deny(`INSERT INTO critical_dates(title,deadline_date,tenant_id,created_by) VALUES('Denied','2026-11-01','${id(1)}','${id(11)}')`);}));

test('legacy null creator can be edited but cannot be rewritten as a different author',()=>run(async()=>{await db.query(`UPDATE critical_dates SET title='Legacy' WHERE id='${id(80)}'`);await db.query('ALTER TABLE critical_dates DISABLE TRIGGER critical_dates_preserve_identity');await db.query(`UPDATE critical_dates SET created_by=NULL WHERE id='${id(80)}'`);await db.query('ALTER TABLE critical_dates ENABLE TRIGGER critical_dates_preserve_identity');await auth();assert.equal((await db.query(`UPDATE critical_dates SET title='Corrected' WHERE id='${id(80)}' RETURNING id`)).rowCount,1);await deny('UPDATE critical_dates SET created_by=$1 WHERE id=$2',[id(11),id(80)]);}));
