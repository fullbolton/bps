import test from 'node:test';import assert from 'node:assert/strict';
import {importActualTypeScript} from './helpers/import-typescript.mjs';
const {createTask}=await importActualTypeScript(new URL('../src/lib/services/tasks.ts',import.meta.url));
test('independent task inserts null company without company lookup and keeps assignment empty',async()=>{
 let payload;const c={auth:{getUser:async()=>({data:{user:{id:'actor'}}})},from(table){assert.equal(table,'tasks');return {insert(v){payload=v;return {select(){return {single:async()=>({data:v,error:null})};}};}};}};
 const row=await createTask(c,{legacyCompanyId:null,title:'  Bankaya evrak bırak  '},{tenantId:'tenant'});
 assert.equal(row.company_id,null);assert.equal(row.title,'Bankaya evrak bırak');assert.equal(payload.tenant_id,'tenant');assert.equal(payload.created_by,'actor');assert.equal(payload.assigned_to_user_id,null);assert.equal(payload.source_type,'manuel');
});
test('independent tasks cannot borrow company-linked context',async()=>{
 const c={from(){assert.fail('must not insert');}};
 for(const extra of [{contractId:'contract'},{appointmentId:'appointment'},{sourceType:'randevu'},{sourceType:'sozlesme'},{sourceRef:'external-ref'}])await assert.rejects(createTask(c,{legacyCompanyId:null,title:'Outside task',...extra},{tenantId:'tenant'}),/Firma dışı görev/);
});
