import test from 'node:test';import assert from 'node:assert/strict';
import {importActualTypeScript} from './helpers/import-typescript.mjs';
const {prepareAccessCommand:prepare,saveAccessCommand:save}=await importActualTypeScript(new URL('../src/lib/services/access-management.ts',import.meta.url));
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const payload=()=>({kind:'save_role',name:'HR Reader',rules:[{capability:'hr.employees.read',effect:'allow',scope:{kind:'selected',departmentIds:[id(8)],locationIds:[]}}]});
test('access commands validate role contract and deeply freeze retry data',()=>{
 const p=payload(),intent=prepare(id(1),id(2),id(3),1,p);p.rules[0].scope.departmentIds.push(id(9));assert.equal(intent.p_payload.rules[0].scope.departmentIds.length,1);assert.ok(Object.isFrozen(intent.p_payload.rules[0].scope.departmentIds));
 for(const mutate of [p=>p.rules[0].capability='*',p=>p.rules[0].scope.departmentIds=[],p=>p.name='',p=>p.extra=true,p=>p.rules[0].effect={toString:()=> 'allow'}]){const p=payload();mutate(p);assert.throws(()=>prepare(id(1),id(2),id(3),1,p));}
 assert.throws(()=>prepare(id(1),id(2),id(3),1,{kind:'assign_role',accountId:id(1),roleId:id(8)}),/ACCESS_PROTECTED_ACCOUNT/);
 for(const rev of [0,-1,1.5,Number.MAX_SAFE_INTEGER])assert.throws(()=>prepare(id(1),id(2),id(3),rev,payload()));
});
test('access receipt requires exact revision and target; uncertain command reuses intent',async()=>{
 const intent=prepare(id(1),id(2),id(3),5,{kind:'assign_role',accountId:id(4),roleId:id(8)});
 const base={schemaVersion:1,actorId:id(1),tenantId:id(2),commandId:id(3),kind:'assign_role',id:id(8),revision:6};let data=base,error=Error('uncertain');const calls=[];
 const client={rpc(name,args){assert.equal(name,'company_access_command_v1');calls.push(args);return {abortSignal:async()=>({data,error})};}};
 await assert.rejects(save(client,intent));error=null;assert.deepEqual(await save(client,intent),{id:id(8),revision:6});assert.deepEqual(calls[0],calls[1]);
 for(const change of [{actorId:id(9)},{tenantId:id(9)},{commandId:id(9)},{id:id(9)},{revision:5},{kind:'unassign_role'},{extra:true}]){data={...base,...change};await assert.rejects(save(client,intent),/ACCESS_RECEIPT_INVALID/);}
});
