import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {importActualTypeScript} from './helpers/import-typescript.mjs';
const {MODULE_CATALOG}=await importActualTypeScript(new URL('../src/lib/modules/catalog.ts',import.meta.url));
const {MODULE_CHANGE_CHECKS,parseModuleChangePreview,parseRequestedModules}=await importActualTypeScript(new URL('../src/lib/modules/change-preview.ts',import.meta.url));
const {previewWorkspaceModules}=await importActualTypeScript(new URL('../src/lib/services/workspace-modules.ts',import.meta.url));
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const scope={actorId:id(11),tenantId:id(1),membershipVersion:id(31),selectionVersion:null};
const all=v=>Object.fromEntries(MODULE_CATALOG.map(m=>[m.key,v]));
const snapshot=()=>({schemaVersion:1,context:{...scope,name:'Synthetic',role:'yonetici',schemaVersion:1,catalogVersion:1,configRevision:'1',modules:all(true)},requested:all(false),disabled:MODULE_CATALOG.map(m=>m.key).sort(),dependencies:[],checks:MODULE_CHANGE_CHECKS.map(c=>({module:c.module,code:c.code,blocking:false})),assessmentDate:'2026-09-29',advisoryOnly:true,mutationAvailable:false});
const parse=x=>parseModuleChangePreview(x,scope,'1',all(false));
test('complete advisory response preserves all checks but never permits mutation',()=>{
 const result=parse(snapshot());assert.equal(result.checks.length,16);assert.equal(result.mutationAvailable,false);assert.equal(result.advisoryOnly,true);
});
test('a dependency-invalid draft is accepted so the UI can explain it; incomplete or coerced states are not',()=>{
 assert.equal(parseRequestedModules({...all(true),customers:false}).customers,false);
 for(const x of [null,[],{}, {...all(true),tasks:'false'},{...all(true),extra:true}])assert.throws(()=>parseRequestedModules(x));
});
test('scope revision membership role and advisory flags fail closed',()=>{
 for(const patch of [{tenantId:id(2)},{actorId:id(12)},{membershipVersion:id(99)},{configRevision:'2'},{role:'operasyon'}])assert.throws(()=>parse({...snapshot(),context:{...snapshot().context,...patch}}));
 for(const patch of [{advisoryOnly:false},{mutationAvailable:true},{checks:null},{disabled:[]},{requested:all(true)}])assert.throws(()=>parse({...snapshot(),...patch}));
});
test('missing duplicate foreign and non-boolean checks never become an empty successful report',()=>{
 for(const checks of [[],snapshot().checks.slice(1),[snapshot().checks[0],...snapshot().checks.slice(0,-1)],snapshot().checks.map((c,i)=>i?c:{...c,blocking:null}),snapshot().checks.map((c,i)=>i?c:{...c,module:'finance'})])assert.throws(()=>parse({...snapshot(),checks}));
});
test('dependency evidence must match the requested graph',()=>{
 const x=snapshot();x.requested={...all(true),documents:false};x.disabled=['documents'];x.checks=[];
 assert.throws(()=>parseModuleChangePreview(x,scope,'1',x.requested));
 x.dependencies=[{module:'contracts',requires:'documents'}];assert.equal(parseModuleChangePreview(x,scope,'1',x.requested).dependencies.length,1);
});
test('every resolution link targets an existing page',()=>{
 for(const c of MODULE_CHANGE_CHECKS)assert.ok(existsSync(new URL(`../src/app/(main)${c.href}/page.tsx`,import.meta.url)),c.href);
});
test('one bounded RPC; transport errors and malformed responses never fall back',async()=>{
 for(const response of [{data:snapshot(),error:null},{data:null,error:null},{data:snapshot(),error:{message:'transport'}}]){
  let calls=0;const client={rpc:(name,args)=>{calls++;assert.equal(name,'preview_workspace_modules_v1');assert.equal(args.p_expected_tenant,scope.tenantId);return {abortSignal:s=>{assert.ok(s instanceof AbortSignal);return Promise.resolve(response);}};}};
  if(response.data&&!response.error)assert.equal((await previewWorkspaceModules(client,scope,'1',all(false))).checks.length,16);
  else await assert.rejects(previewWorkspaceModules(client,scope,'1',all(false)));
  assert.equal(calls,1);
 }
});
