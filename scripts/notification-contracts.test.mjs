import test from 'node:test';
import assert from 'node:assert/strict';
import {importActualTypeScript} from './helpers/import-typescript.mjs';
const {readExpiryContracts}=await importActualTypeScript(new URL('../src/lib/email/contract-candidates.ts',import.meta.url));
const client=page=>({from:table=>{assert.equal(table,'contracts');return {select:(fields,opts)=>{assert.equal(fields,'id, tenant_id, company_id, name, end_date, responsible');assert.equal(opts.count,'exact');return {eq:(key,value)=>{assert.deepEqual([key,value],['status','aktif']);return {not:(...args)=>{assert.deepEqual(args,['end_date','is',null]);return {order:key=>{assert.equal(key,'id');return {range:page};}};}};}};}};}});
test('expiry contract reader reaches the last candidate past the server cap without selecting unused columns',async()=>{
 const rows=Array.from({length:1001},(_,i)=>({id:'c'+i,tenant_id:'t',company_id:'company',name:'Sentetik',end_date:'2026-09-30',responsible:null}));
 const calls=[];
 const result=await readExpiryContracts(client(async(from,to)=>{calls.push([from,to]);return {data:rows.slice(from,from+500),count:1001,error:null};}));
 assert.equal(result.length,1001);assert.equal(result.at(-1).id,'c1000');assert.deepEqual(calls,[[0,499],[500,999],[1000,1499]]);
});
test('contract read failure or incomplete later page rejects the entire candidate set',async()=>{
 for(const tail of [{data:[],count:2,error:null},{data:null,count:2,error:{code:'42501'}},{data:[{id:'c1'}],count:2,error:null}]){
  await assert.rejects(readExpiryContracts(client(async from=>from?tail:{data:[{id:'c1'}],count:2,error:null})));
 }
 assert.deepEqual(await readExpiryContracts(client(async()=>({data:[],count:0,error:null}))),[]);
});
