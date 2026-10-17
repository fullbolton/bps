import {loadFixtureMigrations} from './fixture-migrations.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const {Client}=createRequire(import.meta.url)('pg');
const container='supabase_db_bps-supabase-acceptance';
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const database=`bps_module_history_${process.pid}`;
const admin=sql=>execFileSync('docker',['exec','-i',container,'psql','-XqAt','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1'],{input:sql,encoding:'utf8',timeout:20000});

test('manager module history on complete local schema',async t=>{
 admin(`CREATE DATABASE ${database} TEMPLATE bps_module_chain_20261005;`);let c;
 try{
 const password=execFileSync('docker',['exec',container,'printenv','POSTGRES_PASSWORD'],{encoding:'utf8'}).trim();
 c=new Client({host:'127.0.0.1',port:54322,user:'postgres',password,database});await c.connect();
 for(const f of loadFixtureMigrations())await c.query(readFileSync(new URL('../../supabase/migrations/'+f,import.meta.url),'utf8'));
 const claims=()=>c.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:id(11),active_tenant_id:id(1),role:'authenticated'})]);await claims();
 const read=(actor=id(11),tenant=id(1))=>c.query('select workspace_module_history_v1($1,$2) value',[actor,tenant]);
 await t.test('manager gets only own bootstrap without receipt hash',async()=>{
 await c.query('SET ROLE authenticated');const v=(await read()).rows[0].value;assert.equal(v.entries.length,1);assert.equal(v.entries[0].kind,'bootstrap');assert.equal(v.context.tenantId,id(1));assert.equal('request_hash' in v.entries[0],false);await c.query('RESET ROLE');
 });
 await t.test('foreign actor and tenant rejected',async()=>{await c.query('SET ROLE authenticated');await assert.rejects(read(id(12)),e=>e.code==='42501');await assert.rejects(read(id(11),id(2)),e=>e.code==='42501');await c.query('RESET ROLE');});
 await t.test('nonmanager denied with current membership role',async()=>{
 await c.query('BEGIN');await c.query("UPDATE tenant_memberships SET role='operasyon' WHERE user_id=$1 AND tenant_id=$2",[id(11),id(1)]);await c.query('SET LOCAL ROLE authenticated');await assert.rejects(read(),e=>e.code==='42501');await c.query('ROLLBACK');});
 await t.test('latest 20 exact revisions and original data remain intact',async()=>{
 await c.query('GRANT EXECUTE ON FUNCTION change_workspace_modules_v1(uuid,uuid,uuid,uuid,text,uuid,jsonb) TO authenticated');await c.query('SET ROLE authenticated');
 for(let i=0;i<22;i++){const ctx=(await c.query('select current_workspace_modules_v1() v')).rows[0].v;await c.query('select change_workspace_modules_v1($1,$2,$3,$4,$5,$6,$7)',[ctx.actorId,ctx.tenantId,ctx.membershipVersion,ctx.selectionVersion,ctx.configRevision,id(9900+i),{...ctx.modules,announcements:!ctx.modules.announcements}]);}
 const v=(await read()).rows[0].value;assert.equal(v.entries.length,20);assert.equal(v.entries[0].revision,'23');assert.equal(v.entries[19].revision,'4');assert.ok(v.entries.every(r=>r.kind==='settings'&&typeof r.actorName==='string'));await c.query('RESET ROLE');assert.equal((await c.query('SELECT count(*)::int n FROM tenant_module_changes WHERE tenant_id=$1',[id(1)])).rows[0].n,23);
 });
 await t.test('anon and service role have no execute',async()=>{for(const role of ['anon','service_role']){await c.query('SET ROLE '+role);await assert.rejects(read(),e=>e.code==='42501');await c.query('RESET ROLE');}});
 }finally{if(c)await c.end();admin(`DROP DATABASE ${database} WITH (FORCE);`);}
});
