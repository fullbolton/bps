import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {importActualTypeScript} from './helpers/import-typescript.mjs';
import {renderCatalogSql,migrationUrl} from './module-catalog-sql.mjs';
const catalog=await importActualTypeScript(new URL('../src/lib/modules/catalog.ts',import.meta.url));
const context=await importActualTypeScript(new URL('../src/lib/modules/context.ts',import.meta.url));
const service=await importActualTypeScript(new URL('../src/lib/services/workspace-modules.ts',import.meta.url));
const {MODULE_CATALOG,parseModuleStates,requiredModuleClosure,validateModuleCatalog}=catalog;
const uuid=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const scope={actorId:uuid(1),tenantId:uuid(2),selectionVersion:null,membershipVersion:uuid(3)};
const states=enabled=>Object.fromEntries(MODULE_CATALOG.map(m=>[m.key,enabled]));
const valid=()=>({...scope,name:' Mek ',role:'yonetici',schemaVersion:1,catalogVersion:1,configRevision:'1',modules:states(true)});

test('hard dependencies are a DAG; unknown, duplicate and self edges are rejected',()=>{
 validateModuleCatalog(MODULE_CATALOG);
 for(const invalid of [[],[...MODULE_CATALOG,MODULE_CATALOG[0]],
  [{key:'a',requires:['missing'],enhances:[]}],
  [{key:'a',requires:['a'],enhances:[]}],
  [{key:'a',requires:[],enhances:['a']}],
  [{key:'a',requires:['b','b'],enhances:[]},{key:'b',requires:[],enhances:[]}],
  [{key:'a',requires:['b'],enhances:['b']},{key:'b',requires:[],enhances:[]}],
  [{key:'a',requires:['b'],enhances:[]},{key:'b',requires:['a'],enhances:[]}],
 ]) assert.throws(()=>validateModuleCatalog(invalid));
 validateModuleCatalog([{key:'a',requires:[],enhances:['b']},{key:'b',requires:[],enhances:['a']}]);
});
test('talent, tasks and announcements stand alone; reporting and staffing do not require each other',()=>{
 for(const key of ['talent','tasks','announcements'])assert.deepEqual(requiredModuleClosure([key]),[key]);
 assert.deepEqual(requiredModuleClosure(['reporting']),['customers','reporting']);
 assert.deepEqual(requiredModuleClosure(['staffing']),['customers','staffing']);
 assert.deepEqual(requiredModuleClosure(['contracts']),['customers','documents','contracts']);
 assert.throws(()=>requiredModuleClosure(['unknown']));
});
test('every one of the 1024 configurations is accepted iff all required dependencies are enabled',()=>{
 for(let mask=0;mask<2**MODULE_CATALOG.length;mask++){
  const input=Object.fromEntries(MODULE_CATALOG.map((m,i)=>[m.key,Boolean(mask&(1<<i))]));
  const coherent=MODULE_CATALOG.every(m=>!input[m.key]||m.requires.every(key=>input[key]));
  if(coherent)assert.deepEqual(parseModuleStates(input),input);
  else assert.throws(()=>parseModuleStates(input),/MODULE_CONFIG_DEPENDENCY/);
 }
});
test('partial, unknown, inherited and non-boolean module values never imply enabled',()=>{
 const missing=states(true);delete missing.tasks;
 for(const input of [null,[],{},missing,{...states(true),unknown:false},Object.create(states(true)),
  ...[null,'true',1,undefined,{}].map(tasks=>({...states(true),tasks}))])assert.throws(()=>parseModuleStates(input));
});
test('context keeps bigint revisions exact and discards unrelated response fields',()=>{
 const response={...valid(),configRevision:'9223372036854775807',secret:'excluded'};
 const parsed=context.parseWorkspaceModuleContext(response,scope);
 assert.equal(parsed.configRevision,'9223372036854775807');assert.equal(parsed.name,'Mek');assert.equal(parsed.secret,undefined);
 assert.ok(Object.isFrozen(parsed));assert.ok(Object.isFrozen(parsed.modules));
 response.modules.tasks=false;assert.equal(parsed.modules.tasks,true);
});
test('actor/company/generation/role/protocol mismatches cannot supply a context',()=>{
 for(const patch of [{actorId:uuid(9)},{tenantId:uuid(9)},{selectionVersion:uuid(9)},{membershipVersion:uuid(9)},
  {role:'admin'},{schemaVersion:2},{catalogVersion:2},{schemaVersion:'1'},{modules:null},
  ...[null,1,'0','01','-1','1e2','9223372036854775808','99999999999999999999'].map(configRevision=>({configRevision}))]){
  assert.throws(()=>context.parseWorkspaceModuleContext({...valid(),...patch},scope));
 }
 for(const patch of [{selectionVersion:'invalid'},{membershipVersion:null}])assert.throws(()=>context.parseWorkspaceModuleContext(valid(),{...scope,...patch}));
});
test('all existing member roles retain their role without receiving new privileges',()=>{
 for(const role of ['yonetici','partner','operasyon','ik','muhasebe','goruntuleyici'])assert.equal(context.parseWorkspaceModuleContext({...valid(),role},scope).role,role);
});
test('an older response from another workspace is rejected and no RPC fallback runs',async()=>{
 for(const response of [{data:valid(),error:{message:'transport'}},{data:null,error:null},{data:{...valid(),tenantId:uuid(7)},error:null}]){
  let calls=0;const client={rpc:name=>{assert.equal(name,'current_workspace_modules_v1');calls++;return {abortSignal:()=>Promise.resolve(response)};}};
  await assert.rejects(service.loadWorkspaceModules(client,scope));assert.equal(calls,1);
 }
});
test('one bounded RPC returns the whole snapshot, without a client-selected tenant argument',async()=>{
 const client={rpc:(...args)=>{assert.deepEqual(args,['current_workspace_modules_v1']);return {abortSignal:signal=>{
  assert.ok(signal instanceof AbortSignal);return Promise.resolve({data:valid(),error:null});
 }};}};
 assert.deepEqual((await service.loadWorkspaceModules(client,scope)).modules,states(true));
});
test('migration catalog is generated from the same manifest, not a second hand-maintained graph',()=>{
 assert.ok(readFileSync(migrationUrl,'utf8').includes(renderCatalogSql()));
});
