// Disposable native PostgreSQL: atomic batches and observed lock waits.
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
const dir=await mkdtemp(join(tmpdir(),'bps-transfer-races-'));
const pg=new EmbeddedPostgres({databaseDir:join(dir,'db'),user:'postgres',password:randomUUID(),port:55442,persistent:false,postgresFlags:['-h','127.0.0.1','-k',dir],onLog:()=>{},onError:()=>{}});
const clients=[];let count=0;const pass=label=>{count++;console.log('PASS '+label);};
try {
  await pg.initialise();await pg.start();
  async function connect(){const c=pg.getPgClient('postgres','127.0.0.1');clients.push(c);await c.connect();await c.query("SET statement_timeout='8s'; SET idle_in_transaction_session_timeout='15s'");return c;}
  const monitor=await connect(),a=await connect(),b=await connect();
  await monitor.query(baseline);
  await monitor.query(`CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$ SELECT jsonb_build_object('app_metadata',jsonb_build_object('active_tenant',current_setting('test.tenant',true))) $$;`);
  for(const file of ['./fixtures/local-task-prefill.sql','../supabase/migrations/20260909001300_task_assignment_history.sql','../supabase/migrations/20260909001500_task_transfer.sql'])await monitor.query(await readFile(new URL(file,import.meta.url),'utf8'));
  async function asUser(c,uid=10,tenant=1){await c.query('RESET ROLE');await c.query("SELECT set_config('test.user',$1,false),set_config('test.tenant',$2,false)",[id(uid),id(tenant)]);await c.query('SET ROLE authenticated');}
  await asUser(a);await asUser(b);
  const preview=async(c=a,source=11,tenant=1,actor=10)=>(await c.query('SELECT preview_task_transfer($1,$2,$3) r',[id(actor),id(tenant),id(source)])).rows[0].r;
  const directory=async(c=a,tenant=1,actor=10)=>(await c.query('SELECT task_transfer_directory($1,$2) r',[id(actor),id(tenant)])).rows[0].r;
  const command=(tasks,extra={})=>({command:randomUUID(),actor:id(10),tenant:id(1),source:id(11),target:id(12),tasks:tasks.map(t=>({id:t.id,revision:t.revision})),...extra});
  const transfer=async(c,cmd)=>(await c.query('SELECT transfer_tasks_scoped($1,$2,$3,$4,$5,$6::jsonb) r',[cmd.actor,cmd.tenant,cmd.command,cmd.source,cmd.target,JSON.stringify(cmd.tasks)])).rows[0].r;
  const seed=async(n,extra={})=>{await monitor.query('INSERT INTO tasks(id,tenant_id,company_id,title,assigned_to_user_id,status) VALUES($1,$2,$3,$4,$5,$6)',[id(n),id(extra.tenant??1),id(extra.company??20),'Transfer '+n,id(extra.source??11),extra.status??'acik']);return {id:id(n),revision:0};};
  const revision=async(n)=>(await monitor.query('SELECT revision,assigned_to_user_id,status FROM tasks WHERE id=$1',[id(n)])).rows[0];
  const receipts=async()=>(await monitor.query('SELECT count(*)::int n FROM task_transfer_receipts')).rows[0].n;
  assert.deepEqual((await preview()).tasks,[]);pass('empty preview is measured zero');
  const t1=await seed(100),t2=await seed(101,{company:22,status:'gecikti'});await seed(102,{status:'tamamlandi'});await seed(103,{status:'iptal'});await seed(104,{tenant:2,company:21});
  assert.equal((await preview()).total,2);assert.equal((await directory()).sources[0].count,2);pass('preview includes passive-company open work, excludes closed and foreign work');
  const cmd=command([t1,t2]);assert.equal((await transfer(a,cmd)).moved,2);
  assert.equal((await revision(100)).assigned_to_user_id,id(12));assert.equal((await revision(101)).status,'gecikti');assert.equal((await revision(102)).assigned_to_user_id,id(11));
  assert.equal((await a.query("SELECT count(*)::int n FROM task_assignment_history WHERE kind='reassigned' AND actor_id=$1",[id(10)])).rows[0].n,2);pass('atomic transfer preserves status and records exactly two identity histories');
  assert.equal((await transfer(a,cmd)).moved,2);assert.equal((await revision(100)).revision,'1');pass('same command after response loss replays without another revision');
  await assert.rejects(()=>transfer(a,{...cmd,target:id(10)}),/TRANSFER_COMMAND/);pass('command payload cannot change');
  assert.equal((await transfer(a,{...cmd,tasks:[...cmd.tasks].reverse()})).moved,2);pass('same command with reordered tasks uses canonical snapshot');
  await assert.rejects(()=>a.query('SELECT * FROM task_transfer_receipts'),e=>e.code==='42501');await assert.rejects(()=>a.query('DELETE FROM task_transfer_receipts'),e=>e.code==='42501');pass('receipt is private and not client editable');
  const t3=await seed(110),t4=await seed(111);await monitor.query("UPDATE tasks SET title='Changed' WHERE id=$1",[id(111)]);
  let before=await receipts();await assert.rejects(()=>transfer(a,command([t3,t4])),/TRANSFER_CONFLICT/);assert.equal((await revision(110)).revision,'0');assert.equal(await receipts(),before);pass('late batch conflict rolls back earlier updates, history and receipt');
  await assert.rejects(()=>transfer(a,command([t3,{id:id(999),revision:0}])),/TRANSFER_CONFLICT/);assert.equal((await revision(110)).revision,'0');pass('missing task cannot yield partial success');
  for(const n of [102,103,104])await assert.rejects(()=>transfer(a,command([{id:id(n),revision:0}])),/TRANSFER_CONFLICT/);pass('forged closed cancelled or foreign task selection rejected');
  for(const tasks of [[],Array.from({length:101},()=>t3),[t3,t3],[{...t3,revision:-1}],[{...t3,revision:0.5}],[{...t3,revision:'0'}],[{...t3,id:'x'}],[{...t3,extra:1}],null])await assert.rejects(()=>transfer(a,command([], {tasks})),/TRANSFER_VALIDATION/);
  pass('empty oversized duplicated malformed and unsafe revisions rejected');
  await assert.rejects(()=>transfer(a,command([t3],{target:id(13)})),/TRANSFER_TARGET/);await assert.rejects(()=>transfer(a,command([t3],{target:id(11)})),/TRANSFER_VALIDATION/);pass('foreign target and same-person transfer rejected');
  await monitor.query("UPDATE profiles SET role='muhasebe' WHERE id=$1",[id(12)]);
  assert.equal((await directory()).targets.some(p=>p.id===id(12)),false);
  await assert.rejects(()=>transfer(a,command([t3])),/TRANSFER_TARGET_ROLE/);
  await monitor.query("UPDATE profiles SET role='ik' WHERE id=$1",[id(12)]);pass('member without task access cannot receive transfer');
  await assert.rejects(()=>transfer(a,command([t3],{actor:id(11)})),/TRANSFER_SCOPE/);await assert.rejects(()=>transfer(a,command([t3],{tenant:id(2)})),/TRANSFER_SCOPE/);pass('actor and tenant mismatch rejected');
  await asUser(b,12);await assert.rejects(()=>preview(b,11,1,12),/TRANSFER_FORBIDDEN/);await assert.rejects(()=>transfer(b,command([t3],{actor:id(12)})),/TRANSFER_FORBIDDEN/);
  await asUser(b,14);await assert.rejects(()=>directory(b,1,14),/TRANSFER_SCOPE/);await assert.rejects(()=>transfer(b,command([t3],{actor:id(14)})),/TRANSFER_SCOPE/);pass('non-manager and stale claim cannot preview or write');
  await b.query('RESET ROLE');await b.query('SET ROLE anon');await assert.rejects(()=>preview(b),e=>e.code==='42501');pass('anonymous RPC access denied');await asUser(b);
  const departed=await seed(120,{source:14});assert.equal((await directory()).sources.find(s=>s.id===id(14)).name,null);
  assert.equal((await transfer(a,command([departed],{source:id(14)}))).moved,1);pass('departed source identity remains transferable without revealing external profile name');
  const pidA=(await a.query('SELECT pg_backend_pid() pid')).rows[0].pid,pidB=(await b.query('SELECT pg_backend_pid() pid')).rows[0].pid;
  async function race(first,second,verify,label){
    await a.query('BEGIN ISOLATION LEVEL READ COMMITTED');let pending;
    try{await first();pending=second().then(value=>({value}),error=>({error}));let blocked=false;
      for(let i=0;i<300;i++){if((await monitor.query('SELECT pg_blocking_pids($1) pids',[pidB])).rows[0].pids.includes(pidA)){blocked=true;break;}await delay(10);}
      assert.ok(blocked,'must observe lock wait');await a.query('COMMIT');await verify(await pending);pass(label);
    }catch(e){await a.query('ROLLBACK');if(pending)await pending;throw e;}
  }
  const t5=await seed(130),same=command([t5]);await race(()=>transfer(a,same),()=>transfer(b,same),r=>{assert.ifError(r.error);assert.equal(r.value.moved,1);},'concurrent identical command waits and replays one transfer');
  const t6=await seed(131);await race(()=>transfer(a,command([t6])),()=>transfer(b,command([t6],{target:id(10)})),r=>assert.match(r.error?.message??'',/TRANSFER_CONFLICT/),'overlapping different commands wait and reject stale snapshot');
  const t7=await seed(132);await race(()=>a.query("UPDATE tasks SET title='Raced' WHERE id=$1",[t7.id]),()=>transfer(b,command([t7])),r=>assert.match(r.error?.message??'',/TRANSFER_CONFLICT/),'ordinary task edit invalidates preview after actual lock wait');
  const t8=await seed(133);await a.query('RESET ROLE');
  await race(async()=>{await a.query('SELECT 1 FROM profiles WHERE id=$1 FOR UPDATE',[id(12)]);await a.query('DELETE FROM tenant_memberships WHERE user_id=$1',[id(12)]);},()=>transfer(b,command([t8])),r=>assert.match(r.error?.message??'',/TRANSFER_TARGET/),'target departure committed during wait is rechecked');
  await monitor.query('INSERT INTO tenant_memberships VALUES($1,$2)',[id(12),id(1)]);
  await race(async()=>{await a.query("UPDATE profiles SET role='ik' WHERE id=$1",[id(10)]);},()=>transfer(b,command([t8])),r=>assert.match(r.error?.message??'',/TRANSFER_FORBIDDEN/),'actor role revocation committed during wait is rechecked');
  await monitor.query("UPDATE profiles SET role='yonetici' WHERE id=$1",[id(10)]);
  await race(async()=>{await a.query('SELECT 1 FROM profiles WHERE id=$1 FOR UPDATE',[id(10)]);await a.query('UPDATE tenant_memberships SET tenant_id=$1 WHERE user_id=$2',[id(2),id(10)]);},()=>transfer(b,command([t8])),r=>assert.match(r.error?.message??'',/TRANSFER_SCOPE/),'actor tenant move committed during wait invalidates old claim');
  await monitor.query('UPDATE tenant_memberships SET tenant_id=$1 WHERE user_id=$2',[id(1),id(10)]);await asUser(a);
  const t9=await seed(134);await b.query('RESET ROLE');
  await race(()=>transfer(a,command([t9])),()=>b.query('SELECT 1 FROM profiles WHERE id=$1 FOR UPDATE',[id(12)]),r=>assert.ifError(r.error),'admin target profile lock waits for transfer without deadlock');await asUser(b);
  // Measured bound above the PostgREST default row ceiling; JSON aggregate is one row.
  await monitor.query(`INSERT INTO tasks(tenant_id,company_id,title,assigned_to_user_id) SELECT $1,$2,'Volume '||g,$3 FROM generate_series(1,1200) g`,[id(1),id(20),id(11)]);
  const start=performance.now(),p=await preview();assert.ok(p.total>1200);assert.equal(p.tasks.length,100);
  console.log('MEASURE preview total='+p.total+' returned='+p.tasks.length+' ms='+Math.round(performance.now()-start));
  const bulk=await transfer(a,command(p.tasks));assert.equal(bulk.moved,100);assert.equal((await preview()).total,p.total-100);pass('100-task batch and fresh remainder on more than 1200 tasks');
  await monitor.query('ANALYZE tasks');const plan=(await monitor.query("EXPLAIN (FORMAT JSON) SELECT id FROM tasks WHERE tenant_id=$1 AND assigned_to_user_id=$2 AND status IN ('acik','devam_ediyor','gecikti') ORDER BY id LIMIT 100",[id(1),id(11)])).rows[0]['QUERY PLAN'];
  assert.match(JSON.stringify(plan),/tasks_active_assignee_transfer/);pass('bounded preview uses partial assignee index at measured volume');
  console.log(`Task transfer checks: ${count} passed.`);
} finally {for(const c of clients)await c.end().catch(()=>{});await pg.stop().catch(()=>{});await rm(dir,{recursive:true,force:true});}
