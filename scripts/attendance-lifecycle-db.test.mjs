import {installModuleGuards,assertGuardsRetained} from './fixtures/hotfix-module-integration.mjs';
import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {entry,render} from './attendance-lifecycle-fix.mjs';
import {historicalOperationsSql} from './helpers/operations-function-history.mjs';
import {fixture,active,verified,actualFunction} from './fixtures/security-boundary-database.mjs';
const {Client}=createRequire(import.meta.url)('pg');
const url=new URL(process.env.BPS_MODULE_TEST_DATABASE_URL??'postgres://bps_module_test@127.0.0.1:55439/postgres');assert.ok(['127.0.0.1','localhost','[::1]'].includes(url.hostname));
const name=`bps_attendance_lifecycle_${process.pid}_${Date.now()}`,id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;let admin,db,target,created=false;
before(async()=>{
 admin=new Client({connectionString:url.href});await admin.connect();await admin.query(`CREATE DATABASE ${name}`);created=true;target=new URL(url);target.pathname='/'+name;db=new Client({connectionString:target.href,query_timeout:5000});await db.connect();await db.query(fixture+active+verified);await db.query(actualFunction('20260926000100_multi_workspace_cutover.sql','current_user_role'));
 await db.query(`CREATE TABLE profiles(id uuid);INSERT INTO profiles VALUES('${id(11)}');
 CREATE TABLE ops_commands(tenant_id uuid,actor_id uuid,id uuid,kind text,payload jsonb,result jsonb,PRIMARY KEY(tenant_id,actor_id,id));
 CREATE TABLE ops_daily_requests(id uuid,tenant_id uuid,lifecycle text);
 CREATE TABLE ops_workers(id uuid,tenant_id uuid);
 CREATE TABLE ops_assignments(id uuid,tenant_id uuid,request_id uuid,worker_id uuid,work_date date,removed_at timestamptz,attendance text,attendance_revision integer,attendance_recorded_at timestamptz,attendance_recorded_by uuid,occupied_range tstzrange);
 CREATE TABLE ops_events(tenant_id uuid,actor_id uuid,command_id uuid,kind text,entity_id uuid);
 INSERT INTO ops_daily_requests VALUES('${id(50)}','${id(1)}','active');INSERT INTO ops_workers VALUES('${id(51)}','${id(1)}');
 INSERT INTO ops_assignments VALUES('${id(52)}','${id(1)}','${id(50)}','${id(51)}','2026-01-01',NULL,'unreported',0,NULL,NULL,'[2026-01-01 08:00Z,2026-01-01 12:00Z)');`);
 await db.query(entry.baseDeclaration);await db.query(historicalOperationsSql([entry.signature]));
 assert.equal((await db.query('SELECT prosrc FROM pg_proc WHERE oid=$1::regprocedure',[entry.signature])).rows[0].prosrc,entry.body);
 await db.query(`REVOKE ALL ON FUNCTION ${entry.signature} FROM PUBLIC,anon,service_role;GRANT EXECUTE ON FUNCTION ${entry.signature} TO authenticated`);
 // Reproduce the stale-screen bug against the real historically patched original.
 await db.query('BEGIN');await db.query('UPDATE ops_assignments SET removed_at=now()');await auth();assert.equal((await record(db)).rows[0].v.status,'present');await db.query('ROLLBACK');
 await installModuleGuards(db,[entry.signature]);
 await db.query(render());
 await assertGuardsRetained(db,[entry.signature]);
});
after(async()=>{if(db)await db.end();if(admin){if(created)await admin.query(`DROP DATABASE ${name} WITH(FORCE)`);await admin.end();}});
async function run(fn){await db.query('BEGIN');try{await fn();}finally{await db.query('ROLLBACK');}}
async function auth(c=db){await c.query("SELECT set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:id(11),active_tenant_id:id(1)})]);await c.query('SET ROLE authenticated');}
const record=(c=db,command=60,status='present',rev=0,assignment=52)=>c.query('SELECT ops_record_attendance($1,$2,$3,$4,$5,$6) v',[id(11),id(1),id(command),id(assignment),rev,status]);
test('removed and cancelled assignments reject every new attendance state without receipts',async()=>{
 for(const closed of ['removed','cancelled'])for(const status of ['present','absent','unreported'])await run(async()=>{
  await db.query('RESET ROLE');await db.query(closed==='removed'?'UPDATE ops_assignments SET removed_at=now()':"UPDATE ops_daily_requests SET lifecycle='cancelled'");await auth();await db.query('SAVEPOINT rejected');await assert.rejects(record(db,60,status),e=>e.message==='OPS_ATTENDANCE_CLOSED');await db.query('ROLLBACK TO rejected');await db.query('RESET ROLE');assert.equal((await db.query('SELECT count(*)::integer n FROM ops_commands')).rows[0].n,0);assert.equal((await db.query('SELECT attendance_revision FROM ops_assignments')).rows[0].attendance_revision,0);
 });
});
test('active attendance works; retry of accepted command after removal returns receipt without new event',()=>run(async()=>{
 await db.query('RESET ROLE');await auth();const v=(await record()).rows[0].v;assert.equal(v.revision,1);await db.query('RESET ROLE');await db.query('UPDATE ops_assignments SET removed_at=now()');await auth();assert.deepEqual((await record()).rows[0].v,v);await db.query('RESET ROLE');assert.equal((await db.query('SELECT count(*)::integer n FROM ops_events')).rows[0].n,1);
}));
test('non-overlapping shifts remain allowed and overlap still rejects',()=>run(async()=>{
 await db.query('RESET ROLE');await db.query(`INSERT INTO ops_assignments SELECT '${id(53)}',tenant_id,request_id,worker_id,work_date,NULL,'unreported',0,NULL,NULL,'[2026-01-01 13:00Z,2026-01-01 17:00Z)' FROM ops_assignments WHERE id='${id(52)}'`);await auth();await record();await record(db,61,'present',0,53);await db.query('RESET ROLE');await db.query(`INSERT INTO ops_assignments SELECT '${id(54)}',tenant_id,request_id,worker_id,work_date,NULL,'unreported',0,NULL,NULL,occupied_range FROM ops_assignments WHERE id='${id(52)}'`);await auth();await assert.rejects(record(db,62,'present',0,54),e=>e.message==='OPS_ATTENDANCE_CONFLICT');
}));
test('waiting stale screen observes committed removal after acquiring request lock',async()=>{
 await db.query('RESET ROLE');const waiter=new Client({connectionString:target.href,query_timeout:5000});await waiter.connect();
 try{await db.query('BEGIN');await db.query(`SELECT FROM ops_daily_requests WHERE id='${id(50)}' FOR UPDATE`);await db.query(`UPDATE ops_assignments SET removed_at=now() WHERE id='${id(52)}'`);await auth(waiter);const pending=record(waiter).then(()=>null,e=>e);let waiting=false;
 for(let i=0;i<100;i++){if((await admin.query('SELECT wait_event_type FROM pg_stat_activity WHERE pid=$1',[waiter.processID])).rows[0]?.wait_event_type==='Lock'){waiting=true;break;}await new Promise(r=>setTimeout(r,10));}assert.ok(waiting);await db.query('COMMIT');assert.equal((await pending).message,'OPS_ATTENDANCE_CLOSED');assert.equal((await db.query('SELECT count(*)::integer n FROM ops_commands')).rows[0].n,0);
 }finally{await db.query('ROLLBACK');await db.query('UPDATE ops_assignments SET removed_at=NULL');await waiter.end();}
});
