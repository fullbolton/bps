import {loadFixtureMigrations} from '../module-change-command-20261017/fixture-migrations.mjs';
import test from 'node:test';import assert from 'node:assert/strict';import {execFileSync} from 'node:child_process';import {readFileSync} from 'node:fs';import {createRequire} from 'node:module';const pg=createRequire(import.meta.url)('pg');
const container='supabase_db_bps-supabase-acceptance',database=`bps_task_inbox_read_${process.pid}`;
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const admin=sql=>execFileSync('docker',['exec','-i',container,'psql','-XqAt','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1'],{input:sql,encoding:'utf8',timeout:20000});
test('scoped task notification reader and acknowledgement',async t=>{
 admin(`CREATE DATABASE ${database} TEMPLATE bps_module_chain_20261005;`);let c;
 try {
 const password=execFileSync('docker',['exec',container,'printenv','POSTGRES_PASSWORD'],{encoding:'utf8'}).trim();c=new pg.Client({host:'127.0.0.1',port:54322,user:'postgres',password,database});await c.connect();
 for(const f of loadFixtureMigrations())await c.query(readFileSync(new URL('../../supabase/migrations/'+f,import.meta.url),'utf8'));
 for(const f of ['candidate.sql','read-candidate.sql'])await c.query(readFileSync(new URL(f,import.meta.url),'utf8'));
 await c.query("INSERT INTO tenant_memberships(user_id,tenant_id,role) VALUES($1,$2,'operasyon') ON CONFLICT(user_id,tenant_id) DO UPDATE SET role='operasyon'",[id(12),id(1)]);
 const login=async(actor)=>{await c.query('RESET ROLE');await c.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:id(actor),role:'authenticated'})]);
 const member=(await c.query('select version from tenant_memberships where user_id=$1 and tenant_id=$2',[id(actor),id(1)])).rows[0].version;
 const selected=(await c.query('select version from workspace_selections where user_id=$1',[id(actor)])).rows[0]?.version??null;
 const choice=(await c.query('select select_workspace($1,$2,gen_random_uuid(),$3) v',[id(1),member,selected])).rows[0].v;
 await c.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:id(actor),active_tenant_id:id(1),role:'authenticated',workspace_membership_version:choice.membershipVersion,workspace_selection_version:choice.selectionVersion})]);await c.query('SET ROLE authenticated');};
 const task=async(input,action='create',row=null)=>{await login(11);return (await c.query('select * from task_execute_v1($1,$2,$3,$4,$5,$6)',[action,row?.id??null,row?.revision??null,input,id(1),id(11)])).rows[0];};
 const read=async(before=null,actor=id(12),tenant=id(1))=>(await c.query('select task_inbox_page_v1($1,$2,$3) v',[actor,tenant,before])).rows[0].v;
 const mark=async(event,actor=id(12),tenant=id(1))=>(await c.query('select task_inbox_read_v1($1,$2,$3) v',[actor,tenant,event])).rows[0].v;
 let rows=[];for(let i=0;i<32;i++) rows.push(await task({title:'Synthetic '+i,assigned_to_user_id:id(12)}));await login(12);
 let page;
 await t.test('recipient gets 30 then 2, stable cursor and global unread',async()=>{page=await read();assert.equal(page.items.length,30);assert.equal(page.unread,32);const next=await read(page.nextCursor);assert.equal(next.items.length,2);assert.equal(next.unread,32);assert.equal(next.nextCursor,null);assert.equal(new Set([...page.items,...next.items].map(x=>x.id)).size,32);});
 await t.test('read is idempotent and never completes source task',async()=>{const event=page.items[0];assert.equal(await mark(event.id),true);const once=(await read()).items.find(x=>x.id===event.id).read_at;assert.equal(await mark(event.id),true);const twice=await read();assert.equal(twice.unread,31);assert.equal(twice.items.find(x=>x.id===event.id).read_at,once);assert.equal((await c.query('select status from tasks where id=$1',[event.task_id])).rows[0].status,'acik');});
 await t.test('foreign actor/tenant/cursor/read rejected and manager cannot read recipient inbox',async()=>{await assert.rejects(read(null,id(11)),e=>e.code==='42501');await assert.rejects(read(null,id(12),id(2)));await assert.rejects(read(id(999)),e=>e.code==='42501');await login(11);assert.equal((await read(null,id(11))).items.length,0);await assert.rejects(mark(page.items[0].id,id(11)),e=>e.code==='42501');await login(12);});
 await t.test('title update keeps notification; reassignment back keeps only latest; completion hides it',async()=>{
 let row=rows[0];row=await task({title:'Changed title'},'update',row);await login(12);let all=[...(await read()).items,...(await read((await read()).nextCursor)).items];assert.equal(all.find(e=>e.task_id===row.id).title,'Changed title');
 row=await task({assigned_to_user_id:id(11)},'update',row);row=await task({assigned_to_user_id:id(12)},'update',row);await login(12);let first=await read();all=[...first.items,...(await read(first.nextCursor)).items];assert.equal(all.filter(e=>e.task_id===row.id).length,1);const event=all.find(e=>e.task_id===row.id);
 row=await task({status:'tamamlandi'},'update',row);await login(12);assert.equal((await read()).unread,30);await assert.rejects(mark(event.id),e=>e.code==='42501');
 });
 await t.test('live membership role downgrade denies stale session; IK retains task access',async()=>{await c.query('RESET ROLE');await c.query('BEGIN');await c.query("UPDATE tasks SET status='tamamlandi' WHERE tenant_id=$1 AND assigned_to_user_id=$2",[id(1),id(12)]);await c.query("UPDATE tenant_memberships SET role='muhasebe' WHERE user_id=$1 AND tenant_id=$2",[id(12),id(1)]);await c.query('SET LOCAL ROLE authenticated');await assert.rejects(read());await c.query('ROLLBACK');await c.query("UPDATE tenant_memberships SET role='ik' WHERE user_id=$1 AND tenant_id=$2",[id(12),id(1)]);await login(12);assert.ok((await read()).items.length);});
 await t.test('module disabled hides count and rejects mark; no direct table or helper access',async()=>{await c.query('RESET ROLE');await c.query('BEGIN');await c.query("UPDATE tenant_module_settings SET enabled=false WHERE tenant_id=$1 AND module_key='tasks'",[id(1)]);await c.query('SET LOCAL ROLE authenticated');assert.equal((await read()).unread,0);assert.equal((await read()).items.length,0);await assert.rejects(mark(page.items[0].id));await c.query('ROLLBACK');await login(12);await assert.rejects(c.query('select * from task_inbox_events'),e=>e.code==='42501');await assert.rejects(c.query('select * from task_inbox_visible_v1($1,$2)',[id(12),id(1)]),e=>e.code==='42501');});
 await t.test('acknowledgement waiting on task lock rechecks committed completion',async()=>{
 await login(12);const event=(await read()).items.find(x=>x.read_at===null);assert.ok(event);const pid=(await c.query('select pg_backend_pid() pid')).rows[0].pid;
 const other=new pg.Client({host:'127.0.0.1',port:54322,user:'postgres',password,database});await other.connect();let pending;
 try {await other.query('BEGIN');await other.query("UPDATE tasks SET status='tamamlandi' WHERE id=$1",[event.task_id]);
 pending=mark(event.id).then(value=>({value}),error=>({error}));
 let waiting=false;for(let i=0;i<100;i++){const state=(await other.query('select wait_event_type from pg_stat_activity where pid=$1',[pid])).rows[0];if(state?.wait_event_type==='Lock'){waiting=true;break;}await new Promise(r=>setTimeout(r,10));}
 assert.equal(waiting,true);await other.query('COMMIT');const result=await pending;assert.equal(result.error?.code,'42501');
 assert.equal((await other.query('select read_at from task_inbox_events where id=$1',[event.id])).rows[0].read_at,null);
 }finally{await other.query('ROLLBACK');if(pending)await pending;await other.end();}
 });
 await t.test('anonymous and service cannot call inbox RPCs',async()=>{for(const role of ['anon','service_role']){await c.query('RESET ROLE');await c.query('SET ROLE '+role);await assert.rejects(read(),e=>e.code==='42501');await assert.rejects(mark(page.items[0].id),e=>e.code==='42501');}});
 }finally {if(c)await c.end();admin(`DROP DATABASE ${database} WITH (FORCE);`);}
});
