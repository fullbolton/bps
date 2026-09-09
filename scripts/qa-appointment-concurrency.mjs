// Disposable PostgreSQL. Real row-lock waits; never reads app environment keys.
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {randomUUID} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import assert from 'node:assert/strict';
import {baseline,id} from './fixtures/daily-operations.mjs';
const modulePath=process.env.BPS_EMBEDDED_PG_MODULE;
if(!modulePath?.startsWith('/'))throw Error('Absolute BPS_EMBEDDED_PG_MODULE required');
const {default:EmbeddedPostgres}=await import(pathToFileURL(modulePath).href);
const dir=await mkdtemp(join(tmpdir(),'bps-appointment-races-'));
const pg=new EmbeddedPostgres({databaseDir:join(dir,'db'),user:'postgres',password:randomUUID(),port:55441,persistent:false,postgresFlags:['-h','127.0.0.1','-k',dir],onLog:()=>{},onError:()=>{}});
const clients=[];let count=0;const pass=label=>{count++;console.log('PASS '+label);};
try {
  await pg.initialise();await pg.start();
  async function connect(){const c=pg.getPgClient('postgres','127.0.0.1');clients.push(c);await c.connect();await c.query("SET statement_timeout='8s'; SET idle_in_transaction_session_timeout='15s'");return c;}
  const monitor=await connect(),a=await connect(),b=await connect();
  await monitor.query(baseline);
  await monitor.query(`CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$ SELECT jsonb_build_object('app_metadata',jsonb_build_object('active_tenant',current_setting('test.tenant',true))) $$;`);
  for(const file of ['./fixtures/local-task-prefill.sql','./fixtures/local-appointments.sql','../supabase/migrations/20260909001300_task_assignment_history.sql','../supabase/migrations/20260909001400_appointment_completion.sql'])await monitor.query(await readFile(new URL(file,import.meta.url),'utf8'));
  // Include old body + revoked ACL to prove adopting the new endpoint never reopens it.
  for(const file of ['20260407001700_complete_appointment_atomic.sql','20260713000200_revoke_complete_appointment_atomic_execute.sql'])await monitor.query(await readFile(new URL('../supabase/migrations/'+file,import.meta.url),'utf8'));
  for(let n=60;n<=75;n++)await monitor.query('INSERT INTO appointments(id,tenant_id,company_id,meeting_date) VALUES($1,$2,$3,$4)',[id(n),id(n===64?2:1),id(n===63?22:n===64?21:20),'2026-09-09']);
  async function asUser(c,uid=10,tenant=1){await c.query('RESET ROLE');await c.query("SELECT set_config('test.user',$1,false),set_config('test.tenant',$2,false)",[id(uid),id(tenant)]);await c.query('SET ROLE authenticated');}
  await asUser(a);await asUser(b);
  const finish=(c,n,patch={})=>{const p={actor:id(10),tenant:id(1),result:'Sonuç',next:'Takip',task:true,...patch};return c.query('SELECT complete_appointment_scoped($1,$2,$3,$4,$5,$6) result',[p.actor,p.tenant,id(n),p.result,p.next,p.task]);};
  const first=(await finish(a,60)).rows[0].result;
  let task=(await a.query('SELECT * FROM tasks WHERE id=$1',[first.taskId])).rows[0];assert.equal(task.status,'acik');assert.equal(task.assigned_to_user_id,null);assert.equal(task.tenant_id,id(1));assert.equal(task.revision,'0');assert.equal(task.appointment_id,id(60));
  assert.equal((await a.query('SELECT kind FROM task_assignment_history WHERE task_id=$1',[first.taskId])).rows[0].kind,'created');pass('appointment and correctly scoped open task/history commit together');
  assert.deepEqual((await finish(a,60)).rows[0].result,first);assert.equal((await a.query('SELECT count(*)::int n FROM tasks WHERE appointment_id=$1',[id(60)])).rows[0].n,1);pass('identical retry returns original receipt without another task');
  await assert.rejects(()=>finish(a,60,{next:'Changed'}),/APPT_ALREADY_COMPLETED/);pass('changed retry cannot create another followup');
  await asUser(b,11);await assert.rejects(()=>finish(b,60,{actor:id(11)}),/APPT_ALREADY_COMPLETED/);await asUser(b);pass('other actor cannot claim prior completion receipt');
  await assert.rejects(()=>finish(a,61,{actor:id(11)}),/APPT_SCOPE_CHANGED/);await assert.rejects(()=>finish(a,61,{tenant:id(2)}),/APPT_SCOPE_CHANGED/);pass('expected actor and tenant are checked');
  await assert.rejects(()=>finish(a,64),/APPT_NOT_FOUND/);pass('other tenant appointment cannot be completed');
  await asUser(b,12);await assert.rejects(()=>finish(b,61,{actor:id(12)}),/APPT_FORBIDDEN/);await asUser(b,14);await assert.rejects(()=>finish(b,61,{actor:id(14)}),/APPT_SCOPE_CHANGED/);await asUser(b);pass('HR and stale claim are denied');
  await b.query('SET ROLE anon');await assert.rejects(()=>finish(b,61),e=>e.code==='42501');await asUser(b);
  assert.equal((await monitor.query("SELECT has_function_privilege('authenticated','public.complete_appointment_atomic(uuid,text,text,boolean)','EXECUTE') allowed")).rows[0].allowed,false);pass('anonymous denied and old unsafe RPC remains revoked');
  await assert.rejects(()=>a.query('SELECT * FROM appointment_completion_receipts'),e=>e.code==='42501');await assert.rejects(()=>a.query('DELETE FROM appointment_completion_receipts'),e=>e.code==='42501');pass('completion receipts are not directly accessible');
  const passive=(await finish(a,63)).rows[0].result;assert.equal(passive.taskId,null);assert.match(passive.taskSkippedReason,/pasif/);assert.equal((await a.query('SELECT status FROM appointments WHERE id=$1',[id(63)])).rows[0].status,'tamamlandi');pass('passive company appointment completes with explicit task skip');
  const noTask=(await finish(a,62,{task:false})).rows[0].result;assert.equal(noTask.taskId,null);assert.equal(noTask.taskSkippedReason,null);pass('no-task completion does not imply a skipped request');
  await monitor.query("CREATE FUNCTION fail_fixture_task() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.appointment_id='"+id(65)+"'::uuid THEN RAISE EXCEPTION 'test task failure'; END IF; RETURN NEW; END $$; CREATE TRIGGER fail_fixture_task BEFORE INSERT ON tasks FOR EACH ROW EXECUTE FUNCTION fail_fixture_task();");
  await assert.rejects(()=>finish(a,65),/test task failure/);assert.equal((await a.query('SELECT status FROM appointments WHERE id=$1',[id(65)])).rows[0].status,'planlandi');assert.equal((await monitor.query('SELECT count(*)::int n FROM appointment_completion_receipts WHERE appointment_id=$1',[id(65)])).rows[0].n,0);pass('task insert failure rolls appointment and receipt back');
  await monitor.query('DROP TRIGGER fail_fixture_task ON tasks; DROP FUNCTION fail_fixture_task();');await finish(a,65);pass('failed transaction may be safely retried');
  const pidA=(await a.query('SELECT pg_backend_pid() pid')).rows[0].pid,pidB=(await b.query('SELECT pg_backend_pid() pid')).rows[0].pid;
  async function race(first,second,expected,label){await a.query('BEGIN ISOLATION LEVEL READ COMMITTED');let pending;
    try{const value=await first();pending=second().then(value=>({value}),error=>({error}));let blocked=false;
      for(let i=0;i<200;i++){if((await monitor.query('SELECT pg_blocking_pids($1) pids',[pidB])).rows[0].pids.includes(pidA)){blocked=true;break;}await delay(10);}
      assert.ok(blocked,'must observe real lock wait');await a.query('COMMIT');const result=await pending;
      if(expected instanceof RegExp){assert.ok(result.error);assert.match(result.error.message,expected);}else{if(result.error)throw result.error;await expected(result.value,value);}pass(label);
    }catch(e){await a.query('ROLLBACK');if(pending)await pending;throw e;}}
  await race(()=>finish(a,66),()=>finish(b,66),(second,first)=>assert.deepEqual(second.rows,first.rows),'same actor concurrent retry waits then returns identical result');
  assert.equal((await a.query('SELECT count(*)::int n FROM tasks WHERE appointment_id=$1',[id(66)])).rows[0].n,1);pass('concurrent completion creates one followup');
  await race(()=>finish(a,67),()=>finish(b,67,{next:'Different'}),/APPT_ALREADY_COMPLETED/,'different concurrent result is rejected after lock');
  await a.query('RESET ROLE');
  await race(()=>a.query("UPDATE companies SET status='pasif' WHERE id=$1",[id(20)]),()=>finish(b,68),r=>assert.equal(r.rows[0].result.taskId,null),'company deactivation commits before task decision');
  await a.query("UPDATE companies SET status='aktif' WHERE id=$1",[id(20)]);
  await race(()=>a.query("UPDATE profiles SET role='ik' WHERE id=$1",[id(10)]),()=>finish(b,69),/APPT_FORBIDDEN/,'post-profile-lock role check sees committed revocation');
  await a.query("UPDATE profiles SET role='yonetici' WHERE id=$1",[id(10)]);
  await race(async()=>{await a.query('SELECT id FROM profiles WHERE id=$1 FOR UPDATE',[id(10)]);await a.query('UPDATE tenant_memberships SET tenant_id=$1 WHERE user_id=$2',[id(2),id(10)]);},()=>finish(b,70),/APPT_SCOPE_CHANGED/,'post-profile-lock tenant check rejects membership move');
  await a.query('UPDATE tenant_memberships SET tenant_id=$1 WHERE user_id=$2',[id(1),id(10)]);await asUser(a);
  await monitor.query("UPDATE appointments SET status='planlandi' WHERE id=$1",[id(60)]);await assert.rejects(()=>finish(a,60),/APPT_STATE_CHANGED/);pass('reopened appointment cannot masquerade as a successful current completion');
  await monitor.query("UPDATE appointments SET status='tamamlandi',result='Legacy',next_action='Legacy' WHERE id=$1",[id(71)]);await assert.rejects(()=>finish(a,71),/APPT_ALREADY_COMPLETED/);pass('legacy completion without receipt is not retroactively duplicated');
  for(const patch of [{result:'\t\n '},{result:'\u00a0\ufeff'},{next:''},{result:'x'.repeat(4001)},{next:'x'.repeat(1001)},{task:null}])await assert.rejects(()=>finish(a,72,patch),/APPT_VALIDATION/);pass('raw RPC validates text bounds and boolean');
  console.log(`Appointment concurrency checks: ${count} passed.`);
} finally {for(const c of clients)await c.end().catch(()=>{});await pg.stop().catch(()=>{});await rm(dir,{recursive:true,force:true});}
