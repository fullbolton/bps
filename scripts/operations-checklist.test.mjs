import test from 'node:test';
import assert from 'node:assert/strict';
import {importActualTypeScript} from './helpers/import-typescript.mjs';
import {id} from './fixtures/daily-operations.mjs';
const {buildOperationsChecklist:build,filterChecklist,checklistTotals}=await importActualTypeScript(new URL('../src/lib/operations/operations-checklist.ts',import.meta.url));
const a=(n,status='unreported',removed=false)=>({id:id(n),workerId:id(n),status,removed,revision:status==='unreported'?0:1});
const row=(n,attendance=[],patch={})=>({id:id(n),locationId:id(100),locationName:'Şube '+n,city:'İstanbul',workDate:'2026-09-09',serviceLine:'Temizlik',position:'Görevli',requiredCount:3,lifecycle:'active',assignments:attendance.filter(a=>!a.removed).map(a=>({id:a.id,workerId:a.workerId,name:'P'})),attendance,...patch});
const plan=(rows,generatedAt='2026-09-09T12:00:00Z')=>({companyId:id(20),companyName:'Firma',weekStart:'2026-09-07',generatedAt,requests:rows});
test('one request may have three signs but request count is unique',()=>{
  const c=build(plan([row(1,[a(10,'absent'),a(11)])]),'2026-09-09');
  assert.deepEqual(checklistTotals(c.items),{requests:1,open:1,absent:1,unreported:1});
});
test('removed absence and cancelled demands do not create actions',()=>{
  const c=build(plan([row(1,[a(10,'absent',true),a(11)],{requiredCount:1}),row(2,[a(12,'present',true)],{lifecycle:'cancelled'})]),'2026-09-09');
  assert.deepEqual(checklistTotals(c.items),{requests:1,open:0,absent:0,unreported:1});
});
test('future unknown does not count as outstanding but unfilled demand does',()=>{
  const c=build(plan([row(1,[a(10)],{workDate:'2026-09-10',requiredCount:2})]),'2026-09-10');
  assert.deepEqual(checklistTotals(c.items),{requests:1,open:1,absent:0,unreported:0});
});
test('due date uses snapshot Istanbul day across UTC midnight boundary',()=>{
  const p=plan([row(1,[a(10)],{requiredCount:1})],'2026-09-08T21:00:00Z');
  assert.equal(build(p,'2026-09-09').items[0].unreported,1);
  p.generatedAt='2026-09-08T20:59:59Z';assert.equal(build(p,'2026-09-09').items.length,0);
});
test('wrong week or malformed snapshot never becomes clean checklist',()=>{
  const p=plan([row(1)]);assert.throws(()=>build(p,'2026-09-14'));
  delete p.requests[0].attendance;assert.throws(()=>build(p,'2026-09-09'));
  assert.throws(()=>build({...p,generatedAt:'unknown'},'2026-09-09'));
});
test('empty verified week and fully present request have no signs',()=>{
  assert.deepEqual(build(plan([]),'2026-09-09').items,[]);
  assert.deepEqual(build(plan([row(1,[a(10,'present')],{requiredCount:1})]),'2026-09-09').items,[]);
});
test('priority and search preserve overlap without summing people',()=>{
  const c=build(plan([row(1,[a(10)],{requiredCount:1}),row(2),row(3,[a(11,'absent')],{locationName:'İSTANBUL Merkez'})]),'2026-09-09');
  assert.deepEqual(c.items.map(r=>r.id),[id(3),id(2),id(1)]);
  assert.equal(filterChecklist(c.items,'absence','istanbul merkez').length,1);
  assert.equal(filterChecklist(c.items,'open','').length,2);
  assert.equal(filterChecklist(c.items,'unreported','').length,1);
  assert.equal(filterChecklist(c.items,'all','no match').length,0);
});
test('selected day only, including year boundary week',()=>{
  const p={...plan([row(1,[],{workDate:'2027-01-01'}),row(2,[],{workDate:'2026-12-31'})]),weekStart:'2026-12-28',generatedAt:'2027-01-02T00:00:00Z'};
  assert.deepEqual(build(p,'2027-01-01').items.map(r=>r.id),[id(1)]);
});
