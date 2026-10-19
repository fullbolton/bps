import test from 'node:test';
import assert from 'node:assert/strict';
import {importActualTypeScript} from './helpers/import-typescript.mjs';
const {MODULE_CATALOG}=await importActualTypeScript(new URL('../src/lib/modules/catalog.ts',import.meta.url));
const {parseCatalogSnapshot:parse,upgradeCatalogSnapshot:upgrade,mergeCatalogRequest:merge,compareCatalogSnapshots:compare}=await importActualTypeScript(new URL('../src/lib/modules/catalog-snapshot.ts',import.meta.url));
const all=Object.fromEntries(MODULE_CATALOG.map(m=>[m.key,true]));
test('explicit upgrade preserves every legacy configuration and starts HR disabled',()=>{
 let accepted=0;
 for(let mask=0;mask<2**MODULE_CATALOG.length;mask++){
  const state=Object.fromEntries(MODULE_CATALOG.map((m,i)=>[m.key,!!(mask&(1<<i))]));
  let old;try{old=parse(1,state);}catch{continue;}
  const next=upgrade(state);accepted++;
  assert.deepEqual(next.modules,{...state,hr:false});
  assert.deepEqual(compare(old,next),{upgraded:true,changes:[]});
  assert.ok(Object.isFrozen(next)&&Object.isFrozen(next.modules));
 }
 assert.ok(accepted>20);
});
test('snapshot reads never infer HR, version, missing fields, or dependency state',()=>{
 for(const [version,state] of [[undefined,all],['2',{...all,hr:false}],[3,{...all,hr:false}],[2,all],[1,{...all,hr:false}],[2,{...all,hr:0}],[2,{...all,hr:false,unknown:false}],[2,{...all,customers:false,hr:false}],[2,null]])assert.throws(()=>parse(version,state));
 const inherited=Object.create({hr:false});Object.assign(inherited,all);assert.throws(()=>parse(2,inherited));
});
test('legacy client preserves both enabled and disabled HR and does not mutate its input',()=>{
 for(const hr of [false,true]){
  const current=parse(2,{...all,hr}),desired={...all,finance:false};
  const result=merge(current,1,desired);
  assert.deepEqual(result.modules,{...desired,hr});
  assert.deepEqual(current.modules,{...all,hr});assert.deepEqual(desired,{...all,finance:false});
  assert.deepEqual(compare(current,result),{upgraded:false,changes:[{key:'finance',enabled:false}]});
 }
});
test('new client cannot silently upgrade storage or hide an HR-only event',()=>{
 assert.throws(()=>merge(parse(1,all),2,{...all,hr:false}),/UPGRADE_REQUIRED/);
 const before=upgrade(all),after=merge(before,2,{...all,hr:true});
 assert.deepEqual(compare(before,after),{upgraded:false,changes:[{key:'hr',enabled:true}]});
 assert.deepEqual(compare(after,before),{upgraded:false,changes:[{key:'hr',enabled:false}]});
 assert.throws(()=>merge(before,1,{...all,hr:true}));
});
test('catalog migration cannot combine activation, settings edits or downgrade',()=>{
 const before=parse(1,all);
 assert.throws(()=>compare(before,parse(2,{...all,hr:true})),/UPGRADE_HR_ENABLED/);
 assert.throws(()=>compare(before,parse(2,{...all,finance:false,hr:false})),/UPGRADE_CHANGED_STATE/);
 assert.throws(()=>compare(upgrade(all),before),/DOWNGRADE/);
 assert.deepEqual(compare(before,before),{upgraded:false,changes:[]});
});
test('untrusted current state is validated even on a legacy merge',()=>{
 assert.throws(()=>merge({version:2,modules:all},1,all));
 assert.throws(()=>merge(upgrade(all),3,all));
 const current=upgrade(all);assert.throws(()=>merge(current,2,{...all,hr:null}));
});
