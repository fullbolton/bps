import test from 'node:test';import assert from 'node:assert/strict';
import {importActualTypeScript} from './helpers/import-typescript.mjs';
const {loadOutreachLatest,recordOutreach}=await importActualTypeScript(new URL('../src/lib/services/replacement-outreach.ts',import.meta.url));
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const scope={actorId:id(1),tenantId:id(2)},assignmentId=id(3),workerId=id(4),commandId=id(5);
const input={assignmentId,workerId,expectedRevision:3,outcome:'accepted',note:'Görüşüldü'};
const client=(data,error=null)=>({rpc:async()=>({data,error})});
test('only an explicit scoped null latest is interpreted as no conversation',async()=>{
 assert.equal(await loadOutreachLatest(client({assignmentId,workerId,latest:null}),scope,assignmentId,workerId),null);
 for(const data of [null,{},[],{assignmentId,workerId},{assignmentId:id(8),workerId,latest:null}])await assert.rejects(loadOutreachLatest(client(data),scope,assignmentId,workerId));
});
test('transport error cannot become a zero revision snapshot',async()=>{const error=Error('offline');await assert.rejects(loadOutreachLatest(client(null,error),scope,assignmentId,workerId),e=>e===error);});
test('latest revision and actor are validated before exposing the record',async()=>{
 const row={revision:4,outcome:'accepted',note:'OK',recordedAt:'2026-09-15T08:00:00Z',actorId:id(1)};
 assert.deepEqual(await loadOutreachLatest(client({assignmentId,workerId,latest:row}),scope,assignmentId,workerId),row);
 for(const patch of [{revision:0},{revision:'4'},{outcome:'placed'},{actorId:null},{recordedAt:'invalid'}])await assert.rejects(loadOutreachLatest(client({assignmentId,workerId,latest:{...row,...patch}}),scope,assignmentId,workerId));
});
test('write retains scope, command ID and revision; validates response against submitted command',async()=>{
 let args;const c={rpc:async(name,p)=>{assert.equal(name,'ops_record_replacement_outreach');args=p;return {data:{commandId,revision:4,outcome:'accepted'},error:null};}};
 assert.equal((await recordOutreach(c,scope,commandId,input)).revision,4);
 assert.equal(args.p_expected_revision,3);assert.equal(args.p_command_id,commandId);assert.equal(args.p_tenant_id,scope.tenantId);
 for(const result of [null,{commandId,revision:3,outcome:'accepted'},{commandId:id(8),revision:4,outcome:'accepted'},{commandId,revision:4,outcome:'declined'}])await assert.rejects(recordOutreach(client(result),scope,commandId,input));
});
test('invalid input stops before RPC and write errors are preserved for reconciliation',async()=>{
 const never={rpc:()=>{throw Error('RPC should not run');}};
 await assert.rejects(recordOutreach(never,scope,commandId,{...input,expectedRevision:'3'}),/alanları/);
 await assert.rejects(recordOutreach(never,scope,commandId,{...input,note:'a'.repeat(1001)}),/alanları/);
 const error={code:'P0001',message:'OUTREACH_STALE'};await assert.rejects(recordOutreach(client(null,error),scope,commandId,input),e=>e===error);
});
