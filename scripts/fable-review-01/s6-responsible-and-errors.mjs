// Senaryo 6 — sorumlu değişimi ve hata gösterimi. Gerçek board çıktısı parseStartBoard'dan geçirilir;
// migration'ın fırlattığı START_* kodları startError haritasıyla karşılaştırılır (statik + birim).
import test,{before,after} from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {startDb,as,exec,board,rowOf,seed,rejects,istanbulToday,plan,id} from './harness.mjs';
import {importActualTypeScript} from '../helpers/import-typescript.mjs';
let db,root,A,today,lib;const asg=id(400);
before(async()=>{db=await startDb();root=db.root;today=await istanbulToday(root);
 await seed(root,{requests:[{id:300,workDate:today,assignments:[{id:400,worker:200}]}]});
 A=await db.connect();await as(A,10);lib=await importActualTypeScript(new URL('../../src/lib/operations/start-board.ts',import.meta.url));
 await exec(A,{assignment:asg,rev:0,action:'plan',payload:plan(11)});});
after(async()=>{await db?.stop();});
const row=async()=>rowOf(await board(A,{day:today}),asg);

test('6a sorumlu üyeliğini kaybedince listede ownerAvailable=false ve üye listesinden düşer; JS modeli urgent',async()=>{
 assert.equal((await row()).ownerAvailable,true);
 await root.query('DELETE FROM tenant_memberships WHERE user_id=$1',[id(11)]);
 const b=await board(A,{day:today});const r=rowOf(b,asg);assert.equal(r.ownerAvailable,false);assert.ok(!b.members.some(m=>m.id===id(11)));
 assert.equal(lib.startRowState(r,Date.parse(b.serverNow)).urgent,true);
});
test('6b geçersiz yeni sorumlu START_OWNER (üye değil / ik / yabancı tenant / yok); geçerli sorumlu gerekçeyle atanır',async()=>{
 for(const owner of [11,12,13,999])await rejects(()=>exec(A,{assignment:asg,rev:1,action:'plan',payload:{...plan(owner),reason:'Sorumlu değişti'}}),/START_OWNER/);
 const r=await exec(A,{assignment:asg,rev:1,action:'plan',payload:{...plan(10),reason:'Sorumlu değişti'}});assert.equal(r.revision,2);
 const x=await row();assert.equal(x.responsibleId,id(10));assert.equal(x.ownerAvailable,true);
 await root.query('INSERT INTO tenant_memberships VALUES($1,$2)',[id(11),id(1)]);
});
test('6c sorumlunun rolü ik olunca ownerAvailable=false; plan action mevcut sorumluyu da doğrular',async()=>{
 await exec(A,{assignment:asg,rev:2,action:'plan',payload:{...plan(11),reason:'Yeniden 11'}});
 await root.query("UPDATE profiles SET role='ik' WHERE id=$1",[id(11)]);
 assert.equal((await row()).ownerAvailable,false);
 await rejects(()=>exec(A,{assignment:asg,rev:3,action:'plan',payload:{...plan(11),reason:'Aynı sorumlu'}}),/START_OWNER/);
 await root.query("UPDATE profiles SET role='operasyon' WHERE id=$1",[id(11)]);
});
test('6d gerçek RPC çıktısı parseStartBoard\'dan geçer; sözleşmeye aykırı cevaplar boş/başarılı sayılmaz (throw)',async()=>{
 const b=await board(A,{day:today});assert.equal(lib.parseStartBoard(b).rows.length,1);
 const r=b.rows[0];const variants=[
  {...b,rows:[{...r,confirmedAt:new Date().toISOString(),source:'branch',witness:''}]},
  {...b,rows:[{...r,events:[{...r.events[0],actor:null}]}]},
  {...b,members:[{id:id(11),name:null}]},
  {...b,rows:Array.from({length:51},()=>r)},
  {...b,serverNow:'yakında'},
  {...b,rows:[{...r,offsets:[15]}]},
  null,{},[]];
 for(const v of variants)assert.throws(()=>lib.parseStartBoard(v),Error,JSON.stringify(v).slice(0,80));
});
test('6e migration\'ın fırlattığı her START_* kodu istemcide kesin bir metne eşlenmeli — eşlenmeyenler "belirsiz" gösteriliyor',async()=>{
 const sql=await readFile(new URL('../../supabase/migrations/20260909002700_start_tracking.sql',import.meta.url),'utf8');
 const raised=[...new Set([...sql.matchAll(/RAISE EXCEPTION '(START_[A-Z_]+)'/g)].map(m=>m[1]))].sort();
 const generic=lib.startError({message:'__none__'});
 const unmapped=raised.filter(code=>lib.startError({message:code})===generic);
 console.log('fırlatılan kodlar:',raised.join(' '));console.log('eşlenmeyen:',unmapped.join(' ')||'(yok)');
 assert.deepEqual(unmapped,[],`kesin ret kodları belirsiz metinle gösteriliyor: ${unmapped.join(', ')}`);
});
test('6f geçersiz sorumlu kimliği (uuid değil) START_INPUT yerine ham 22P02 hatası döner',async()=>{
 const e=await rejects(()=>exec(A,{assignment:asg,rev:3,action:'plan',payload:{...plan(),responsibleId:'yok',reason:'x'}}),/./);
 console.log('gelen hata:',e.code,e.message);assert.equal(e.code,'22P02');
});
