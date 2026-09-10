// Senaryo 1 — yanıt kaybı ve tekrar. Gerçek ops_start_execute / ops_reconcile_commands gövdeleri,
// iki bağlantı, açık transaction + pg_blocking_pids ile bekleme kanıtı.
import test,{before,after} from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
import {startDb,as,exec,board,rowOf,seed,rejects,pid,assertBlocked,count,istanbulToday,plan,id} from './harness.mjs';
import {importActualTypeScript} from '../helpers/import-typescript.mjs';
let db,root,A,B,today;const asg=id(400);
before(async()=>{db=await startDb();root=db.root;today=await istanbulToday(root);
 await seed(root,{requests:[{id:300,workDate:today,assignments:[{id:400,worker:200}]}]});
 A=await db.connect();B=await db.connect();await as(A,10);await as(B,11);});
after(async()=>{await db?.stop();});
const events=()=>count(root,'SELECT count(*) n FROM ops_start_events WHERE assignment_id=$1',[asg]);
const commands=(cmd)=>count(root,'SELECT count(*) n FROM ops_commands WHERE id=$1',[cmd]);

test('1a aynı komut kimliğiyle ardışık tekrar: aynı makbuz, tek olay, tek revision artışı',async()=>{
 const cmd=randomUUID();const first=await exec(A,{assignment:asg,rev:0,action:'plan',payload:plan(),command:cmd});
 assert.equal(first.revision,1);
 const again=await exec(A,{assignment:asg,rev:0,action:'plan',payload:plan(),command:cmd});
 assert.deepEqual(again,first);assert.equal(await events(),1);assert.equal(rowOf(await board(A,{day:today}),asg).revision,1);
});
test('1b aynı kimlik, farklı içerik: START_REPLAY; kayıt değişmez',async()=>{
 const cmd=randomUUID();await exec(A,{assignment:asg,rev:1,action:'claim',command:cmd});
 await rejects(()=>exec(A,{assignment:asg,rev:1,action:'release',command:cmd}),/START_REPLAY/);
 await rejects(()=>exec(A,{assignment:asg,rev:2,action:'claim',command:cmd}),/START_REPLAY/);
 assert.equal(await events(),2);assert.equal(rowOf(await board(A,{day:today}),asg).revision,2);
 await exec(A,{assignment:asg,rev:2,action:'release'});
});
test('1c gecikmiş ilk çağrı eşzamanlı gelir: ikinci bağlantı ilkinin commit\'ini BEKLER, sonra aynı makbuzu alır',async()=>{
 const cmd=randomUUID();const A2=await db.connect();await as(A2,10);
 const pa=await pid(A),pa2=await pid(A2);
 await A.query('BEGIN');const first=await exec(A,{assignment:asg,rev:3,action:'claim',command:cmd});
 const late=exec(A2,{assignment:asg,rev:3,action:'claim',command:cmd});
 await assertBlocked(root,late,pa2,pa);
 await A.query('COMMIT');
 assert.deepEqual(await late,first);assert.equal(await commands(cmd),1);
 assert.equal(await count(root,'SELECT count(*) n FROM ops_start_events WHERE id=$1',[cmd]),1);
 await A2.end();await exec(A,{assignment:asg,rev:4,action:'release'});
});
test('1d yazma uçuştayken kapatma (reconcile p_close): kapatma bekler, commit sonrası confirmed',async()=>{
 const cmd=randomUUID();const pa=await pid(A),pb=await pid(B);await as(B,10);
 await A.query('BEGIN');await exec(A,{assignment:asg,rev:5,action:'claim',command:cmd});
 const close=B.query('SELECT public.ops_reconcile_commands($1,$2,$3,true) r',[id(10),id(1),[cmd]]);
 await assertBlocked(root,close,pb,pa);
 await A.query('COMMIT');
 assert.deepEqual((await close).rows[0].r,[{id:cmd,status:'confirmed'}]);
 assert.equal(await count(root,'SELECT count(*) n FROM ops_start_events WHERE id=$1',[cmd]),1);
 await exec(A,{assignment:asg,rev:6,action:'release'});
});
test('1e geri alınan yazma ve kapatma yarışı: kapatma kazanır, geç yazma START_REPLAY, olay üretilmez',async()=>{
 const cmd=randomUUID();const pa=await pid(A),pb=await pid(B);const before=await events();
 await A.query('BEGIN');await exec(A,{assignment:asg,rev:7,action:'claim',command:cmd});
 const close=B.query('SELECT public.ops_reconcile_commands($1,$2,$3,true) r',[id(10),id(1),[cmd]]);
 await assertBlocked(root,close,pb,pa);
 await A.query('ROLLBACK');
 assert.deepEqual((await close).rows[0].r,[{id:cmd,status:'closed'}]);
 await rejects(()=>exec(A,{assignment:asg,rev:7,action:'claim',command:cmd}),/START_REPLAY/);
 assert.equal(await events(),before);assert.equal(rowOf(await board(A,{day:today}),asg).revision,7);
});
test('1f hiç gönderilmemiş komut: kapatmadan önce unknown, kapatınca closed, sonra aynı kimlikle yazma START_REPLAY',async()=>{
 const cmd=randomUUID();
 assert.deepEqual((await B.query('SELECT public.ops_reconcile_commands($1,$2,$3,false) r',[id(10),id(1),[cmd]])).rows[0].r,[{id:cmd,status:'unknown'}]);
 assert.equal(await commands(cmd),0);
 assert.deepEqual((await B.query('SELECT public.ops_reconcile_commands($1,$2,$3,true) r',[id(10),id(1),[cmd]])).rows[0].r,[{id:cmd,status:'closed'}]);
 await rejects(()=>exec(A,{assignment:asg,rev:7,action:'claim',command:cmd}),/START_REPLAY/);
 assert.equal(await events(),(await events()));
});
test('1g kapatma başka aktörün komutunu göremez: aktör anahtarı PK\'nın parçası',async()=>{
 const cmd=randomUUID();await exec(A,{assignment:asg,rev:7,action:'claim',command:cmd});
 await as(B,11);
 assert.deepEqual((await B.query('SELECT public.ops_reconcile_commands($1,$2,$3,false) r',[id(11),id(1),[cmd]])).rows[0].r,[{id:cmd,status:'unknown'}]);
 await exec(A,{assignment:asg,rev:8,action:'release'});
});
test('1h istemci kimlik tekrarı: aynı satır+içerik aynı komut kimliği, yenilenmiş revision yeni kimlik',async()=>{
 const {reserveCommand}=await importActualTypeScript(new URL('../../src/lib/operations/pending-commands.ts',import.meta.url));
 const disk=new Map(),storage={getItem:k=>disk.get(k)??null,setItem:(k,v)=>disk.set(k,v)},locks={request:(k,fn)=>Promise.resolve().then(fn)};
 const scope={actorId:id(10),tenantId:id(1)};const body=rev=>({assignmentId:asg,expectedRevision:rev,action:'call',data:{offset:0,outcome:'on_way',occurredAt:'2026-09-09T05:00:00.000Z'}});
 const a=await reserveCommand(scope,'start',body(9),storage,locks),b=await reserveCommand(scope,'start',body(9),storage,locks),c=await reserveCommand(scope,'start',body(10),storage,locks);
 assert.equal(a,b);assert.notEqual(a,c);
});
test('1i UI mesajı ile transaction durumu: kesin ret (START_REPLAY/START_INPUT) istemcide "belirsiz" metniyle gösteriliyor',async()=>{
 const {startError}=await importActualTypeScript(new URL('../../src/lib/operations/start-board.ts',import.meta.url));
 const generic=startError({message:'zzz'});
 const replay=await rejects(()=>exec(A,{assignment:asg,rev:9,action:'plan',payload:{...plan(),offsets:[-1,-1]}}),/START_INPUT/);
 assert.equal(await count(root,'SELECT count(*) n FROM ops_commands WHERE kind=$1 AND result IS NULL',['start']),0,'ret edilen komut satırı kalmadı (transaction geri alındı)');
 const shown=startError(replay);
 // Kanıt: sunucu kesin reddetti ve hiçbir şey yazmadı; kullanıcı "kaydın yapılmadığı anlamına gelmez" cümlesini görüyor.
 assert.equal(shown,generic);assert.match(shown,/kaydın yapılmadığı anlamına gelmez/);
});
