import test from 'node:test';import assert from 'node:assert/strict';
import {importActualTypeScript} from './helpers/import-typescript.mjs';
const {parseModuleEntitlements:parse}=await importActualTypeScript(new URL('../src/lib/modules/entitlements.ts',import.meta.url));
const {loadModuleEntitlements:load}=await importActualTypeScript(new URL('../src/lib/services/workspace-modules.ts',import.meta.url));
const {MODULE_CATALOG}=await importActualTypeScript(new URL('../src/lib/modules/catalog.ts',import.meta.url));
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const all=Object.fromEntries(MODULE_CATALOG.map(m=>[m.key,true]));
const expected={actorId:id(1),tenantId:id(2),membershipVersion:id(3),selectionVersion:null,name:'Synthetic',role:'yonetici',schemaVersion:1,catalogVersion:1,configRevision:'2',modules:all};
const make=()=>({schemaVersion:1,context:{...expected,catalogVersion:2,modules:{...all,hr:false}},entitlementRevision:'9007199254740993',granted:{...all,hr:true},ready:{...all,hr:false}});
test('allocation does not imply readiness or activation; revisions retain bigint precision',()=>{
 const value=parse(make(),expected);assert.equal(value.granted.hr,true);assert.equal(value.ready.hr,false);assert.equal(value.enabled.hr,false);assert.equal(value.revision,'9007199254740993');assert.ok(Object.isFrozen(value.granted));
});
test('rights reject missing data, scope drift, unsupported versions and inconsistent activation',()=>{
 for(const mutate of [x=>delete x.granted.hr,x=>x.granted.hr='true',x=>x.ready.extra=false,x=>x.context.tenantId=id(9),x=>x.context.membershipVersion=id(9),x=>x.context.configRevision='3',x=>x.entitlementRevision=2,x=>x.context.modules.hr=true,x=>x.granted.finance=false,x=>x.context.catalogVersion=3,x=>x.schemaVersion=2]){
 const value=make();mutate(value);assert.throws(()=>parse(value,expected));
 }
 assert.throws(()=>parse(make(),{...expected,role:'operasyon'}));
});
test('allocations can exist independently but enabled modules still require valid dependencies',()=>{
 const value=make();value.context.modules=Object.fromEntries(Object.keys(value.context.modules).map(k=>[k,false]));value.granted.customers=false;
 const result=parse(value,{...expected,modules:{...value.context.modules}});assert.equal(result.granted.contracts,true);
 value.context.modules.contracts=true;assert.throws(()=>parse(value,{...expected,modules:{...value.context.modules}}));
});
test('rights service makes one scoped RPC and never substitutes default rights',async()=>{
 const calls=[];let error=null,data=make();const client={rpc(name,args){calls.push({name,args});return {abortSignal:async()=>({data,error})};}};
 await load(client,expected);assert.deepEqual(calls[0],{name:'workspace_module_entitlements_v1',args:{p_actor:expected.actorId,p_tenant:expected.tenantId}});
 error={code:'offline'};await assert.rejects(load(client,expected),e=>e===error);assert.equal(calls.length,2);
 error=null;data=null;await assert.rejects(load(client,expected));
});
