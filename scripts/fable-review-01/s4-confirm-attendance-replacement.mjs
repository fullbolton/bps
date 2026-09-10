// Senaryo 4 — teyit, gerçekleşme ve yedek atama. Gerçek ops_record_attendance, ops_replace_assignment (002700 sarmalayıcı),
// ops_mutate (001200 gövdesi) ve trigger ops_guard_confirmed_start; eşzamanlılık açık transaction + pg_blocking_pids ile.
import test,{before,after} from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
import {startDb,as,exec,board,rowOf,seed,rejects,pid,assertBlocked,count,istanbulToday,plan,id,sleep} from './harness.mjs';
let db,root,A,B,today;
const conf=()=>({source:'branch',witness:'Synthetic supervisor',occurredAt:new Date().toISOString()});
const call=(o={})=>({offset:0,outcome:'on_way',occurredAt:new Date().toISOString(),...o});
const attendance=(c,asg,rev,status,user=10)=>c.query('SELECT public.ops_record_attendance($1,$2,$3,$4,$5,$6) r',[id(user),id(1),randomUUID(),asg,rev,status]);
const replace=(c,asg,worker,rev,command=randomUUID(),user=10)=>c.query('SELECT public.ops_replace_assignment($1,$2,$3,$4,$5,$6) r',[id(user),id(1),command,asg,id(worker),rev]).then(r=>r.rows[0].r);
const asgRow=(asg)=>root.query('SELECT attendance,attendance_revision,removed_at FROM ops_assignments WHERE id=$1',[asg]).then(r=>r.rows[0]);
before(async()=>{db=await startDb();root=db.root;today=await istanbulToday(root);
 await seed(root,{requests:[{id:300,workDate:today,assignments:[{id:405,worker:200},{id:406,worker:201},{id:407,worker:202},{id:411,worker:203}]},{id:301,workDate:today,assignments:[]},{id:302,workDate:today,assignments:[]}]});
 A=await db.connect();B=await db.connect();await as(A,10);await as(B,11);
 for(const n of [405,406,407])await exec(A,{assignment:id(n),rev:0,action:'plan',payload:plan()});});
after(async()=>{await db?.stop();});
const row=async(asg)=>rowOf(await board(A,{day:today}),asg);

