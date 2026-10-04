import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {entries,render,storageOriginal} from './reporting-module-gates.mjs';
import {source} from './talent-module-gates.mjs';
import {sqlFile,fixture,active,verified,workspace} from './fixtures/module-database.mjs';
const {Client}=createRequire(import.meta.url)('pg');
const url=new URL(process.env.BPS_MODULE_TEST_DATABASE_URL??'postgres://bps_module_test@127.0.0.1:55439/postgres');assert.ok(['localhost','127.0.0.1','[::1]'].includes(url.hostname));
const name=`bps_reporting_modules_${process.pid}_${Date.now()}`,id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;let admin,db,created=false;
before(async()=>{
 admin=new Client({connectionString:url.href});await admin.connect();await admin.query(`CREATE DATABASE ${name}`);created=true;const target=new URL(url);target.pathname='/'+name;db=new Client({connectionString:target.href,query_timeout:10000});await db.connect();await db.query(fixture+active+verified+workspace);
 await db.query(`CREATE FUNCTION public.current_user_role() RETURNS text LANGUAGE sql STABLE AS $$SELECT role FROM public.tenant_memberships WHERE user_id=auth.uid() AND tenant_id=public.current_user_verified_tenant()$$;CREATE TABLE profiles(id uuid);INSERT INTO profiles VALUES('${id(11)}');SET check_function_bodies=off;`);
 const tables=new Set(entries.flatMap(e=>[...e.body.matchAll(/\b\w+\s+public\.(\w+)(?:%ROWTYPE)?\s*[;,]/gi)].map(m=>m[1])));
 for(const t of tables)await db.query(`CREATE TABLE ${t}(id uuid,tenant_id uuid,actor_id uuid,company_id uuid,project_id uuid,batch_id uuid,status text,name text,code text,kind text,revision integer,created_at timestamptz,path text)`);
 await db.query(source('reporting_assert_scope','20260928000100_project_reporting_foundation.sql','read').declaration);await db.query('REVOKE ALL ON FUNCTION reporting_assert_scope(uuid,uuid,boolean) FROM PUBLIC,anon,authenticated,service_role');
 await db.query(sqlFile('20260928000900_tenant_module_foundation.sql'));
 await db.query(source('workspace_require_module_write_v1','20260928001000_task_module_gateway.sql','write').declaration);
 await db.query(source('workspace_require_module_read_v1','20260929000300_talent_module_rpc_gates.sql','read').declaration);
 await db.query('REVOKE ALL ON FUNCTION workspace_require_module_write_v1(uuid,text[]),workspace_require_module_read_v1(uuid,text[]) FROM PUBLIC,anon,authenticated,service_role');
 for(const e of entries){await db.query(e.declaration);await db.query(`REVOKE ALL ON FUNCTION ${e.signature} FROM PUBLIC,anon,service_role;GRANT EXECUTE ON FUNCTION ${e.signature} TO authenticated`);}
 await db.query(`CREATE FUNCTION reporting_source_access(p_name text,p_write boolean) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $body$${storageOriginal}$body$;REVOKE ALL ON FUNCTION reporting_source_access(text,boolean) FROM PUBLIC,anon,service_role;GRANT EXECUTE ON FUNCTION reporting_source_access(text,boolean) TO authenticated`);
 await db.query(source('reporting_import_validate','20260928000200_project_reporting_actual_import.sql','read').declaration);
 await db.query('REVOKE ALL ON FUNCTION reporting_import_validate(uuid,uuid,date,text,jsonb) FROM PUBLIC,anon,authenticated,service_role');
 await db.query(render());
});
after(async()=>{if(db)await db.end();if(admin){if(created)await admin.query(`DROP DATABASE ${name} WITH(FORCE)`);await admin.end();}});
async function run(fn){await db.query('BEGIN');try{await fn();}finally{await db.query('ROLLBACK');}}
async function auth(){await db.query("SELECT set_config('request.jwt.claims',$1,true)",[JSON.stringify({sub:id(11),active_tenant_id:id(1)})]);await db.query('SET LOCAL ROLE authenticated');}
function call(e){return `SELECT ${e.name}(${e.signature.split('(')[1].slice(0,-1).split(',').map((t,i)=>i<2?`'${id(i===0?11:1)}'::uuid`:`NULL::${t}`).join(',')})`;}
for(const e of entries)test(`${e.name} rejects disabled reporting before business queries`,()=>run(async()=>{
 await db.query(`UPDATE tenant_module_settings SET enabled=false WHERE tenant_id='${id(1)}' AND module_key='reporting'`);await auth();await assert.rejects(db.query(call(e)),err=>err.code==='BM001');
}));
test('all endpoint bodies retain business statements and clients cannot bypass through anon/service',async()=>{
 for(const e of entries){assert.equal((await db.query('SELECT prosrc FROM pg_proc WHERE oid=$1::regprocedure',[e.signature])).rows[0].prosrc,e.body.replace(e.anchor,()=>e.anchor+e.guard));for(const r of ['anon','service_role'])assert.equal((await db.query('SELECT has_function_privilege($1,$2,\'EXECUTE\') yes',[r,e.signature])).rows[0].yes,false);}
});
test('enabled actual list is scoped; talent and staffing can both be off',()=>run(async()=>{
 await db.query(`CREATE TABLE companies(id uuid,tenant_id uuid,name text);ALTER TABLE reporting_periods ADD COLUMN month date;
 INSERT INTO companies VALUES('${id(50)}','${id(1)}','A'),('${id(51)}','${id(2)}','B');
 INSERT INTO reporting_projects(id,tenant_id,company_id,name,created_at) VALUES('${id(60)}','${id(1)}','${id(50)}','Project A',now()),('${id(61)}','${id(2)}','${id(51)}','Project B',now());
 UPDATE tenant_module_settings SET enabled=false WHERE tenant_id='${id(1)}' AND module_key IN ('talent','staffing')`);await auth();const v=(await db.query(`SELECT reporting_project_list('${id(11)}','${id(1)}',0) v`)).rows[0].v;assert.equal(v.total,1);assert.equal(v.rows[0].name,'Project A');
}));
test('Storage helper keeps ownership/status rules and denies read/upload when reporting off',()=>run(async()=>{
 await db.query(`INSERT INTO reporting_imports(id,tenant_id,actor_id,status) VALUES('${id(70)}','${id(1)}','${id(11)}','pending')`);await auth();const path=`${id(1)}/${id(70)}/${'a'.repeat(64)}.csv`;
 const check=async()=> (await db.query('SELECT reporting_source_access($1,false) r,reporting_source_access($1,true) w',[path])).rows[0];assert.deepEqual(await check(),{r:true,w:true});
 await db.query('RESET ROLE');await db.query("UPDATE reporting_imports SET status='approved'");await db.query('SET LOCAL ROLE authenticated');assert.deepEqual(await check(),{r:true,w:false});
 await db.query('RESET ROLE');await db.query(`UPDATE tenant_module_settings SET enabled=false WHERE tenant_id='${id(1)}' AND module_key='reporting'`);await db.query('SET LOCAL ROLE authenticated');assert.deepEqual(await check(),{r:false,w:false});
}));
test('read role cannot use reporting writes; spoofed actor fails scope',()=>run(async()=>{
 await db.query(`UPDATE tenant_memberships SET role='muhasebe' WHERE user_id='${id(11)}'`);await auth();await db.query('SAVEPOINT deny');await assert.rejects(db.query(call(entries[0])),e=>e.message==='REPORT_FORBIDDEN');await db.query('ROLLBACK TO deny');await assert.rejects(db.query(`SELECT reporting_project_list('${id(12)}','${id(1)}',0)`),e=>e.message==='REPORT_SCOPE');
}));

