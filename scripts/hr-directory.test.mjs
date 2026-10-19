import test from 'node:test';import assert from 'node:assert/strict';
import {importActualTypeScript} from './helpers/import-typescript.mjs';
const {parseHrDirectory:parse,prepareHrRecord:prepare,saveHrRecord:save}=await importActualTypeScript(new URL('../src/lib/services/hr-directory.ts',import.meta.url));
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const response=()=>({schemaVersion:1,actorId:id(1),tenantId:id(2),departments:[],hasMore:false,employees:[{id:id(3),code:'HR01',name:'Synthetic',startsOn:'2026-01-01',endsOn:null,department:null,position:null}]});
test('HR directory rejects foreign scope, duplicate records, invalid dates and partial pagination',()=>{
 assert.equal(parse(response(),id(1),id(2)).employees.length,1);
 for(const mutate of [x=>x.actorId=id(8),x=>x.tenantId=id(8),x=>x.hasMore=true,x=>x.employees.push(x.employees[0]),x=>x.employees[0].startsOn='2026-02-30',x=>x.departments=[{id:id(5),name:''}]]){const x=response();mutate(x);assert.throws(()=>parse(x,id(1),id(2)));}
});
test('HR create validates inputs and freezes the retry payload',()=>{
 const payload={kind:'employee',name:'Synthetic',code:'HR01',startsOn:'2026-01-01'};
 for(const changed of [{startsOn:'2026-02-30'},{code:''},{departmentId:id(9)},{name:''}])assert.throws(()=>prepare(id(1),id(2),id(4),{...payload,...changed}));
 const intent=prepare(id(1),id(2),id(4),payload);assert.ok(Object.isFrozen(intent.p_payload));payload.name='Changed';assert.equal(intent.p_payload.name,'Synthetic');
});
test('uncertain HR write reuses exact command and rejects mismatched success receipts',async()=>{
 const intent=prepare(id(1),id(2),id(4),{kind:'department',name:'Synthetic'});let error=Error('offline');let data={schemaVersion:1,actorId:id(1),tenantId:id(2),commandId:id(4),kind:'department',id:id(5)};const calls=[];
 const client={rpc(n,args){calls.push(args);return {abortSignal:async()=>({data,error})};}};
 await assert.rejects(save(client,intent));error=null;assert.equal(await save(client,intent),id(5));assert.deepEqual(calls[0],calls[1]);
 for(const changed of [{actorId:id(8)},{commandId:id(9)},{kind:'employee'},{id:'invalid'}]){const old=data;data={...data,...changed};await assert.rejects(save(client,intent));data=old;}
});
