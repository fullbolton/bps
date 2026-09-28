import test from 'node:test';
import assert from 'node:assert/strict';
import {importActualTypeScript} from './helpers/import-typescript.mjs';
const {fetchCompanyPartnerAssignments,resolveCompanyRecipients}=await importActualTypeScript(new URL('../src/lib/email/notification-recipients.ts',import.meta.url));
const client=respond=>({from(table){assert.equal(table,'partner_company_assignments');return {select(_,opts){assert.equal(opts.count,'exact');return {in(key,ids){assert.equal(key,'company_id');assert.ok(ids.length<=100);const order=[];return {order(key){order.push(key);return this;},range(from,to){assert.deepEqual(order,['company_id','partner_user_id']);assert.equal(to-from,499);return respond(ids,from);}};}};}};}});
test('company IDs are chunked and each assignment batch is paged to the measured total',async()=>{
 const ids=Array.from({length:101},(_,i)=>'c'+i),calls=[];
 const result=await fetchCompanyPartnerAssignments(client((chunk,from)=>{calls.push([chunk.length,from]);const data=Array.from({length:chunk.length===100?601:1},(_,i)=>({company_id:chunk[0],partner_user_id:'p'+i}));return {data:data.slice(from,from+200),count:data.length,error:null};}),[...ids,ids[0]]);
 assert.equal(result.error,undefined);assert.equal(result.rows.length,602);assert.equal(result.rows.at(-1).company_id,'c100');assert.deepEqual(calls,[[100,0],[100,200],[100,400],[100,600],[1,0]]);
});
test('late assignment failure or unrelated company discards all previously read assignments',async()=>{
 for(const bad of [{data:[],count:1,error:null},{data:[{company_id:'foreign',partner_user_id:'p'}],count:1,error:null},{data:null,count:0,error:{code:'42501'}}]){
  const result=await fetchCompanyPartnerAssignments(client((ids)=>ids[0]==='c0'?{data:[{company_id:'c0',partner_user_id:'p'}],count:1,error:null}:bad),Array.from({length:101},(_,i)=>'c'+i));
  assert.ok(result.error);assert.deepEqual(result.rows,[]);
 }
 assert.deepEqual(await fetchCompanyPartnerAssignments({from(){throw Error('no query');}},[]),{rows:[]});
});
test('failed manager read yields no company recipients and never starts partner lookup',async()=>{
 const fake={from:table=>{assert.equal(table,'profiles');return {select:()=>({in:()=>({order:()=>({range:async()=>({data:null,count:null,error:{code:'42501'}})})})})};}};
 const result=await resolveCompanyRecipients(fake,['c'],{includePartners:true});assert.equal(result.byCompany.size,0);assert.equal(result.errors.length,1);
});
