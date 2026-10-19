import test from 'node:test';import assert from 'node:assert/strict';
import {importActualTypeScript} from './helpers/import-typescript.mjs';
const {parsePlatformRights:parse,prepareRightChange:prepare,saveRightChange:save,loadPlatformRights:load}=await importActualTypeScript(new URL('../src/lib/services/platform-module-rights.ts',import.meta.url));
const {MODULE_CATALOG}=await importActualTypeScript(new URL('../src/lib/modules/catalog.ts',import.meta.url));
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const all={...Object.fromEntries(MODULE_CATALOG.map(m=>[m.key,true])),hr:false};
const raw=()=>({schemaVersion:1,actorId:id(1),tenantId:id(2),name:'Synthetic',revision:'7',granted:{...all},ready:{...all},enabled:{...all}});
test('admin read validates actor/company and never equates allocation with activation',()=>{
 const x=raw();x.granted.hr=true;const result=parse(x,id(1),id(2));assert.equal(result.granted.hr,true);assert.equal(result.enabled.hr,false);
 for(const mutate of [v=>v.actorId=id(9),v=>v.tenantId=id(9),v=>delete v.granted.hr,v=>v.enabled.hr=true,v=>v.revision=7,v=>v.ready.finance=false]){const v=raw();mutate(v);assert.throws(()=>parse(v,id(1),id(2)));}
});
test('intent is immutable and refuses active modules; result must match the exact original intent',async()=>{
 const s=parse(raw(),id(1),id(2));assert.throws(()=>prepare(s,'finance',id(3)));const intent=prepare(s,'hr',id(3));assert.ok(Object.isFrozen(intent));assert.equal(intent.p_granted,true);
 const receipt={schemaVersion:1,actorId:id(1),tenantId:id(2),commandId:id(3),module:'hr',granted:true,revision:'8',replayed:false};
 let data=receipt,error=null;const calls=[];const client={rpc(name,args){calls.push({name,args});return {abortSignal:async()=>({data,error})};}};
 error={code:'offline'};await assert.rejects(save(client,intent));error=null;data={...receipt,replayed:true};await save(client,intent);assert.deepEqual(calls[0].args,calls[1].args);
 for(const delta of [{tenantId:id(9)},{module:'finance'},{revision:'9'},{granted:false},{commandId:id(9)}]){data={...receipt,...delta};await assert.rejects(save(client,intent));}
});
test('reader calls scoped platform RPC once without falling back',async()=>{
 let name,args;const c={rpc(n,a){name=n;args=a;return {abortSignal:async()=>({data:raw(),error:null})};}};
 await load(c,id(1),id(2));assert.equal(name,'platform_module_rights_v1');assert.deepEqual(args,{p_actor:id(1),p_tenant:id(2)});
});