test('4a teyit ile attendance=present ve attendance_revision aynı transaction\'da',async()=>{
 const r=await exec(A,{assignment:id(405),rev:1,action:'confirm',payload:conf()});assert.equal(r.revision,2);
 const a=await asgRow(id(405));assert.equal(a.attendance,'present');assert.equal(a.attendance_revision,1);assert.ok((await row(id(405))).confirmedAt);
});
test('4b eski gerçekleşme yazarı teyitli kaydı absent/unreported yapamaz (trigger START_CONFIRMED); present tekrarına izin verir (not)',async()=>{
 await rejects(()=>attendance(A,id(405),1,'absent'),/START_CONFIRMED/);await rejects(()=>attendance(A,id(405),1,'unreported'),/START_CONFIRMED/);
 assert.equal((await asgRow(id(405))).attendance,'present');
 await attendance(A,id(405),1,'present');assert.equal((await asgRow(id(405))).attendance_revision,2,'present→present kabul, revision 2');
});
test('4c eşzamanlı: A teyit açık transaction\'da, B absent yazısı BEKLER, commit sonrası reddedilir; present kalır',async()=>{
 const pa=await pid(A),pb=await pid(B);
 await A.query('BEGIN');await exec(A,{assignment:id(406),rev:1,action:'confirm',payload:conf()});
 const absent=attendance(B,id(406),0,'absent',11);await assertBlocked(root,absent,pb,pa);
 await A.query('COMMIT');
 await rejects(()=>absent,/OPS_STALE_VERSION|START_CONFIRMED/);assert.equal((await asgRow(id(406))).attendance,'present');
});
test('4d teyitli atama yedeklenemez (OPS_REPLACE_PRESENT); teyit sırasında yedekleme bekler ve reddedilir',async()=>{
 await rejects(()=>replace(A,id(405),201,2),/OPS_REPLACE_PRESENT/);
 // 407: teyit açıkken replace bloklanır
 const pa=await pid(A),pb=await pid(B);
 await A.query('BEGIN');await exec(A,{assignment:id(407),rev:1,action:'confirm',payload:conf()});
 const rep=replace(B,id(407),204,0,randomUUID(),11);await assertBlocked(root,rep,pb,pa);
 await A.query('ROLLBACK'); // teyit geri alındı: yedekleme artık geçmeli
 const out=await rep;assert.equal(out.replacedAssignmentId,id(407));assert.equal((await asgRow(id(407))).removed_at!==null,true);
});
test('4e geri alma: gerekçe zorunlu, confirmed null, attendance unreported, geçmiş korunur; sonra eski yazar absent yazabilir',async()=>{
 await rejects(()=>exec(A,{assignment:id(405),rev:2,action:'reopen',payload:{reason:'x'}}),/START_REASON/);
 const r=await exec(A,{assignment:id(405),rev:2,action:'reopen',payload:{reason:'Yanlış şube teyidi'}});assert.equal(r.revision,3);
 const a=await asgRow(id(405));assert.equal(a.attendance,'unreported');assert.equal(a.attendance_revision,3);
 const x=await row(id(405));assert.equal(x.confirmedAt,null);assert.deepEqual(x.events.map(e=>e.kind),['plan','confirm','reopen']);
 await attendance(A,id(405),3,'absent');assert.equal((await asgRow(id(405))).attendance,'absent');
 await rejects(()=>exec(A,{assignment:id(405),rev:3,action:'confirm',payload:conf()}),/START_ATTENDANCE_CONFLICT/,'absent iken teyit çelişki');
});
test('4f yedek atama planı devralır, geçmişi devralmaz; eski kayda yazma START_CLOSED; tekrar aynı komut tek inherited olay',async()=>{
 const asg=id(406);await exec(A,{assignment:asg,rev:2,action:'reopen',payload:{reason:'Yedek için geri alındı'}});
 await exec(A,{assignment:asg,rev:3,action:'call',payload:call()});await exec(A,{assignment:asg,rev:4,action:'call',payload:call({outcome:'unreachable',reason:'Tekrar arandı'})});
 const before=await row(asg);assert.equal(before.events.filter(e=>e.kind==='call').length,2);
 const command=randomUUID(),attRev=(await asgRow(asg)).attendance_revision;const first=await replace(A,asg,205,attRev,command);
 assert.equal(first.id,command);
 const b=await board(A,{day:today});const old=rowOf(b,asg),fresh=rowOf(b,command);
 assert.equal(old.closed,true);assert.equal(old.events.length,before.events.length,'eski geçmiş dokunulmadı');
 assert.equal(fresh.startAt,old.startAt);assert.deepEqual(fresh.offsets,old.offsets);assert.equal(fresh.responsibleId,old.responsibleId);
 assert.equal(fresh.revision,1);assert.equal(fresh.confirmedAt,null);assert.equal(fresh.attendance,'unreported');
 assert.deepEqual(fresh.events.map(e=>e.kind),['inherited']);assert.equal(fresh.events[0].payload.previousAssignmentId,asg);
 await rejects(()=>exec(A,{assignment:asg,rev:5,action:'call',payload:call()}),/START_CLOSED/);
 await rejects(()=>exec(A,{assignment:asg,rev:5,action:'plan',payload:{...plan(),reason:'kapalı'}}),/START_CLOSED/);
 assert.deepEqual(await replace(A,asg,205,attRev,command),first,'idempotent makbuz');
 await rejects(()=>replace(A,asg,205,attRev+1,command),/OPS_IDEMPOTENCY_MISMATCH/,'aynı komut farklı içerik');
 assert.equal(await count(root,"SELECT count(*) n FROM ops_start_events WHERE assignment_id=$1 AND kind='inherited'",[command]),1);
 assert.equal(await count(root,'SELECT count(*) n FROM ops_start_plans WHERE assignment_id=$1',[command]),1);
 const c=await exec(A,{assignment:command,rev:1,action:'confirm',payload:conf()});assert.equal(c.revision,2);
});
test('4g talep iptali (ops_mutate cancel) sonrası atamaya yazma START_CLOSED; plan geçmişi kalır',async()=>{
 await root.query(`INSERT INTO ops_assignments(id,tenant_id,request_id,work_date,worker_id,created_by) VALUES($1,$2,$3,$4,$5,$6)`,[id(409),id(1),id(301),today,id(206),id(10)]);
 await exec(A,{assignment:id(409),rev:0,action:'plan',payload:plan()});
 await A.query('SELECT public.ops_execute_scoped($1,$2,$3,$4,$5)',[id(10),id(1),randomUUID(),'cancel',{requestId:id(301)}]);
 const r=await row(id(409));assert.equal(r.closed,true);assert.equal(r.events.length,1);
 await rejects(()=>exec(A,{assignment:id(409),rev:1,action:'call',payload:call()}),/START_CLOSED/);
});
test('4h aynı gün başka atamada present olan personel teyit edilemez (kaldırılmış ama present kayıt dahil)',async()=>{
 await attendance(A,id(411),0,'present');
 await A.query('SELECT public.ops_execute_scoped($1,$2,$3,$4,$5)',[id(10),id(1),randomUUID(),'remove',{requestId:id(300),assignmentId:id(411)}]);
 const assign=randomUUID();await A.query('SELECT public.ops_execute_scoped($1,$2,$3,$4,$5)',[id(10),id(1),assign,'assign',{requestId:id(302),workerId:id(203)}]);
 await exec(A,{assignment:assign,rev:0,action:'plan',payload:plan()});await sleep(5);
 await rejects(()=>exec(A,{assignment:assign,rev:1,action:'confirm',payload:conf()}),/START_ATTENDANCE_CONFLICT/);
 assert.equal((await asgRow(assign)).attendance,'unreported');
});
test('4i teyitli+present atama talep iptaliyle kapanabilir: teyit kalır, listede "kapandı" öne geçer (davranış notu)',async()=>{
 const asg=id(405);await attendance(A,asg,4,'unreported');await exec(A,{assignment:asg,rev:3,action:'confirm',payload:conf()});
 await A.query('SELECT public.ops_execute_scoped($1,$2,$3,$4,$5)',[id(10),id(1),randomUUID(),'remove',{requestId:id(300),assignmentId:asg}]);
 const r=await row(asg);assert.equal(r.closed,true);assert.ok(r.confirmedAt);assert.equal(r.attendance,'present');
});
test('4j plansız atamanın yedeği plan/olay devralmaz (uydurma saat yok)',async()=>{
 await root.query(`INSERT INTO ops_assignments(id,tenant_id,request_id,work_date,worker_id,created_by) VALUES($1,$2,$3,$4,$5,$6)`,[id(412),id(1),id(302),today,id(207),id(10)]);
 const command=randomUUID();await replace(A,id(412),208,0,command);
 const r=rowOf(await board(A,{day:today}),command);assert.equal(r.startAt,null);assert.equal(r.revision,0);assert.deepEqual(r.events,[]);
 assert.equal(await count(root,'SELECT count(*) n FROM ops_start_plans WHERE assignment_id=$1',[command]),0);
});
