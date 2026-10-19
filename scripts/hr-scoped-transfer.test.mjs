import test from 'node:test';import assert from 'node:assert/strict';
import {importActualTypeScript} from './helpers/import-typescript.mjs';
const {prepareHrLocationTransfer:prepare,parseHrLocationTransferReceipt:parse}=await importActualTypeScript(new URL('../src/lib/services/hr-scoped-transfer.ts',import.meta.url));
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const body=()=>({assignmentId:id(4),expectedRevision:1,locationId:id(5)});
test('transfer freezes exact intent and rejects invalid revisions and extra client dates',()=>{
 const p=body(),intent=prepare(id(1),id(2),id(3),1,p);p.locationId=id(9);assert.equal(intent.p_payload.locationId,id(5));assert.ok(Object.isFrozen(intent.p_payload));
 for(const value of [{...body(),expectedRevision:0},{...body(),expectedRevision:1.1},{...body(),startsOn:'2026-01-01'},{...body(),locationId:null}])assert.throws(()=>prepare(id(1),id(2),id(3),1,value));
 assert.throws(()=>prepare(id(1),id(2),id(3),0,body()));
});
test('transfer receipt must match employee, source, command and valid server date',()=>{
 const intent=prepare(id(1),id(2),id(3),1,body());const r={schemaVersion:1,actorId:id(1),tenantId:id(2),commandId:id(3),kind:'transfer_location',id:id(6),previousId:id(4),employeeId:id(7),startsOn:'2026-10-19',revision:1};
 assert.equal(parse(r,intent,id(7)).id,id(6));
 for(const change of [{employeeId:id(9)},{previousId:id(9)},{commandId:id(9)},{startsOn:'2026-02-30'},{revision:2},{id:id(4)}])assert.throws(()=>parse({...r,...change},intent,id(7)));
});
test('transfer options reject foreign, duplicate, stale and mismatched assignment pages',async()=>{
 const {parseHrTransferOptions:parseOptions,mergeHrTransferOptions:merge}=await importActualTypeScript(new URL('../src/lib/services/hr-scoped-transfer.ts',import.meta.url));
 const raw={schemaVersion:1,actorId:id(1),tenantId:id(2),employeeId:id(3),assignmentId:id(4),assignmentRevision:1,policyRevision:2,sourceLocationId:id(5),sourceLocationName:'Source',effectiveOn:'2026-10-19',locations:[{id:id(6),name:'Target'}],hasMore:false};
 assert.equal(parseOptions(raw,id(1),id(2),id(3)).locations.length,1);
 for(const patch of [{employeeId:id(9)},{locations:[{id:id(5),name:'Source'}]},{hasMore:true},{effectiveOn:'2026-02-30'},{assignmentRevision:0}])assert.throws(()=>parseOptions({...raw,...patch},id(1),id(2),id(3)));
 const a=parseOptions({...raw,locations:Array.from({length:50},(_,n)=>({id:id(10+n),name:'Target'})),hasMore:true},id(1),id(2),id(3));
 const b=parseOptions({...raw,locations:[{id:id(60),name:'Last'}]},id(1),id(2),id(3));assert.equal(merge(a,b).locations.length,51);assert.throws(()=>merge(a,{...b,assignmentRevision:2}));assert.throws(()=>merge(a,{...b,effectiveOn:'2026-10-20'}));
});
