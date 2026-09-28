import test from 'node:test';
import assert from 'node:assert/strict';
import {importActualTypeScript} from './helpers/import-typescript.mjs';
import {id} from './fixtures/daily-operations.mjs';
const {parseStartOverview,startTrackingHref}=await importActualTypeScript(new URL('../src/lib/operations/start-overview.ts',import.meta.url));
const day='2026-09-09',at=day+'T08:00:00+03:00';
const row=n=>({id:id(n),requestId:id(300),companyId:id(20),company:'Synthetic',location:'Branch',worker:'Worker '+n,position:'Cleaner',createdAt:day+'T06:00:00+03:00',closed:false,ownerAvailable:true,revision:1,planVersion:1,offsets:[-60],events:[],startAt:at,plannedAt:day+'T06:00:00+03:00',responsibleId:id(10),confirmedAt:null});
const board=(rows=[],total=rows.length,dayTotal=total)=>({serverNow:at,day,total,dayTotal,filterScope:'day',rows,members:[]});
test('zero assignments differs from zero outstanding tracking',()=>{
 assert.equal(parseStartOverview(board(),day).dayTotal,0);
 assert.deepEqual(parseStartOverview(board([],0,60),day).items,[]);
 assert.equal(parseStartOverview(board([],0,60),day).dayTotal,60);
});
test('full count survives first-page/top-three rendering',()=>{
 const data=parseStartOverview(board(Array.from({length:50},(_,i)=>row(1000+i)),120,160),day);
 assert.equal(data.total,120);assert.equal(data.dayTotal,160);assert.equal(data.items.length,3);
 assert.deepEqual(data.items.map(r=>r.id),[1000,1001,1002].map(id));
});
test('partial or wrong-scope response is not a healthy summary',()=>{
 for(const b of [null,board([row(1)],5),board([],0,-1),{...board(),filterScope:undefined},{...board(),day:'2026-09-08'}])assert.throws(()=>parseStartOverview(b,day));
});
test('confirmed or closed record cannot become an outstanding item',()=>{
 assert.throws(()=>parseStartOverview(board([{...row(1),closed:true}]),day));
 assert.throws(()=>parseStartOverview(board([{...row(1),confirmedAt:at,source:'branch',witness:'Synthetic supervisor'}]),day));
});
test('employee claim remains pending and lost responsibility is explicit',()=>{
 const r={...row(1),startAt:day+'T09:00:00+03:00',events:[{id:id(50),revision:2,planVersion:1,kind:'call',payload:{offset:0,outcome:'claimed_arrival'},occurredAt:at,recordedAt:at,actor:'Synthetic'}]};
 assert.match(parseStartOverview(board([r]),day).items[0].status,/teyit bekleniyor/);
 assert.match(parseStartOverview(board([{...r,ownerAvailable:false}]),day).items[0].status,/artık yetkili değil/);
});
test('tracking link preserves exact day and enables only explicit action filter',()=>{
 assert.equal(startTrackingHref(day,true),'/talepler/ise-baslama?gun=2026-09-09&aksiyon=1');
 assert.equal(startTrackingHref(day),'/talepler/ise-baslama?gun=2026-09-09');
 for(const invalid of ['2026-02-30','2026-13-01','2026-09-09&tenant=foreign'])assert.throws(()=>startTrackingHref(invalid,true));
});
