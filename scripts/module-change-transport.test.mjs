import test from 'node:test';
import assert from 'node:assert/strict';
import {importActualTypeScript} from './helpers/import-typescript.mjs';
const {createModuleChangeCapability}=await importActualTypeScript(new URL('../src/lib/services/module-change.ts',import.meta.url));
const payload={p_actor:'actor',p_tenant:'tenant',p_membership_version:'membership',p_selection_version:null,p_revision:'2',p_command:'same-intent',p_modules:{tasks:false}};
test('module transport preserves the original intent and uses a bounded request',async()=>{
 const calls=[],receipt={schemaVersion:1};let refreshed=0;
 const capability=createModuleChangeCapability({rpc(name,args){calls.push({name,args});return {abortSignal(signal){assert.ok(signal instanceof AbortSignal);return Promise.resolve({data:receipt,error:null});}};}},async()=>{refreshed++;});
 assert.equal(await capability.transport(payload),receipt);
 assert.equal(refreshed,0,'transport must not refresh before receipt validation');
 assert.deepEqual(calls,[{name:'change_workspace_modules_v1',args:payload}]);
 await capability.refresh();assert.equal(refreshed,1);
});
test('RPC and transport failures propagate without retry or refresh',async()=>{
 for(const failure of ['rpc','network']){
  let calls=0;
  const capability=createModuleChangeCapability({rpc(){calls++;return {abortSignal(){if(failure==='network')return Promise.reject(Error('offline'));return Promise.resolve({data:{replayed:true},error:Error('denied')});}};}},async()=>assert.fail('must not refresh'));
  await assert.rejects(capability.transport(payload));assert.equal(calls,1);
 }
});
