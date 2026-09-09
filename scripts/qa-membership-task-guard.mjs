// Actual original admin function + new migration on disposable native PostgreSQL.
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
const dir=await mkdtemp(join(tmpdir(),'bps-membership-guard-'));
const pg=new EmbeddedPostgres({databaseDir:join(dir,'db'),user:'postgres',password:randomUUID(),port:55443,persistent:false,postgresFlags:['-h','127.0.0.1','-k',dir],onLog:()=>{},onError:()=>{}});
const clients=[];let count=0;const pass=label=>{count++;console.log('PASS '+label);};
try {
  await pg.initialise();await pg.start();
  async function connect(){const c=pg.getPgClient('postgres','127.0.0.1');clients.push(c);await c.connect();await c.query("SET statement_timeout='8s'; SET idle_in_transaction_session_timeout='15s'");return c;}
  const monitor=await connect(),a=await connect(),b=await connect();
  await monitor.query(baseline);
  await monitor.query(`CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$ SELECT jsonb_build_object('app_metadata',jsonb_build_object('active_tenant',current_setting('test.tenant',true))) $$;
    CREATE TABLE auth.sessions(id uuid PRIMARY KEY,user_id uuid); CREATE TABLE auth.refresh_tokens(id uuid PRIMARY KEY,session_id uuid REFERENCES auth.sessions(id) ON DELETE CASCADE);`);
  for(const file of ['./fixtures/local-task-prefill.sql','../supabase/migrations/20260909001300_task_assignment_history.sql','../supabase/migrations/20260909001500_task_transfer.sql','./fixtures/local-admin-assignment.sql'])await monitor.query(await readFile(new URL(file,import.meta.url),'utf8'));
  const old=await readFile(new URL('../supabase/migrations/20260827000400_platform_admin_rpcs.sql',import.meta.url),'utf8'),start=old.indexOf('CREATE OR REPLACE FUNCTION public.admin_assign_role_and_tenant('),end=old.indexOf('COMMENT ON FUNCTION public.admin_assign_role_and_tenant(',start);
  assert.ok(start>0&&end>start);await monitor.query(old.slice(start,end));
  await monitor.query('REVOKE ALL ON FUNCTION admin_assign_role_and_tenant(uuid,text,uuid) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION admin_assign_role_and_tenant(uuid,text,uuid) TO authenticated;');
  const ownership=async()=>(await monitor.query("SELECT oid,proowner,proacl FROM pg_proc WHERE oid='public.admin_assign_role_and_tenant(uuid,text,uuid)'::regprocedure")).rows[0];
  const beforeOwner=await ownership();
  // A legacy inconsistent assignment is retained for repair/closure acceptance.
  await monitor.query("INSERT INTO tasks(id,tenant_id,company_id,title,assigned_to_user_id) VALUES($1,$2,$3,'Legacy orphan',$4)",[id(900),id(1),id(20),id(14)]);
  await monitor.query(await readFile(new URL('../supabase/migrations/20260909001600_task_membership_guard.sql',import.meta.url),'utf8'));
  assert.deepEqual(await ownership(),beforeOwner);pass('CREATE OR REPLACE preserves exact admin function oid owner and ACL');
  await monitor.query('UPDATE profiles SET is_platform_admin=true WHERE id=$1',[id(10)]);
  async function asUser(c,uid=10){await c.query('RESET ROLE');await c.query("SELECT set_config('test.user',$1,false),set_config('test.tenant',$2,false)",[id(uid),id(1)]);await c.query('SET ROLE authenticated');}
  await asUser(a);await asUser(b);
  const admin=(c,role='operasyon',tenant=2,user=11)=>c.query('SELECT admin_assign_role_and_tenant($1,$2,$3)',[id(user),role,id(tenant)]);
  const memberships=async(user=11)=>(await monitor.query('SELECT tenant_id FROM tenant_memberships WHERE user_id=$1 ORDER BY tenant_id',[id(user)])).rows.map(r=>r.tenant_id);
  const insert=(c,n,source=11)=>c.query('INSERT INTO tasks(id,tenant_id,company_id,title,assigned_to_user_id) VALUES($1,$2,$3,$4,$5)',[id(n),id(1),id(20),'Guard '+n,id(source)]);
  const session=async()=>{await monitor.query('INSERT INTO auth.sessions VALUES($1,$2)',[id(700),id(11)]);await monitor.query('INSERT INTO auth.refresh_tokens VALUES($1,$2)',[id(701),id(700)]);};
  await session();await insert(a,100);
  await assert.rejects(()=>admin(a),e=>e.code==='BP001');assert.deepEqual(await memberships(),[id(1)]);assert.equal((await monitor.query('SELECT count(*)::int n FROM auth.sessions')).rows[0].n,1);pass('active work blocks tenant move and preserves membership and sessions');
  await assert.rejects(()=>admin(a,'muhasebe',1),e=>e.code==='BP001');assert.equal((await monitor.query('SELECT role FROM profiles WHERE id=$1',[id(11)])).rows[0].role,'operasyon');pass('role losing task access is blocked and rolled back');
  await admin(a,'ik',1);assert.deepEqual(await memberships(),[id(1)]);assert.equal((await monitor.query('SELECT count(*)::int n FROM auth.sessions')).rows[0].n,1);pass('same tenant safe role update retains membership and session');
  await a.query('SELECT transfer_tasks_scoped($1,$2,$3,$4,$5,$6::jsonb)',[id(10),id(1),randomUUID(),id(11),id(12),JSON.stringify([{id:id(100),revision:0}])]);
  await admin(a);assert.deepEqual(await memberships(),[id(2)]);assert.equal((await monitor.query('SELECT count(*)::int n FROM auth.sessions')).rows[0].n,0);assert.equal((await monitor.query('SELECT count(*)::int n FROM auth.refresh_tokens')).rows[0].n,0);pass('after transfer membership move succeeds and session refresh-token cascade remains');
  await admin(a,'operasyon',1);
  await monitor.query('INSERT INTO tenant_memberships VALUES($1,$2)',[id(11),id(2)]);await insert(a,101);await admin(a,'operasyon',1);assert.deepEqual(await memberships(),[id(1)]);pass('repair keeps target membership with its jobs while removing unused extra membership');
  await a.query("UPDATE tasks SET status='tamamlandi' WHERE id=$1",[id(101)]);await admin(a,'muhasebe',1);await assert.rejects(()=>a.query("UPDATE tasks SET status='acik' WHERE id=$1",[id(101)]),e=>e.code==='BP003');pass('closed history allows role loss but cannot reopen into inaccessible ownership');
  await admin(a,'operasyon',1);
  await assert.rejects(()=>admin(a,'yonetici',2,14),e=>e.code==='BP001');assert.deepEqual(await memberships(14),[]);pass('zero-membership orphaned active work still blocks moving user elsewhere');
  await assert.rejects(()=>a.query("UPDATE tasks SET title='Edit invalid active' WHERE id=$1",[id(900)]),e=>e.code==='BP002');
  await monitor.query("UPDATE tasks SET status='tamamlandi' WHERE id=$1",[id(900)]);pass('legacy invalid active assignment is not silently backfilled and can be closed');
  await insert(a,102);await assert.rejects(()=>monitor.query('DELETE FROM tenant_memberships WHERE user_id=$1',[id(11)]),e=>e.code==='BP001');await assert.rejects(()=>monitor.query('UPDATE tenant_memberships SET tenant_id=$1 WHERE user_id=$2',[id(2),id(11)]),e=>e.code==='BP001');pass('direct membership removal and move are guarded too');
  await a.query("UPDATE tasks SET status='tamamlandi' WHERE id=$1",[id(102)]);
  const pidA=(await a.query('SELECT pg_backend_pid() pid')).rows[0].pid,pidB=(await b.query('SELECT pg_backend_pid() pid')).rows[0].pid;
  async function race(first,second,verify,label){
    await a.query('BEGIN ISOLATION LEVEL READ COMMITTED');let pending;
    try{await first();pending=second().then(value=>({value}),error=>({error}));let blocked=false;
      for(let i=0;i<300;i++){if((await monitor.query('SELECT pg_blocking_pids($1) pids',[pidB])).rows[0].pids.includes(pidA)){blocked=true;break;}await delay(10);}
      assert.ok(blocked,'must observe actual wait');await a.query('COMMIT');verify(await pending);pass(label);
    }catch(e){await a.query('ROLLBACK');if(pending)await pending;throw e;}
  }
  await race(()=>insert(a,110),()=>admin(b),r=>assert.equal(r.error?.code,'BP001'),'task insert commits first: waiting admin sees active task and rejects move');
  await a.query("UPDATE tasks SET status='tamamlandi' WHERE id=$1",[id(110)]);
  await race(()=>admin(a),()=>insert(b,111),r=>assert.equal(r.error?.code,'BP002'),'admin moves first: waiting insert rechecks membership and rolls back');
  assert.equal((await monitor.query('SELECT count(*)::int n FROM tasks WHERE id=$1',[id(111)])).rows[0].n,0);await admin(a,'operasyon',1);
  await race(()=>admin(a,'muhasebe',1),()=>insert(b,112),r=>assert.equal(r.error?.code,'BP003'),'role changes first: waiting insert rechecks task access');await admin(a,'operasyon',1);
  await a.query('INSERT INTO tasks(id,tenant_id,company_id,title) VALUES($1,$2,$3,$4)',[id(113),id(1),id(20),'Unassigned']);
  await race(()=>admin(a),()=>b.query('UPDATE tasks SET assigned_to_user_id=$1 WHERE id=$2',[id(11),id(113)]),r=>assert.equal(r.error?.code,'BP002'),'membership move races ordinary reassignment without deadlock');await admin(a,'operasyon',1);
  await race(()=>admin(a),()=>b.query("UPDATE tasks SET status='acik' WHERE id=$1",[id(110)]),r=>assert.equal(r.error?.code,'BP002'),'membership move races reopening existing closed task without deadlock');await admin(a,'operasyon',1);
  await insert(a,114);
  await race(()=>a.query('SELECT transfer_tasks_scoped($1,$2,$3,$4,$5,$6::jsonb)',[id(10),id(1),randomUUID(),id(11),id(12),JSON.stringify([{id:id(114),revision:0}])]),()=>admin(b,'muhasebe',1,12),r=>assert.equal(r.error?.code,'BP001'),'transfer target role cannot be removed after waiting for transfer commit');
  await a.query('BEGIN ISOLATION LEVEL REPEATABLE READ');await assert.rejects(()=>admin(a),e=>e.code==='BP004');await a.query('ROLLBACK');
  await a.query('BEGIN ISOLATION LEVEL REPEATABLE READ');await assert.rejects(()=>insert(a,150),e=>e.code==='BP004');await a.query('ROLLBACK');pass('non-default isolation cannot reuse stale guard snapshots');
  await asUser(b,11);await assert.rejects(()=>admin(b),e=>e.code==='42501');pass('new guards do not expand platform-admin authorization');
  const migration=await readFile(new URL('../supabase/migrations/20260909001600_task_membership_guard.sql',import.meta.url),'utf8');
  const checkStart=migration.indexOf('-- Check REAL stored-function owners');assert.ok(checkStart>0);
  await monitor.query('CREATE ROLE guard_limited; GRANT USAGE ON SCHEMA public TO guard_limited; GRANT SELECT ON tasks,profiles,tenant_memberships TO guard_limited; GRANT UPDATE ON profiles TO guard_limited; ALTER FUNCTION admin_assign_role_and_tenant(uuid,text,uuid) OWNER TO guard_limited;');
  await assert.rejects(()=>monitor.query(migration.slice(checkStart,migration.lastIndexOf('COMMIT;'))),/must read all rows/);
  await monitor.query('ALTER FUNCTION admin_assign_role_and_tenant(uuid,text,uuid) OWNER TO postgres');assert.deepEqual(await ownership(),beforeOwner);pass('owner assertion rejects preserved admin owner whose RLS would hide tasks');
  console.log(`Membership/task guard checks: ${count} passed.`);
} finally {for(const c of clients)await c.end().catch(()=>{});await pg.stop().catch(()=>{});await rm(dir,{recursive:true,force:true});}
