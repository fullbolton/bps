// Senaryo 3 — plan ve zaman sınırları. Saatler sabit ISO değerlerle verilir; tek duvar-saat bağımlılığı
// "İstanbul'da bugün hangi gün" (DB'den okunur). created_at/planned_at root ile sabit geçmiş anlara alınır.
import test,{before,after} from 'node:test';import assert from 'node:assert/strict';
import {startDb,as,exec,board,rowOf,seed,rejects,istanbulToday,shiftDay,plan,ist,id,sleep} from './harness.mjs';
import {importActualTypeScript} from '../helpers/import-typescript.mjs';
let db,root,A,today,yday,startRowState;
before(async()=>{db=await startDb();root=db.root;today=await istanbulToday(root);yday=shiftDay(today,-1);
 await seed(root,{requests:[{id:300,workDate:yday,assignments:[{id:401,worker:200},{id:402,worker:201}]},{id:301,workDate:today,assignments:[{id:403,worker:202},{id:404,worker:203}]},{id:302,workDate:shiftDay(today,1),assignments:[{id:405,worker:204}]}]});
 // Dünkü atamalar ve planlar sabit geçmiş anda oluşmuş sayılır (İstanbul 06:00).
 await root.query('UPDATE ops_assignments SET created_at=$1 WHERE id IN ($2,$3)',[ist(yday,'06:00:00'),id(401),id(402)]);
 A=await db.connect();await as(A,10);({startRowState}=await importActualTypeScript(new URL('../../src/lib/operations/start-board.ts',import.meta.url)));});
after(async()=>{await db?.stop();});
const backdatePlan=(asg)=>root.query('UPDATE ops_start_plans SET created_at=$1,planned_at=$1 WHERE assignment_id=$2',[ist(yday,'06:00:00'),asg]);
const row=async(asg,day=today)=>rowOf(await board(A,{day}),asg);

