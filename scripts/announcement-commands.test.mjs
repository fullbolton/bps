import test from 'node:test';
import assert from 'node:assert/strict';
import {importActualTypeScript} from './helpers/import-typescript.mjs';
const raw=await importActualTypeScript(new URL('../src/lib/supabase/announcements.ts',import.meta.url));
const service=await importActualTypeScript(new URL('../src/lib/services/announcements.ts',import.meta.url));
const row={id:'a',tenant_id:'tenant-a',body:'Duyuru',created_by:'actor',created_at:'2026-10-05'};
function client(data=row,error=null){const calls=[];return {calls,from(){throw Error('No direct DML');},rpc(name,args){calls.push({name,args});return {single:async()=>({data,error})};}};}
test('create uses one command; author is resolved in database without extra auth request',async()=>{
 const c=client();assert.equal((await service.createAnnouncement(c,{body:'  Duyuru  '},{tenantId:'tenant-a'})).id,'a');
 assert.deepEqual(c.calls,[{name:'announcement_execute_v1',args:{p_action:'create',p_id:null,p_tenant:'tenant-a',p_body:'Duyuru'}}]);
});
test('delete requires returned matching record and uses no table DML',async()=>{
 const c=client();await raw.deleteAnnouncement(c,'a');assert.deepEqual(c.calls[0].args,{p_action:'delete',p_id:'a',p_tenant:null,p_body:null});
 for(const data of [null,{...row,id:'b'}])await assert.rejects(raw.deleteAnnouncement(client(data),'a'),/doğrulanamadı/);
});
test('empty, wrong-scope, wrong-body and transport failures never become create success or retries',async()=>{
 for(const [data,error] of [[null,null],[{...row,tenant_id:'b'},null],[{...row,body:'Other'},null],[null,{message:'offline'}]]){
  const c=client(data,error);await assert.rejects(raw.insertAnnouncement(c,{tenant_id:'tenant-a',body:'Duyuru'}));assert.equal(c.calls.length,1);
 }
});
test('service retains 500-character limit and rejects invalid body before writing',async()=>{
 assert.equal(service.ANNOUNCEMENT_MAX_LENGTH,500);
 for(const body of ['  ','x'.repeat(501)]){const c=client();await assert.rejects(service.createAnnouncement(c,{body},{tenantId:'tenant-a'}));assert.equal(c.calls.length,0);}
});

test('module, role and transport failures have actionable messages',async()=>{
 for(const [code,expected] of [['BM001',/modülü kapalı/],['42501',/yetkiniz yok/],['22023',/1–500/],[undefined,/Liste|liste/]]) {
  await assert.rejects(raw.deleteAnnouncement(client(null,{code,message:'internal detail'}),'a'),expected);
 }
});
