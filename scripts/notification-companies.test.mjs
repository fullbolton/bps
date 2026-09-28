import test from 'node:test';
import assert from 'node:assert/strict';
import {importActualTypeScript} from './helpers/import-typescript.mjs';
const {readNotificationCompanyNames}=await importActualTypeScript(new URL('../src/lib/email/company-names.ts',import.meta.url));
const client=respond=>({from(table){assert.equal(table,'companies');return {select(fields,opts){assert.equal(fields,'id, name');assert.equal(opts.count,'exact');return {in(key,ids){assert.equal(key,'id');assert.ok(ids.length<=100);return respond(ids);}};}};}});
test('notification names resolve all referenced companies in bounded deduplicated chunks',async()=>{
 const ids=Array.from({length:201},(_,i)=>'c'+i),sizes=[];
 const result=await readNotificationCompanyNames(client(chunk=>{sizes.push(chunk.length);return {data:chunk.map(id=>({id,name:id==='c200'?'—':'Sentetik'})),count:chunk.length,error:null};}),[...ids,ids[0]]);
 assert.deepEqual(sizes,[100,100,1]);assert.equal(result.size,201);assert.equal(result.get('c200'),'—');
 assert.equal((await readNotificationCompanyNames(client(()=>{throw Error('must not query');}),[])).size,0);
});
test('missing, truncated, duplicated or malformed company names fail instead of generating fallback mail',async()=>{
 for(const response of [{data:[],count:0,error:null},{data:[],count:1,error:null},{data:null,count:0,error:null},{data:[{id:'wrong',name:'Name'}],count:1,error:null},{data:[{id:'c',name:' '}],count:1,error:null},{data:null,count:null,error:{code:'42501'}}])await assert.rejects(readNotificationCompanyNames(client(()=>response),['c']));
 await assert.rejects(readNotificationCompanyNames(client(()=>({data:[{id:'c',name:'A'},{id:'c',name:'B'}],count:2,error:null})),['c','d']));
});