test('3a plan saati İstanbul (+03) olarak yorumlanır: 00:30 → önceki UTC günü 21:30Z',async()=>{
 await exec(A,{assignment:id(401),rev:0,action:'plan',payload:plan(10,'00:30',[-15])});await backdatePlan(id(401));
 const r=await row(id(401),yday);assert.equal(Date.parse(r.startAt),Date.parse(ist(yday,'00:30:00')));
 assert.equal(new Date(r.startAt).toISOString().slice(0,10),shiftDay(yday,-1),'UTC tarihi bir gün geride');
});
test('3b gece yarısı: iş günü D-1 için D 00:00:01 (İstanbul) arama START_TIME — UTC tarihi hâlâ D-1 olsa da',async()=>{
 const occurredAt=ist(today,'00:00:01');assert.equal(new Date(occurredAt).toISOString().slice(0,10),yday,'UTC\'de tarih D-1');
 await rejects(()=>exec(A,{assignment:id(401),rev:1,action:'call',payload:{offset:0,outcome:'on_way',occurredAt}}),/START_TIME/);
 const r=await exec(A,{assignment:id(401),rev:1,action:'call',payload:{offset:0,outcome:'on_way',occurredAt:ist(yday,'23:59:59')}});assert.equal(r.revision,2);
});
test('3c teyit iş günü dışında reddedilir: sonraki gün START_TIME (genel tarih kontrolü önce), önceki gün START_ATTENDANCE_CONFLICT; D-1 23:59:59 kabul, present',async()=>{
 const conf=(occurredAt)=>({source:'branch',witness:'Synthetic supervisor',occurredAt});
 await rejects(()=>exec(A,{assignment:id(401),rev:2,action:'confirm',payload:conf(ist(today,'00:00:00'))}),/START_TIME/);
 await exec(A,{assignment:id(405),rev:0,action:'plan',payload:plan(10,'09:00',[-60])}); // yarınki iş günü
 await rejects(()=>exec(A,{assignment:id(405),rev:1,action:'confirm',payload:conf(new Date().toISOString())}),/START_ATTENDANCE_CONFLICT/,'iş günü gelmeden teyit');
 await exec(A,{assignment:id(401),rev:2,action:'confirm',payload:conf(ist(yday,'23:59:59'))});
 const r=await row(id(401),yday);assert.equal(r.attendance,'present');assert.equal(Date.parse(r.confirmedAt),Date.parse(ist(yday,'23:59:59')));
});
test('3d gelecekteki olay ve atama öncesi olay START_TIME; eta sınırları',async()=>{
 await exec(A,{assignment:id(402),rev:0,action:'plan',payload:plan(10,'09:00',[-60])});await backdatePlan(id(402));
 const future=new Date(Date.now()+3600000).toISOString();
 await rejects(()=>exec(A,{assignment:id(402),rev:1,action:'call',payload:{offset:0,outcome:'on_way',occurredAt:future}}),/START_TIME/);
 await rejects(()=>exec(A,{assignment:id(402),rev:1,action:'call',payload:{offset:0,outcome:'on_way',occurredAt:ist(yday,'05:59:59')}}),/START_TIME/,'atama öncesi');
 await rejects(()=>exec(A,{assignment:id(402),rev:1,action:'call',payload:{offset:0,outcome:'on_way',occurredAt:ist(yday,'10:00:00'),eta:ist(yday,'09:00:00')}}),/START_TIME/,'eta görüşmeden önce');
 await rejects(()=>exec(A,{assignment:id(402),rev:1,action:'call',payload:{offset:0,outcome:'on_way',occurredAt:ist(yday,'10:00:00'),eta:ist(today,'10:00:01')}}),/START_TIME/,'eta 24 saatten uzak');
 await exec(A,{assignment:id(402),rev:1,action:'call',payload:{offset:-60,outcome:'preparing',occurredAt:ist(yday,'08:00:00')}});
});
test('3e planlı adım zamanından önce arama START_CHECK_TIME; plan dışı offset START_CHECK_TIME',async()=>{
 await exec(A,{assignment:id(403),rev:0,action:'plan',payload:plan(10,'23:59',[-30])});await sleep(5); // ms kesmesi: bkz. bulgu (occurredAt saniye/ms, created_at µs)
 await rejects(()=>exec(A,{assignment:id(403),rev:1,action:'call',payload:{offset:-30,outcome:'on_way',occurredAt:new Date().toISOString()}}),/START_CHECK_TIME/);
 await rejects(()=>exec(A,{assignment:id(403),rev:1,action:'call',payload:{offset:-45,outcome:'on_way',occurredAt:new Date().toISOString()}}),/START_CHECK_TIME/);
});
test('3f geç atama: planlanan adımlar plan anından önceyse uygulanmaz (SQL START_CHECK_TIME) ve JS modeli "due/not_applicable" der',async()=>{
 await exec(A,{assignment:id(404),rev:0,action:'plan',payload:plan(10,'00:01',[-1])}); // adım 00:00, plan şimdiawait sleep(5); // ms kesmesi: bkz. bulgu (occurredAt saniye/ms, created_at µs)
 console.log('3f zaman tanıkları:',JSON.stringify((await root.query("SELECT a.created_at a_created,p.created_at p_created,p.planned_at,p.start_at,clock_timestamp() db_now,r.work_date::text work_date FROM ops_assignments a JOIN ops_start_plans p ON p.assignment_id=a.id JOIN ops_daily_requests r ON r.id=a.request_id WHERE a.id=$1",[id(404)])).rows[0]),'js_now',new Date().toISOString());
 await rejects(()=>exec(A,{assignment:id(404),rev:1,action:'call',payload:{offset:-1,outcome:'on_way',occurredAt:new Date().toISOString()}}),/START_CHECK_TIME/);
 const r=await row(id(404));const m=startRowState(r,Date.parse((await board(A,{day:today})).serverNow));
 assert.equal(m.steps[0].state,'not_applicable');assert.equal(m.status,'unverified','başlangıç geçti, teyit yok');
 const done=await exec(A,{assignment:id(404),rev:1,action:'call',payload:{offset:0,outcome:'claimed_arrival',occurredAt:new Date().toISOString()}});assert.equal(done.revision,2);
});
test('3g personel beyanı hiçbir kombinasyonda teyit değildir: claimed_arrival sonrası confirmedAt null, attendance unreported, model pending/unverified',async()=>{
 const r=await row(id(404));assert.equal(r.confirmedAt,null);assert.equal(r.attendance,'unreported');
 const m=startRowState(r,Date.parse((await board(A,{day:today})).serverNow));assert.ok(['pending','unverified'].includes(m.status));assert.notEqual(m.status,'confirmed');
 await rejects(()=>exec(A,{assignment:id(404),rev:2,action:'confirm',payload:{source:'worker',witness:'Kendisi',occurredAt:new Date().toISOString()}}),/START_WITNESS/);
 await rejects(()=>exec(A,{assignment:id(404),rev:2,action:'confirm',payload:{source:'branch',witness:'   ',occurredAt:new Date().toISOString()}}),/START_WITNESS/);
});
test('3h plan değişince eski arama olayları yeni planı boyamaz (plan_version); aynı adım yeni sürümde gerekçesiz tekrar kaydedilir',async()=>{
 await rejects(()=>exec(A,{assignment:id(404),rev:2,action:'plan',payload:plan(10,'00:02',[-1])}),/START_REASON/);
 await exec(A,{assignment:id(404),rev:2,action:'plan',payload:{...plan(10,'00:02',[-1]),reason:'Saat düzeltildi'}});await sleep(5); // ms kesmesi: bkz. bulgu (occurredAt saniye/ms, created_at µs)
 const r=await row(id(404));assert.equal(r.planVersion,2);assert.equal(r.revision,3);
 assert.equal(r.events.filter(e=>e.kind==='call').length,1,'eski olay silinmedi');
 const m=startRowState(r,Date.parse((await board(A,{day:today})).serverNow));assert.equal(m.status,'unverified','eski claimed_arrival yeni planda pending üretmedi');
 const again=await exec(A,{assignment:id(404),rev:3,action:'call',payload:{offset:0,outcome:'on_way',occurredAt:new Date().toISOString()}});assert.equal(again.revision,4);
 await rejects(()=>exec(A,{assignment:id(404),rev:4,action:'call',payload:{offset:0,outcome:'on_way',occurredAt:new Date().toISOString()}}),/START_REASON/,'aynı sürümde tekrar gerekçe ister');
});
test('3i tarayıcı saat farkı: JS modeli yalnız verilen "now" ile hesaplar; ileri/geri saat sunucu sonucunu değiştirmez (statik+birim)',async()=>{
 const r=await row(id(404));const serverNow=Date.parse((await board(A,{day:today})).serverNow);
 const a=startRowState(r,serverNow),b=startRowState(r,serverNow+3600000*5),c=startRowState(r,serverNow-3600000*5);
 assert.equal(a.status,'unverified');assert.equal(b.status,'unverified');assert.notEqual(c.status,'confirmed');
 // İstemci `now`u sunucu serverNow + geçen süre olarak türetir (StartBoardClient satır 22); tarayıcı saati yalnız tick farkına girer.
});
// BULGU testi: bu test ürün davranışı düzelene kadar KIRMIZI kalır (bkz. FABLE_REVIEW_01_SONUC.md B-2).
test('3j [BULGU] plan kaydından ÖNCE yapılmış ek arama (offset 0) ve teyit, atama sonrası olsa da START_TIME ile reddediliyor; mesaj "atama öncesi" diyor',async()=>{
 await root.query('UPDATE ops_assignments SET created_at=$1 WHERE id=$2',[ist(today,'06:00:00'),id(403)]);
 const p=(await root.query('SELECT created_at FROM ops_start_plans WHERE assignment_id=$1',[id(403)])).rows[0].created_at;
 const fiveMinutesBeforePlan=new Date(p.getTime()-300000).toISOString();
 assert.ok(Date.parse(fiveMinutesBeforePlan)>Date.parse(ist(today,'06:00:00')),'önkoşul: görüşme atama oluşturulduktan sonra');
 const sameSecondAsPlan=new Date(Math.floor(p.getTime()/1000)*1000).toISOString(); // tarayıcının o saniyede göndereceği değer (saniye çözünürlüğü)
 for(const occurredAt of [fiveMinutesBeforePlan,sameSecondAsPlan]){
  let error=null;try{await exec(A,{assignment:id(403),rev:1,action:'call',payload:{offset:0,outcome:'on_way',occurredAt,note:'Plan girilmeden önce aranmıştı'}});}catch(e){error=e.message;}
  assert.equal(error,null,`occurredAt=${occurredAt} plan created_at=${p.toISOString()} → ${error} (istemci metni: "Görüşme zamanı gelecekte veya atama öncesinde olamaz.")`);
 }
});
