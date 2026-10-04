import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {importActualTypeScript} from './helpers/import-typescript.mjs';
const url=new URL('../src/lib/email/contract-expiry-email.ts',import.meta.url);
const code=ts.transpileModule(readFileSync(url,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
const modules=new Map();
for(const [,spec]of code.matchAll(/require\("([^"]+)"\)/g))if(!spec.endsWith('resend-transport'))modules.set(spec,await importActualTypeScript(spec.startsWith('@/')?new URL('../src/'+spec.slice(2)+'.ts',import.meta.url):new URL(spec+'.ts',url)));
function runner(sent,multi=false){const exports={};vm.runInNewContext(code,{exports,Date,Map,Set,process:{env:{NEXT_PUBLIC_BPS_MULTI_WORKSPACE_ENABLED:String(multi),BPS_EMAIL_FROM:'synthetic@example.invalid',BPS_APP_URL:'https://example.invalid'}},require:spec=>spec.endsWith('resend-transport')?{sendEmail:async input=>{sent.push(input);return {ok:true,id:'synthetic'};}}:modules.get(spec)});return exports.runContractExpiryRecallBatch;}
function fixture({failTable=null,missingCompany=false,small=false,sharedEmail=false}={}){
 const contract=(id,tenant_id,company_id,name)=>({id,tenant_id,company_id,name,status:'aktif',end_date:'2026-10-15',responsible:null});
 const contracts=small?[contract('a0','A','ca','A-CONTRACT')]:Array.from({length:601},(_,i)=>contract('a'+String(i).padStart(4,'0'),'A','ca','A-CONTRACT-'+i));
 if(!small)contracts.push(contract('z-contract','B','cb','B-PRIVATE-CONTRACT'));
 const profiles=[{id:'alice',email:'alice@example.invalid',role:'yonetici'},{id:'bob',email:'bob@example.invalid',role:'yonetici'},{id:'partner',email:'partner@example.invalid',role:'partner'}];
 if(sharedEmail){profiles[1].email=profiles[0].email;profiles.push({id:'alice-twin',email:profiles[0].email,role:'yonetici'});}
 const tenant_memberships=Array.from({length:601},(_,i)=>({tenant_id:'A',user_id:'dummy'+i}));
 tenant_memberships.push({tenant_id:'A',user_id:'alice'},{tenant_id:'B',user_id:'bob'},{tenant_id:'B',user_id:'partner'});
 if(sharedEmail)tenant_memberships.push({tenant_id:'A',user_id:'alice-twin'});
 const tables={contracts,profiles,tenant_memberships,companies:missingCompany?[]:[{id:'ca',name:'A-COMPANY'},{id:'cb',name:'B-COMPANY'}],partner_company_assignments:[{company_id:'cb',partner_user_id:'partner'}]};
 const stamps=[],ranges=[];
 const client={from(table){let filters=[],orders=[],payload;
  const read=(from=0,paged=false)=>{const data=tables[table].filter(r=>filters.every(f=>f(r))).sort((a,b)=>{for(const k of orders){const c=a[k].localeCompare(b[k]);if(c)return c;}return 0;});if(table===failTable&&from>0)return {data:null,count:null,error:{code:'42501'}};return {data:paged?data.slice(from,from+200):data,count:data.length,error:null};};
  const q={select(_fields,opts){if(table!=='notification_log')assert.equal(opts.count,'exact');return q;},eq(k,v){filters.push(r=>r[k]===v);return q;},in(k,v){assert.ok(v.length<=100);filters.push(r=>v.includes(r[k]));return q;},not(k,_op,v){filters.push(r=>r[k]!==v);return q;},order(k){orders.push(k);return q;},range:async(from,to)=>{assert.equal(to-from,499);ranges.push([table,from]);return read(from,true);},then(resolve,reject){return Promise.resolve(read()).then(resolve,reject);},insert(v){payload=v;return q;},maybeSingle:async()=>{stamps.push(payload);return {data:{kind:payload.kind},error:null};}};
  return q;
 }};
 return {client,stamps,ranges,tables};
}
test('contract batch reads past limits and sends each contract only to its tenant and assigned partner',async()=>{
 const sent=[],f=fixture();const result=await runner(sent)(f.client,new Date('2026-09-14T21:00:00Z'));
 assert.equal(result.errors.length,0);assert.equal(result.contractsEvaluated,602);assert.equal(sent.length,603);assert.equal(f.stamps.length,603);
 const alice=sent.filter(m=>m.to==='alice@example.invalid'),bob=sent.filter(m=>m.to==='bob@example.invalid'),partner=sent.filter(m=>m.to==='partner@example.invalid');
 assert.equal(alice.length,601);assert.ok(alice.some(m=>m.text.includes('A-CONTRACT-600')));assert.ok(alice.every(m=>!m.text.includes('B-PRIVATE-CONTRACT')));
 assert.equal(bob.length,1);assert.equal(partner.length,1);assert.match(bob[0].text,/B-PRIVATE-CONTRACT/);assert.match(partner[0].text,/B-PRIVATE-CONTRACT/);
 assert.ok(f.ranges.some(([t,o])=>t==='contracts'&&o===600));assert.ok(f.ranges.some(([t,o])=>t==='tenant_memberships'&&o===600));
});
test('contract batch stops before stamps on a late read failure or missing company name',async()=>{
 for(const options of [{failTable:'contracts'},{failTable:'tenant_memberships'},{missingCompany:true}]){
  const sent=[],f=fixture(options);const result=await runner(sent)(f.client,new Date('2026-09-15T09:00:00Z'));
  assert.ok(result.errors.length);assert.equal(sent.length,0);assert.equal(f.stamps.length,0);
 }
});
test('contract 30-day window opens at Istanbul midnight',async()=>{
 for(const [now,expected]of [['2026-09-14T20:59:59Z',0],['2026-09-14T21:00:00Z',1]]){
  const sent=[],f=fixture({small:true});const result=await runner(sent)(f.client,new Date(now));assert.equal(result.errors.length,0);assert.equal(result.contractsEvaluated,expected);assert.equal(sent.length,expected);
 }
});

test('a shared email in another tenant does not hide an eligible profile; same-tenant duplicates still get one copy',async()=>{
 const sent=[],f=fixture({sharedEmail:true});const result=await runner(sent)(f.client,new Date('2026-09-15T09:00:00Z'));
 assert.equal(result.errors.length,0);
 const shared=sent.filter(m=>m.to==='alice@example.invalid');
 assert.equal(shared.filter(m=>m.text.includes('B-PRIVATE-CONTRACT')).length,1);
 assert.equal(shared.filter(m=>m.text.includes('A-CONTRACT-')).length,601);
 assert.equal(f.stamps.filter(s=>s.entity_id==='z-contract'&&s.recipient_profile_id==='bob').length,1);
 assert.equal(f.stamps.some(s=>s.entity_id==='z-contract'&&s.recipient_profile_id==='alice'),false);
});

test('multi-workspace contracts use tenant roles for managers and assigned partners',async()=>{
 const sent=[],f=fixture();
 f.tables.tenant_memberships=[{tenant_id:'A',user_id:'alice',role:'yonetici',version:'1'},{tenant_id:'B',user_id:'alice',role:'goruntuleyici',version:'2'},{tenant_id:'B',user_id:'bob',role:'yonetici',version:'3'},{tenant_id:'B',user_id:'partner',role:'goruntuleyici',version:'4'}];
 f.tables.profiles[0].role='goruntuleyici';
 const result=await runner(sent,true)(f.client,new Date('2026-09-14T21:00:00Z'));
 assert.equal(result.errors.length,0);assert.equal(sent.length,602);
 assert.equal(sent.filter(m=>m.to==='partner@example.invalid').length,0);
 assert.ok(sent.filter(m=>m.to==='alice@example.invalid').every(m=>!m.text.includes('B-PRIVATE-CONTRACT')));
 assert.equal(sent.filter(m=>m.to==='bob@example.invalid').length,1);
});

test('contract batch reserves the actual expiry date and renewal changes its key',async()=>{
 const sent=[],f=fixture({small:true});await runner(sent)(f.client,new Date('2026-09-20T09:00:00Z'));assert.equal(f.stamps[0].threshold_key,'30d:2026-10-15');
 f.tables.contracts[0].end_date='2027-10-15';await runner(sent)(f.client,new Date('2027-09-20T09:00:00Z'));assert.equal(f.stamps.at(-1).threshold_key,'30d:2027-10-15');
});
