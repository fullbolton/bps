import test from 'node:test';
import assert from 'node:assert/strict';
import {importActualTypeScript} from './helpers/import-typescript.mjs';
import {id} from './fixtures/daily-operations.mjs';
const {parseAttendanceWeek,attendanceTotals}=await importActualTypeScript(new URL('../src/lib/operations/weekly-attendance.ts',import.meta.url));
const a=(n,status='unreported',removed=false,worker=n)=>({id:id(n),workerId:id(worker),status,removed,revision:status==='unreported'?0:1});
const row=(n,attendance,lifecycle='active',date='2026-09-07')=>({id:id(n),locationId:id(100),locationName:'Şube',city:'İstanbul',workDate:date,serviceLine:'Temizlik',position:'Görevli',requiredCount:3,lifecycle,assignments:attendance.filter(a=>!a.removed).map(a=>({id:a.id,workerId:a.workerId,name:'Personel'})),attendance});
const plan=rows=>({companyId:id(20),companyName:'Firma',weekStart:'2026-09-07',generatedAt:'2026-09-09T12:00:00Z',requests:rows});
const parse=p=>parseAttendanceWeek(p,id(20),'2026-09-07');
test('cancelled presence remains actual; removed unknown is not outstanding',()=>{
  const p=parse(plan([row(1,[a(10,'present',true),a(11,'absent',true),a(12,'unreported',true)],'cancelled'),row(2,[a(13),a(14,'present')])]));
  assert.deepEqual(attendanceTotals(p.requests),{present:2,absent:1,unreported:1,cancelledPresent:1});
});
test('no declarations cannot silently become zero attendance',()=>{
  const p=plan([row(1,[])]);delete p.requests[0].attendance;assert.throws(()=>parse(p));
  assert.throws(()=>parse(null));assert.throws(()=>parse({...p,companyId:id(21)}));
});
test('duplicate or unmatched declarations fail verification',()=>{
  assert.throws(()=>parse(plan([row(1,[a(10),a(10)])])));
  assert.throws(()=>parse(plan([row(1,[a(10,'present',true)]),row(2,[a(11,'present',true,10)])])));
  const p=plan([row(1,[a(10)])]);p.requests[0].attendance[0].removed=true;assert.throws(()=>parse(p));
});
test('same worker on different days counts separate person days',()=>{
  const p=parse(plan([row(1,[a(10,'present')]),row(2,[a(11,'present',false,10)],'active','2026-09-08')]));
  assert.equal(attendanceTotals(p.requests).present,2);
});
test('absence total counts declarations, not unique people',()=>{
  const p=parse(plan([row(1,[a(10,'absent',true,99),a(11,'absent',true,99)])]));
  assert.equal(attendanceTotals(p.requests).absent,2);
});
