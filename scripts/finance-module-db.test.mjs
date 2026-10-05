import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {sqlFile,fixture,active,verified,workspace,actualFunction} from './fixtures/module-database.mjs';
const {Client}=createRequire(import.meta.url)('pg');
const root=new URL(process.env.BPS_MODULE_TEST_DATABASE_URL??'postgres://bps_module_test@127.0.0.1:55439/postgres');
assert.ok(['127.0.0.1','localhost','[::1]'].includes(root.hostname),'Synthetic local DB only');
const name=`bps_finance_modules_${process.pid}_${Date.now()}`,url=new URL(root);url.pathname='/'+name;
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const client=()=>new Client({connectionString:url.href,connectionTimeoutMillis:5000,query_timeout:10000});
let admin,db,created=false;
const migration=sqlFile('20261005000800_finance_module_access.sql');
const payload={fileName:'synthetic.xlsx',rows:[{accountCode:'120.01.01.001',accountName:'Synthetic customer',borcTotal:120,alacakTotal:0,borcBakiyesi:120,alacakBakiyesi:0,matchedCompanyId:id(101),matchStatus:'matched'}]};
async function claims(c,actor=11,tenant=1){await c.query("SELECT set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:id(actor),active_tenant_id:id(tenant)})]);}
async function asUser(c,actor=11,tenant=1){await claims(c,actor,tenant);await c.query('SET ROLE authenticated');}
async function rollback(fn){await db.query('BEGIN');try{return await fn();}finally{await db.query('ROLLBACK');await db.query('RESET ROLE');}}
async function confirm(c,number=501,input=payload,tenant=1){return (await c.query('SELECT confirm_mizan_atomic($1,$2,$3::jsonb) id',[id(number),id(tenant),JSON.stringify(input)])).rows[0].id;}
async function off(c){await c.query("UPDATE tenant_module_settings SET enabled=false WHERE tenant_id=$1 AND module_key='finance'",[id(1)]);}
async function waitLock(c,pid){for(let i=0;i<100;i++){await c.query('SELECT pg_stat_clear_snapshot()');if((await c.query('SELECT wait_event_type FROM pg_stat_activity WHERE pid=$1',[pid])).rows[0]?.wait_event_type==='Lock')return;await new Promise(r=>setTimeout(r,10));}throw Error('Expected lock wait');}
before(async()=>{
 admin=new Client({connectionString:root.href});await admin.connect();await admin.query(`CREATE DATABASE ${name}`);created=true;
 db=client();await db.connect();
 await db.query(fixture+active+verified+workspace+actualFunction('20260926000100_multi_workspace_cutover.sql','current_user_role')+`
 CREATE TABLE profiles(id uuid PRIMARY KEY,role text,display_name text);
 INSERT INTO profiles VALUES('${id(11)}','yonetici','Synthetic manager'),('${id(12)}','operasyon','Other tenant'),('${id(21)}','muhasebe','Synthetic accounting'),('${id(22)}','operasyon','Synthetic operations');
 INSERT INTO tenant_memberships VALUES('${id(1)}','${id(21)}','muhasebe','${id(41)}'),('${id(1)}','${id(22)}','operasyon','${id(42)}');
 CREATE TABLE companies(id uuid PRIMARY KEY,tenant_id uuid NOT NULL REFERENCES tenants(id),name text NOT NULL);
 INSERT INTO companies VALUES('${id(101)}','${id(1)}','Synthetic customer'),('${id(102)}','${id(2)}','Foreign customer');
 CREATE TABLE financial_summaries(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL REFERENCES tenants(id),company_id uuid REFERENCES companies(id),open_receivable numeric,unbilled_amount numeric,is_overdue boolean,last_source text,confirmed_by uuid,confirmed_at timestamptz,created_by uuid,updated_at timestamptz);
 CREATE UNIQUE INDEX financial_company_key ON financial_summaries(tenant_id,company_id) WHERE company_id IS NOT NULL;
 ALTER TABLE financial_summaries ENABLE ROW LEVEL SECURITY;
 CREATE POLICY financial_read ON financial_summaries FOR SELECT TO authenticated USING(tenant_id=current_user_active_tenant() AND current_user_role() IN('yonetici','muhasebe'));
 GRANT SELECT,INSERT,UPDATE,DELETE ON financial_summaries TO authenticated;
 -- Retired entry bodies are deliberately stubs: tests verify their effective ACL, not their legacy algorithm.
 CREATE FUNCTION confirm_financial_data(jsonb,jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$BEGIN RAISE EXCEPTION 'RETIRED_STUB_MUST_NOT_EXECUTE';END$$;
 CREATE FUNCTION derive_financial_summaries_from_mizan(uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$BEGIN RAISE EXCEPTION 'RETIRED_STUB_MUST_NOT_EXECUTE';END$$;
 `);
 await db.query(sqlFile('20260415000100_create_mizan_tables.sql'));
 await db.query(sqlFile('20260415000200_mizan_match_status_consistency.sql'));
 await db.query(sqlFile('20260909002600_atomic_mizan.sql'));
 await db.query(sqlFile('20261005000100_tenant_module_foundation.sql'));
 // Actual shared guard definitions, without unrelated task-schema fixture.
 const shared=sqlFile('20261005000200_task_module_gateway.sql');await db.query(shared.slice(shared.indexOf('CREATE FUNCTION public.workspace_module_enabled_v1'),shared.indexOf('-- Restrictive AND fences')));
 await db.query('GRANT ALL ON financial_summaries,mizan_uploads,mizan_upload_rows TO service_role');
 await db.query('GRANT EXECUTE ON FUNCTION confirm_financial_data(jsonb,jsonb),derive_financial_summaries_from_mizan(uuid),confirm_mizan_atomic(uuid,uuid,jsonb) TO service_role');
 await db.query(migration);
 await claims(db);await confirm(db,500);
 await db.query(`INSERT INTO financial_summaries(tenant_id,company_id,open_receivable) VALUES('${id(2)}','${id(102)}',888);`);
 console.log('Synthetic finance DB:',(await db.query('SHOW server_version')).rows[0].server_version);
});
after(async()=>{if(db)await db.end();if(admin){if(created)await admin.query(`DROP DATABASE ${name} WITH(FORCE)`);await admin.end();}});

test('finance AND policies retain role and tenant filtering while enabled',async()=>{
 await rollback(async()=>{await asUser(db);assert.equal((await db.query('SELECT * FROM financial_summaries')).rowCount,1);assert.equal((await db.query('SELECT * FROM mizan_upload_rows')).rowCount,1);});
 await rollback(async()=>{await asUser(db,21);assert.equal((await db.query('SELECT * FROM financial_summaries')).rowCount,1);assert.equal((await db.query('SELECT * FROM mizan_uploads')).rowCount,0);});
 await rollback(async()=>{await asUser(db,22);assert.equal((await db.query('SELECT * FROM financial_summaries')).rowCount,0);});
});
test('closed finance hides all three tables without deleting records',async()=>{
 await rollback(async()=>{await off(db);await asUser(db);for(const table of ['financial_summaries','mizan_uploads','mizan_upload_rows'])assert.equal((await db.query(`SELECT * FROM ${table}`)).rowCount,0);await db.query('RESET ROLE');assert.equal((await db.query('SELECT * FROM mizan_uploads')).rowCount,1);});
});
test('atomic import still writes and replays the same receipt once when enabled',async()=>{
 await rollback(async()=>{await asUser(db);assert.equal(await confirm(db),id(501));assert.equal(await confirm(db),id(501));assert.equal((await db.query('SELECT * FROM mizan_upload_rows')).rowCount,2);assert.equal((await db.query('SELECT open_receivable FROM financial_summaries')).rows[0].open_receivable,'120.00');});
});
test('closed finance rejects both new import and old replay before any write',async()=>{
 for(const number of [500,502])await rollback(async()=>{await off(db);await asUser(db);await assert.rejects(confirm(db,number),e=>e.code==='BM001');});
 assert.equal((await db.query('SELECT * FROM mizan_uploads')).rowCount,1);
});
test('wrong role, foreign company and stale claimed tenant remain rejected',async()=>{
 await rollback(async()=>{await asUser(db,21);await assert.rejects(confirm(db),/MIZAN_FORBIDDEN/);});
 await rollback(async()=>{await asUser(db);await assert.rejects(confirm(db,501,{...payload,rows:[{...payload.rows[0],matchedCompanyId:id(102)}]}),/MIZAN_COMPANY_SCOPE/);});
 await rollback(async()=>{await db.query("DELETE FROM tenant_memberships WHERE user_id=$1",[id(11)]);await asUser(db);await assert.rejects(confirm(db),/MIZAN_SCOPE/);});
});
test('malformed module configuration and stronger isolation fail closed',async()=>{
 await rollback(async()=>{await db.query("DELETE FROM tenant_module_settings WHERE tenant_id=$1 AND module_key='finance'",[id(1)]);await asUser(db);await assert.rejects(confirm(db),e=>e.code==='55000');});
 await rollback(async()=>{await db.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');await asUser(db);await assert.rejects(confirm(db),e=>e.code==='25000');});
});
test('anon, authenticated and bypassrls service cannot mutate directly or call retired RPCs',async()=>{
 for(const role of ['anon','authenticated','service_role']){
  for(const table of ['financial_summaries','mizan_uploads','mizan_upload_rows'])for(const privilege of ['INSERT','UPDATE','DELETE','TRUNCATE'])assert.equal((await db.query('SELECT has_table_privilege($1,$2,$3) ok',[role,table,privilege])).rows[0].ok,false);
  for(const sql of ["SELECT confirm_financial_data('{}','[]')",`SELECT derive_financial_summaries_from_mizan('${id(500)}')`])await rollback(async()=>{await claims(db);await db.query(`SET LOCAL ROLE ${role}`);await assert.rejects(db.query(sql),e=>e.code==='42501');});
 }
 for(const table of ['financial_summaries','mizan_uploads','mizan_upload_rows'])await rollback(async()=>{await db.query('SET LOCAL ROLE service_role');await assert.rejects(db.query('SELECT * FROM '+table),e=>e.code==='42501');});
});
test('config change wins: import waits before profile lock then observes disabled state',async()=>{
 const writer=client(),control=client();await writer.connect();await control.connect();let pending;
 try{
  await control.query('BEGIN');await control.query('SELECT * FROM tenant_module_config WHERE tenant_id=$1 FOR UPDATE',[id(1)]);await off(control);
  await asUser(writer);const pid=(await writer.query('SELECT pg_backend_pid() pid')).rows[0].pid;
  pending=confirm(writer,601).then(()=>({ok:true}),error=>({error}));await waitLock(db,pid);
  // No profile lock has been taken while config is pending.
  await db.query('BEGIN');await db.query('SELECT * FROM profiles WHERE id=$1 FOR UPDATE NOWAIT',[id(11)]);await db.query('ROLLBACK');
  await control.query('COMMIT');assert.equal((await pending).error.code,'BM001');
 }finally{await control.query('ROLLBACK');if(pending)await pending;await db.query("UPDATE tenant_module_settings SET enabled=true WHERE tenant_id=$1 AND module_key='finance'",[id(1)]);await writer.end();await control.end();}
});
test('import wins: config update waits for full import transaction',async()=>{
 const writer=client(),control=client();await writer.connect();await control.connect();let pending;
 try{
  await writer.query('BEGIN');await asUser(writer);await confirm(writer,602);
  const pid=(await control.query('SELECT pg_backend_pid() pid')).rows[0].pid;
  pending=control.query('UPDATE tenant_module_config SET revision=revision+1 WHERE tenant_id=$1',[id(1)]).then(()=>true,error=>{throw error;});await waitLock(db,pid);
  await writer.query('ROLLBACK');assert.equal(await pending,true);
 }finally{await writer.query('ROLLBACK');if(pending)await pending;await writer.end();await control.end();}
});

// Reconstruct the pre-patch command inside a rollback-only transaction, then inject drift.
async function expectMigrationRejection(inject, pattern) {
 await rollback(async()=>{
  for (const [table,policy] of [['financial_summaries','financial_summaries_module_read_v1'],['mizan_uploads','mizan_uploads_module_read_v1'],['mizan_upload_rows','mizan_rows_module_read_v1']])
   await db.query(`DROP POLICY ${policy} ON ${table}`);
  const definition=(await db.query("SELECT pg_get_functiondef('confirm_mizan_atomic(uuid,uuid,jsonb)'::regprocedure) definition")).rows[0].definition;
  const guard=" PERFORM public.workspace_require_module_write_v1(p_tenant_id,ARRAY['finance','customers']);\n";
  assert.ok(definition.includes(guard));
  await db.query(definition.replace(guard,''));
  await inject();
  const body=migration.replace(/^BEGIN;$/m,'').replace(/^COMMIT;$/m,'');
  if(pattern) await assert.rejects(db.query(body),pattern);
  else {
   await db.query(body);
   assert.equal((await db.query("SELECT has_column_privilege('authenticated','financial_summaries','open_receivable','UPDATE') ok")).rows[0].ok,false);
  }
 });
 assert.equal((await db.query("SELECT count(*) FROM pg_policies WHERE policyname='financial_summaries_module_read_v1'")).rows[0].count,'1');
}
test('migration revokes direct column privileges as well as table privileges',async()=>{
 await expectMigrationRejection(()=>db.query('GRANT UPDATE(open_receivable) ON financial_summaries TO authenticated'));
});
test('migration aborts on inherited write privileges',async()=>{
 await expectMigrationRejection(()=>db.query(`CREATE ROLE finance_inherited_${process.pid}; GRANT UPDATE ON financial_summaries TO finance_inherited_${process.pid}; GRANT finance_inherited_${process.pid} TO authenticated`),/FINANCE_WRITE_PRIVILEGE_DRIFT/);
});
test('migration aborts on command body drift',async()=>{
 await expectMigrationRejection(async()=>{
  const definition=(await db.query("SELECT pg_get_functiondef('confirm_mizan_atomic(uuid,uuid,jsonb)'::regprocedure) definition")).rows[0].definition;
  await db.query(definition.replace('WHERE id=v_actor FOR UPDATE','WHERE id=v_actor FOR SHARE'));
 },/FINANCE_FUNCTION_DRIFT/);
});
test('migration aborts on a callable same-name overload',async()=>{
 await expectMigrationRejection(()=>db.query("CREATE FUNCTION confirm_mizan_atomic(jsonb) RETURNS void LANGUAGE sql AS 'SELECT';"),/FINANCE_OVERLOAD_PRIVILEGE_DRIFT/);
});
