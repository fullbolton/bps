import test from 'node:test';
import assert from 'node:assert/strict';
import {importActualTypeScript} from './helpers/import-typescript.mjs';
const raw=await importActualTypeScript(new URL('../src/lib/supabase/appointments.ts',import.meta.url));
const input={tenant_id:'tenant',company_id:'company',meeting_date:'2026-10-13'};
const row={...input,id:'appointment',contract_id:null,status:'planlandi'};
function client(data=row,error=null){const calls=[];return {calls,from(){throw Error('Direct DML forbidden');},rpc(name,args){calls.push({name,args});return {single:async()=>({data,error})};}};}
test('appointment create uses gateway and excludes caller author/status',async()=>{
 const c=client();await raw.insertAppointment(c,{...input,created_by:'forged',status:'tamamlandi'});
 assert.equal(c.calls.length,1);assert.equal(c.calls[0].name,'appointment_execute_v1');
 assert.equal(c.calls[0].args.p_input.created_by,undefined);assert.equal(c.calls[0].args.p_input.status,undefined);
});
test('appointment command rejects missing, wrong tenant/company/date/contract and transport result',async()=>{
 for(const data of [null,{...row,tenant_id:'other'},{...row,company_id:'other'},{...row,meeting_date:'2026-10-14'},{...row,contract_id:'other'}])await assert.rejects(raw.insertAppointment(client(data),input),/doğrulanamadı/);
 const c=client(null,{message:'private error'});await assert.rejects(raw.insertAppointment(c,input),/sonucu doğrulanamadı/);assert.equal(c.calls.length,1);
});
test('status command sends expected state and tenant; rejects response mismatch',async()=>{
 const c=client({...row,status:'iptal'});await raw.updateAppointment(c,row.id,{status:'iptal'},row);
 assert.deepEqual(c.calls[0].args,{p_action:'status',p_id:row.id,p_tenant:'tenant',p_input:{status:'iptal',expected_status:'planlandi'}});
 await assert.rejects(raw.updateAppointment(client(),row.id,{status:'iptal'},row),/doğrulanamadı/);
 await assert.rejects(raw.updateAppointment(client(),row.id,{status:'iptal',company_id:'other'},row),/Geçersiz/);
});
test('calendar errors distinguish closed module, conflict, authorization and uncertainty',async()=>{
 for(const [code,pattern] of [['BM001',/modül kapalı/],['40001',/başka bir işlemde değişti/],['PT409',/başka bir işlemde değişti/],['42501',/yetkiniz yok/],['08006',/sonucu doğrulanamadı/]])
  await assert.rejects(raw.insertAppointment(client(null,{code}),input),pattern);
});
