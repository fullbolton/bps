import test from 'node:test';
import assert from 'node:assert/strict';
import {importActualTypeScript} from './helpers/import-typescript.mjs';
const {stampNotification,rollbackStamp}=await importActualTypeScript(new URL('../src/lib/email/notification-log.ts',import.meta.url));
const key={kind:'contract_expiry',entityId:'00000000-0000-4000-8000-000000000001',recipientProfileId:'00000000-0000-4000-8000-000000000002',thresholdKey:'30d:2026-10-15',tenantId:'00000000-0000-4000-8000-000000000003'};
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

test('renewal keys vary by expiry, reject invalid dates, and preserve other notification kinds',async()=>{
 const {notificationThresholdKey:key}=await importActualTypeScript(new URL('../src/lib/notification-kinds.ts',import.meta.url));
 for(const kind of ['contract_expiry','document_expiry']){
  assert.equal(key(kind,'2026-10-15'),'30d:2026-10-15');assert.notEqual(key(kind,'2026-10-15'),key(kind,'2027-10-15'));
  for(const date of [null,undefined,'2026-02-30','15/10/2026',''])assert.throws(()=>key(kind,date));
 }
 assert.equal(key('task_overdue'),'overdue');assert.equal(key('appointment_reminder'),'1d');
});

test('failed delivery rollback filters the exact dated reservation',async()=>{
 const filters=[];
 const query={eq(column,value){filters.push([column,value]);return query;},then(resolve){resolve({error:null});}};
 const db={from(table){assert.equal(table,'notification_log');return {delete(){return query;}};}};
 await rollbackStamp(db,key);
 assert.deepEqual(filters,[['kind',key.kind],['entity_id',key.entityId],['recipient_profile_id',key.recipientProfileId],['threshold_key','30d:2026-10-15']]);
});
