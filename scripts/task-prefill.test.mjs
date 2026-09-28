import test from 'node:test';
import assert from 'node:assert/strict';
import {importActualTypeScript} from './helpers/import-typescript.mjs';
import {id} from './fixtures/daily-operations.mjs';
const {validateTaskPrefillQuery:validate,taskPrefillHref:href,parseTaskPrefillSearch:parse,buildTaskPrefill:build}=await importActualTypeScript(new URL('../src/lib/operations/task-prefill.ts',import.meta.url));
const query={companyId:id(20),requestId:id(30),date:'2026-09-09'};
const companies=[{id:id(20),name:'Banka',active:true}];
const board={workers:[],locations:[{id:id(40),name:'00001 · Merkez',city:'İstanbul',active:true}],requests:[{id:id(30),locationId:id(40),workDate:query.date,serviceLine:'Temizlik',position:'Görevli',requiredCount:2,lifecycle:'active',assignments:[],attendance:[]}]};
test('URL round trip carries only identifiers and date',()=>{
  const url=new URL(href(query),'http://local');
  assert.equal(url.pathname,'/gorevler'); assert.deepEqual(parse(url.searchParams),query);
  assert.deepEqual([...url.searchParams.keys()],['firma','talep','gun']);
});
test('ordinary tasks page has no prefill; partial and duplicate context rejected',()=>{
  assert.equal(parse(new URLSearchParams('q=foo')),null);
  for(const s of ['firma='+id(20),'talep='+id(30),new URL(href(query),'http://local').search+'&firma='+id(21)]) assert.throws(()=>parse(new URLSearchParams(s)));
});
test('reject malformed ids, impossible dates and unsupported date bounds',()=>{
  for(const patch of [{companyId:'f1'},{requestId:'javascript:alert(1)'},{date:'2026-02-30'},{date:'1999-12-31'},{date:'2101-01-01'}]) assert.throws(()=>validate({...query,...patch}));
  for(const value of [null,undefined,{},'text'])assert.throws(()=>validate(value));
});
test('prefill derives fresh name and title from server data, no assignee/source FK or deadline inferred',()=>{
  const p=build({...query,title:'forged',companyName:'forged'},companies,board);
  assert.equal(p.companyName,'Banka');assert.equal(p.title,'00001 · Merkez · 2026-09-09 · Temizlik / Görevli — takip');
  assert.deepEqual(Object.keys(p).sort(),['companyId','companyName','date','requestId','returnHref','title'].sort());
  const url=new URL(p.returnHref,'http://local');assert.equal(url.pathname,'/talepler/gunluk');assert.equal(url.hash,'#talep-'+id(30));
});
test('missing company/request/location and mismatched day fail without fallback',()=>{
  for(const [c,b] of [[[],board],[companies,{...board,requests:[]}],[companies,{...board,locations:[]}],[companies,{...board,requests:[{...board.requests[0],workDate:'2026-09-10'}]}]])assert.throws(()=>build(query,c,b),/OPS_OUT_OF_SCOPE/);
});
test('passive company and cancelled request cannot prepare a new followup',()=>{
  assert.throws(()=>build(query,[{...companies[0],active:false}],board),/OPS_INACTIVE_COMPANY/);
  assert.throws(()=>build(query,companies,{...board,requests:[{...board.requests[0],lifecycle:'cancelled'}]}),/OPS_REQUEST_NOT_ACTIVE/);
});
test('inactive location may still need a followup on an existing active request',()=>{
  assert.equal(build(query,companies,{...board,locations:[{...board.locations[0],active:false}]}).companyId,id(20));
});
