import test from 'node:test';import assert from 'node:assert/strict';
import {importActualTypeScript} from './helpers/import-typescript.mjs';
const {workMinutes,validateWorkAction,parseWorkRecord,parseWorkReceipt}=await importActualTypeScript(new URL('../src/lib/operations/work-approval.ts',import.meta.url));
const {loadWorkRecord,executeWorkRecord}=await importActualTypeScript(new URL('../src/lib/services/work-approval.ts',import.meta.url));
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const scope={actorId:id(1),tenantId:id(2)},assignmentId=id(3),commandId=id(4);
const fields={startTime:'22:00',endTime:'06:00',nextDay:true,breakMinutes:60,note:'Gece'};
const row={...fields,netMinutes:420,revision:1,status:'draft',updatedAt:'2026-09-15T09:00:00Z',history:[{revision:1,action:'save',reason:'',recordedAt:'2026-09-15T09:00:00Z',netMinutes:420}]};
const client=(data,error=null)=>({rpc:async()=>({data,error})});
test('overnight is explicit; break reduces actual work; invalid time never becomes an estimate',()=>{
 assert.equal(workMinutes(fields),420);
 assert.equal(workMinutes({...fields,startTime:'08:00',endTime:'17:00',nextDay:false,breakMinutes:45}),495);
 for(const patch of [{nextDay:false},{breakMinutes:480},{breakMinutes:-1},{breakMinutes:0.5},{breakMinutes:NaN},{endTime:'23:00'},{startTime:'8:00'},{startTime:'24:00'},{note:null}])assert.throws(()=>workMinutes({...fields,...patch}));
});
test('24 hour limit and zero-length work are distinct; no automatic overnight guessing',()=>{
 assert.equal(workMinutes({...fields,startTime:'08:00',endTime:'08:00',breakMinutes:0}),1440);
 assert.throws(()=>workMinutes({...fields,startTime:'08:00',endTime:'08:00',nextDay:false,breakMinutes:0}));
 assert.throws(()=>workMinutes({...fields,startTime:'08:00',endTime:'08:01',breakMinutes:0}));
});
test('correction reason required and only valid scoped record can establish revision zero',async()=>{
 assert.throws(()=>validateWorkAction('return',{reason:'  '}));assert.throws(()=>validateWorkAction('reopen',{reason:'ab'}));
 assert.deepEqual(validateWorkAction('return',{reason:' Saat hatalı '}),{reason:'Saat hatalı'});
 assert.equal(await loadWorkRecord(client({assignmentId,record:null}),scope,assignmentId),null);
 for(const data of [null,{},[],{assignmentId},{assignmentId:id(8),record:null}])await assert.rejects(loadWorkRecord(client(data),scope,assignmentId));
 await assert.rejects(loadWorkRecord(client(null,Error('offline')),scope,assignmentId),/offline/);
});
test('net totals and contiguous latest audit history must agree with the record',()=>{
 assert.deepEqual(parseWorkRecord({assignmentId,record:row},assignmentId),row);
 for(const patch of [{netMinutes:421},{revision:0},{status:'paid'},{history:[]},{history:[{...row.history[0],revision:2}]},{history:null}])assert.throws(()=>parseWorkRecord({assignmentId,record:{...row,...patch}},assignmentId));
});
test('receipt is matched to command, assignment, action and next revision',()=>{
 const receipt={commandId,assignmentId,revision:2,status:'submitted'};
 assert.equal(parseWorkReceipt(receipt,commandId,assignmentId,1,'submit').revision,2);
 for(const patch of [{commandId:id(8)},{assignmentId:id(8)},{revision:1},{status:'approved'}])assert.throws(()=>parseWorkReceipt({...receipt,...patch},commandId,assignmentId,1,'submit'));
});
test('invalid write fails before RPC; exact payload and errors are preserved',async()=>{
 let called=false;const c={rpc:async(name,p)=>{called=true;assert.equal(name,'ops_work_record_execute');assert.equal(p.p_tenant_id,scope.tenantId);assert.equal(p.p_expected_revision,0);assert.deepEqual(p.p_payload,fields);return {data:{commandId,assignmentId,revision:1,status:'draft'},error:null};}};
 await assert.rejects(executeWorkRecord(c,scope,commandId,assignmentId,0,'save',{...fields,breakMinutes:-1}));assert.equal(called,false);
 assert.equal((await executeWorkRecord(c,scope,commandId,assignmentId,0,'save',fields)).revision,1);
 const error={message:'WORK_STALE'};await assert.rejects(executeWorkRecord(client(null,error),scope,commandId,assignmentId,0,'save',fields),e=>e===error);
});
const {loadWorkList}=await importActualTypeScript(new URL('../src/lib/services/work-approval.ts',import.meta.url));
test('company/day list rejects wrong scope, partial shape, duplicates and malformed totals',async()=>{
 const company=id(9),date='2026-09-13';
 const entry={assignmentId,workerName:'Personel',locationName:'Şube',status:'submitted',revision:2,netMinutes:420,closed:false};
 assert.deepEqual(await loadWorkList(client({companyId:company,workDate:date,records:[]}),scope,company,date),[]);
 assert.deepEqual(await loadWorkList(client({companyId:company,workDate:date,records:[entry]}),scope,company,date),[entry]);
 for(const data of [null,{companyId:company,workDate:date},{companyId:id(8),workDate:date,records:[]},{companyId:company,workDate:date,records:[entry,entry]},{companyId:company,workDate:date,records:[{...entry,netMinutes:'420'}]}])await assert.rejects(loadWorkList(client(data),scope,company,date));
 await assert.rejects(loadWorkList(client(null,Error('offline')),scope,company,date),/offline/);
});
test('latest 20 audit entries are accepted only in contiguous descending revision order',()=>{
 const history=Array.from({length:20},(_,i)=>({...row.history[0],revision:21-i}));
 assert.equal(parseWorkRecord({assignmentId,record:{...row,revision:21,history}},assignmentId).history.length,20);
 assert.throws(()=>parseWorkRecord({assignmentId,record:{...row,revision:21,history:history.slice(0,19)}},assignmentId));
});
