/** Native, disposable PostgreSQL: no remote URL accepted and no application credentials read.
 * npm install --prefix /private/tmp/bps-native-pgtest embedded-postgres@17.10.0-beta.17
 * BPS_EMBEDDED_PG_MODULE=/private/tmp/bps-native-pgtest/node_modules/embedded-postgres/dist/index.js node scripts/qa-daily-concurrency.mjs
 */
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {randomUUID} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import assert from 'node:assert/strict';
import {baseline,id} from './fixtures/daily-operations.mjs';
const {default:EmbeddedPostgres}=await import(process.env.BPS_EMBEDDED_PG_MODULE?pathToFileURL(process.env.BPS_EMBEDDED_PG_MODULE).href:'embedded-postgres');
const dir=await mkdtemp(join(tmpdir(),'bps-pg-races-'));
const pg=new EmbeddedPostgres({databaseDir:join(dir,'db'),user:'postgres',password:randomUUID(),port:55439,persistent:false,
  postgresFlags:['-h','127.0.0.1','-k',dir],onLog:()=>{},onError:()=>{}});
const clients=[];let checks=0;
const pass=label=>{checks++;console.log('PASS '+label);};
const query=(c,n,kind,payload)=>c.query('select ops_mutate($1,$2,$3) as result',[id(n),kind,JSON.stringify(payload)]);
const rows=[{code:'0001',name:'Şube',city:'İstanbul'}];
const imp=(c,n,items=rows)=>c.query('select ops_import_locations($1,$2,$3) as result',[id(n),id(20),JSON.stringify(items)]);
try {
  await pg.initialise();await pg.start();
  async function connect(){const c=pg.getPgClient('postgres','127.0.0.1');clients.push(c);await c.connect();await c.query("set statement_timeout='8s'; set idle_in_transaction_session_timeout='15s'");return c;}
  const monitor=await connect(),a=await connect(),b=await connect();
  console.log((await monitor.query('select version() as v')).rows[0].v);
  await monitor.query(baseline);
  for(const name of ['20260909000100_daily_operations_pilot.sql','20260909000200_location_import.sql','20260909000300_scoped_operation_command.sql','20260909000400_command_reconciliation.sql','20260909000500_weekly_operations.sql','20260909000600_request_batch.sql','20260909000700_resize_request.sql','20260909000800_attendance.sql','20260909000900_replace_assignment.sql','20260909001000_attendance_week.sql','20260909001100_operations_directory.sql','20260909001200_directory_activation.sql'])await monitor.query(await readFile(new URL('../supabase/migrations/'+name,import.meta.url),'utf8'));
  async function user(c){await c.query('reset role');await c.query("select set_config('test.user',$1,false),set_config('test.tenant',$2,false)",[id(10),id(1)]);await c.query('set role authenticated');}
  await user(a);await user(b);
  const pidA=(await a.query('select pg_backend_pid() as pid')).rows[0].pid;
  const pidB=(await b.query('select pg_backend_pid() as pid')).rows[0].pid;
  assert.notEqual(pidA,pidB);
  async function race(first,second,expected,label){
    await a.query('begin isolation level read committed');
    let pending;
    try {
      const firstResult=await first();
      pending=second().then(value=>({value}),error=>({error}));
      let blocked=false;
      for(let i=0;i<200;i++){
        const blockers=(await monitor.query('select pg_blocking_pids($1) as pids',[pidB])).rows[0].pids;
        if(blockers.includes(pidA)){blocked=true;break;}await delay(10);
      }
      assert.equal(blocked,true,`${label}: second backend must actually wait for first`);
      await a.query('commit');
      const result=await pending;
      if(expected instanceof RegExp){assert.ok(result.error);assert.match(result.error.message,expected);}
      else {if(result.error)throw result.error;await expected(result.value,firstResult);}
      pass(label);
    }catch(e){await a.query('rollback');if(pending)await pending;throw e;}
  }
  await query(a,100,'location',{companyId:id(20),name:'Şube',city:'İstanbul'});
  for(let n=101;n<=105;n++)await query(a,n,'worker',{name:'Personel '+n,code:'P'+n,kind:'idp'});
  const request={companyId:id(20),locationId:id(100),workDate:'2026-09-09',serviceLine:'Temizlik',position:'Görevli',requiredCount:1};
  for(let n=110;n<=116;n++)await query(a,n,'request',request);
  await race(()=>query(a,200,'assign',{requestId:id(110),workerId:id(101)}),()=>query(b,201,'assign',{requestId:id(110),workerId:id(102)}),/OPS_CAPACITY_FULL/,'two workers compete for final slot');
  await race(()=>query(a,202,'assign',{requestId:id(111),workerId:id(102)}),()=>query(b,203,'assign',{requestId:id(112),workerId:id(102)}),/OPS_WORKER_CONFLICT/,'same worker on two requests');
  const same={requestId:id(112),workerId:id(103)};
  await race(()=>query(a,204,'assign',same),()=>query(b,204,'assign',same),(second,first)=>assert.deepEqual(second.rows,first.rows),'same command returns one assignment');
  assert.equal((await monitor.query('select count(*)::int as n from ops_events where command_id=$1',[id(204)])).rows[0].n,1);pass('concurrent retry creates one event');
  await race(()=>query(a,205,'assign',{requestId:id(113),workerId:id(104)}),()=>query(b,206,'cancel',{requestId:id(113)}),()=>{},'cancel waits for assignment then removes it');
  assert.equal((await monitor.query('select count(*)::int as n from ops_assignments where request_id=$1 and removed_at is null',[id(113)])).rows[0].n,0);pass('cancelled request has no active assignment');
  await race(()=>query(a,207,'cancel',{requestId:id(114)}),()=>query(b,208,'assign',{requestId:id(114),workerId:id(105)}),/OPS_REQUEST_NOT_ACTIVE/,'assignment sees committed cancellation');
  await race(()=>imp(a,210),()=>imp(b,211),r=>assert.deepEqual(r.rows[0].result,{commandId:id(211),added:0,skipped:1}),'concurrent imports deduplicate under company lock');
  await race(()=>imp(a,212,[{code:'0002',name:'A',city:'B'}]),()=>imp(b,213,[{code:'0002',name:'Changed',city:'B'}]),/OPS_IMPORT_CONFLICT/,'concurrent differing imports conflict');
  await race(()=>imp(a,214,[{code:'0003',name:'A',city:'B'}]),()=>query(b,215,'location',{companyId:id(20),name:'Manual',city:'B'}),()=>{},'manual location waits behind import');
  await a.query('reset role');
  await race(()=>a.query('update profiles set role=$1 where id=$2',['ik',id(10)]),()=>query(b,216,'request',request),/OPS_FORBIDDEN/,'post-lock check sees committed role revocation');
  await a.query('update profiles set role=$1 where id=$2',['yonetici',id(10)]);
  await race(()=>a.query('update profiles set role=$1 where id=$2',['ik',id(10)]),()=>b.query('select ops_execute_scoped($1,$2,$3,$4,$5)',[id(10),id(1),id(218),'request',JSON.stringify(request)]),/OPS_FORBIDDEN/,'scoped wrapper sees committed role revocation after lock');
  await a.query('update profiles set role=$1 where id=$2',['yonetici',id(10)]);
  await race(async()=>{await a.query('select id from profiles where id=$1 for update',[id(10)]);await a.query('update tenant_memberships set tenant_id=$1 where user_id=$2',[id(2),id(10)]);},()=>query(b,217,'request',request),/OPS_FORBIDDEN/,'post-lock check rejects stale tenant after membership move');
  await a.query('update tenant_memberships set tenant_id=$1 where user_id=$2',[id(1),id(10)]);
  await race(async()=>{await a.query('select id from profiles where id=$1 for update',[id(10)]);await a.query('update tenant_memberships set tenant_id=$1 where user_id=$2',[id(2),id(10)]);},()=>b.query('select ops_execute_scoped($1,$2,$3,$4,$5)',[id(10),id(1),id(219),'request',JSON.stringify(request)]),/OPS_SCOPE_CHANGED/,'scoped wrapper rejects membership move after real lock wait');
  await a.query('update tenant_memberships set tenant_id=$1 where user_id=$2',[id(1),id(10)]);await user(a);
  const resolve=(c,n,close=true)=>c.query('select ops_reconcile_commands($1,$2,$3::uuid[],$4) as result',[id(10),id(1),[id(n)],close]);
  await race(()=>query(a,220,'request',request),()=>resolve(b,220),r=>assert.equal(r.rows[0].result[0].status,'confirmed'),'closing waits for in-flight write and preserves its committed result');
  await race(()=>resolve(a,221),()=>query(b,221,'request',request),/OPS_IDEMPOTENCY_MISMATCH/,'late write waits for closing marker then cannot create a request');
  await race(()=>resolve(a,222),()=>resolve(b,222),r=>assert.equal(r.rows[0].result[0].status,'closed'),'concurrent close requests resolve to one terminal marker');
  await a.query('begin');
  await query(a,223,'request',request);
  assert.equal((await resolve(b,223,false)).rows[0].result[0].status,'unknown');
  await a.query('commit');
  assert.equal((await resolve(b,223,false)).rows[0].result[0].status,'confirmed');pass('lookup preserves unknown during in-flight write then sees committed result');
  const bp={companyId:id(20),locationId:id(100),serviceLine:'Temizlik',position:'Batch race',requiredCount:2,dates:['2026-09-10','2026-09-11']};
  const batch=(c,n,p=bp)=>c.query('select ops_create_request_batch($1,$2,$3,$4) as result',[id(10),id(1),id(n),JSON.stringify(p)]);
  await race(()=>batch(a,230),()=>batch(b,231),/OPS_BATCH_EXISTS/,'concurrent overlapping batches serialize and second sees committed requests');
  await race(()=>batch(a,232,{...bp,position:'Batch same command'}),()=>batch(b,232,{...bp,position:'Batch same command'}),(second,first)=>assert.deepEqual(second.rows,first.rows),'concurrent same batch command returns exact same request IDs');
  await race(()=>query(a,233,'request',{...request,position:'Single then batch'}),()=>batch(b,234,{...bp,position:'Single then batch',dates:['2026-09-09','2026-09-10']}),/OPS_BATCH_EXISTS/,'batch waiting on in-flight single request detects committed conflict');
  await race(()=>resolve(a,235),()=>batch(b,235,{...bp,position:'Closed batch'}),/OPS_IDEMPOTENCY_MISMATCH/,'closing wins race against late batch without partial requests');
  await race(()=>batch(a,236,{...bp,position:'Batch before close'}),()=>resolve(b,236),r=>assert.equal(r.rows[0].result[0].status,'confirmed'),'closing waits for completed batch and preserves all requests');
  const resize=(c,n,r,expected,required)=>c.query('select ops_resize_request($1,$2,$3,$4,$5,$6)',[id(10),id(1),id(n),id(r),expected,required]);
  for(const n of [240,244,248])await query(a,n,'request',{...request,workDate:'2026-09-30',requiredCount:2});
  await query(a,241,'assign',{requestId:id(240),workerId:id(101)});
  await race(()=>query(a,242,'assign',{requestId:id(240),workerId:id(102)}),()=>resize(b,243,240,2,1),/OPS_BELOW_ASSIGNED/,'resize sees concurrent second assignment and cannot discard it');
  await query(a,245,'assign',{requestId:id(244),workerId:id(103)});
  await race(()=>resize(a,246,244,2,1),()=>query(b,247,'assign',{requestId:id(244),workerId:id(104)}),/OPS_CAPACITY_FULL/,'assignment sees reduced capacity after lock wait');
  await race(()=>resize(a,249,248,2,3),()=>resize(b,250,248,2,4),/OPS_STALE_VERSION/,'two capacity edits cannot silently overwrite each other');
  await race(()=>query(a,251,'cancel',{requestId:id(248)}),()=>resize(b,252,248,3,2),/OPS_REQUEST_NOT_ACTIVE/,'resize sees concurrent cancellation');
  const attend=(c,n,assignment,revision,status)=>c.query('select ops_record_attendance($1,$2,$3,$4,$5,$6) as result',[id(10),id(1),id(n),id(assignment),revision,status]);
  for(const n of [300,301,302])await query(a,n,'request',{...request,workDate:'2001-01-01'});
  await query(a,303,'assign',{requestId:id(300),workerId:id(101)});
  await race(()=>attend(a,304,303,0,'present'),()=>attend(b,305,303,0,'absent'),/OPS_STALE_VERSION/,'attendance correction sees new revision after actual wait');
  await race(()=>attend(a,306,303,1,'absent'),()=>attend(b,306,303,1,'absent'),(second,first)=>assert.deepEqual(second.rows,first.rows),'concurrent attendance retry produces one revision');
  await race(()=>query(a,307,'remove',{requestId:id(300),assignmentId:id(303)}),()=>attend(b,308,303,2,'present'),()=>{},'historical attendance correction waits for removal and remains valid');
  await query(a,309,'assign',{requestId:id(301),workerId:id(101)});
  await attend(a,310,303,3,'unreported');
  await race(()=>attend(a,311,303,4,'present'),()=>attend(b,312,309,0,'present'),/OPS_ATTENDANCE_CONFLICT/,'cross-request attendance waits on same worker and cannot double count');
  await race(()=>resolve(a,313),()=>attend(b,313,309,0,'absent'),/OPS_IDEMPOTENCY_MISMATCH/,'closing wins against late attendance');
  const replace=(c,n,assignment,worker,revision=0)=>c.query('select ops_replace_assignment($1,$2,$3,$4,$5,$6) as result',[id(10),id(1),id(n),id(assignment),id(worker),revision]);
  for(const n of [400,401,402,403])await query(a,n,'request',{...request,workDate:'2002-01-01'});
  await query(a,404,'assign',{requestId:id(400),workerId:id(101)});
  await race(()=>replace(a,405,404,102),()=>replace(b,406,404,103),/OPS_STALE_VERSION/,'competing replacements leave exactly one new active assignment');
  await race(()=>replace(a,407,405,103),()=>replace(b,407,405,103),(second,first)=>assert.deepEqual(second.rows,first.rows),'same replacement command returns same assignment');
  await query(a,408,'assign',{requestId:id(401),workerId:id(101)});
  await race(()=>query(a,409,'assign',{requestId:id(402),workerId:id(102)}),()=>replace(b,410,408,102),/OPS_WORKER_CONFLICT/,'replacement sees worker booked by concurrent request');
  await race(()=>attend(a,411,408,0,'present'),()=>replace(b,412,408,104),/OPS_STALE_VERSION/,'replacement waits for attendance and rejects stale declaration');
  await race(()=>query(a,413,'cancel',{requestId:id(400)}),()=>replace(b,414,407,104),/OPS_REQUEST_NOT_ACTIVE/,'replacement sees committed cancellation');
  const active=(c,n,kind,entity,revision,value)=>c.query('select ops_set_directory_active($1,$2,$3,$4,$5,$6,$7) as result',[id(10),id(1),id(n),kind,id(entity),revision,value]);
  await query(a,500,'location',{companyId:id(20),name:'Activation races',city:'Ankara'});
  await query(a,501,'worker',{name:'Activation race worker',code:'ACTIVATION_RACE',kind:'idp'});
  const apr={...request,locationId:id(500),workDate:'2004-01-01'};
  await query(a,502,'request',apr);await query(a,503,'request',apr);
  await race(()=>active(a,504,'workers',501,0,false),()=>query(b,505,'assign',{requestId:id(502),workerId:id(501)}),/OPS_INACTIVE_WORKER/,'assignment sees committed worker deactivation after lock wait');
  await active(a,506,'workers',501,1,true);
  await race(()=>query(a,507,'assign',{requestId:id(502),workerId:id(501)}),()=>active(b,508,'workers',501,2,false),()=>{},'deactivation waits for assignment and preserves it');
  assert.equal((await monitor.query('select count(*)::int as n from ops_assignments where id=$1 and removed_at is null',[id(507)])).rows[0].n,1);pass('winning assignment survives subsequent deactivation');
  await active(a,509,'workers',501,3,true);
  await race(()=>active(a,510,'locations',500,0,false),()=>query(b,511,'assign',{requestId:id(503),workerId:id(101)}),/OPS_INACTIVE_LOCATION/,'assignment location SHARE check sees committed deactivation');
  await active(a,512,'locations',500,1,true);
  await race(()=>query(a,513,'assign',{requestId:id(503),workerId:id(101)}),()=>active(b,514,'locations',500,2,false),()=>{},'location deactivation waits behind assignment SHARE lock');
  await race(()=>active(a,515,'locations',500,3,true),()=>active(b,516,'locations',500,3,false),/OPS_STALE_VERSION/,'concurrent directory edits cannot overwrite revision');
  await race(()=>resolve(a,517),()=>active(b,517,'workers',501,4,false),/OPS_IDEMPOTENCY_MISMATCH/,'close wins against late activation write');
  await race(()=>active(a,518,'locations',500,4,false),()=>query(b,519,'request',{...apr,workDate:'2004-01-02'}),/OPS_INACTIVE_LOCATION/,'new demand sees committed location deactivation');
  await active(a,520,'locations',500,5,true);
  await race(()=>active(a,521,'locations',500,6,false),()=>batch(b,522,{...bp,locationId:id(500),position:'Activation batch',dates:['2004-01-02']}),/OPS_INACTIVE_LOCATION/,'batch waiting on company lock sees deactivated location');
  await active(a,523,'locations',500,7,true);
  await race(()=>active(a,524,'locations',500,8,false),()=>replace(b,525,507,102),/OPS_INACTIVE_LOCATION/,'replacement sees location deactivation');
  await a.query('reset role');
  await race(()=>a.query('update profiles set role=$1 where id=$2',['operasyon',id(10)]),()=>active(b,526,'workers',501,4,false),/OPS_FORBIDDEN/,'activation role check sees committed manager revocation after profile lock');
  await a.query('update profiles set role=$1 where id=$2',['yonetici',id(10)]);await user(a);
  console.log(`${checks} native PostgreSQL concurrency checks passed; each race observed a real backend lock wait.`);
} finally {
  await Promise.allSettled(clients.map(c=>c.end()));
  await pg.stop();
  await rm(dir,{recursive:true,force:true});
}
