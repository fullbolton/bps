import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {entry,render} from './start-shift-fix.mjs';
import {historicalOperationsSql} from './helpers/operations-function-history.mjs';
import {fixture,active,verified,actualFunction} from './fixtures/security-boundary-database.mjs';
const {Client}=createRequire(import.meta.url)('pg');
const url=new URL(process.env.BPS_MODULE_TEST_DATABASE_URL??'postgres://bps_module_test@127.0.0.1:55439/postgres');assert.ok(['127.0.0.1','localhost','[::1]'].includes(url.hostname));
const name=`bps_start_shift_${process.pid}_${Date.now()}`,id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;let admin,db,created=false,target;
before(async()=>{
 admin=new Client({connectionString:url.href});await admin.connect();await admin.query(`CREATE DATABASE ${name}`);created=true;target=new URL(url);target.pathname='/'+name;db=new Client({connectionString:target.href,query_timeout:5000});await db.connect();await db.query(fixture+active+verified);await db.query(actualFunction('20260926000100_multi_workspace_cutover.sql','current_user_role'));
 await db.query(`CREATE TABLE profiles(id uuid,role text);INSERT INTO profiles VALUES('${id(11)}','yonetici');
 CREATE TABLE ops_commands(tenant_id uuid,actor_id uuid,id uuid,kind text,payload jsonb,result jsonb,PRIMARY KEY(tenant_id,actor_id,id));
 CREATE TABLE ops_daily_requests(id uuid,tenant_id uuid,lifecycle text,work_date date,shift_start time);
 CREATE TABLE ops_workers(id uuid,tenant_id uuid);
 CREATE TABLE ops_assignments(id uuid,tenant_id uuid,request_id uuid,worker_id uuid,work_date date,removed_at timestamptz,attendance text,attendance_revision integer,attendance_recorded_at timestamptz,attendance_recorded_by uuid,occupied_range tsrange,created_at timestamptz);
 CREATE TABLE ops_start_plans(assignment_id uuid PRIMARY KEY,tenant_id uuid,start_at timestamptz,responsible_id uuid,offsets integer[],revision integer,plan_version integer DEFAULT 1,planned_at timestamptz,confirmed_at timestamptz,confirmation_source text,witness text,claimed_by uuid,claim_until timestamptz);
 CREATE TABLE ops_start_events(id uuid,tenant_id uuid,assignment_id uuid,actor_id uuid,revision integer,plan_version integer,kind text,payload jsonb,occurred_at timestamptz);
 CREATE TABLE ops_events(tenant_id uuid,actor_id uuid,command_id uuid,kind text,entity_id uuid);
 INSERT INTO ops_daily_requests VALUES('${id(50)}','${id(1)}','active','2026-01-01','08:00');INSERT INTO ops_workers VALUES('${id(51)}','${id(1)}');
 INSERT INTO ops_assignments VALUES('${id(52)}','${id(1)}','${id(50)}','${id(51)}','2026-01-01',NULL,'unreported',0,NULL,NULL,'[2026-01-01 08:00,2026-01-01 12:00)','2025-12-31 00:00Z');
 INSERT INTO ops_start_plans VALUES('${id(52)}','${id(1)}','2026-01-01 08:00+03','${id(11)}',ARRAY[-30],1,1,'2025-12-31 00:00Z',NULL,NULL,NULL,NULL,NULL);`);
 await db.query(entry.baseDeclaration);await db.query(historicalOperationsSql([entry.signature]));assert.equal((await db.query('SELECT prosrc FROM pg_proc WHERE oid=$1::regprocedure',[entry.signature])).rows[0].prosrc,entry.body);
 await db.query(`REVOKE ALL ON FUNCTION ${entry.signature} FROM PUBLIC,anon;GRANT EXECUTE ON FUNCTION ${entry.signature} TO authenticated`);
 // Reproduce the real pre-fix failure for disjoint shifts before replacing it.
 await run(async()=>{await addOther('[2026-01-01 14:00,2026-01-01 18:00)');await auth();await assert.rejects(confirm(),e=>e.message==='START_ATTENDANCE_CONFLICT');});
 await db.query(render());
});
after(async()=>{if(db)await db.end();if(admin){if(created)await admin.query(`DROP DATABASE ${name} WITH(FORCE)`);await admin.end();}});
async function run(fn){await db.query('BEGIN');try{await db.query('RESET ROLE');await fn();}finally{await db.query('ROLLBACK');}}
async function auth(c=db){await c.query("SELECT set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:id(11),active_tenant_id:id(1)})]);await c.query('SET ROLE authenticated');}
const confirm=(at='2026-01-01T08:00:00+03:00',c=db,command=60)=>c.query('SELECT ops_start_execute($1,$2,$3,$4,1,$5,$6) v',[id(11),id(1),id(command),id(52),'confirm',{occurredAt:at,source:'branch',witness:'Synthetic branch'}]);
const addOther=range=>db.query(`INSERT INTO ops_assignments SELECT $1,tenant_id,request_id,worker_id,work_date,NULL,'present',1,NULL,NULL,$2::tsrange,created_at FROM ops_assignments WHERE id=$3`,[id(53),range,id(52)]);
test('two separate shifts and adjacent shifts can both be confirmed on the same date',async()=>{
 for(const range of ['[2026-01-01 14:00,2026-01-01 18:00)','[2026-01-01 12:00,2026-01-01 14:00)'])await run(async()=>{await addOther(range);await auth();await confirm();await db.query('RESET ROLE');assert.equal((await db.query('SELECT attendance FROM ops_assignments WHERE id=$1',[id(52)])).rows[0].attendance,'present');});
});
test('overnight confirmation and extra call work after midnight until the exclusive shift end',()=>run(async()=>{
 await db.query("UPDATE ops_assignments SET occupied_range='[2026-01-01 23:30,2026-01-02 07:30)'");await db.query("UPDATE ops_start_plans SET start_at='2026-01-01 23:30+03'");await auth();
 await confirm('2026-01-02T00:15:00+03:00');
 await db.query('RESET ROLE');assert.equal((await db.query('SELECT confirmed_at FROM ops_start_plans')).rows[0].confirmed_at.toISOString(),'2026-01-01T21:15:00.000Z');
}));
test('manual call after midnight remains available for a night shift',()=>run(async()=>{
 await db.query("UPDATE ops_assignments SET occupied_range='[2026-01-01 23:30,2026-01-02 07:30)'");await auth();
 await db.query('SELECT ops_start_execute($1,$2,$3,$4,1,$5,$6)',[id(11),id(1),id(60),id(52),'call',{occurredAt:'2026-01-02T00:15:00+03:00',offset:0,outcome:'on_way'}]);
}));
test('end boundary, earlier date, future timestamps, absent and overlapping attendance stay rejected',async()=>{
 for(const scenario of ['end','previous','future','absent','overlap','removedPresent','nullRange'])await run(async()=>{
  let at='2026-01-01T08:00:00+03:00',error='START_ATTENDANCE_CONFLICT';
  if(scenario==='end'){at='2026-01-01T12:00:00+03:00';error='START_TIME';}
  if(scenario==='previous')at='2025-12-31T23:59:00+03:00';
  if(scenario==='future'){at='2099-01-01T08:00:00+03:00';error='START_TIME';}
  if(scenario==='absent')await db.query("UPDATE ops_assignments SET attendance='absent'");
  if(['overlap','removedPresent'].includes(scenario)){await addOther('[2026-01-01 11:00,2026-01-01 13:00)');if(scenario==='removedPresent')await db.query('UPDATE ops_assignments SET removed_at=now() WHERE id=$1',[id(53)]);}
  if(scenario==='nullRange'){await db.query('UPDATE ops_assignments SET occupied_range=NULL');error='START_TIME';}
  await auth();await assert.rejects(confirm(at),e=>e.message===error);
 });
});
test('early arrival on work date and legacy full-day assignments remain supported',async()=>{
 for(const legacy of [false,true])await run(async()=>{if(legacy)await db.query("UPDATE ops_assignments SET occupied_range='[2026-01-01 00:00,2026-01-02 00:00)'");await auth();await confirm('2026-01-01T07:45:00+03:00');});
});
test('closed assignment rejects new command but accepted retry remains idempotent',()=>run(async()=>{
 await auth();const first=(await confirm()).rows[0].v;await db.query('RESET ROLE');await db.query('UPDATE ops_assignments SET removed_at=now()');await auth();assert.deepEqual((await confirm()).rows[0].v,first);await assert.rejects(confirm('2026-01-01T08:00:00+03:00',db,61),e=>e.message==='START_CLOSED');
}));
test('concurrent confirmation observes an overlapping committed attendance after the worker lock',async()=>{
 const waiter=new Client({connectionString:target.href,query_timeout:5000});await waiter.connect();
 try{
  await db.query('BEGIN');await db.query('RESET ROLE');await db.query('SELECT FROM ops_workers WHERE id=$1 FOR UPDATE',[id(51)]);
  await addOther('[2026-01-01 11:00,2026-01-01 13:00)');await auth(waiter);
  const pending=confirm('2026-01-01T08:00:00+03:00',waiter).then(()=>null,e=>e);let waiting=false;
  for(let i=0;i<100;i++){if((await admin.query('SELECT wait_event_type FROM pg_stat_activity WHERE pid=$1',[waiter.processID])).rows[0]?.wait_event_type==='Lock'){waiting=true;break;}await new Promise(r=>setTimeout(r,10));}
  assert.ok(waiting);await db.query('COMMIT');assert.equal((await pending).message,'START_ATTENDANCE_CONFLICT');
  assert.equal((await db.query('SELECT count(*)::int n FROM ops_start_events')).rows[0].n,0);
  assert.equal((await db.query('SELECT count(*)::int n FROM ops_commands')).rows[0].n,0);
 }finally{await db.query('ROLLBACK');await db.query('DELETE FROM ops_assignments WHERE id=$1',[id(53)]);await waiter.end();}
});
