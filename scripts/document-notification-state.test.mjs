import test from 'node:test';
import assert from 'node:assert/strict';
import {importActualTypeScript} from './helpers/import-typescript.mjs';
const {enabledNotificationDocuments:read}=await importActualTypeScript(new URL('../src/lib/email/document-module-access.ts',import.meta.url));
const items=[{entityId:'d1',tenantId:'A'},{entityId:'d2',tenantId:'A'}];
test('document eligibility requires exact ids, tenants and boolean values',async()=>{
 const good=[{id:'d1',tenant_id:'A',enabled:true},{id:'d2',tenant_id:'A',enabled:false}];
 const c=data=>({rpc:async(name,args)=>{assert.equal(name,'document_notification_state_v1');assert.deepEqual(args,{p_ids:['d1','d2'],p_tenant_ids:['A','A']});return {data,error:null};}});
 assert.deepEqual([...await read(c(good),items)],['d1']);
 for(const data of [null,[],[good[0],good[0]],[{...good[0],tenant_id:'B'},good[1]],[{...good[0],enabled:'true'},good[1]],[{...good[0],id:'other'},good[1]]])await assert.rejects(read(c(data),items));
});
test('document checks deduplicate and chunk without accepting contradictory scope',async()=>{
 const rows=Array.from({length:501},(_,i)=>({entityId:'d'+i,tenantId:'A'})),sizes=[];
 const c={rpc:async(_,args)=>{sizes.push(args.p_ids.length);return {data:args.p_ids.map(id=>({id,tenant_id:'A',enabled:true})),error:null};}};
 assert.equal((await read(c,[...rows,rows[0]])).size,501);assert.deepEqual(sizes,[500,1]);
 await assert.rejects(read({rpc(){throw Error('Must not query');}},[{entityId:'d',tenantId:'A'},{entityId:'d',tenantId:'B'}]),/SCOPE/);
});
test('document state database and transport failures do not fall back to enabled',async()=>{
 for(const c of [{rpc:async()=>({data:[],error:{code:'55000'}})},{rpc:async()=>{throw Error('offline');}}])await assert.rejects(read(c,items));
 assert.equal((await read({rpc(){throw Error('empty must not query');}},[])).size,0);
});
