import test from 'node:test';
import assert from 'node:assert/strict';
import {importActualTypeScript} from './helpers/import-typescript.mjs';
const {fetchProfilesByIds}=await importActualTypeScript(new URL('../src/lib/email/notification-recipients.ts',import.meta.url));
const profile=id=>({id,email:id+'@example.invalid',display_name:'Sentetik',role:'operasyon'});
const client=respond=>({from(table){assert.equal(table,'profiles');return {select(fields,opts){assert.equal(fields,'id, email, display_name, role');assert.equal(opts.count,'exact');return {in(key,ids){assert.equal(key,'id');assert.ok(ids.length<=100);return respond(ids);}};}};}});
test('profile IDs are deduplicated and chunked without losing the last owner',async()=>{
 const ids=Array.from({length:251},(_,i)=>'p'+i),sizes=[];
 const result=await fetchProfilesByIds(client(chunk=>{sizes.push(chunk.length);return {data:chunk.map(profile),count:chunk.length,error:null};}),[...ids,ids[0]]);
 assert.equal(result.error,undefined);assert.equal(result.byId.size,251);assert.equal(result.byId.has('p250'),true);assert.deepEqual(sizes,[100,100,51]);
});
test('late error, count mismatch and unexpected or repeated profiles discard previous chunks',async()=>{
 const ids=Array.from({length:101},(_,i)=>'p'+i);
 for(const response of [{data:[],count:1,error:null},{data:null,count:0,error:null},{data:[],count:0,error:{code:'42501'}},{data:[profile('foreign')],count:1,error:null},{data:[profile('p100'),profile('p100')],count:2,error:null}]){
  const result=await fetchProfilesByIds(client(chunk=>chunk.length===100?{data:chunk.map(profile),count:100,error:null}:response),ids);
  assert.ok(result.error);assert.equal(result.byId.size,0);
 }
});
test('missing profiles and contactless profiles are measured omissions, empty input does not query',async()=>{
 assert.equal((await fetchProfilesByIds(client(()=>{throw Error('must not read');}),[])).error,undefined);
 const result=await fetchProfilesByIds(client(()=>({data:[{...profile('p1'),email:null}],count:1,error:null})),['p1','missing']);
 assert.equal(result.error,undefined);assert.equal(result.byId.size,0);
});
test('company recipients still exclude a former partner after shared profile lookup',async()=>{
 const {resolveCompanyRecipients}=await importActualTypeScript(new URL('../src/lib/email/notification-recipients.ts',import.meta.url));
 const fake={from(table){return {select(){return {in(key){
  if(table==='partner_company_assignments')return {order(){return this;},range:async()=>({data:[{company_id:'c1',partner_user_id:'former'},{company_id:'c1',partner_user_id:'current'}],count:2,error:null})};
  if(key==='role')return {order(){return {range:async()=>({data:[],count:0,error:null})};}};
  return {data:[profile('former'),{...profile('current'),role:'partner'}],count:2,error:null};
 }};}};}};
 const result=await resolveCompanyRecipients(fake,['c1'],{includePartners:true});
 assert.deepEqual(result.errors,[]);assert.deepEqual(result.byCompany.get('c1').map(p=>p.id),['current']);
});

test('role profile pagination includes the last eligible recipient and excludes missing contact',async()=>{
 const {fetchProfilesByRoles}=await importActualTypeScript(new URL('../src/lib/email/notification-recipients.ts',import.meta.url));
 const data=Array.from({length:601},(_,i)=>({...profile('p'+i),email:i===0?null:'synthetic@example.invalid'}));
 const ranges=[];
 const fake={from:()=>({select:(_,opts)=>{assert.equal(opts.count,'exact');return {in:(key,roles)=>{assert.equal(key,'role');assert.deepEqual(roles,['operasyon']);return {order:key=>{assert.equal(key,'id');return {range:async(from,to)=>{ranges.push([from,to]);return {data:data.slice(from,from+300),count:601,error:null};}};}};}};}})};
 const result=await fetchProfilesByRoles(fake,['operasyon','operasyon']);
 assert.equal(result.error,undefined);assert.equal(result.rows.length,600);assert.equal(result.rows.at(-1).id,'p600');assert.deepEqual(ranges,[[0,499],[300,799],[600,1099]]);
});
test('role profile errors and unexpected roles never expose a partial recipient list',async()=>{
 const {fetchProfilesByRoles}=await importActualTypeScript(new URL('../src/lib/email/notification-recipients.ts',import.meta.url));
 for(const tail of [{data:[],count:2,error:null},{data:[profile('p2')],count:3,error:null},{data:[{...profile('p2'),role:'partner'}],count:2,error:null},{data:null,count:2,error:{code:'42501'}}]){
  const fake={from:()=>({select:()=>({in:()=>({order:()=>({range:async(from)=>from?tail:{data:[profile('p1')],count:2,error:null}})})})})};
  const result=await fetchProfilesByRoles(fake,['operasyon']);assert.ok(result.error);assert.deepEqual(result.rows,[]);
 }
 assert.deepEqual(await fetchProfilesByRoles({from(){throw Error('must not query');}},[]),{rows:[]});
});
