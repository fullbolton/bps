import test from 'node:test';
import assert from 'node:assert/strict';
import {importActualTypeScript} from './helpers/import-typescript.mjs';
import {id} from './fixtures/daily-operations.mjs';
const b=await importActualTypeScript(new URL('../src/lib/contract-renewal.ts',import.meta.url));
const service=await importActualTypeScript(new URL('../src/lib/services/contract-renewal.ts',import.meta.url));
const scope={actorId:id(10),tenantId:id(1)},command={commandId:id(99),contractId:id(100),revision:0,assigneeId:id(11),dueDate:'2026-10-01',basis:'Operational decision'};
const snapshot={contractId:id(100),revision:0,companyStatus:'aktif',suggestedDate:null,task:null};
test('creation validates real calendar dates, bounded revision and required basis',()=>{
 assert.deepEqual(b.validateRenewalCommand(command),command);
 for(const dueDate of ['2026-02-30','2026-02-29','1900-02-29','infinity','2026-1-1'])assert.throws(()=>b.validateRenewalCommand({...command,dueDate}));
 assert.equal(b.renewalDate('2028-02-29'),'2028-02-29');
 for(const extra of [{basis:'\u00a0\ufeff'},{basis:'x'.repeat(2001)},{revision:1.2},{revision:null},{revision:Number.MAX_SAFE_INTEGER},{assigneeId:'bad'}])assert.throws(()=>b.validateRenewalCommand({...command,...extra}));
 assert.equal(b.validateRenewalCommand({...command,basis:'😀'.repeat(2000)}).basis.length,4000);
});
test('unavailable or malformed snapshot never means no task',()=>{
 assert.deepEqual(b.parseRenewalSnapshot(snapshot,id(100)),snapshot);
 for(const data of [null,{}, {...snapshot,task:undefined},{...snapshot,task:{id:null}},{...snapshot,revision:'0'},{...snapshot,contractId:id(101)}])assert.throws(()=>b.parseRenewalSnapshot(data,id(100)));
});
test('current task owner can be unassigned or unavailable without inventing a person',()=>{
 const task={id:id(200),title:'Renew',status:'tamamlandi',dueDate:null,assigneeId:null,assigneeName:null,basis:'Decision'};
 assert.deepEqual(b.parseRenewalSnapshot({...snapshot,task},id(100)).task,task);
});
test('service uses one scoped RPC; malformed success and transport failure do not fall back',async()=>{
 let calls=0;let response={data:null,error:null};const client={from:()=>{throw Error('No fallback');},rpc:async(name,args)=>{calls++;assert.equal(name,'create_contract_renewal_task');assert.equal(args.p_actor_id,scope.actorId);assert.equal(args.p_revision,0);return response;}};
 await assert.rejects(()=>service.createRenewal(client,scope,{...command,basis:''}));assert.equal(calls,0);
 await assert.rejects(()=>service.createRenewal(client,scope,command));assert.equal(calls,1);
 response={data:null,error:{message:'offline'}};await assert.rejects(()=>service.createRenewal(client,scope,command));assert.equal(calls,2);
 response={data:{commandId:command.commandId,contractId:command.contractId,taskId:id(200)},error:null};assert.equal((await service.createRenewal(client,scope,command)).taskId,id(200));assert.equal(calls,3);
});
test('only exact known failure is definite; unknown responses keep retry command',()=>{
 for(const error of [null,new TypeError('offline'),{message:'prefix RENEWAL_TARGET'}])assert.equal(b.renewalFailure(error).uncertain,true);
 assert.equal(b.renewalFailure({message:'RENEWAL_EXISTS'}).uncertain,false);
 assert.throws(()=>b.parseRenewalResult({commandId:id(98),contractId:command.contractId,taskId:id(200)},command));
});
