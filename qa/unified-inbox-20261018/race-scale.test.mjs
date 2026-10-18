import {loadFixtureMigrations} from '../module-change-command-20261017/fixture-migrations.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {performance} from 'node:perf_hooks';
const pg=createRequire(import.meta.url)('pg');
const container='supabase_db_bps-supabase-acceptance',database=`bps_inbox_races_${process.pid}`;
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const admin=sql=>execFileSync('docker',['exec','-i',container,'psql','-XqAt','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1'],{input:sql,encoding:'utf8',timeout:20000});
test('inbox lock barriers and bounded page at history scale',async t=>{
 admin(`CREATE DATABASE ${database} TEMPLATE bps_module_chain_20261005;`);let c,other;
 try{
  const password=execFileSync('docker',['exec',container,'printenv','POSTGRES_PASSWORD'],{encoding:'utf8'}).trim();
  const options={host:'127.0.0.1',port:54322,user:'postgres',password,database};c=new pg.Client(options);other=new pg.Client(options);await c.connect();await other.connect();
  const migrations=loadFixtureMigrations();
  for(const f of migrations.filter(f=>f.slice(0,14)<'20261018000300'))await c.query(readFileSync(new URL('../../supabase/migrations/'+f,import.meta.url),'utf8'));
  await t.test('dependency drift aborts before creating a delivery table',async()=>{
   await c.query('BEGIN');
   try{
    await c.query("CREATE OR REPLACE FUNCTION public.current_workspace_modules_v1() RETURNS jsonb LANGUAGE sql AS $$ SELECT '{}'::jsonb $$");
    await assert.rejects(c.query(readFileSync(new URL('../../supabase/migrations/20261018000300_task_inbox_capture.sql',import.meta.url),'utf8')),e=>e.message.includes('INBOX_DEPENDENCY_DRIFT'));
   }finally{await c.query('ROLLBACK');}
   assert.equal((await c.query("select to_regclass('public.task_inbox_events') v")).rows[0].v,null);
  });
  for(const f of migrations.filter(f=>f.slice(0,14)>='20261018000300'))await c.query(readFileSync(new URL('../../supabase/migrations/'+f,import.meta.url),'utf8'));
  await c.query("INSERT INTO tenant_memberships(user_id,tenant_id,role) VALUES($1,$2,'operasyon') ON CONFLICT(user_id,tenant_id) DO UPDATE SET role='operasyon'",[id(12),id(1)]);
  async function login(actor){await c.query('RESET ROLE');await c.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:id(actor),role:'authenticated'})]);
   const member=(await c.query('select version from tenant_memberships where user_id=$1 and tenant_id=$2',[id(actor),id(1)])).rows[0].version;
   const selected=(await c.query('select version from workspace_selections where user_id=$1',[id(actor)])).rows[0]?.version??null;
   const choice=(await c.query('select select_workspace($1,$2,gen_random_uuid(),$3) v',[id(1),member,selected])).rows[0].v;
   await c.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:id(actor),active_tenant_id:id(1),role:'authenticated',workspace_membership_version:choice.membershipVersion,workspace_selection_version:choice.selectionVersion})]);await c.query('SET ROLE authenticated');}
  await login(11);
  await c.query("select * from task_execute_v1('create',null,null,$1,$2,$3)",[{title:'Synthetic race task',assigned_to_user_id:id(12)},id(1),id(11)]);
  await c.query("select * from announcement_execute_v1('create',null,$1,'Synthetic race announcement')",[id(1)]);
  const page=async()=>(await c.query('select workspace_inbox_page_v1($1,$2) v',[id(12),id(1)])).rows[0].v;
  const mark=async(e)=>c.query('select workspace_inbox_read_v1($1,$2,$3,$4)',[id(12),id(1),e.kind,e.id]);
  const pid=(await c.query('select pg_backend_pid() pid')).rows[0].pid;
  async function race(event,lock,change,expectedCode){
   let pending;
   try{await other.query('BEGIN');await other.query(lock,[id(1),id(12)].slice(0,lock.includes('$2')?2:1));
    pending=mark(event).then(value=>({value}),error=>({error}));
    let waiting=false;for(let i=0;i<150;i++){if((await other.query('select wait_event_type from pg_stat_activity where pid=$1',[pid])).rows[0]?.wait_event_type==='Lock'){waiting=true;break;}await new Promise(r=>setTimeout(r,10));}
    assert.equal(waiting,true,'ack must actually wait on the competing transaction');await change();await other.query('COMMIT');
    const result=await pending;assert.ok(result.error,'stale ack must fail');assert.equal(result.error.code,expectedCode);
    const table=event.kind==='task_assignment'?'task_inbox_events':'announcement_inbox_events';assert.equal((await other.query(`select read_at from ${table} where id=$1`,[event.id])).rows[0].read_at,null);
   }finally{await other.query('ROLLBACK');if(pending)await pending;}
  }
  for(const [kind,module] of [['task_assignment','tasks'],['announcement','announcements']]){
   await t.test(kind+' rechecks module after config lock',async()=>{
    await login(12);const e=(await page()).items.find(x=>x.kind===kind);assert.ok(e);
    await race(e,'SELECT 1 FROM tenant_module_config WHERE tenant_id=$1 FOR UPDATE',()=>other.query('UPDATE tenant_module_settings SET enabled=false WHERE tenant_id=$1 AND module_key=$2',[id(1),module]),'BM001');
    await other.query('UPDATE tenant_module_settings SET enabled=true WHERE tenant_id=$1 AND module_key=$2',[id(1),module]);
   });
   await t.test(kind+' rechecks membership version after profile lock',async()=>{
    await login(12);const e=(await page()).items.find(x=>x.kind===kind);assert.ok(e);
    await race(e,'SELECT 1 FROM profiles WHERE id=$2 AND $1::uuid IS NOT NULL FOR UPDATE',()=>other.query("UPDATE tenant_memberships SET role=CASE WHEN role='ik' THEN 'operasyon' ELSE 'ik' END WHERE user_id=$1 AND tenant_id=$2",[id(12),id(1)]),'42501');
   });
  }
  await t.test('10000 delivered announcements return an exact count and only 30 rows',async()=>{
   const start=performance.now();
   // Synthetic bulk source seed invokes the real delivery trigger; not a command throughput benchmark.
   await other.query("INSERT INTO announcements(tenant_id,created_by,body) SELECT $1,$2,'Synthetic scale '||g FROM generate_series(1,10000) g",[id(1),id(11)]);
   const insertMs=performance.now()-start;await other.query('ANALYZE announcement_inbox_events');await other.query('ANALYZE announcements');await login(12);
   const times=[];for(let i=0;i<5;i++){const a=performance.now();const result=await page();times.push(performance.now()-a);assert.equal(result.items.length,30);assert.equal(result.unread,10002);assert.ok(result.nextCursor);}
   writeFileSync(new URL('scale.json',import.meta.url),JSON.stringify({measuredAt:new Date().toISOString(),environment:'local disposable PostgreSQL; two current recipients including author; one delivery per announcement',sourceRowsAdded:10000,insertWithDeliveryTriggerMs:insertMs,pageMs:times,unread:10002,pageRows:30,limits:'Single connection, warm local DB, no production latency or high fan-out claim'},null,2)+'\n');
  });
 }finally{if(c)await c.end();if(other)await other.end();admin(`DROP DATABASE ${database} WITH (FORCE);`);}
});
