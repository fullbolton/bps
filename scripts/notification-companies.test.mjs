import test from 'node:test';
import assert from 'node:assert/strict';
import {importActualTypeScript} from './helpers/import-typescript.mjs';
const {readNotificationCompanyNames}=await importActualTypeScript(new URL('../src/lib/email/company-names.ts',import.meta.url));
const client=respond=>({rpc(name,args){assert.equal(name,'notification_company_names_v1');assert.equal(args.p_module,'calendar');assert.ok(args.p_company_ids.length<=100);return respond(args.p_company_ids);}});
const refs=ids=>ids.map(companyId=>({companyId,tenantId:'A'}));
test('notification names resolve all referenced companies in bounded deduplicated chunks',async()=>{
 const ids=Array.from({length:201},(_,i)=>'c'+i),sizes=[];
 const result=await readNotificationCompanyNames(client(chunk=>{sizes.push(chunk.length);return {data:chunk.map(id=>({id,tenant_id:'A',name:id==='c200'?'—':'Sentetik'})),count:chunk.length,error:null};}),refs([...ids,ids[0]]),"calendar");
 assert.deepEqual(sizes,[100,100,1]);assert.equal(result.size,201);assert.equal(result.get('c200'),'—');
 assert.equal((await readNotificationCompanyNames(client(()=>{throw Error('must not query');}),[],"calendar")).size,0);
});
test('missing, truncated, duplicated or malformed company names fail instead of generating fallback mail',async()=>{
 for(const response of [{data:[],count:0,error:null},{data:[],count:1,error:null},{data:null,count:0,error:null},{data:[{id:'wrong',tenant_id:'A',name:'Name'}],count:1,error:null},{data:[{id:'c',tenant_id:'A',name:' '}],count:1,error:null},{data:null,count:null,error:{code:'42501'}}])await assert.rejects(readNotificationCompanyNames(client(()=>response),refs(['c']),"calendar"));
 await assert.rejects(readNotificationCompanyNames(client(()=>({data:[{id:'c',tenant_id:'A',name:'A'},{id:'c',tenant_id:'A',name:'B'}],count:2,error:null})),refs(['c','d']),"calendar"));
});

test('a company cannot be associated with two tenants or acknowledge a different tenant',async()=>{
 await assert.rejects(readNotificationCompanyNames(client(()=>{throw Error('no RPC expected');}),[{companyId:'c',tenantId:'A'},{companyId:'c',tenantId:'B'}],'calendar'),/SCOPE/);
 await assert.rejects(readNotificationCompanyNames(client(()=>({data:[{id:'c',tenant_id:'B',name:'Secret'}],error:null})),refs(['c']),'calendar'),/INVALID/);
});