async function resetEndpoints(){for(const e of entries)await db.query(e.declaration.replace(/^CREATE (?:OR REPLACE )?FUNCTION/i,'CREATE OR REPLACE FUNCTION'));await db.query(`CREATE OR REPLACE FUNCTION reporting_source_access(p_name text,p_write boolean) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $body$${storageOriginal}$body$`);}
const patch=()=>render().replace(/\nBEGIN;\n/,'\n').replace(/COMMIT;\n$/,'');
test('late body drift rolls back earlier endpoint patches',()=>run(async()=>{
 await resetEndpoints();const last=entries.at(-1);await db.query(last.declaration.replace(/^CREATE (?:OR REPLACE )?FUNCTION/i,'CREATE OR REPLACE FUNCTION').replace('BEGIN','BEGIN\n -- drift'));await db.query('SAVEPOINT candidate');await assert.rejects(db.query(patch()),e=>e.message.includes('BODY_DRIFT'));await db.query('ROLLBACK TO candidate');assert.equal((await db.query('SELECT prosrc FROM pg_proc WHERE oid=$1::regprocedure',[entries[0].signature])).rows[0].prosrc,entries[0].body);
}));
test('new accessible overload and exposed internal helper require explicit review',async()=>{
 await run(async()=>{await resetEndpoints();await db.query(`CREATE FUNCTION reporting_extra(p_actor uuid,p_tenant uuid) RETURNS void LANGUAGE sql AS $$SELECT$$;GRANT EXECUTE ON FUNCTION reporting_extra(uuid,uuid) TO authenticated`);await assert.rejects(db.query(patch()),e=>e.message.includes('UNREVIEWED_ENDPOINT'));});
 await run(async()=>{await resetEndpoints();await db.query('GRANT EXECUTE ON FUNCTION reporting_import_validate(uuid,uuid,date,text,jsonb) TO authenticated');await assert.rejects(db.query(patch()),e=>e.message.includes('INTERNAL_ACL'));});
});

