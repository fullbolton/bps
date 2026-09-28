// Local PostgreSQL only. Creates and drops its own uniquely named synthetic database.
import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const {Client}=createRequire(import.meta.url)('pg');
const url=new URL(process.env.BPS_MODULE_TEST_DATABASE_URL??'postgres://bps_module_test@127.0.0.1:55439/postgres');
assert.ok(['127.0.0.1','localhost','[::1]'].includes(url.hostname),'Module tests require a local synthetic PostgreSQL server');
const dbName=`bps_module_acceptance_${process.pid}_${Date.now()}`;
let admin,db,created=false;
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const sqlFile=name=>readFileSync(new URL('../supabase/migrations/'+name,import.meta.url),'utf8');
const migration=sqlFile('20260928000900_tenant_module_foundation.sql');
function actualFunction(file,name){
 const text=sqlFile(file),start=text.indexOf(`CREATE OR REPLACE FUNCTION public.${name}()`);
 assert.ok(start>=0,name);const end=text.indexOf('$$;',text.indexOf('$$',start)+2);assert.ok(end>start);
 return text.slice(start,end+3);
}
const fixture=`
DO $$ BEGIN
 IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon;END IF;
 IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated;END IF;
 IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role BYPASSRLS;END IF;
END $$;
CREATE SCHEMA auth;
CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$ SELECT coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT (auth.jwt()->>'sub')::uuid $$;
GRANT USAGE ON SCHEMA public,auth TO anon,authenticated,service_role;
CREATE TABLE public.tenants(id uuid PRIMARY KEY,name text NOT NULL);
CREATE TABLE public.tenant_memberships(tenant_id uuid REFERENCES tenants(id),user_id uuid,role text NOT NULL,version uuid NOT NULL,PRIMARY KEY(tenant_id,user_id));
CREATE TABLE public.workspace_selections(user_id uuid PRIMARY KEY,tenant_id uuid REFERENCES tenants(id),version uuid NOT NULL);
INSERT INTO tenants VALUES('${id(1)}','Synthetic A'),('${id(2)}','Synthetic B');
INSERT INTO tenant_memberships VALUES('${id(1)}','${id(11)}','yonetici','${id(31)}'),('${id(2)}','${id(12)}','operasyon','${id(32)}');
`;
const verified=actualFunction('20260904000100_profiles_tenant_scope.sql','current_user_verified_tenant');
const active=actualFunction('20260926000100_multi_workspace_cutover.sql','current_user_active_tenant');
const workspace=actualFunction('20260926000100_multi_workspace_cutover.sql','current_workspace_context');
async function claims(client,actor=11,tenant=1,extra={}){
 await client.query("SELECT set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:id(actor),active_tenant_id:id(tenant),...extra})]);
}
async function rollbackRun(callback){await db.query('BEGIN');try{return await callback();}finally{await db.query('ROLLBACK');}}
async function denied(query,message){await assert.rejects(db.query(query),e=>message?e.message.includes(message):e.code==='42501');}
async function snapshot(){const r=await db.query('SELECT public.current_workspace_modules_v1() value');return r.rows[0].value;}
before(async()=>{
 admin=new Client({connectionString:url.href,connectionTimeoutMillis:5000,query_timeout:10000});await admin.connect();
 await admin.query(`CREATE DATABASE ${dbName}`);created=true;
 const target=new URL(url);target.pathname='/'+dbName;
 db=new Client({connectionString:target.href,connectionTimeoutMillis:5000,query_timeout:10000});await db.connect();
 await db.query(fixture+active+verified+workspace);await db.query(migration);
 console.log('Synthetic module DB:',(await db.query('SHOW server_version')).rows[0].server_version);
});
after(async()=>{if(db)await db.end();if(admin){if(created)await admin.query(`DROP DATABASE ${dbName} WITH (FORCE)`);await admin.end();}});

test('existing tenants get exactly ten enabled settings and one truthful bootstrap receipt each',async()=>{
 const r=await db.query('SELECT tenant_id,count(*)::int n,bool_and(enabled) enabled FROM tenant_module_settings GROUP BY tenant_id ORDER BY tenant_id');
 assert.deepEqual(r.rows,[{tenant_id:id(1),n:10,enabled:true},{tenant_id:id(2),n:10,enabled:true}]);
 const audit=await db.query('SELECT count(*)::int n FROM tenant_module_changes WHERE before_revision=0 AND after_revision=1 AND before_state=\'{}\'::jsonb AND kind=\'bootstrap\' AND request_hash=encode(sha256(convert_to(after_state::text,\'UTF8\')),\'hex\')');
 assert.equal(audit.rows[0].n,2);
});
test('new tenant provisioning initializes all ten rows in the same transaction; rollback leaves nothing',async()=>{
 await rollbackRun(async()=>{
  await db.query(`INSERT INTO tenants VALUES('${id(3)}','Synthetic new')`);
  assert.equal((await db.query(`SELECT count(*)::int n FROM tenant_module_settings WHERE tenant_id='${id(3)}'`)).rows[0].n,10);
 });
 assert.equal((await db.query(`SELECT count(*)::int n FROM tenant_module_config WHERE tenant_id='${id(3)}'`)).rows[0].n,0);
});
test('authenticated response is scoped to live membership, preserves role and bigint precision',async()=>{
 await rollbackRun(async()=>{
  await db.query(`UPDATE tenant_module_config SET revision=9223372036854775807 WHERE tenant_id='${id(1)}'`);
  await claims(db);await db.query('SET LOCAL ROLE authenticated');const value=await snapshot();
  assert.equal(value.tenantId,id(1));assert.equal(value.actorId,id(11));assert.equal(value.role,'yonetici');
  assert.equal(value.configRevision,'9223372036854775807');assert.equal(value.schemaVersion,1);assert.equal(Object.keys(value.modules).length,10);
 });
 await rollbackRun(async()=>{await claims(db,12,2);await db.query('SET LOCAL ROLE authenticated');assert.equal((await snapshot()).role,'operasyon');});
});
test('all configuration tables deny direct reads and writes to anon/authenticated/service_role',async()=>{
 for(const role of ['anon','authenticated','service_role'])for(const table of ['tenant_module_config','tenant_module_settings','tenant_module_changes']){
  await rollbackRun(async()=>{await db.query(`SET LOCAL ROLE ${role}`);await denied(`SELECT * FROM ${table}`);});
  await rollbackRun(async()=>{await db.query(`SET LOCAL ROLE ${role}`);await denied(`DELETE FROM ${table}`);});
 }
 const r=await db.query("SELECT count(*)::int n FROM pg_class WHERE relname IN('tenant_module_config','tenant_module_settings','tenant_module_changes') AND relrowsecurity");assert.equal(r.rows[0].n,3);
});
test('only authenticated can execute the public reader; internal bootstrap and catalog have no client grants',async()=>{
 for(const role of ['anon','authenticated','service_role'])for(const signature of ['tenant_module_bootstrap_v1(uuid)','tenant_module_on_create_v1()','tenant_module_key_guard_v1()','workspace_module_catalog_v1()']){
  const r=await db.query('SELECT has_function_privilege($1,$2,\'EXECUTE\') allowed',[role,'public.'+signature]);assert.equal(r.rows[0].allowed,false);
 }
 for(const role of ['anon','service_role'])await rollbackRun(async()=>{await db.query(`SET LOCAL ROLE ${role}`);await denied('SELECT current_workspace_modules_v1()');});
});
test('no session, foreign tenant claim and removed membership fail closed',async()=>{
 for(const actor of [11,99])await rollbackRun(async()=>{await claims(db,actor,2);await db.query('SET LOCAL ROLE authenticated');await denied('SELECT current_workspace_modules_v1()','WORKSPACE_SCOPE');});
 await rollbackRun(async()=>{await db.query("SELECT set_config('request.jwt.claims','{}',false)");await db.query('SET LOCAL ROLE authenticated');await denied('SELECT current_workspace_modules_v1()','WORKSPACE_SCOPE');});
 await rollbackRun(async()=>{await db.query(`DELETE FROM tenant_memberships WHERE user_id='${id(11)}'`);await claims(db);await db.query('SET LOCAL ROLE authenticated');await denied('SELECT current_workspace_modules_v1()','WORKSPACE_SCOPE');});
});
test('stale workspace selection and stale membership generations are rejected by the real scope functions',async()=>{
 for(const extra of [{},{workspace_selection_version:id(41),workspace_membership_version:id(99)}])await rollbackRun(async()=>{
  await db.query(`INSERT INTO workspace_selections VALUES('${id(11)}','${id(1)}','${id(41)}')`);
  await claims(db,11,1,extra);await db.query('SET LOCAL ROLE authenticated');await denied('SELECT current_workspace_modules_v1()','WORKSPACE_SCOPE');
 });
 await rollbackRun(async()=>{
  await db.query(`INSERT INTO workspace_selections VALUES('${id(11)}','${id(1)}','${id(41)}')`);
  await claims(db,11,1,{workspace_selection_version:id(41),workspace_membership_version:id(31)});await db.query('SET LOCAL ROLE authenticated');
  assert.equal((await snapshot()).selectionVersion,id(41));
 });
});
test('missing config, missing key and broken hard dependencies do not return an all-enabled fallback',async()=>{
 for(const [mutation,message] of [
  [`DELETE FROM tenant_module_config WHERE tenant_id='${id(1)}'`,'MODULE_CONFIG_MISSING'],
  [`DELETE FROM tenant_module_settings WHERE tenant_id='${id(1)}' AND module_key='tasks'`,'MODULE_CONFIG_INCOMPLETE'],
  [`UPDATE tenant_module_settings SET enabled=false WHERE tenant_id='${id(1)}' AND module_key='customers'`,'MODULE_CONFIG_DEPENDENCY']]){
  await rollbackRun(async()=>{await db.query(mutation);await claims(db);await db.query('SET LOCAL ROLE authenticated');await denied('SELECT current_workspace_modules_v1()',message);});
 }
});
test('disabled independent module is represented as disabled without changing another tenant',async()=>{
 await rollbackRun(async()=>{
  await db.query(`UPDATE tenant_module_settings SET enabled=false WHERE tenant_id='${id(1)}' AND module_key='talent'`);
  await claims(db);await db.query('SET LOCAL ROLE authenticated');assert.equal((await snapshot()).modules.talent,false);
  await claims(db,12,2);assert.equal((await snapshot()).modules.talent,true);
 });
});
test('unknown/duplicate module keys, invalid revision and bootstrap reset are rejected',async()=>{
 for(const query of [
  `INSERT INTO tenant_module_settings VALUES('${id(1)}','unknown',true)`,
  `INSERT INTO tenant_module_settings VALUES('${id(1)}','tasks',true)`,
  `UPDATE tenant_module_config SET revision=0 WHERE tenant_id='${id(1)}'`,
  `SELECT tenant_module_bootstrap_v1('${id(1)}')`
 ])await rollbackRun(async()=>{await assert.rejects(db.query(query));});
});

test('tenant insert and migration serialize in both orders; timeout rolls back all new tables',async()=>{
 const raceName=dbName+'_race';await admin.query(`CREATE DATABASE ${raceName}`);
 const target=new URL(url);target.pathname='/'+raceName;
 const migrator=new Client({connectionString:target.href,connectionTimeoutMillis:5000,query_timeout:10000});
 const writer=new Client({connectionString:target.href,connectionTimeoutMillis:5000,query_timeout:10000});
 await migrator.connect();await writer.connect();
 try{
  await migrator.query(fixture+active+verified+workspace);
  await writer.query('BEGIN');await writer.query(`INSERT INTO tenants VALUES('${id(3)}','Before migration')`);
  await assert.rejects(migrator.query(migration.replace("lock_timeout='15s'","lock_timeout='100ms'")),e=>e.code==='55P03');
  await migrator.query('ROLLBACK');
  assert.equal((await migrator.query("SELECT to_regclass('public.tenant_module_config') value")).rows[0].value,null);
  await writer.query('COMMIT');
  // Hold the migration transaction after installing the trigger and backfilling.
  await migrator.query(migration.replace(/COMMIT;\s*$/,''));
  const pid=(await writer.query('SELECT pg_backend_pid() pid')).rows[0].pid;
  const insertion=writer.query(`INSERT INTO tenants VALUES('${id(4)}','During migration')`);
  const waiting=async()=>{
   for(let i=0;i<100;i++){
    const r=await migrator.query('SELECT wait_event_type FROM pg_stat_activity WHERE pid=$1',[pid]);
    if(r.rows[0]?.wait_event_type==='Lock')return;
    await new Promise(resolve=>setTimeout(resolve,10));
   }
   throw Error('Writer did not wait on the tenant migration lock');
  };
  try{await waiting();}finally{await migrator.query('COMMIT');await insertion;}
  const rows=await migrator.query('SELECT tenant_id,count(*)::int n FROM tenant_module_settings GROUP BY tenant_id ORDER BY tenant_id');
  assert.deepEqual(rows.rows,[1,2,3,4].map(n=>({tenant_id:id(n),n:10})));
 }finally{
  await migrator.end();await writer.end();await admin.query(`DROP DATABASE ${raceName} WITH (FORCE)`);
 }
});
