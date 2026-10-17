import {loadFixtureMigrations} from '../module-change-command-20261017/fixture-migrations.mjs';
import test from 'node:test';import assert from 'node:assert/strict';import {execFileSync} from 'node:child_process';import {readFileSync} from 'node:fs';import {createRequire} from 'node:module';const pg=createRequire(import.meta.url)('pg');
const container='supabase_db_bps-supabase-acceptance',database=`bps_task_inbox_${process.pid}`;
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const admin=sql=>execFileSync('docker',['exec','-i',container,'psql','-XqAt','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1'],{input:sql,encoding:'utf8',timeout:20000});
test('task notification capture on full local schema',async t=>{
 admin(`CREATE DATABASE ${database} TEMPLATE bps_module_chain_20261005;`);let c;
 try {
 const password=execFileSync('docker',['exec',container,'printenv','POSTGRES_PASSWORD'],{encoding:'utf8'}).trim();c=new pg.Client({host:'127.0.0.1',port:54322,user:'postgres',password,database});await c.connect();
 for(const f of loadFixtureMigrations())await c.query(readFileSync(new URL('../../supabase/migrations/'+f,import.meta.url),'utf8'));
 await c.query(readFileSync(new URL('./candidate.sql',import.meta.url),'utf8'));
 await c.query("INSERT INTO tenant_memberships(user_id,tenant_id,role) VALUES($1,$2,'operasyon') ON CONFLICT(user_id,tenant_id) DO UPDATE SET role='operasyon'",[id(12),id(1)]);
 await c.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:id(11),active_tenant_id:id(1),role:'authenticated'})]);
 const command=async(action,task=null,revision=null,input={})=>{await c.query('SET ROLE authenticated');try{return (await c.query('select * from task_execute_v1($1,$2,$3,$4,$5,$6)',[action,task,revision,input,id(1),id(11)])).rows[0];}finally{await c.query('RESET ROLE');}};
 const events=async()=> (await c.query('SELECT * FROM task_inbox_events ORDER BY created_at,id')).rows;
 let task;
 await t.test('no historical backfill; real command captures recipient without body copy',async()=>{
 assert.equal((await events()).length,0);
 task=await command('create',null,null,{title:'Synthetic assigned task',assigned_to_user_id:id(12)});
 const rows=await events();assert.equal(rows.length,1);assert.equal(rows[0].task_id,task.id);assert.equal(rows[0].recipient_id,id(12));assert.equal(rows[0].actor_id,id(11));assert.equal('title' in rows[0],false);
 });
 await t.test('same assignee edits and self assignment do not notify',async()=>{
 task=await command('update',task.id,task.revision,{title:'Revised synthetic title',assigned_to_user_id:id(12)});assert.equal((await events()).length,1);
 await command('create',null,null,{title:'Self',assigned_to_user_id:id(11)});assert.equal((await events()).length,1);
 const unassigned=await command('create',null,null,{title:'Claimable'});await command('claim',unassigned.id,unassigned.revision);assert.equal((await events()).length,1);
 });
 await t.test('reassignment produces one new event; stale command produces none',async()=>{
 task=await command('update',task.id,task.revision,{assigned_to_user_id:id(11)});
 const previous=task.revision;task=await command('update',task.id,task.revision,{assigned_to_user_id:id(12)});
 assert.equal((await events()).length,2);await assert.rejects(command('update',task.id,previous,{assigned_to_user_id:id(11)}));assert.equal((await events()).length,2);
 });
 await t.test('source rollback also rolls back notification',async()=>{
 await c.query('BEGIN');await command('create',null,null,{title:'Rollback',assigned_to_user_id:id(12)});assert.equal((await events()).length,3);await c.query('ROLLBACK');assert.equal((await events()).length,2);
 });
 await t.test('closed-task assignment is not a new actionable notification',async()=>{
 const closed=await command('create',null,null,{title:'Closing',assigned_to_user_id:id(11)});
 await command('update',closed.id,closed.revision,{assigned_to_user_id:id(12),status:'tamamlandi'});assert.equal((await events()).length,2);
 });
 await t.test('capture failure cannot silently commit the source task',async()=>{
 const before=(await c.query('select count(*)::int n from tasks')).rows[0].n;
 await c.query('ALTER TABLE task_inbox_events ADD CONSTRAINT synthetic_failure CHECK(false) NOT VALID');
 await assert.rejects(command('create',null,null,{title:'Must roll back',assigned_to_user_id:id(12)}),e=>e.code==='23514');
 await c.query('ALTER TABLE task_inbox_events DROP CONSTRAINT synthetic_failure');
 assert.equal((await c.query('select count(*)::int n from tasks')).rows[0].n,before);assert.equal((await events()).length,2);
 });
 await t.test('no client role can read, inject, or execute trigger directly',async()=>{
 for(const role of ['anon','authenticated','service_role']){await c.query('SET ROLE '+role);await assert.rejects(c.query('SELECT * FROM task_inbox_events'),e=>e.code==='42501');await assert.rejects(c.query('DELETE FROM task_inbox_events'),e=>e.code==='42501');await assert.rejects(c.query('INSERT INTO task_inbox_events DEFAULT VALUES'),e=>e.code==='42501');await assert.rejects(c.query('SELECT task_inbox_capture_v1()'),e=>e.code==='42501');await c.query('RESET ROLE');}
 });
 await t.test('source deletion cascades without orphan events',async()=>{await c.query('DELETE FROM tasks WHERE id=$1',[task.id]);assert.equal((await events()).length,0);});
 } finally {if(c)await c.end();admin(`DROP DATABASE ${database} WITH (FORCE);`);}
});
