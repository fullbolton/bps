import test from 'node:test';import assert from 'node:assert/strict';
import {importActualTypeScript} from './helpers/import-typescript.mjs';
const {parseHrActivation:parse,prepareHrActivation:prepare,parseHrActivationReceipt:receipt}=await importActualTypeScript(new URL('../src/lib/services/hr-access-activation.ts',import.meta.url));
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const sample=()=>({schemaVersion:1,actorId:id(1),tenantId:id(2),mode:'legacy',modeRevision:0,policyRevision:1,releaseApproved:true,moduleOpen:true,missingHrPolicies:0,canActivate:true,token:'a'.repeat(32),members:[{accountId:id(1),membershipId:id(8),membershipVersion:id(9),name:'Synthetic manager',role:'yonetici',policyAssigned:false,permanentReadRule:false},{accountId:id(3),membershipId:id(4),membershipVersion:id(5),name:'Synthetic HR',role:'ik',policyAssigned:true,permanentReadRule:true}]});
test('activation rejects foreign scope, incomplete inventory and inconsistent readiness',()=>{
 const s=sample();assert.equal(parse(s,id(1),id(2)).canActivate,true);
 for(const patch of [{actorId:id(9)},{mode:'other'},{modeRevision:-1},{policyRevision:0},{releaseApproved:false},{moduleOpen:false},{missingHrPolicies:1},{token:'x'},{members:[...s.members,...s.members]},{members:[{...s.members[0],membershipVersion:null}]}])assert.throws(()=>parse({...s,...patch},id(1),id(2)));
 const blocked={...s,releaseApproved:false,canActivate:false};assert.equal(parse(blocked,id(1),id(2)).canActivate,false);assert.throws(()=>prepare(id(1),id(2),id(6),parse(blocked,id(1),id(2))));
});
test('activation receipts must bind exact reviewed token, actor, command and revisions',()=>{
 const s=sample(),intent=prepare(id(1),id(2),id(6),parse(s,id(1),id(2)));assert.ok(Object.isFrozen(intent));
 const r={schemaVersion:1,actorId:id(1),tenantId:id(2),commandId:id(6),mode:'scoped',modeRevision:1,policyRevision:1,preflight:s};assert.equal(receipt(r,intent).mode,'scoped');
 for(const patch of [{commandId:id(7)},{mode:'legacy'},{modeRevision:2},{policyRevision:2},{preflight:{...s,token:'b'.repeat(32)}}])assert.throws(()=>receipt({...r,...patch},intent));
});
