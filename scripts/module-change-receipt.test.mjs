import test from 'node:test';
import assert from 'node:assert/strict';
import {importActualTypeScript} from './helpers/import-typescript.mjs';
const {parseModuleChangeReceipt}=await importActualTypeScript(new URL('../src/lib/modules/change-receipt.ts',import.meta.url));
const {MODULE_CATALOG}=await importActualTypeScript(new URL('../src/lib/modules/catalog.ts',import.meta.url));
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const modules=Object.fromEntries(MODULE_CATALOG.map(m=>[m.key,true]));
const context={actorId:id(1),tenantId:id(2),membershipVersion:id(3),selectionVersion:null,name:'Synthetic',role:'yonetici',schemaVersion:1,catalogVersion:1,configRevision:'9007199254740993',modules};
const expected={context,commandId:id(4),modules:{...modules,announcements:false}};
const receipt=()=>({schemaVersion:1,actorId:id(1),tenantId:id(2),commandId:id(4),revision:'9007199254740994',modules:expected.modules,replayed:false});
test('receipt keeps bigint precision and validates both fresh commit and replay',()=>{
 for(const replayed of [true,false]){const result=parseModuleChangeReceipt({...receipt(),replayed},expected);assert.equal(result.revision,'9007199254740994');assert.equal(result.replayed,replayed);assert.ok(Object.isFrozen(result));}
});
test('foreign identity, command, revision, state or protocol cannot show success',()=>{
 for(const patch of [{actorId:id(9)},{tenantId:id(9)},{commandId:id(9)},{revision:'9007199254740995'},{revision:9007199254740994},{schemaVersion:2},{replayed:'true'},{modules}])assert.throws(()=>parseModuleChangeReceipt({...receipt(),...patch},expected));
});
test('null, missing and partial responses fail closed',()=>{
 for(const value of [null,[],{}, {...receipt(),modules:{}}, {...receipt(),revision:null}])assert.throws(()=>parseModuleChangeReceipt(value,expected));
 for(const key of Object.keys(receipt())){const value=receipt();delete value[key];assert.throws(()=>parseModuleChangeReceipt(value,expected));}
});
test('invalid expected commands cannot turn a response into proof',()=>{
 for(const patch of [{commandId:'bad'},{modules},{context:{...context,role:'operasyon'}},{modules:{...expected.modules,customers:false}}])assert.throws(()=>parseModuleChangeReceipt(receipt(),{...expected,...patch}));
});
test('replayed receipt remains bound to original revision, not a later settings snapshot',()=>{
 assert.throws(()=>parseModuleChangeReceipt({...receipt(),replayed:true},{...expected,context:{...context,configRevision:'9007199254740995'}}));
});
