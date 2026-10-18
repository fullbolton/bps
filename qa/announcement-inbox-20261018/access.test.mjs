import {loadFixtureMigrations} from '../module-change-command-20261017/fixture-migrations.mjs';
import test from 'node:test';import assert from 'node:assert/strict';import {execFileSync} from 'node:child_process';import {readFileSync} from 'node:fs';import {createRequire} from 'node:module';const pg=createRequire(import.meta.url)('pg');
const container='supabase_db_bps-supabase-acceptance',database=`bps_announcement_inbox_${process.pid}`;
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const admin=sql=>execFileSync('docker',['exec','-i',container,'psql','-XqAt','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1'],{input:sql,encoding:'utf8',timeout:20000});
test('announcement inbox on complete local schema',async t=>{
 admin(`CREATE DATABASE ${database} TEMPLATE bps_module_chain_20261005;`);let c;
 try {
 const password=execFileSync('docker',['exec',container,'printenv','POSTGRES_PASSWORD'],{encoding:'utf8'}).trim();c=new pg.Client({host:'127.0.0.1',port:54322,user:'postgres',password,database});await c.connect();
 for(const f of loadFixtureMigrations())await c.query(readFileSync(new URL('../../supabase/migrations/'+f,import.meta.url),'utf8'));
 await c.query("INSERT INTO tenant_memberships(user_id,tenant_id,role) VALUES($1,$2,'operasyon') ON CONFLICT(user_id,tenant_id) DO UPDATE SET role='operasyon'",[id(12),id(1)]);
 const login=async(actor)=>{await c.query('RESET ROLE');await c.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:id(actor),role:'authenticated'})]);
 const member=(await c.query('select version from tenant_memberships where user_id=$1 and tenant_id=$2',[id(actor),id(1)])).rows[0].version;
 const selected=(await c.query('select version from workspace_selections where user_id=$1',[id(actor)])).rows[0]?.version??null;
 const choice=(await c.query('select select_workspace($1,$2,gen_random_uuid(),$3) v',[id(1),member,selected])).rows[0].v;
 await c.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:id(actor),active_tenant_id:id(1),role:'authenticated',workspace_membership_version:choice.membershipVersion,workspace_selection_version:choice.selectionVersion})]);await c.query('SET ROLE authenticated');};
 const publish=async(body='Synthetic announcement')=>{await login(11);return (await c.query("select * from announcement_execute_v1('create',null,$1,$2)",[id(1),body])).rows[0];};
 const read=async(before=null,actor=id(12),tenant=id(1))=>(await c.query('select announcement_inbox_page_v1($1,$2,$3) v',[actor,tenant,before])).rows[0].v;
 const mark=async(event,actor=id(12),tenant=id(1))=>(await c.query('select announcement_inbox_read_v1($1,$2,$3) v',[actor,tenant,event])).rows[0].v;
 let source,event;
 await t.test('future publication snapshots current recipients, never writer or other tenant',async()=>{
 await c.query('RESET ROLE');assert.equal((await c.query('select count(*)::int n from announcement_inbox_events')).rows[0].n,0);
 source=await publish();await login(11);assert.equal((await read(null,id(11))).items.length,0);await login(12);const result=await read();assert.equal(result.items.length,1);event=result.items[0];assert.equal(event.body,'Synthetic announcement');assert.equal(event.announcement_id,source.id);
 await c.query('RESET ROLE');assert.equal((await c.query('select count(*)::int n from announcement_inbox_events where tenant_id<>$1',[id(1)])).rows[0].n,0);
 });
 await t.test('mark is private and idempotent without altering announcement',async()=>{await login(12);assert.equal(await mark(event.id),true);const first=(await read()).items[0].read_at;assert.equal(await mark(event.id),true);assert.equal((await read()).items[0].read_at,first);assert.equal((await read()).unread,0);await login(11);await assert.rejects(mark(event.id,id(11)),e=>e.code==='42501');assert.equal((await c.query('select body from announcements where id=$1',[source.id])).rows[0].body,'Synthetic announcement');});
 await t.test('new membership gets no earlier publication delivery',async()=>{
 await c.query('RESET ROLE');await c.query('DELETE FROM tenant_memberships WHERE user_id=$1 AND tenant_id=$2',[id(12),id(1)]);
 const later=await publish('Before joining');await c.query('RESET ROLE');await c.query("INSERT INTO tenant_memberships(user_id,tenant_id,role) VALUES($1,$2,'goruntuleyici')",[id(12),id(1)]);await login(12);
 assert.ok(!(await read()).items.some(x=>x.announcement_id===later.id));assert.ok((await read()).items.some(x=>x.announcement_id===source.id));
 });
 await t.test('removed membership denies stale session; current viewer and accounting roles can read',async()=>{
 await c.query('RESET ROLE');await c.query('BEGIN');await c.query('DELETE FROM tenant_memberships WHERE user_id=$1 AND tenant_id=$2',[id(12),id(1)]);await c.query('SET LOCAL ROLE authenticated');await assert.rejects(read(),e=>e.code==='42501');await c.query('ROLLBACK');
 await c.query("UPDATE tenant_memberships SET role='muhasebe' WHERE user_id=$1 AND tenant_id=$2",[id(12),id(1)]);await login(12);assert.ok((await read()).items.length);
 });
 await t.test('foreign scopes, invalid cursor, disabled module and raw access fail closed',async()=>{
 await assert.rejects(read(null,id(11)),e=>e.code==='42501');await assert.rejects(read(null,id(12),id(2)),e=>e.code==='42501');await assert.rejects(read(id(999)),e=>e.code==='42501');
 await c.query('RESET ROLE');await c.query('BEGIN');await c.query("UPDATE tenant_module_settings SET enabled=false WHERE tenant_id=$1 AND module_key='announcements'",[id(1)]);await c.query('SET LOCAL ROLE authenticated');assert.equal((await read()).unread,0);assert.equal((await read()).items.length,0);await assert.rejects(mark(event.id));await c.query('ROLLBACK');await login(12);
 for(const sql of ['select * from announcement_inbox_events','delete from announcement_inbox_events','insert into announcement_inbox_events default values','select announcement_inbox_capture_v1()'])await assert.rejects(c.query(sql),e=>e.code==='42501');
 });
 await t.test('fanout failure rolls back publication',async()=>{
 await c.query('RESET ROLE');const before=(await c.query('select count(*)::int n from announcements')).rows[0].n;await c.query('ALTER TABLE announcement_inbox_events ADD CONSTRAINT synthetic_fail CHECK(false) NOT VALID');await assert.rejects(publish('Must roll back'),e=>e.code==='23514');await c.query('RESET ROLE');await c.query('ALTER TABLE announcement_inbox_events DROP CONSTRAINT synthetic_fail');assert.equal((await c.query('select count(*)::int n from announcements')).rows[0].n,before);
 });
 await t.test('32 notifications page without omission; source delete removes deliveries',async()=>{
 for(let i=0;i<31;i++)await publish('Page '+i);await login(12);const first=await read();assert.equal(first.items.length,30);const next=await read(first.nextCursor);assert.equal(next.items.length,2);assert.equal(next.nextCursor,null);assert.equal(new Set([...first.items,...next.items].map(x=>x.id)).size,32);
 await login(11);await c.query("select * from announcement_execute_v1('delete',$1,null,null)",[source.id]);await login(12);await assert.rejects(mark(event.id),e=>e.code==='42501');await c.query('RESET ROLE');assert.equal((await c.query('select count(*)::int n from announcement_inbox_events where announcement_id=$1',[source.id])).rows[0].n,0);
 });
 await t.test('acknowledgement waiting on source deletion rejects without resurrecting delivery',async()=>{
 await login(12);const target=(await read()).items.find(x=>x.read_at===null);assert.ok(target);
 const pid=(await c.query('select pg_backend_pid() pid')).rows[0].pid;
 const other=new pg.Client({host:'127.0.0.1',port:54322,user:'postgres',password,database});await other.connect();let pending;
 try {await other.query('BEGIN');await other.query('DELETE FROM announcements WHERE id=$1',[target.announcement_id]);
 pending=mark(target.id).then(value=>({value}),error=>({error}));
 let waiting=false;for(let i=0;i<100;i++){const state=(await other.query('select wait_event_type from pg_stat_activity where pid=$1',[pid])).rows[0];if(state?.wait_event_type==='Lock'){waiting=true;break;}await new Promise(r=>setTimeout(r,10));}
 assert.equal(waiting,true);await other.query('COMMIT');assert.equal((await pending).error?.code,'42501');assert.equal((await other.query('select count(*)::int n from announcement_inbox_events where id=$1',[target.id])).rows[0].n,0);
 }finally{await other.query('ROLLBACK');if(pending)await pending;await other.end();}
 });
 await t.test('anonymous and service cannot use RPCs',async()=>{for(const role of ['anon','service_role']){await c.query('RESET ROLE');await c.query('SET ROLE '+role);await assert.rejects(read(),e=>e.code==='42501');await assert.rejects(mark(event.id),e=>e.code==='42501');}});
 }finally{if(c)await c.end();admin(`DROP DATABASE ${database} WITH (FORCE);`);}
});
