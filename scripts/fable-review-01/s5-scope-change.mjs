// Senaryo 5 — kapsam değişimi. Gerçek 001600 üyelik guard trigger'ı kurulu (tasks/admin RPC fixture stub'ı ile);
// üyelik/rol/tenant değişimi ile açık işlem arasındaki kilit sırası pg_blocking_pids ile kanıtlanır.
import test,{before,after} from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
import {startDb,as,exec,board,seed,rejects,pid,assertBlocked,count,istanbulToday,plan,id} from './harness.mjs';
import {importActualTypeScript} from '../helpers/import-typescript.mjs';
let db,root,A,today;const asg=id(400);
before(async()=>{db=await startDb({guard:true});root=db.root;today=await istanbulToday(root);
 await seed(root,{requests:[{id:300,workDate:today,assignments:[{id:400,worker:200}]}]});
 A=await db.connect();await as(A,11);await exec(A,{user:11,assignment:asg,rev:0,action:'plan',payload:plan(11)});});
after(async()=>{await db?.stop();});
const membership=(user,tenant,on)=>root.query(on?'INSERT INTO tenant_memberships(user_id,tenant_id) VALUES($1,$2)':'DELETE FROM tenant_memberships WHERE user_id=$1 AND tenant_id=$2',[id(user),id(tenant)]);
const events=()=>count(root,'SELECT count(*) n FROM ops_start_events WHERE assignment_id=$1',[asg]);

