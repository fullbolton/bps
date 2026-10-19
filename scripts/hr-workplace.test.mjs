import test from 'node:test';
import assert from 'node:assert/strict';
import {importActualTypeScript} from './helpers/import-typescript.mjs';
const {prepareWorkplaceCommand:prepare,saveWorkplaceCommand:save}=await importActualTypeScript(new URL('../src/lib/services/hr-workplace.ts',import.meta.url));
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const payload={kind:'assign_location',employeeId:id(4),employmentId:id(5),locationId:id(6),startsOn:'2026-01-01'};
test('workplace commands reject malformed dates, identities, revisions and unknown fields',()=>{
 for(const changed of [{startsOn:'2026-02-30'},{endsOn:'2025-12-31'},{endsOn:null},{locationId:'bad'},{extra:true}])assert.throws(()=>prepare(id(1),id(2),id(3),{...payload,...changed}));
 for(const expectedRevision of [0,-1,1.5,Number.MAX_SAFE_INTEGER])assert.throws(()=>prepare(id(1),id(2),id(3),{kind:'unlink_account',id:id(4),expectedRevision}));
 assert.throws(()=>prepare(id(1),id(2),id(3),{kind:'create_location',name:' '}));
 assert.throws(()=>prepare(id(1),id(2),id(3),{kind:'link_account',employeeId:id(4),accountId:'bad'}));
 const original={...payload};const intent=prepare(id(1),id(2),id(3),original);original.startsOn='2027-01-01';assert.equal(intent.p_payload.startsOn,'2026-01-01');assert.ok(Object.isFrozen(intent.p_payload));
});
test('uncertain writes retry identical command and validate exact scoped receipt',async()=>{
 const intent=prepare(id(1),id(2),id(3),{kind:'end_location',id:id(4),expectedRevision:2,endsOn:'2026-06-30'});
 const base={schemaVersion:1,actorId:id(1),tenantId:id(2),commandId:id(3),kind:'end_location',id:id(4),revision:3};let data=base,error=Error('offline');const calls=[];
 const client={rpc(name,args){assert.equal(name,'hr_workplace_command_v1');calls.push(args);return {abortSignal:async()=>({data,error})};}};
 await assert.rejects(save(client,intent));error=null;assert.deepEqual(await save(client,intent),{id:id(4),revision:3});assert.deepEqual(calls[0],calls[1]);
 for(const changed of [{actorId:id(8)},{tenantId:id(8)},{commandId:id(8)},{kind:'unlink_account'},{id:id(8)},{revision:2},{extra:true}]){data={...base,...changed};await assert.rejects(save(client,intent),/HR_RECEIPT_INVALID/);}
});
