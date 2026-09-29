import {historicalOperationsSql} from './helpers/operations-function-history.mjs';
import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {entries,render} from './operations-module-gates.mjs';
import {source} from './talent-module-gates.mjs';
import {sqlFile,fixture,active,verified,workspace} from './fixtures/module-database.mjs';
const {Client}=createRequire(import.meta.url)('pg');
const url=new URL(process.env.BPS_MODULE_TEST_DATABASE_URL??'postgres://bps_module_test@127.0.0.1:55439/postgres');
assert.ok(['127.0.0.1','localhost','[::1]'].includes(url.hostname));
const dbName=`bps_ops_gates_${process.pid}_${Date.now()}`,id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
let admin,db,created=false,targetUrl;
before(async()=>{
 admin=new Client({connectionString:url.href});await admin.connect();await admin.query(`CREATE DATABASE ${dbName}`);created=true;targetUrl=new URL(url);targetUrl.pathname='/'+dbName;
 db=new Client({connectionString:targetUrl.href,query_timeout:10000});await db.connect();await db.query(fixture+active+verified+workspace);
 await db.query(`CREATE FUNCTION public.current_user_role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT role FROM public.tenant_memberships WHERE user_id=auth.uid() AND tenant_id=public.current_user_verified_tenant() $$;
 CREATE TABLE profiles(id uuid PRIMARY KEY); INSERT INTO profiles VALUES('${id(11)}'),('${id(12)}'); SET check_function_bodies=off;`);
 const names=new Set(entries.flatMap(e=>[...e.body.matchAll(/\b(?:DECLARE\s+)?\w+\s+public\.(\w+)(?:%ROWTYPE)?\s*[;,]/gi)].map(m=>m[1])));
 names.add('ops_daily_requests');names.add('ops_idp_context');
 for(const name of names)if(name!=='profiles')await db.query(`CREATE TABLE public.${name}(id uuid,tenant_id uuid,actor_id uuid,request_id uuid,original_name text,revision integer)`);
 await db.query(source('talent_assert_scope','20260914000200_talent_people.sql','read').declaration);
 await db.query(sqlFile('20260928000900_tenant_module_foundation.sql'));
 await db.query(source('workspace_require_module_write_v1','20260928001000_task_module_gateway.sql','write').declaration);
 await db.query(source('workspace_require_module_read_v1','20260929000300_talent_module_rpc_gates.sql','read').declaration);
 await db.query('REVOKE ALL ON FUNCTION workspace_require_module_write_v1(uuid,text[]),workspace_require_module_read_v1(uuid,text[]) FROM PUBLIC,anon,authenticated,service_role');
 for(const e of entries){await db.query(e.baseDeclaration);await db.query(`REVOKE ALL ON FUNCTION ${e.signature} FROM PUBLIC,anon,service_role;GRANT EXECUTE ON FUNCTION ${e.signature} TO authenticated`);}
 await db.query(source('ops_comment_context','20260910000200_request_conversation.sql','read').declaration);
 await db.query('REVOKE ALL ON FUNCTION ops_comment_context(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role');
 await db.query('CREATE TABLE ops_message_notifications(tenant_id uuid,recipient_id uuid,message_id uuid,read_at timestamptz)');
 await db.query(historicalOperationsSql(entries.map(e=>e.signature)));
 await db.query(render());
});
after(async()=>{if(db)await db.end();if(admin){if(created)await admin.query(`DROP DATABASE ${dbName} WITH(FORCE)`);await admin.end();}});
async function run(fn){await db.query('BEGIN');try{await fn();}finally{await db.query('ROLLBACK');}}
async function claims(client=db,actor=11,tenant=1){await client.query("SELECT set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:id(actor),active_tenant_id:id(tenant)})]);}
function call(e){const types=e.signature.slice(e.signature.indexOf('(')+1,-1).split(',');return `SELECT public.${e.name}(${types.map((t,i)=>i<2?`'${id(i===0?11:1)}'::uuid`:`NULL::${t}`).join(',')})`;}
for(const e of entries)test(`${e.name}: staffing off denies before business body`,()=>run(async()=>{
 await db.query(`UPDATE tenant_module_settings SET enabled=false WHERE tenant_id='${id(1)}' AND module_key='staffing'`);await claims();await db.query('SET LOCAL ROLE authenticated');await assert.rejects(db.query(call(e)),err=>err.code==='BM001');
}));
test('every original statement and exact signature is preserved',async()=>{
 for(const e of entries){const body=(await db.query('SELECT prosrc FROM pg_proc WHERE oid=$1::regprocedure',[e.signature])).rows[0].prosrc;assert.equal(body,e.body.replace(e.anchor,e.anchor+e.guard));}
});
test('enabled IDP read uses actual body; talent off does not break operations',()=>run(async()=>{
 await db.query(`INSERT INTO ops_daily_requests(id,tenant_id) VALUES('${id(60)}','${id(1)}');INSERT INTO ops_idp_context(tenant_id,request_id,original_name) VALUES('${id(1)}','${id(60)}','Synthetic IDP')`);
 await db.query(`UPDATE tenant_module_settings SET enabled=false WHERE tenant_id='${id(1)}' AND module_key='talent'`);await claims();await db.query('SET LOCAL ROLE authenticated');
 const r=await db.query(`SELECT ops_idp_read('${id(11)}','${id(1)}','${id(60)}') v`);assert.equal(r.rows[0].v.original_name,'Synthetic IDP');
}));
test('each endpoint rejects actor and workspace spoof before business work',async()=>{
 for(const e of entries)await run(async()=>{await claims(db,12,2);await db.query('SET LOCAL ROLE authenticated');await assert.rejects(db.query(call(e)),err=>err.code==='42501');});
});
test('original IDP role restriction survives for HR',()=>run(async()=>{
 await db.query(`UPDATE tenant_memberships SET role='ik' WHERE user_id='${id(11)}'`);await claims();await db.query('SET LOCAL ROLE authenticated');await assert.rejects(db.query(`SELECT ops_idp_read('${id(11)}','${id(1)}','${id(60)}')`),e=>e.message==='IDP_FORBIDDEN');
}));
test('anon and service execute is denied for every scoped endpoint',async()=>{
 for(const e of entries)for(const role of ['anon','service_role'])assert.equal((await db.query('SELECT has_function_privilege($1,$2,\'EXECUTE\') yes',[role,e.signature])).rows[0].yes,false);
});
test('writer waits for settings lock then sees committed disabled state',async()=>{
 const waiter=new Client({connectionString:targetUrl.href,query_timeout:5000});await waiter.connect();
 try{await db.query('BEGIN');await db.query(`SELECT FROM tenant_module_config WHERE tenant_id='${id(1)}' FOR UPDATE`);await db.query(`UPDATE tenant_module_settings SET enabled=false WHERE tenant_id='${id(1)}' AND module_key='staffing'`);
 await claims(waiter);await waiter.query('SET ROLE authenticated');const pending=waiter.query(call(entries.find(e=>e.name==='ops_execute_scoped'))).then(()=>null,e=>e);
 let waiting=false;for(let i=0;i<100;i++){const r=await admin.query('SELECT wait_event_type FROM pg_stat_activity WHERE pid=$1',[waiter.processID]);if(r.rows[0]?.wait_event_type==='Lock'){waiting=true;break;}await new Promise(r=>setTimeout(r,10));}
 assert.ok(waiting);await db.query('COMMIT');assert.equal((await pending).code,'BM001');
 }finally{await db.query('ROLLBACK');await db.query(`UPDATE tenant_module_settings SET enabled=true WHERE tenant_id='${id(1)}' AND module_key='staffing'`);await waiter.end();}
});
async function originals(){for(const e of entries)await db.query(e.declaration.replace(/^CREATE (?:OR REPLACE )?FUNCTION/i,'CREATE OR REPLACE FUNCTION'));}
const migrationBody=()=>render().replace(/\nBEGIN;\n/,'\n').replace(/COMMIT;\n$/,'');
test('late catalog drift rolls back previous endpoint patches',()=>run(async()=>{
 await originals();const last=entries.at(-1);await db.query(last.declaration.replace(/^CREATE (?:OR REPLACE )?FUNCTION/i,'CREATE OR REPLACE FUNCTION').replace('BEGIN','BEGIN\n -- drift'));
 await db.query('SAVEPOINT candidate');await assert.rejects(db.query(migrationBody()),e=>e.message.includes('BODY_DRIFT'));await db.query('ROLLBACK TO candidate');
 assert.equal((await db.query('SELECT prosrc FROM pg_proc WHERE oid=$1::regprocedure',[entries[0].signature])).rows[0].prosrc,entries[0].body);
}));
test('an unreviewed exposed actor endpoint stops migration',()=>run(async()=>{
 await originals();await db.query(`CREATE FUNCTION ops_extra(p_actor uuid,p_tenant uuid) RETURNS jsonb LANGUAGE sql AS $$ SELECT '{}'::jsonb $$;GRANT EXECUTE ON FUNCTION ops_extra(uuid,uuid) TO authenticated`);
 await assert.rejects(db.query(migrationBody()),e=>e.message.includes('UNREVIEWED_ENDPOINT'));
}));

test('enabled notification write keeps original recipient boundary and does not duplicate timestamp',()=>run(async()=>{
 await db.query(`INSERT INTO ops_message_notifications VALUES('${id(1)}','${id(11)}','${id(70)}',NULL),('${id(1)}','${id(12)}','${id(70)}',NULL)`);await claims();await db.query('SET LOCAL ROLE authenticated');
 const sql=`SELECT ops_comment_read('${id(11)}','${id(1)}','${id(70)}') v`;assert.equal((await db.query(sql)).rows[0].v,true);
 await db.query('RESET ROLE');const first=(await db.query(`SELECT read_at FROM ops_message_notifications WHERE recipient_id='${id(11)}'`)).rows[0].read_at;
 await db.query('SET LOCAL ROLE authenticated');await db.query(sql);await db.query('RESET ROLE');
 const rows=(await db.query('SELECT recipient_id,read_at FROM ops_message_notifications ORDER BY recipient_id')).rows;
 assert.equal(rows[0].read_at.toISOString(),first.toISOString());assert.equal(rows[1].read_at,null);
}));
test('pre-history fixture is rejected rather than accepted as the deployed baseline',()=>run(async()=>{
 for(const e of entries)await db.query(e.baseDeclaration.replace(/^CREATE (?:OR REPLACE )?FUNCTION/i,'CREATE OR REPLACE FUNCTION'));
 await assert.rejects(db.query(migrationBody()),e=>e.message.includes('BODY_DRIFT'));
}));
