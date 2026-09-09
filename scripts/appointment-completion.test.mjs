import test from 'node:test';
import assert from 'node:assert/strict';
import {importActualTypeScript} from './helpers/import-typescript.mjs';
import {id} from './fixtures/daily-operations.mjs';
const {validateCompletion,parseCompletion}=await importActualTypeScript(new URL('../src/lib/appointment-completion.ts',import.meta.url));
const {completeAppointment,updateAppointmentStatus}=await importActualTypeScript(new URL('../src/lib/services/appointments.ts',import.meta.url));
const input={result:'Done',nextAction:'Follow up',createTask:true},scope={actorId:id(10),tenantId:id(1)};
test('bounded completion input is normalized; nonboolean cannot request a task',()=>{
  assert.deepEqual(validateCompletion({result:' Done ',nextAction:' Next '}),{result:'Done',nextAction:'Next',createTask:false});
  for(const p of [null,{...input,result:'\t\n'},{...input,nextAction:'x'.repeat(1001)},{...input,result:'x'.repeat(4001)},{...input,createTask:'false'}])assert.throws(()=>validateCompletion(p));
});
test('completion result must identify exact appointment and valid task/skip combination',()=>{
  const data={appointmentId:id(60),taskId:id(70),taskSkippedReason:null};assert.deepEqual(parseCompletion(data,id(60),true),data);
  for(const p of [null,{}, {...data,appointmentId:id(61)},{...data,taskId:'bad'}, {...data,taskSkippedReason:'skip'},{...data,taskId:null},{...data,taskId:null,taskSkippedReason:''}])assert.throws(()=>parseCompletion(p,id(60),true));
  assert.throws(()=>parseCompletion(data,id(60),false));
});
test('service uses one scoped RPC with no sequential table fallback',async()=>{
  let calls=0;const c={rpc:async(name,args)=>{calls++;assert.equal(name,'complete_appointment_scoped');assert.equal(args.p_actor_id,scope.actorId);assert.equal(args.p_tenant_id,scope.tenantId);return {data:{appointmentId:id(60),taskId:id(70),taskSkippedReason:null},error:null};},from:()=>{throw Error('forbidden fallback');}};
  assert.equal((await completeAppointment(c,id(60),input,scope)).taskId,id(70));assert.equal(calls,1);
});
test('transport failure is unverifiable, not already completed or unauthorized',async()=>{
  await assert.rejects(()=>completeAppointment({rpc:async()=>{throw new TypeError('offline');}},id(60),input,scope),e=>e.message.includes('Aynı içerikle')&&!e.message.includes('yetkiniz yok'));
});
test('scope and invalid input fail before calling RPC',async()=>{
  let calls=0;const c={rpc:()=>{calls++;}};
  await assert.rejects(()=>completeAppointment(c,id(60),input,{...scope,actorId:'invalid'}));
  await assert.rejects(()=>completeAppointment(c,id(60),{...input,result:''},scope));assert.equal(calls,0);
});
test('status-only service cannot recreate split completion path',async()=>{
  await assert.rejects(()=>updateAppointmentStatus({},id(60),'tamamlandi'),/sonuç ve takip/);
});
