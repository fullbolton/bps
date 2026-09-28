import test from 'node:test';
import assert from 'node:assert/strict';
import {importActualTypeScript} from './helpers/import-typescript.mjs';
const {validateLocationUpdate,parseLocationUpdate}=await importActualTypeScript(new URL('../src/lib/operations/location-update.ts',import.meta.url));
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const input={companyId:id(1),id:id(2),expectedRevision:3,name:'Merkez',city:'İstanbul'};
const result={...input,commandId:id(3),revision:4,previousRevision:3,previousName:'Eski',previousCity:'Ankara'};
test('only editable fields survive; leading/trailing whitespace is trimmed',()=>{
 assert.deepEqual(validateLocationUpdate({...input,name:' Merkez ',city:' İstanbul ',externalCode:'CHANGED',active:false}),input);
});
test('invalid identity, stale-token shapes and invalid text cannot become update commands',()=>{
 for(const patch of [{id:'x'},{companyId:null},{expectedRevision:'3'},{expectedRevision:-1},{expectedRevision:2147483647},{expectedRevision:1.5},{name:' '},{name:'a'.repeat(161)},{city:'a'.repeat(81)},{city:'a\nb'},{name:'a\u0000b'}])assert.throws(()=>validateLocationUpdate({...input,...patch}));
});
test('response requires identity, exact new values and one revision advance',()=>{
 assert.equal(parseLocationUpdate(result,id(3),input).previousName,'Eski');
 for(const patch of [{commandId:id(4)},{id:id(4)},{companyId:id(4)},{revision:5},{revision:'4'},{previousRevision:2},{name:'Other'},{city:'Other'},{previousName:null},{previousCity:''}])assert.throws(()=>parseLocationUpdate({...result,...patch},id(3),input));
 for(const v of [null,[],{},true])assert.throws(()=>parseLocationUpdate(v,id(3),input));
});
test('max accepted revision advances safely and missing old values are unverifiable',()=>{
 const p={...input,expectedRevision:2147483646};
 assert.equal(parseLocationUpdate({...result,previousRevision:p.expectedRevision,revision:2147483647},id(3),p).revision,2147483647);
 const missing={...result};delete missing.previousCity;assert.throws(()=>parseLocationUpdate(missing,id(3),input));
});

const {runLocationUpdate}=await importActualTypeScript(new URL('../src/lib/services/daily-operations.ts',import.meta.url));
test('real service forwards scope and normalized payload; RPC error or malformed success is never accepted',async()=>{
 const scope={actorId:id(10),tenantId:id(11)};
 let seen;
 const client={rpc:async(name,args)=>{seen={name,args};return {data:result,error:null};}};
 await runLocationUpdate(client,scope,id(3),{...input,name:' Merkez '});
 assert.equal(seen.name,'ops_update_location');assert.equal(seen.args.p_actor_id,scope.actorId);assert.equal(seen.args.p_tenant_id,scope.tenantId);assert.equal(seen.args.p_name,'Merkez');
 for(const reply of [{data:null,error:null},{data:result,error:{message:'transport'}},{data:{...result,revision:99},error:null}])await assert.rejects(runLocationUpdate({rpc:async()=>reply},scope,id(3),input));
 await assert.rejects(runLocationUpdate({rpc:async()=>assert.fail('invalid scope must not call RPC')},{...scope,tenantId:'bad'},id(3),input));
});
