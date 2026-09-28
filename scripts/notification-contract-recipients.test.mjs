import test from 'node:test';
import assert from 'node:assert/strict';
import {importActualTypeScript} from './helpers/import-typescript.mjs';
const {readContractRecipients}=await importActualTypeScript(new URL('../src/lib/email/contract-recipients.ts',import.meta.url));
function fake({profiles=[],assignments=[],fail=false,calls=[]}){return {from(table){calls.push(table);let role,ids,key;return {select(fields,options){assert.equal(options.count,'exact');if(table==='profiles')assert.equal(fields,'id, email');return {eq(k,v){assert.equal(k,'role');role=v;return this;},in(k,v){key=k;ids=v;assert.ok(v.length<=100);return this;},order(){return this;},range:async(from)=>{if(fail&&from)return {data:[],count:profiles.length,error:{code:'42501'}};const data=table==='profiles'?profiles.filter(p=>(!role||p.role===role)&&(!ids||ids.includes(p.id))):assignments.filter(p=>key==='company_id'&&ids.includes(p.company_id));return {data:data.slice(from,from+200),count:data.length,error:null};}};}};}};}
test('contract recipients page managers, preserve email-only eligibility and restrict partner assignments/roles',async()=>{
 const managers=Array.from({length:601},(_,i)=>({id:'m'+i,email:'m'+i+'@example.invalid',role:'yonetici'}));
 const profiles=[...managers,{id:'partner',email:'p@example.invalid',role:'partner'},{id:'former',email:'f@example.invalid',role:'ik'}];
 const assignments=[{company_id:'c1',partner_user_id:'partner'},{company_id:'c1',partner_user_id:'former'}];
 const result=await readContractRecipients(fake({profiles,assignments}),['c1','c2'],true);
 assert.equal(result.get('c1').length,602);assert.equal(result.get('c2').length,601);assert.ok(result.get('c2').some(p=>p.id==='m600'));assert.equal(result.get('c1').some(p=>p.id==='former'),false);
 const calls=[];await readContractRecipients(fake({profiles,assignments,calls}),['c1'],false);assert.equal(calls.includes('partner_company_assignments'),false);
});
test('contract recipient later page failure rejects instead of returning earlier managers',async()=>{
 const profiles=Array.from({length:201},(_,i)=>({id:'m'+i,email:'s@example.invalid',role:'yonetici'}));
 await assert.rejects(readContractRecipients(fake({profiles,fail:true}),['c1'],true));
 const calls=[];assert.equal((await readContractRecipients(fake({calls}),[],true)).size,0);assert.deepEqual(calls,[]);
});
