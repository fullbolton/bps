import test from 'node:test';
import assert from 'node:assert/strict';
import {importActualTypeScript} from './helpers/import-typescript.mjs';
import {id} from './fixtures/daily-operations.mjs';
const boundary=await importActualTypeScript(new URL('../src/lib/task-transfer.ts',import.meta.url));
const service=await importActualTypeScript(new URL('../src/lib/services/task-transfer.ts',import.meta.url));
const scope={actorId:id(10),tenantId:id(1)};
const command={commandId:id(99),sourceId:id(11),targetId:id(12),tasks:[{id:id(20),revision:0}]};
const preview={sourceId:id(11),total:1,tasks:[{id:id(20),revision:0,title:'A',companyName:null}]};
test('command validates bounded unique integer revisions and canonical identities',()=>{
  assert.deepEqual(boundary.validateTransferCommand(command),command);
  for(const input of [null,{}, {...command,targetId:command.sourceId},{...command,tasks:[]},{...command,tasks:Array(101).fill(command.tasks[0])},{...command,tasks:[...command.tasks,...command.tasks]},...[-1,0.1,'0',null,Number.MAX_SAFE_INTEGER].map(revision=>({...command,tasks:[{id:id(20),revision}]}))])assert.throws(()=>boundary.validateTransferCommand(input));
});
test('snapshot normalization removes ordering and presentation from command identity',()=>{
  const c=boundary.validateTransferCommand({...command,tasks:[{id:id(21),revision:2,title:'ignored'},...command.tasks]});
  assert.deepEqual(c.tasks,[command.tasks[0],{id:id(21),revision:2}]);
});
test('preview rejects silent omissions, duplicate rows, unsafe counts and wrong source',()=>{
  assert.deepEqual(boundary.parseTransferPreview(preview,id(11)),preview);
  for(const value of [null,{...preview,sourceId:id(12)},{...preview,total:2},{...preview,total:'1'},{...preview,tasks:[{...preview.tasks[0],revision:undefined}]},{...preview,total:2,tasks:[...preview.tasks,...preview.tasks]}])assert.throws(()=>boundary.parseTransferPreview(value,id(11)));
  assert.equal(boundary.parseTransferPreview({...preview,total:0,tasks:[]},id(11)).total,0);
});
test('directory allows unnamed departed source, never absent arrays or duplicate targets',()=>{
  const d={sources:[{id:id(14),name:null,count:1201}],targets:[{id:id(12),name:'Local'}]};
  assert.deepEqual(boundary.parseTransferDirectory(d),d);
  for(const value of [null,{sources:[]},{...d,targets:[...d.targets,...d.targets]},{...d,sources:[{...d.sources[0],count:0}]}])assert.throws(()=>boundary.parseTransferDirectory(value));
});
test('result must match exact command scope and moved count',()=>{
  const result={commandId:command.commandId,sourceId:command.sourceId,targetId:command.targetId,moved:1};
  assert.deepEqual(boundary.parseTransferResult(result,command),result);
  for(const value of [null,{...result,moved:0},{...result,commandId:id(98)},{...result,targetId:id(10)}])assert.throws(()=>boundary.parseTransferResult(value,command));
});
test('service writes one RPC and has no iterative task fallback',async()=>{
  let calls=0;const client={from:()=>{throw Error('fallback forbidden');},rpc:async(name,args)=>{calls++;assert.equal(name,'transfer_tasks_scoped');assert.equal(args.p_tenant_id,scope.tenantId);assert.deepEqual(args.p_tasks,command.tasks);return {data:{commandId:command.commandId,sourceId:command.sourceId,targetId:command.targetId,moved:1},error:null};}};
  assert.equal((await service.submitTransfer(client,scope,command)).moved,1);assert.equal(calls,1);
});
test('invalid command fails before write and malformed successful response is uncertain',async()=>{
  let calls=0;const client={rpc:async()=>{calls++;return {data:null,error:null};}};
  await assert.rejects(()=>service.submitTransfer(client,scope,{...command,targetId:'bad'}));assert.equal(calls,0);
  await assert.rejects(()=>service.submitTransfer(client,scope,command));assert.equal(calls,1);
});
test('transport error cannot be mislabeled as nonmember or conflict',()=>{
  for(const error of [new TypeError('offline'),{message:'fetch failed'},null,{message:'prefix TRANSFER_TARGET'}]){
    const failure=boundary.transferFailure(error);assert.equal(failure.uncertain,true);assert.doesNotMatch(failure.error,/üyesi değil|Hiçbiri devredilmedi/);
  }
  assert.equal(boundary.transferFailure({message:'TRANSFER_CONFLICT'}).uncertain,false);
  assert.match(boundary.transferFailure({message:'TRANSFER_TARGET'}).error,/üyesi değil/);
  assert.match(boundary.transferFailure({message:'TRANSFER_TARGET_ROLE'}).error,/görev erişimi yok/);
});
