import test from 'node:test';
import assert from 'node:assert/strict';
import {importActualTypeScript} from './helpers/import-typescript.mjs';
import {id} from './fixtures/daily-operations.mjs';
const model=await importActualTypeScript(new URL('../src/lib/workspace-context.ts',import.meta.url));
const service=await importActualTypeScript(new URL('../src/lib/services/workspace-context.ts',import.meta.url));
const scope={actorId:id(10),tenantId:id(1)},identity={...scope,name:'  Mek Group  '};
test('workspace identity follows server data and never a user-editable company name',()=>{
 assert.deepEqual(model.parseWorkspaceIdentity({...identity,contacts:['private'],slug:'ignored'},scope),{...scope,name:'Mek Group'});
 assert.deepEqual(model.workspaceScope({id:scope.actorId,app_metadata:{active_tenant:scope.tenantId,name:'Wrong name'}}),scope);
 for(const user of [null,{id:scope.actorId,user_metadata:{active_tenant:scope.tenantId}},{id:scope.actorId,app_metadata:{active_tenant:'invalid'}}])assert.equal(model.workspaceScope(user),null);
});
test('missing, malformed and mismatched company or actor responses fail closed',()=>{
 for(const result of [null,[],{},'Mek Group',{...identity,name:''},{...identity,name:'X\nY'},{...identity,name:12},{...identity,actorId:id(11)},{...identity,tenantId:id(2)}])assert.throws(()=>model.parseWorkspaceIdentity(result,scope));
 assert.throws(()=>model.parseWorkspaceIdentity(identity,{actorId:'invalid',tenantId:id(1)}));
});
test('write target requires both the same actor and company',()=>{
 assert.equal(model.matchesWorkspace(identity,scope),true);
 for(const value of [null,{...identity,actorId:id(11)},{...identity,tenantId:id(2)}])assert.equal(model.matchesWorkspace(value,scope),false);
});
test('RPC errors and null success never invent a company or return a stale identity',async()=>{
 for(const response of [{data:identity,error:{message:'transport'}},{data:null,error:null},{data:{...identity,tenantId:id(2)},error:null}]){
  const client={rpc:()=>({abortSignal:()=>Promise.resolve(response)})};
  await assert.rejects(service.loadWorkspaceIdentity(client,scope));
 }
});
test('company context request carries no caller-selected company and has a deadline',async()=>{
 let called=false;
 const client={rpc:(...args)=>{assert.deepEqual(args,['current_workspace_context']);called=true;return {abortSignal:signal=>{assert.ok(signal instanceof AbortSignal);return Promise.resolve({data:identity,error:null});}};}};
 assert.equal((await service.loadWorkspaceIdentity(client,scope)).name,'Mek Group');assert.ok(called);
});

const {withVerifiedWorkspace}=await importActualTypeScript(new URL('../src/lib/auth-workspace.ts',import.meta.url));
test('UI company comes from verified workspace when getUser metadata lacks token-hook claims',()=>{
 const user={id:'00000000-0000-4000-8000-000000000001',app_metadata:{provider:'email'}},tenant='00000000-0000-4000-8000-000000000002';
 assert.equal(withVerifiedWorkspace(user,{actorId:user.id,tenantId:tenant}).app_metadata.active_tenant,tenant);
 assert.deepEqual(user.app_metadata,{provider:'email'});
 const stale={...user,app_metadata:{...user.app_metadata,active_tenant:tenant}};
 for(const response of [null,{}, {actorId:tenant,tenantId:tenant},{actorId:user.id,tenantId:'bad'}])assert.equal(withVerifiedWorkspace(stale,response).app_metadata.active_tenant,undefined);
 assert.equal(withVerifiedWorkspace(null,{actorId:user.id,tenantId:tenant}),null);
});

const {resolveWorkspaceAccess,workspaceRoles}=await importActualTypeScript(new URL('../src/lib/auth-workspace.ts',import.meta.url));
test('role and company are accepted together and user metadata cannot supply authority',()=>{
 const user={id:scope.actorId,app_metadata:{active_tenant:id(99),role:'yonetici',provider:'email'}};
 for(const role of workspaceRoles){const result=resolveWorkspaceAccess(user,{...identity,role});assert.equal(result.role,role);assert.equal(result.user.app_metadata.active_tenant,scope.tenantId);}
 assert.equal(user.app_metadata.active_tenant,id(99));
 for(const response of [null,{...identity},{...identity,role:'owner'},{...identity,role:'yonetici',actorId:id(99)},{...identity,role:'yonetici',tenantId:'invalid'},{...identity,role:'yonetici',name:''},{...identity,role:'yonetici',name:'X\nY'}]){
  const result=resolveWorkspaceAccess(user,response);assert.equal(result.role,'goruntuleyici');assert.equal(result.user.app_metadata.active_tenant,undefined);assert.equal(result.user.id,user.id);
 }
 assert.deepEqual(resolveWorkspaceAccess(null,{...identity,role:'yonetici'}),{user:null,role:'goruntuleyici'});
});
