import {loadFixtureMigrations} from '../module-change-command-20261017/fixture-migrations.mjs';
import test from 'node:test';import assert from 'node:assert/strict';import {execFileSync} from 'node:child_process';import {readFileSync} from 'node:fs';import {createRequire} from 'node:module';const pg=createRequire(import.meta.url)('pg');
const container='supabase_db_bps-supabase-acceptance',database=`bps_unified_inbox_${process.pid}`;
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const admin=sql=>execFileSync('docker',['exec','-i',container,'psql','-XqAt','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1'],{input:sql,encoding:'utf8',timeout:20000});
test('unified inbox source and identity boundaries',async t=>{
 admin(`CREATE DATABASE ${database} TEMPLATE bps_module_chain_20261005;`);let c;
 try {
 const password=execFileSync('docker',['exec',container,'printenv','POSTGRES_PASSWORD'],{encoding:'utf8'}).trim();c=new pg.Client({host:'127.0.0.1',port:54322,user:'postgres',password,database});await c.connect();
 for(const f of loadFixtureMigrations())await c.query(readFileSync(new URL('../../supabase/migrations/'+f,import.meta.url),'utf8'));
 for(const f of ['../task-inbox-20261018/candidate.sql','../task-inbox-20261018/read-candidate.sql','../announcement-inbox-20261018/candidate.sql','candidate.sql'])await c.query(readFileSync(new URL(f,import.meta.url),'utf8'));
 await c.query("INSERT INTO tenant_memberships(user_id,tenant_id,role) VALUES($1,$2,'operasyon') ON CONFLICT(user_id,tenant_id) DO UPDATE SET role='operasyon'",[id(12),id(1)]);
 const login=async(actor)=>{await c.query('RESET ROLE');await c.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:id(actor),role:'authenticated'})]);
 const member=(await c.query('select version from tenant_memberships where user_id=$1 and tenant_id=$2',[id(actor),id(1)])).rows[0].version;
 const selected=(await c.query('select version from workspace_selections where user_id=$1',[id(actor)])).rows[0]?.version??null;
 const choice=(await c.query('select select_workspace($1,$2,gen_random_uuid(),$3) v',[id(1),member,selected])).rows[0].v;
 await c.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:id(actor),active_tenant_id:id(1),role:'authenticated',workspace_membership_version:choice.membershipVersion,workspace_selection_version:choice.selectionVersion})]);await c.query('SET ROLE authenticated');};
 const read=async(cursor=null,actor=id(12),tenant=id(1))=>(await c.query('select workspace_inbox_page_v1($1,$2,$3,$4) v',[actor,tenant,cursor?.kind??null,cursor?.id??null])).rows[0].v;
 const mark=async(kind,event)=>(await c.query('select workspace_inbox_read_v1($1,$2,$3,$4) v',[id(12),id(1),kind,event])).rows[0].v;
 await c.query('RESET ROLE');await c.query("INSERT INTO ops_locations(id,tenant_id,company_id,name,city) VALUES($1,$2,$3,'Synthetic','Test')",[id(800),id(1),id(80)]);
 await c.query("INSERT INTO ops_daily_requests(id,tenant_id,company_id,location_id,work_date,service_line,position,required_count,created_by) VALUES($1,$2,$3,$4,'2026-10-18','Test','Test',1,$5)",[id(801),id(1),id(80),id(800),id(11)]);
 await login(11);
 for(let i=0;i<12;i++){
 await c.query("select * from task_execute_v1('create',null,null,$1,$2,$3)",[{title:'Task '+i,assigned_to_user_id:id(12)},id(1),id(11)]);
 await c.query("select * from announcement_execute_v1('create',null,$1,$2)",[id(1),'Announcement '+i]);
 await c.query('select ops_comment_send($1,$2,$3,$4,$5,null,$6)',[id(11),id(1),id(900+i),id(801),'Message '+i,[id(12)]]);
 }
 await login(12);let first;
 await t.test('three sources share one global 30+6 page and unread count',async()=>{first=await read();assert.equal(first.unread,36);assert.equal(first.items.length,30);const next=await read(first.nextCursor);assert.equal(next.items.length,6);assert.equal(next.nextCursor,null);assert.equal(next.unread,36);assert.equal(new Set([...first.items,...next.items].map(x=>x.kind+':'+x.id)).size,36);assert.deepEqual([...new Set(first.items.map(x=>x.kind))].sort(),['announcement','conversation','task_assignment']);});
 await t.test('each kind dispatches acknowledgement only to its own source',async()=>{for(const kind of ['task_assignment','announcement','conversation']){const row=first.items.find(x=>x.kind===kind);assert.equal(await mark(kind,row.id),true);assert.equal(await mark(kind,row.id),true);}assert.equal((await read()).unread,33);await assert.rejects(mark('unknown',first.items[0].id),e=>e.code==='22023');});
 await t.test('type-qualified identity preserves identical UUID/timestamp across sources',async()=>{
 await c.query('RESET ROLE');await c.query("UPDATE task_inbox_events SET id=$1,created_at='2026-10-19T00:00:00Z' WHERE id=(SELECT id FROM task_inbox_events ORDER BY id LIMIT 1)",[id(999)]);
 await c.query("UPDATE announcement_inbox_events SET id=$1,created_at='2026-10-19T00:00:00Z' WHERE id=(SELECT id FROM announcement_inbox_events ORDER BY id LIMIT 1)",[id(999)]);await login(12);
 const page=await read();assert.equal(page.items.filter(x=>x.id===id(999)).length,2);const a=page.items[0];const after=await read({kind:a.kind,id:a.id});assert.ok(after.items.some(x=>x.id===id(999)&&x.kind!==a.kind));
 });
 await t.test('IK sees tasks and announcements but never conversation body',async()=>{await c.query('RESET ROLE');await c.query("UPDATE tenant_memberships SET role='ik' WHERE user_id=$1 AND tenant_id=$2",[id(12),id(1)]);await login(12);const page=await read();assert.equal(page.items.length,24);assert.ok(page.items.every(x=>x.kind!=='conversation'));await assert.rejects(mark('conversation',first.items.find(x=>x.kind==='conversation').id));});
 await t.test('accounting sees only announcements after open tasks transferred',async()=>{await c.query('RESET ROLE');await c.query("UPDATE tasks SET assigned_to_user_id=$1 WHERE tenant_id=$2",[id(11),id(1)]);await c.query("UPDATE tenant_memberships SET role='muhasebe' WHERE user_id=$1 AND tenant_id=$2",[id(12),id(1)]);await login(12);const page=await read();assert.equal(page.items.length,12);assert.ok(page.items.every(x=>x.kind==='announcement'));});
 await t.test('disabled source empties list/count and rejects source cursor; bad scopes denied',async()=>{
 const cursor=(await read()).items[0];await c.query('RESET ROLE');await c.query('BEGIN');await c.query("UPDATE tenant_module_settings SET enabled=false WHERE tenant_id=$1 AND module_key='announcements'",[id(1)]);await c.query('SET LOCAL ROLE authenticated');const page=await read();assert.equal(page.items.length,0);assert.equal(page.unread,0);await assert.rejects(read({kind:cursor.kind,id:cursor.id}),e=>e.code==='42501');await c.query('ROLLBACK');await login(12);await assert.rejects(read(null,id(11)),e=>e.code==='42501');await assert.rejects(read(null,id(12),id(2)),e=>e.code==='42501');await assert.rejects(read({kind:'announcement'}),e=>e.code==='22023');
 });
 await t.test('one disabled source does not suppress other allowed sources; no partial success on a broken source',async()=>{
 await c.query('RESET ROLE');await c.query("UPDATE tenant_memberships SET role='operasyon' WHERE user_id=$1 AND tenant_id=$2",[id(12),id(1)]);await login(12);
 await c.query('RESET ROLE');await c.query('BEGIN');await c.query("UPDATE tenant_module_settings SET enabled=false WHERE tenant_id=$1 AND module_key='staffing'",[id(1)]);await c.query('SET LOCAL ROLE authenticated');const page=await read();assert.equal(page.items.length,12);assert.ok(page.items.every(x=>x.kind==='announcement'));await c.query('ROLLBACK');await login(12);
 await c.query('RESET ROLE');await c.query('BEGIN');await c.query('ALTER TABLE announcement_inbox_events RENAME TO synthetic_unavailable_events');await c.query('SET LOCAL ROLE authenticated');await assert.rejects(read(),e=>e.code==='42P01');await c.query('ROLLBACK');await login(12);assert.equal((await read()).items.length,24);
 });
 await t.test('private helper, anonymous and service access are closed',async()=>{await assert.rejects(c.query('select * from workspace_inbox_visible_v1($1,$2)',[id(12),id(1)]),e=>e.code==='42501');for(const role of ['anon','service_role']){await c.query('RESET ROLE');await c.query('SET ROLE '+role);await assert.rejects(read(),e=>e.code==='42501');await assert.rejects(mark('announcement',id(999)),e=>e.code==='42501');}});
 }finally{if(c)await c.end();admin(`DROP DATABASE ${database} WITH (FORCE);`);}
});
