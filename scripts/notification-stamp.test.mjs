import test from 'node:test';
import assert from 'node:assert/strict';
import {importActualTypeScript} from './helpers/import-typescript.mjs';
const {stampNotification}=await importActualTypeScript(new URL('../src/lib/email/notification-log.ts',import.meta.url));
const key={kind:'contract_expiry',entityId:'00000000-0000-4000-8000-000000000001',recipientProfileId:'00000000-0000-4000-8000-000000000002',thresholdKey:'30d',tenantId:'00000000-0000-4000-8000-000000000003'};
function client(result){return {from(table){assert.equal(table,'notification_log');return {insert(input){assert.equal(input.tenant_id,key.tenantId);assert.equal(input.entity_id,key.entityId);return {select(columns){assert.equal(columns,'kind');return {maybeSingle:async()=>result};}};}};}};}
test('notification reservation requires the expected acknowledgement; empty data is not already sent',async()=>{
 for(const data of [null,undefined,{},[],{kind:'task_due'},{kind:null}]){
  assert.deepEqual(await stampNotification(client({data,error:null}),key),{status:'failed',error:'code=STAMP_ACK_INVALID'});
 }
 assert.deepEqual(await stampNotification(client({data:{kind:key.kind},error:null}),key),{status:'stamped'});
});
test('unique conflict remains an idempotent skip and DB failures expose only their code',async()=>{
 assert.deepEqual(await stampNotification(client({data:null,error:{code:'23505'}}),key),{status:'already_sent'});
 assert.deepEqual(await stampNotification(client({data:null,error:{code:'42501',message:'private@example.invalid'}}),key),{status:'failed',error:'code=42501'});
});