test('5a açık ekran sırasında üyelik kaybı: board ve execute START_SCOPE, olay yok',async()=>{
 assert.equal((await board(A,{user:11,day:today})).total,1);
 await membership(11,1,false);
 await rejects(()=>board(A,{user:11,day:today}),/START_SCOPE/);await rejects(()=>exec(A,{user:11,assignment:asg,rev:1,action:'claim'}),/START_SCOPE/);
 assert.equal(await events(),1);await membership(11,1,true);
});
test('5b rol kaybı (operasyon→ik): START_FORBIDDEN; geri alınca çalışır',async()=>{
 await root.query("UPDATE profiles SET role='ik' WHERE id=$1",[id(11)]);
 await rejects(()=>board(A,{user:11,day:today}),/START_FORBIDDEN/);await rejects(()=>exec(A,{user:11,assignment:asg,rev:1,action:'claim'}),/START_FORBIDDEN/);
 await root.query("UPDATE profiles SET role='operasyon' WHERE id=$1",[id(11)]);assert.equal((await board(A,{user:11,day:today})).total,1);
});
test('5c tenant değişimi: claim tenant 2 + üyelik 1 → START_SCOPE; çift üyelikte eski formun tenant 1 gönderimi ve tenant 2 üzerinden tenant 1 kaydı START_SCOPE',async()=>{
 await as(A,11,2);await rejects(()=>exec(A,{user:11,tenant:1,assignment:asg,rev:1,action:'claim'}),/START_SCOPE/);
 await membership(11,2,true);
 await rejects(()=>exec(A,{user:11,tenant:1,assignment:asg,rev:1,action:'claim'}),/START_SCOPE/,'doğrulanan tenant 2 iken tenant 1 adına yazma');
 await rejects(()=>exec(A,{user:11,tenant:2,assignment:asg,rev:1,action:'claim'}),/START_SCOPE/,'tenant 2 kapsamından tenant 1 ataması');
 assert.equal((await board(A,{user:11,tenant:2,day:today})).total,0,'yabancı kapsam verisi listelenmez');
 await membership(11,2,false);await as(A,11,1);assert.equal(await events(),1);
});
test('5d kilit sırası (gerçek 001600 trigger): açık işlem profil FOR SHARE tutar, üyelik silme BEKLER; commit sonrası silinir ve sonraki işlem START_SCOPE',async()=>{
 const B=await db.connect();const pa=await pid(A),pb=await pid(B);
 await A.query('BEGIN');await exec(A,{user:11,assignment:asg,rev:1,action:'claim'});
 const del=B.query('DELETE FROM tenant_memberships WHERE user_id=$1 AND tenant_id=$2',[id(11),id(1)]);
 await assertBlocked(root,del,pb,pa);
 await A.query('COMMIT');await del;
 await rejects(()=>exec(A,{user:11,assignment:asg,rev:2,action:'release'}),/START_SCOPE/);
 await membership(11,1,true);assert.equal(await events(),2);await B.end();
});
test('5e ters sıra: üyelik silme açık transaction\'da, işlem BEKLER; rollback → işlem geçer, commit → START_SCOPE (taze snapshot)',async()=>{
 const B=await db.connect();const pa=await pid(A),pb=await pid(B);
 await B.query('BEGIN');await B.query('DELETE FROM tenant_memberships WHERE user_id=$1 AND tenant_id=$2',[id(11),id(1)]);
 let op=exec(A,{user:11,assignment:asg,rev:2,action:'release'});await assertBlocked(root,op,pa,pb);
 await B.query('ROLLBACK');assert.equal((await op).revision,3);
 await B.query('BEGIN');await B.query('DELETE FROM tenant_memberships WHERE user_id=$1 AND tenant_id=$2',[id(11),id(1)]);
 op=exec(A,{user:11,assignment:asg,rev:3,action:'claim'});await assertBlocked(root,op,pa,pb);
 await B.query('COMMIT');await rejects(()=>op,/START_SCOPE/);
 await membership(11,1,true);assert.equal(await events(),3);await B.end();
});
test('5f reconcile kapsam dışı: yabancı tenant/aktör OPS_SCOPE_CHANGED; kapatma yazılmaz',async()=>{
 const cmd=randomUUID();
 await rejects(()=>A.query('SELECT public.ops_reconcile_commands($1,$2,$3,true)',[id(11),id(2),[cmd]]),/OPS_SCOPE_CHANGED/);
 await rejects(()=>A.query('SELECT public.ops_reconcile_commands($1,$2,$3,true)',[id(10),id(1),[cmd]]),/OPS_SCOPE_CHANGED/);
 assert.equal(await count(root,'SELECT count(*) n FROM ops_commands WHERE id=$1',[cmd]),0);
});
test('5g istemci: bekleyen komut anahtarı aktör+tenant; başka tenant/hesap eski kaydı görmez ve kapatamaz',async()=>{
 const {reserveCommand,pendingCommandIds}=await importActualTypeScript(new URL('../../src/lib/operations/pending-commands.ts',import.meta.url));
 const disk=new Map(),storage={getItem:k=>disk.get(k)??null,setItem:(k,v)=>disk.set(k,v)},locks={request:(k,fn)=>Promise.resolve().then(fn)};
 const a=await reserveCommand({actorId:id(11),tenantId:id(1)},'start',{x:1},storage,locks);
 assert.deepEqual(pendingCommandIds({actorId:id(11),tenantId:id(2)},storage),[]);assert.deepEqual(pendingCommandIds({actorId:id(10),tenantId:id(1)},storage),[]);
 assert.deepEqual(pendingCommandIds({actorId:id(11),tenantId:id(1)},storage),[a]);
});
test('5h "reddedildi" ile "bilinmiyor" ayrımı: START_SCOPE/START_FORBIDDEN kesin metin; ağ/kilit hatası belirsiz metin',async()=>{
 const {startError}=await importActualTypeScript(new URL('../../src/lib/operations/start-board.ts',import.meta.url));
 assert.match(startError({message:'START_SCOPE'}),/çalışma alanı değişti/);assert.match(startError({message:'START_FORBIDDEN'}),/yetkiniz yok/);
 assert.match(startError({message:'canceling statement due to lock timeout'}),/kaydın yapılmadığı anlamına gelmez/);
 assert.match(startError(new TypeError('Failed to fetch')),/kaydın yapılmadığı anlamına gelmez/);
});
