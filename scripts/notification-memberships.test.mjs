import test from 'node:test';
import assert from 'node:assert/strict';
import {importActualTypeScript} from './helpers/import-typescript.mjs';
const {loadTenantScope}=await importActualTypeScript(new URL('../src/lib/email/notification-recipients.ts',import.meta.url));
function client(page){return {from(table){assert.equal(table,'tenant_memberships');return {select(fields,opts){assert.equal(fields,'user_id, tenant_id');assert.equal(opts.count,'exact');const orders=[];return {order(key){orders.push(key);return this;},range(from,to){assert.deepEqual(orders,['tenant_id','user_id']);assert.equal(to-from,499);return page(from);}};}};}};}
const rows=Array.from({length:1201},(_,i)=>({tenant_id:i<600?'tenant-a':'tenant-b',user_id:'user-'+String(i).padStart(4,'0')}));
test('membership paging reaches the last row even when server cap is lower than requested',async()=>{
 const offsets=[];
 const {scope,error}=await loadTenantScope(client(offset=>{offsets.push(offset);return {data:rows.slice(offset,offset+200),count:rows.length,error:null};}));
 assert.equal(error,undefined);assert.equal(scope.loaded,true);assert.equal(scope.isMember('tenant-b','user-1200'),true);assert.equal(scope.isMember('tenant-a','user-1200'),false);assert.deepEqual(offsets,[0,200,400,600,800,1000,1200]);
});
test('later page error, changing count, empty gap and duplicate rows discard the entire map',async()=>{
 for(const response of [{data:null,count:1201,error:{code:'42501'}},{data:rows.slice(500,1000),count:1202,error:null},{data:[],count:1201,error:null},{data:rows.slice(0,500),count:1201,error:null}]){
  const {scope,error}=await loadTenantScope(client(offset=>offset?response:{data:rows.slice(0,500),count:1201,error:null}));
  assert.equal(scope.loaded,false);assert.equal(scope.isMember('tenant-a','user-0000'),false);assert.ok(error);
 }
});
test('empty membership table is valid only with measured zero; thrown reads remain unavailable',async()=>{
 assert.equal((await loadTenantScope(client(()=>({data:[],count:0,error:null})))).scope.loaded,true);
 for(const page of [()=>({data:[],count:null,error:null}),()=>{throw Error('private@example.invalid');}]){
  const result=await loadTenantScope(client(page));assert.equal(result.scope.loaded,false);assert.equal(result.error.includes('private'),false);
 }
});
