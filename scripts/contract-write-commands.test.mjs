import test from 'node:test';
import assert from 'node:assert/strict';
import {importActualTypeScript} from './helpers/import-typescript.mjs';
const raw=await importActualTypeScript(new URL('../src/lib/supabase/contracts.ts',import.meta.url));
const imports=await importActualTypeScript(new URL('../src/lib/import/import-service.ts',import.meta.url));
const service=await importActualTypeScript(new URL('../src/lib/services/contracts.ts',import.meta.url));
const input={tenant_id:'tenant',company_id:'company',name:'Contract'};
const row={...input,id:'contract',revision:0};
function client(data=row,error=null){const calls=[];return {calls,auth:{getUser:async()=>({data:{user:{id:'actor'}}})},from(){throw Error('Direct DML forbidden');},rpc(name,args){calls.push({name,args});return {single:async()=>({data,error})};}};}
test('create uses gateway and cannot supply author, audit or renewal task flags',async()=>{
 const c=client();await raw.insertContract(c,{...input,created_by:'forged',renewal_task_created:true});
 assert.equal(c.calls[0].name,'contract_write_v1');assert.equal(c.calls[0].args.p_input.created_by,undefined);assert.equal(c.calls[0].args.p_input.renewal_task_created,undefined);
});
test('update passes original revision and verifies returned tenant/id/next revision',async()=>{
 const c=client({...row,revision:5});await raw.updateContract(c,'contract',{name:'New'},{tenant_id:'tenant',revision:4});
 assert.equal(c.calls[0].args.p_revision,4);
 for(const value of [null,{...row,revision:4},{...row,revision:5,tenant_id:'other'},{...row,revision:5,id:'other'}])await assert.rejects(raw.updateContract(client(value),'contract',{name:'New'},{tenant_id:'tenant',revision:4}));
});
test('missing create response and transport failure never become success or auto retry',async()=>{
 for(const data of [null,{...row,tenant_id:'other'},{...row,company_id:'other'}])await assert.rejects(raw.insertContract(client(data),input));
 const c=client(null,{code:'08006'});await assert.rejects(raw.insertContract(c,input),/sonucu doğrulanamadı/);assert.equal(c.calls.length,1);
});
test('closed module and conflict provide separate actionable messages',async()=>{
 for(const [code,pattern] of [['BM001',/modülü kapalı/],['40001',/siz düzenlerken değişti/],['PT409',/siz düzenlerken değişti/],['42501',/yetkiniz yok/]])await assert.rejects(raw.insertContract(client(null,{code}),input),pattern);
});
test('CSV import uses same gateway and counts only confirmed rows',async()=>{
 const rows=[{valid:true,rowIndex:2,errors:[],data:{company_name:'Company',name:'Contract'}}];
 const c=client();assert.equal((await imports.importContracts(c,rows,new Map([['Company','company']]),{tenantId:'tenant'})).imported,1);
 assert.equal(c.calls[0].name,'contract_write_v1');
 const failure=await imports.importContracts(client(null),rows,new Map([['Company','company']]),{tenantId:'tenant'});
 assert.equal(failure.imported,0);assert.equal(failure.errors.length,1);
});
test('service preserves the form revision instead of silently adopting a newer database revision',async()=>{
 const c=client(null,{code:'40001'});
 c.from=()=>{const q={select:()=>q,eq:()=>q,maybeSingle:async()=>({data:{...row,revision:9},error:null})};return q;};
 await assert.rejects(service.updateContractContent(c,row.id,{name:'Form edit'},2),/siz düzenlerken değişti/);
 assert.equal(c.calls[0].args.p_revision,2);
});
test('delete sends confirmed revision and never reports missing or mismatched rows as success',async()=>{
 const c=client();assert.equal((await raw.deleteContractScoped(c,row.id,row)).name,row.name);
 assert.deepEqual(c.calls[0],{name:'contract_delete_v1',args:{p_id:row.id,p_tenant:row.tenant_id,p_revision:0}});
 for(const data of [null,{...row,id:'other'},{...row,tenant_id:'other'},{...row,revision:1}])await assert.rejects(raw.deleteContractScoped(client(data),row.id,row),/silindiği doğrulanamadı/);
});
test('delete explains retained history and uncertain transport result separately',async()=>{
 await assert.rejects(raw.deleteContractScoped(client(null,{code:'23503'}),row.id,row),/işlem geçmişi/);
 const c=client(null,{code:'08006'});await assert.rejects(raw.deleteContractScoped(c,row.id,row),/sonucu doğrulanamadı/);assert.equal(c.calls.length,1);
});
