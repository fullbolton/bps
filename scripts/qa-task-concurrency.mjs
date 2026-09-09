// Disposable native PostgreSQL, independent connections and observed lock waits.
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {randomUUID} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import assert from 'node:assert/strict';
import {baseline,id} from './fixtures/daily-operations.mjs';
const modulePath=process.env.BPS_EMBEDDED_PG_MODULE;
if(!modulePath?.startsWith('/'))throw Error('Absolute BPS_EMBEDDED_PG_MODULE is required');
const {default:EmbeddedPostgres}=await import(pathToFileURL(modulePath).href);
const dir=await mkdtemp(join(tmpdir(),'bps-task-races-'));
const pg=new EmbeddedPostgres({databaseDir:join(dir,'db'),user:'postgres',password:randomUUID(),port:55440,persistent:false,postgresFlags:['-h','127.0.0.1','-k',dir],onLog:()=>{},onError:()=>{}});
const clients=[];let count=0;const pass=label=>{count++;console.log('PASS '+label);};
try {
  await pg.initialise();await pg.start();
  async function connect(){const c=pg.getPgClient('postgres','127.0.0.1');clients.push(c);await c.connect();await c.query("SET statement_timeout='8s'; SET idle_in_transaction_session_timeout='15s'");return c;}
  const monitor=await connect(),a=await connect(),b=await connect();
  await monitor.query(baseline);
  await monitor.query(`CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$ SELECT jsonb_build_object('app_metadata',jsonb_build_object('active_tenant',current_setting('test.tenant',true))) $$;`);
  await monitor.query(await readFile(new URL('./fixtures/local-task-prefill.sql',import.meta.url),'utf8'));
  await monitor.query('INSERT INTO tasks(id,tenant_id,company_id,title,assigned_to_user_id) VALUES($1,$2,$3,$4,$5)',[id(50),id(1),id(20),'Existing',id(11)]);
  await monitor.query(await readFile(new URL('../supabase/migrations/20260909001300_task_assignment_history.sql',import.meta.url),'utf8'));
  async function asUser(c,uid=10,tenant=1){await c.query('RESET ROLE');await c.query("SELECT set_config('test.user',$1,false),set_config('test.tenant',$2,false)",[id(uid),id(tenant)]);await c.query('SET ROLE authenticated');}
  await asUser(a);await asUser(b);
  let rows=(await a.query('SELECT * FROM task_assignment_history WHERE task_id=$1',[id(50)])).rows;
  assert.equal(rows.length,1);assert.equal(rows[0].kind,'baseline');assert.equal(rows[0].actor_id,null);assert.equal(rows[0].next_user_id,id(11));pass('existing task gets truthful baseline, no invented author');
  const pidA=(await a.query('SELECT pg_backend_pid() pid')).rows[0].pid,pidB=(await b.query('SELECT pg_backend_pid() pid')).rows[0].pid;
  const update=(c,revision,assignee)=>c.query('UPDATE tasks SET assigned_to_user_id=$1 WHERE id=$2 AND revision=$3 RETURNING revision',[assignee,id(50),revision]);
  async function race(first,second,label){
    await a.query('BEGIN ISOLATION LEVEL READ COMMITTED');let pending;
    try{await first();pending=second().then(value=>({value}),error=>({error}));let blocked=false;
      for(let i=0;i<200;i++){if((await monitor.query('SELECT pg_blocking_pids($1) pids',[pidB])).rows[0].pids.includes(pidA)){blocked=true;break;}await delay(10);}
      assert.ok(blocked,'must observe actual lock wait');await a.query('COMMIT');const result=await pending;if(result.error)throw result.error;assert.equal(result.value.rowCount,0);pass(label);
    }catch(e){await a.query('ROLLBACK');if(pending)await pending;throw e;}
  }
  await race(()=>update(a,0,id(10)),()=>update(b,0,id(12)),'same revision two writers: second waits then changes zero rows');
  rows=(await a.query('SELECT * FROM task_assignment_history WHERE task_id=$1 ORDER BY revision',[id(50)])).rows;
  assert.equal(rows.length,2);assert.equal(rows[1].kind,'reassigned');assert.equal(rows[1].previous_user_id,id(11));assert.equal(rows[1].next_user_id,id(10));assert.equal(rows[1].actor_id,id(10));pass('winner has exactly one identity transition and actor');
  await race(()=>a.query('UPDATE tasks SET status=$1 WHERE id=$2',['devam_ediyor',id(50)]),()=>update(b,1,id(12)),'direct legacy update also invalidates stale application revision');
  assert.equal((await a.query('SELECT count(*)::int n FROM task_assignment_history WHERE task_id=$1',[id(50)])).rows[0].n,2);pass('status-only update advances revision without fabricating a transfer');
  await a.query('BEGIN');await update(a,2,null);await a.query('ROLLBACK');
  assert.equal((await a.query('SELECT revision FROM tasks WHERE id=$1',[id(50)])).rows[0].revision,'2');assert.equal((await a.query('SELECT count(*)::int n FROM task_assignment_history WHERE task_id=$1',[id(50)])).rows[0].n,2);pass('rollback removes both assignment change and history');
  await update(a,2,null);assert.equal((await a.query('SELECT kind FROM task_assignment_history WHERE task_id=$1 ORDER BY revision DESC LIMIT 1',[id(50)])).rows[0].kind,'unassigned');pass('unassignment is recorded');
  await assert.rejects(()=>update(a,3,id(13)),e=>e.code==='42501');
  assert.equal((await a.query('SELECT revision FROM tasks WHERE id=$1',[id(50)])).rows[0].revision,'3');
  assert.equal((await a.query('SELECT count(*)::int n FROM task_assignment_history WHERE task_id=$1',[id(50)])).rows[0].n,3);pass('rejected foreign assignee leaves revision and history unchanged');
  assert.equal((await a.query('UPDATE tasks SET revision=999 WHERE id=$1 RETURNING revision',[id(50)])).rows[0].revision,'4');pass('client cannot forge revision value');
  for(const q of ["INSERT INTO task_assignment_history(task_id,revision,tenant_id,kind) VALUES($1,99,$2,'assigned')","UPDATE task_assignment_history SET actor_id=$2 WHERE task_id=$1","DELETE FROM task_assignment_history WHERE task_id=$1 AND tenant_id=$2"]){await assert.rejects(()=>a.query(q,[id(50),id(1)]),e=>e.code==='42501');}pass('authenticated callers cannot insert, edit or delete history');
  await asUser(b,13,2);assert.equal((await b.query('SELECT * FROM task_assignment_history')).rowCount,0);pass('other tenant cannot read history');
  await asUser(b,14,1);assert.equal((await b.query('SELECT * FROM task_assignment_history')).rowCount,0);pass('stale claim without membership cannot read new history');
  await asUser(b,12,1);await monitor.query("UPDATE profiles SET role='muhasebe' WHERE id=$1",[id(12)]);
  assert.equal((await b.query('SELECT * FROM task_assignment_history')).rowCount,0);
  await monitor.query("UPDATE profiles SET role='ik' WHERE id=$1",[id(12)]);pass('history also respects current task role visibility');
  await assert.rejects(()=>a.query('UPDATE tasks SET company_id=$1 WHERE id=$2',[id(22),id(50)]),/TASK_CONTEXT_IMMUTABLE/);pass('task context cannot be moved behind its history');
  await update(a,4,id(11));await monitor.query('DELETE FROM tenant_memberships WHERE user_id=$1;',[id(11)]);await monitor.query('DELETE FROM profiles WHERE id=$1',[id(11)]);
  rows=(await a.query('SELECT * FROM task_assignment_history WHERE task_id=$1 ORDER BY revision DESC LIMIT 1',[id(50)])).rows;assert.equal(rows[0].kind,'unassigned');assert.equal(rows[0].previous_user_id,id(11));assert.equal(rows[0].actor_id,null);pass('profile FK removal preserves departed identity in system history');
  await a.query('INSERT INTO tasks(id,tenant_id,company_id,title) VALUES($1,$2,$3,$4)',[id(51),id(1),id(20),'New']);assert.equal((await a.query('SELECT kind FROM task_assignment_history WHERE task_id=$1',[id(51)])).rows[0].kind,'created');pass('new task records creation at revision zero');
  console.log(`Task concurrency/history checks: ${count} passed.`);
} finally {for(const c of clients)await c.end().catch(()=>{});await pg.stop().catch(()=>{});await rm(dir,{recursive:true,force:true});}