test('waiting reporting writer sees committed module disable before entering business work',async()=>{
 const target=new URL(url);target.pathname='/'+name;const waiter=new Client({connectionString:target.href,query_timeout:5000});await waiter.connect();
 try{await db.query('BEGIN');await db.query(`SELECT FROM tenant_module_config WHERE tenant_id='${id(1)}' FOR UPDATE`);await db.query(`UPDATE tenant_module_settings SET enabled=false WHERE tenant_id='${id(1)}' AND module_key='reporting'`);
 await waiter.query("SELECT set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:id(11),active_tenant_id:id(1)})]);await waiter.query('SET ROLE authenticated');const pending=waiter.query(call(entries[0])).then(()=>null,e=>e);
 let waiting=false;for(let i=0;i<100;i++){if((await admin.query('SELECT wait_event_type FROM pg_stat_activity WHERE pid=$1',[waiter.processID])).rows[0]?.wait_event_type==='Lock'){waiting=true;break;}await new Promise(r=>setTimeout(r,10));}assert.ok(waiting,'writer must actually wait on config lock');await db.query('COMMIT');assert.equal((await pending).code,'BM001');
 }finally{await db.query('ROLLBACK');await db.query(`UPDATE tenant_module_settings SET enabled=true WHERE tenant_id='${id(1)}' AND module_key='reporting'`);await waiter.end();}
});

test('source access rejects another operators batch, foreign tenant and malformed paths',()=>run(async()=>{
 await db.query(`UPDATE tenant_memberships SET role='operasyon' WHERE user_id='${id(11)}';INSERT INTO reporting_imports(id,tenant_id,actor_id,status) VALUES('${id(71)}','${id(1)}','${id(12)}','pending'),('${id(72)}','${id(2)}','${id(11)}','pending')`);await auth();
 for(const path of [`${id(1)}/${id(71)}/${'a'.repeat(64)}.csv`,`${id(2)}/${id(72)}/${'a'.repeat(64)}.csv`,'invalid'])assert.deepEqual((await db.query('SELECT reporting_source_access($1,false) r,reporting_source_access($1,true) w',[path])).rows[0],{r:false,w:false});
}));
