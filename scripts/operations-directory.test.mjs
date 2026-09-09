import test from 'node:test';
import assert from 'node:assert/strict';
import {importActualTypeScript} from './helpers/import-typescript.mjs';
import {id} from './fixtures/daily-operations.mjs';
const {validateDirectoryQuery,parseDirectoryPage}=await importActualTypeScript(new URL('../src/lib/operations/operations-directory.ts',import.meta.url));
const q={kind:'locations',companyId:id(20),search:'',status:'all',offset:0};
const row={id:id(1),name:'Şube',code:'0001',city:'İstanbul',workerKind:null,active:true,revision:0};
const page=(query=q,patch={})=>({...query,total:1,generatedAt:'2026-09-09T12:00:00Z',rows:[row],...patch});
test('query separates company locations and tenant workers',()=>{
  assert.equal(validateDirectoryQuery({...q,search:'  0001  '}).search,'0001');
  assert.throws(()=>validateDirectoryQuery({...q,kind:'workers'}));
  assert.equal(validateDirectoryQuery({...q,kind:'workers',companyId:null}).companyId,null);
  for(const patch of [{offset:-50},{offset:1},{offset:1000050},{search:'x'.repeat(161)},{companyId:null},{status:'deleted'}])assert.throws(()=>validateDirectoryQuery({...q,...patch}));
});
test('page preserves leading zero code and manual null code',()=>{
  assert.equal(parseDirectoryPage(page(),q).rows[0].code,'0001');
  assert.equal(parseDirectoryPage(page(q,{rows:[{...row,code:null}]}),q).rows[0].code,null);
});
test('partial page, duplicate identity or wrong filter fails instead of showing clean data',()=>{
  for(const patch of [{total:2},{rows:[]},{total:null},{companyId:id(21)},{search:'other'},{rows:[{...row,active:'true'}]},{total:2,rows:[row,row]}])assert.throws(()=>parseDirectoryPage(page(q,patch),q));
  const active={...q,status:'active'};assert.throws(()=>parseDirectoryPage(page(active,{rows:[{...row,active:false}]}),active));
});
test('page beyond shrinking total is valid empty with true total',()=>{
  const next={...q,offset:50};assert.equal(parseDirectoryPage(page(next,{total:3,rows:[]}),next).total,3);
  assert.equal(parseDirectoryPage(page(q,{total:0,rows:[]}),q).rows.length,0);
});
test('worker shape cannot be mistaken for a company location',()=>{
  const wq={...q,kind:'workers',companyId:null};const wr={...row,city:null,workerKind:'idp'};
  assert.equal(parseDirectoryPage(page(wq,{rows:[wr]}),wq).rows[0].workerKind,'idp');
  for(const patch of [{code:null},{workerKind:'admin'},{city:'İstanbul'}])assert.throws(()=>parseDirectoryPage(page(wq,{rows:[{...wr,...patch}]}),wq));
});

const {validateDirectoryActivation,parseDirectoryActivation}=await importActualTypeScript(new URL('../src/lib/operations/operations-directory.ts',import.meta.url));
test('activation keeps strict boolean and bounded expected revision',()=>{
  const p={kind:'workers',id:id(1),expectedRevision:0,active:false};
  assert.deepEqual(validateDirectoryActivation({...p,tenantId:id(2)}),p);
  for(const patch of [{active:'false'},{active:null},{expectedRevision:-1},{expectedRevision:2147483647},{kind:'companies'},{id:'bad'}])assert.throws(()=>validateDirectoryActivation({...p,...patch}));
});
test('activation response must identify exact change and revision',()=>{
  const p={kind:'workers',id:id(1),expectedRevision:0,active:false};
  const r={...p,commandId:id(2),revision:1,previousRevision:0,previousActive:true};
  assert.equal(parseDirectoryActivation(r,id(2),p).id,id(1));
  for(const patch of [{id:id(3)},{active:true},{revision:0},{previousRevision:1},{previousActive:null}])assert.throws(()=>parseDirectoryActivation({...r,...patch},id(2),p));
});
