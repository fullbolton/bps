import test from 'node:test';
import assert from 'node:assert/strict';
import {importActualTypeScript} from './helpers/import-typescript.mjs';
import {id} from './fixtures/daily-operations.mjs';
const admin=await importActualTypeScript(new URL('../src/lib/services/platform-admin.ts',import.meta.url));
const tasks=await importActualTypeScript(new URL('../src/lib/supabase/tasks.ts',import.meta.url));
test('active work rejection has a useful admin message without raw database text',async()=>{
  await assert.rejects(()=>admin.assignRoleAndTenant({rpc:async()=>({error:{code:'BP001',message:'private details'}})},{userId:id(11),role:'muhasebe',tenantId:id(1)}),e=>e instanceof admin.PlatformAdminError&&e.message.includes('görevleri devrettikten')&&!e.message.includes('private'));
});
function client(error){const q={insert:()=>q,update:()=>q,eq:()=>q,select:()=>q,single:async()=>({data:null,error}),maybeSingle:async()=>({data:null,error})};return {from:()=>q};}
test('task guard membership and role failures remain distinct in create and update',async()=>{
  for(const [code,expected] of [['BP002',/üyesi değil/],['BP003',/görev erişimi yok/]]){
    await assert.rejects(()=>tasks.insertTask(client({code,message:'raw SQL'}),{}),expected);
    await assert.rejects(()=>tasks.updateTask(client({code,message:'raw SQL'}),id(20),{},0),expected);
  }
});
test('transport failures are not translated into lost membership or role',async()=>{
  await assert.rejects(()=>tasks.insertTask(client({message:'Network request failed'}),{}),e=>!e.message.includes('üyesi değil')&&!e.message.includes('görev erişimi yok'));
});
