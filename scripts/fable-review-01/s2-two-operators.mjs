// Senaryo 2 — iki operatör ve lease. İki gerçek bağlantı (kullanıcı 10 ve 11), açık transaction ile bekleme
// kanıtı, süre dolması root ile geriye alınmış claim_until üzerinden (clock_timestamp mock'lanamaz).
import test,{before,after} from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
import {startDb,as,exec,board,rowOf,seed,rejects,pid,assertBlocked,count,istanbulToday,plan,id} from './harness.mjs';
let db,root,A,B,today;const asg=id(400);const call=(o={})=>({offset:0,outcome:'on_way',occurredAt:new Date().toISOString(),...o});
before(async()=>{db=await startDb();root=db.root;today=await istanbulToday(root);
 await seed(root,{requests:[{id:300,workDate:today,assignments:[{id:400,worker:200},{id:401,worker:201}]}]});
 A=await db.connect();B=await db.connect();await as(A,10);await as(B,11);
 await exec(A,{assignment:asg,rev:0,action:'plan',payload:plan()});});
after(async()=>{await db?.stop();});
const row=async()=>rowOf(await board(A,{day:today}),asg);

test('2a lease canlıyken diğer kullanıcı (güncel revision ile): call/claim/release START_CLAIMED',async()=>{
 await exec(A,{assignment:asg,rev:1,action:'claim'});const r=await row();assert.equal(r.claimedBy,id(10));assert.equal(r.revision,2);
 for(const action of ['call','claim','release'])await rejects(()=>exec(B,{user:11,assignment:asg,rev:2,action,payload:action==='call'?call():{}}),/START_CLAIMED/);
 assert.equal((await row()).revision,2,'reddedilen denemeler revision üretmedi');
});
test('2b eşzamanlı: A claim açık transaction\'da, B call BEKLER (pg_blocking_pids), commit sonrası START_STALE',async()=>{
 await exec(A,{assignment:asg,rev:2,action:'release'}); // rev 3, kilit yok
 const pa=await pid(A),pb=await pid(B);
 await A.query('BEGIN');await exec(A,{assignment:asg,rev:3,action:'claim'});
 const late=exec(B,{user:11,assignment:asg,rev:3,action:'call',payload:call()});
 await assertBlocked(root,late,pb,pa);
 await A.query('COMMIT');
 await rejects(()=>late,/START_STALE/);
 await rejects(()=>exec(B,{user:11,assignment:asg,rev:4,action:'call',payload:call()}),/START_CLAIMED/);
 assert.equal((await row()).revision,4);
});
test('2c süre dolunca (claim_until geçmişe alınır) diğer kullanıcı aramayı yapar, lease temizlenir',async()=>{
 await root.query("UPDATE ops_start_plans SET claim_until=clock_timestamp()-interval '1 second' WHERE assignment_id=$1",[asg]);
 const r=await exec(B,{user:11,assignment:asg,rev:4,action:'call',payload:call()});assert.equal(r.revision,5);
 const after=await row();assert.equal(after.claimedBy,null);assert.equal(after.claimUntil,null);
 assert.equal(after.events.filter(e=>e.kind==='call').length,1);
});
test('2d eski sekmeden release/call: eski revision START_STALE; boş plana release izinli ama revision artırır (not)',async()=>{
 await rejects(()=>exec(A,{assignment:asg,rev:3,action:'release'}),/START_STALE/);
 await rejects(()=>exec(A,{assignment:asg,rev:4,action:'call',payload:call()}),/START_STALE/);
 const r=await exec(A,{assignment:asg,rev:5,action:'release'});assert.equal(r.revision,6,'kilitsiz planda release kabul edilir ve revision 6 olur');
});
test('2e aynı revision ile iki gerçek bağlantıdan eşzamanlı claim: tek kazanan, diğeri START_STALE',async()=>{
 const out=await Promise.allSettled([exec(A,{assignment:asg,rev:6,action:'claim'}),exec(B,{user:11,assignment:asg,rev:6,action:'claim'})]);
 assert.equal(out.filter(o=>o.status==='fulfilled').length,1);assert.match(out.find(o=>o.status==='rejected').reason.message,/START_STALE/);
 const r=await row();assert.equal(r.revision,7);assert.ok([id(10),id(11)].includes(r.claimedBy));
 await root.query("UPDATE ops_start_plans SET claimed_by=NULL,claim_until=NULL WHERE assignment_id=$1",[asg]);
});
test('2f aynı revision ile eşzamanlı confirm (iki bağlantı): tek teyit, tek present, tek olay',async()=>{
 const conf=()=>({source:'branch',witness:'Synthetic supervisor',occurredAt:new Date().toISOString()});
 const out=await Promise.allSettled([exec(A,{assignment:asg,rev:7,action:'confirm',payload:conf()}),exec(B,{user:11,assignment:asg,rev:7,action:'confirm',payload:conf()})]);
 assert.equal(out.filter(o=>o.status==='fulfilled').length,1);assert.match(out.find(o=>o.status==='rejected').reason.message,/START_STALE/);
 assert.equal(await count(root,"SELECT count(*) n FROM ops_start_events WHERE assignment_id=$1 AND kind='confirm'",[asg]),1);
 assert.equal((await root.query('SELECT attendance,attendance_revision FROM ops_assignments WHERE id=$1',[asg])).rows[0].attendance,'present');
});
test('2g lease sahibi olmayan kullanıcı, lease canlıyken TEYİT verebilir (davranış notu, hata değil)',async()=>{
 const other=id(401);await exec(A,{assignment:other,rev:0,action:'plan',payload:plan()});await exec(A,{assignment:other,rev:1,action:'claim'});
 const r=await exec(B,{user:11,assignment:other,rev:2,action:'confirm',payload:{source:'field',witness:'Synthetic field lead',occurredAt:new Date().toISOString()}});
 assert.equal(r.revision,3);const x=rowOf(await board(A,{day:today}),other);assert.ok(x.confirmedAt);assert.equal(x.claimedBy,null,'teyit lease\'i temizler');
});
test('2h geçmiş kayıpsız: her başarılı işlem için tam olarak bir olay, revision boşluksuz',async()=>{
 const rows=(await root.query('SELECT revision,kind FROM ops_start_events WHERE assignment_id=$1 ORDER BY revision',[asg])).rows;
 assert.deepEqual(rows.map(r=>r.revision),[1,2,3,4,5,6,7,8]);
 assert.deepEqual(rows.map(r=>r.kind),['plan','claim','release','claim','call','release','claim','confirm']);
});
