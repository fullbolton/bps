import test from 'node:test';import assert from 'node:assert/strict';
import {importActualTypeScript} from './helpers/import-typescript.mjs';
const {parseHrCreateOptions:parse,mergeHrCreateOptions:merge,prepareScopedHrEmployee:prepare,parseScopedHrReceipt:receipt}=await importActualTypeScript(new URL('../src/lib/services/hr-scoped-create.ts',import.meta.url));
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`,zero='00000000-0000-0000-0000-000000000000';
const option=n=>({key:`${id(n)}:${zero}`,departmentId:id(n),departmentName:'Department',locationId:null,locationName:null});
const raw=()=>({schemaVersion:1,actorId:id(1),tenantId:id(2),policyRevision:1,options:[option(3)],hasMore:false,canCreateFuture:false});
test('authorized options preserve paired scope and reject malformed, unordered or foreign responses',()=>{
 assert.equal(parse(raw(),id(1),id(2)).options[0].locationId,null);
 for(const change of [r=>r.actorId=id(9),r=>r.policyRevision=0,r=>r.options[0].locationName='Leaked',r=>r.options[0].key='fake',r=>r.options.push(option(3)),r=>r.hasMore=true,r=>r.canCreateFuture='true']){const r=raw();change(r);assert.throws(()=>parse(r,id(1),id(2)));}
});
test('option pagination cannot merge revisions, overlap or continue a final page',()=>{
 const a=raw();a.options=Array.from({length:50},(_,i)=>option(i+3));a.hasMore=true;const first=parse(a,id(1),id(2));
 const b=raw();b.options=[option(53)];const next=parse(b,id(1),id(2));assert.equal(merge(first,next).options.length,51);
 assert.throws(()=>merge(first,{...next,policyRevision:2}));assert.throws(()=>merge(first,{...next,canCreateFuture:true}));assert.throws(()=>merge(next,next));assert.throws(()=>merge(first,parse(raw(),id(1),id(2))));
});
test('scoped intent is immutable and validates dates, fields, and exact command receipt',()=>{
 const payload={name:'Synthetic',code:'S1',startsOn:'2026-01-01',departmentId:id(4),position:'Role',locationId:id(5)};
 const intent=prepare(id(1),id(2),id(3),1,payload);payload.name='Changed';assert.equal(intent.p_payload.name,'Synthetic');assert.ok(Object.isFrozen(intent.p_payload));
 for(const p of [{...payload,startsOn:'2026-02-30'},{...payload,accountId:id(1)},{...payload,departmentId:undefined},{...payload,locationId:null}])assert.throws(()=>prepare(id(1),id(2),id(3),1,p));
 const r={schemaVersion:1,actorId:id(1),tenantId:id(2),commandId:id(3),kind:'employee',id:id(6)};assert.equal(receipt(r,intent),id(6));assert.throws(()=>receipt({...r,commandId:id(7)},intent));
});
