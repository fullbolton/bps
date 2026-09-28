import test from 'node:test';import assert from 'node:assert/strict';
import {importActualTypeScript} from './helpers/import-typescript.mjs';
const {createTask}=await importActualTypeScript(new URL('../src/lib/services/tasks.ts',import.meta.url));
test('independent task inserts null company without company lookup and keeps assignment empty',async()=>{
 let payload;const c={auth:{getUser:async()=>({data:{user:{id:'actor'}}})},rpc(name,args){assert.equal(name,'task_execute_v1');payload=args;return {single:async()=>({data:args.p_input,error:null})};},from(){assert.fail('No direct table write');}};
 const row=await createTask(c,{legacyCompanyId:null,title:'  Bankaya evrak bırak  '},{tenantId:'tenant'});
 assert.equal(row.company_id,null);assert.equal(row.title,'Bankaya evrak bırak');assert.equal(payload.p_expected_tenant,'tenant');assert.equal(payload.p_input.created_by,undefined);assert.equal(payload.p_input.assigned_to_user_id,null);assert.equal(payload.p_input.source_type,'manuel');
});
test('independent tasks cannot borrow company-linked context',async()=>{
 const c={from(){assert.fail('must not insert');}};
 for(const extra of [{contractId:'contract'},{appointmentId:'appointment'},{sourceType:'randevu'},{sourceType:'sozlesme'},{sourceRef:'external-ref'}])await assert.rejects(createTask(c,{legacyCompanyId:null,title:'Outside task',...extra},{tenantId:'tenant'}),/Firma dışı görev/);
});
