import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {entries,tables,render} from './legacy-operations-module-gates.mjs';
import {source} from './talent-module-gates.mjs';
import {historicalOperationsSql} from './helpers/operations-function-history.mjs';
import {sqlFile,fixture,active,verified,workspace} from './fixtures/module-database.mjs';
const {Client}=createRequire(import.meta.url)('pg');
const url=new URL(process.env.BPS_MODULE_TEST_DATABASE_URL??'postgres://bps_module_test@127.0.0.1:55439/postgres');assert.ok(['127.0.0.1','localhost','[::1]'].includes(url.hostname));
const dbName=`bps_ops_legacy_${process.pid}_${Date.now()}`,id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
let admin,db,created=false;
before(async()=>{
 admin=new Client({connectionString:url.href});await admin.connect();await admin.query(`CREATE DATABASE ${dbName}`);created=true;const target=new URL(url);target.pathname='/'+dbName;db=new Client({connectionString:target.href,query_timeout:10000});await db.connect();await db.query(fixture+active+verified+workspace);
 await db.query(`CREATE FUNCTION public.current_user_role() RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$SELECT role FROM public.tenant_memberships WHERE user_id=auth.uid() AND tenant_id=public.current_user_verified_tenant()$$;SET check_function_bodies=off;`);
 const names=new Set(['companies',...tables,...entries.flatMap(e=>[...e.body.matchAll(/\b\w+\s+public\.(\w+)(?:%ROWTYPE)?\s*[;,]/gi)].map(m=>m[1]))]);
 for(const name of names)await db.query(`CREATE TABLE public.${name}(id uuid,tenant_id uuid NOT NULL,company_id uuid,name text,city text,code text,kind text,active boolean,revision integer,directory_revision integer)`);
 await db.query('GRANT SELECT ON companies TO authenticated');
 for(const table of tables)await db.query(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY;GRANT SELECT ON ${table} TO authenticated;CREATE POLICY old_scope ON ${table} FOR SELECT TO authenticated USING(tenant_id=public.current_user_verified_tenant() AND public.current_user_role() IN ('yonetici','operasyon'));INSERT INTO ${table}(id,tenant_id,name,active) VALUES('${id(50)}','${id(1)}','A',true),('${id(51)}','${id(2)}','B',true)`);
 await db.query(sqlFile('20260928000900_tenant_module_foundation.sql'));
 for(const name of ['workspace_require_module_write_v1','workspace_module_enabled_v1'])await db.query(source(name,'20260928001000_task_module_gateway.sql','read').declaration);
 await db.query('REVOKE ALL ON FUNCTION workspace_require_module_write_v1(uuid,text[]) FROM PUBLIC,anon,authenticated,service_role;GRANT EXECUTE ON FUNCTION workspace_module_enabled_v1(text) TO authenticated');
 for(const e of entries){await db.query(e.baseDeclaration);await db.query(`REVOKE ALL ON FUNCTION ${e.signature} FROM PUBLIC,anon,service_role;GRANT EXECUTE ON FUNCTION ${e.signature} TO authenticated`);}
 await db.query(historicalOperationsSql(entries.map(e=>e.signature)));await db.query(render());
});
after(async()=>{if(db)await db.end();if(admin){if(created)await admin.query(`DROP DATABASE ${dbName} WITH(FORCE)`);await admin.end();}});
async function run(fn){await db.query('BEGIN');try{await fn();}finally{await db.query('ROLLBACK');}}
async function auth(){await db.query("SELECT set_config('request.jwt.claims',$1,true)",[JSON.stringify({sub:id(11),active_tenant_id:id(1)})]);await db.query('SET LOCAL ROLE authenticated');}
for(const e of entries)test(`${e.name} rejects disabled staffing with original execution mode`,()=>run(async()=>{
 await db.query(`UPDATE tenant_module_settings SET enabled=false WHERE tenant_id='${id(1)}' AND module_key='staffing'`);await auth();const types=e.signature.split('(')[1].slice(0,-1).split(',');
 await assert.rejects(db.query(`SELECT ${e.name}(${types.map(t=>'NULL::'+t).join(',')})`),err=>err.code==='BM001');
}));
for(const table of tables)test(`${table} raw SELECT is tenant-scoped and empty when module disabled`,()=>run(async()=>{
 await auth();assert.equal((await db.query(`SELECT * FROM ${table}`)).rowCount,1);await db.query('RESET ROLE');
 await db.query(`CREATE POLICY broader_policy ON ${table} FOR SELECT TO authenticated USING(true)`);await db.query('SET LOCAL ROLE authenticated');assert.equal((await db.query(`SELECT * FROM ${table}`)).rowCount,1);await db.query('RESET ROLE');await db.query(`UPDATE tenant_module_settings SET enabled=false WHERE tenant_id='${id(1)}' AND module_key='staffing'`);await db.query('SET LOCAL ROLE authenticated');assert.equal((await db.query(`SELECT * FROM ${table}`)).rowCount,0);
}));
test('restrictive policies do not grant a viewer previously denied access',()=>run(async()=>{
 await db.query(`UPDATE tenant_memberships SET role='goruntuleyici' WHERE user_id='${id(11)}'`);await auth();for(const table of tables)assert.equal((await db.query(`SELECT * FROM ${table}`)).rowCount,0);
}));
test('actual worker directory remains invoker and works when staffing on, talent off',()=>run(async()=>{
 await db.query(`UPDATE tenant_module_settings SET enabled=false WHERE tenant_id='${id(1)}' AND module_key='talent'`);await auth();const result=await db.query("SELECT ops_directory('workers',NULL,'','all',0) v");assert.equal(result.rows[0].v.total,1);
}));
test('original statements and invoker/definer flags survive history plus gates',async()=>{
 for(const e of entries){const p=(await db.query('SELECT prosrc,prosecdef FROM pg_proc WHERE oid=$1::regprocedure',[e.signature])).rows[0];assert.equal(p.prosrc,e.body.replace(e.anchor,e.anchor+e.guard));assert.equal(p.prosecdef,e.definer);}
});
test('missing tenant RLS precondition aborts without altering functions',()=>run(async()=>{
 for(const table of tables)await db.query(`DROP POLICY ${table}_module_read_v1 ON ${table}`);
 for(const e of entries)await db.query(e.declaration.replace(/^CREATE (?:OR REPLACE )?FUNCTION/i,'CREATE OR REPLACE FUNCTION'));
 await db.query('ALTER FUNCTION ops_board(uuid,date) SECURITY DEFINER;ALTER TABLE ops_workers DISABLE ROW LEVEL SECURITY;SAVEPOINT attempt');
 await assert.rejects(db.query(render().replace(/\nBEGIN;\n/,'\n').replace(/COMMIT;\n$/,'')),e=>e.message.includes('TABLE_DRIFT'));await db.query('ROLLBACK TO attempt');assert.equal((await db.query('SELECT prosrc FROM pg_proc WHERE oid=$1::regprocedure',[entries[0].signature])).rows[0].prosrc,entries[0].body);
}));
