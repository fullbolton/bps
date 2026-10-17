import test from 'node:test';
import assert from 'node:assert/strict';
import {importActualTypeScript} from './helpers/import-typescript.mjs';
const {createModuleChangeAttempt}=await importActualTypeScript(new URL('../src/lib/modules/change-attempt.ts',import.meta.url));
const {MODULE_CATALOG}=await importActualTypeScript(new URL('../src/lib/modules/catalog.ts',import.meta.url));
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const modules=Object.fromEntries(MODULE_CATALOG.map(m=>[m.key,true]));
const context={actorId:id(1),tenantId:id(2),membershipVersion:id(3),selectionVersion:null,name:'Synthetic',role:'yonetici',schemaVersion:1,catalogVersion:1,configRevision:'1',modules};
const draft={...modules,announcements:false};
const receipt={schemaVersion:1,actorId:id(1),tenantId:id(2),commandId:id(4),revision:'2',modules:draft,replayed:true};
test('lost response retries identical immutable intent, even after a newer revision',async()=>{
 const mutable={...draft},attempt=createModuleChangeAttempt(context,id(4),mutable),seen=[];
 mutable.announcements=true;
 assert.deepEqual(await attempt.send(context,async p=>{seen.push(p);throw Error('lost reply');}),{status:'unconfirmed'});
 const result=await attempt.send({...context,configRevision:'3'},async p=>{seen.push(p);return receipt;});
 assert.equal(result.status,'committed');assert.equal(result.receipt.revision,'2');
 assert.equal(seen[0],seen[1]);assert.ok(Object.isFrozen(seen[0]));assert.ok(Object.isFrozen(seen[0].p_modules));assert.equal(seen[0].p_modules.announcements,false);
});
test('double click shares one in-flight request; confirmed repeat does not write again',async()=>{
 const attempt=createModuleChangeAttempt(context,id(4),draft);let resolve,calls=0;
 const transport=()=>{calls++;return new Promise(r=>{resolve=r;});};
 const a=attempt.send(context,transport),b=attempt.send(context,transport);assert.equal(a,b);
 await Promise.resolve();resolve(receipt);await a;
 await attempt.send(context,transport);assert.equal(calls,1);
});
test('malformed acknowledgement stays unconfirmed and can be retried',async()=>{
 const attempt=createModuleChangeAttempt(context,id(4),draft);
 for(const value of [null,{}, {...receipt,commandId:id(8)}])assert.equal((await attempt.send(context,async()=>value)).status,'unconfirmed');
 assert.equal((await attempt.send(context,async()=>receipt)).status,'committed');
});
test('workspace, membership, selection and role changes cannot send the old intent',()=>{
 const attempt=createModuleChangeAttempt(context,id(4),draft);let calls=0;
 for(const patch of [{tenantId:id(9)},{actorId:id(9)},{membershipVersion:id(9)},{selectionVersion:id(9)},{role:'operasyon'}])assert.throws(()=>attempt.send({...context,...patch},async()=>{calls++;return receipt;}));
 assert.equal(calls,0);
});
test('invalid or unchanged requests cannot create an attempt',()=>{
 assert.throws(()=>createModuleChangeAttempt(context,id(4),modules));
 assert.throws(()=>createModuleChangeAttempt(context,'invalid',draft));
 assert.throws(()=>createModuleChangeAttempt({...context,role:'operasyon'},id(4),draft));
});
