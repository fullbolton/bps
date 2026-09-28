import test from 'node:test';
import assert from 'node:assert/strict';
import {importActualTypeScript} from './helpers/import-typescript.mjs';
import {compile} from './helpers/component-driver.mjs';
const raw=await importActualTypeScript(new URL('../src/lib/supabase/contacts.ts',import.meta.url));
const importer=await importActualTypeScript(new URL('../src/lib/import/import-service.ts',import.meta.url));
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const scope={companyId:id(101),tenantId:id(1),actorId:id(11)};
const row={id:id(201),company_id:scope.companyId,created_by:scope.actorId,full_name:'Synthetic contact',is_primary:false,phone:'5550000000',email:null};
function client({data=[row],error=null,identityError=null}={}){
 const calls=[];return {calls,auth:{getUser:async()=>({data:{user:{id:scope.actorId}},error:identityError})},from(){throw Error('No raw write or stale merge read expected');},rpc:async(name,args)=>{calls.push({name,args});assert.equal(name,'contact_execute_v1');return {data,error};}};
}
function service(name){return compile('src/lib/services/contacts.ts',{}, {'@/lib/supabase/contacts':raw,'@/lib/services/companies':{requireCompanyByLegacyMockId:async()=>({id:scope.companyId,tenant_id:scope.tenantId})}},name);}
test('communication submits only supplied fields with resolved actor, tenant and company',async()=>{
 const c=client();await service('updateContactPhoneEmail')(c,'legacy',row.id,{phone:' 5550000000 ',fullName:'forged'});
 assert.deepEqual(JSON.parse(JSON.stringify(c.calls[0].args)),{p_action:'communication',p_contact_id:row.id,p_company_id:scope.companyId,p_tenant_id:scope.tenantId,p_actor_id:scope.actorId,p_input:{phone:'5550000000'}});
});
test('empty changes and failed identity stop before RPC',async()=>{
 const c=client();await assert.rejects(service('updateContactPhoneEmail')(c,'legacy',row.id,{}),/Güncellenecek/);assert.equal(c.calls.length,0);
 const bad=client({identityError:{message:'offline'}});await assert.rejects(service('removeContact')(bad,'legacy',row.id),/Oturum/);assert.equal(bad.calls.length,0);
});
test('delete binds target to expected company and returns the confirmed removed row',async()=>{
 const c=client();assert.equal((await service('removeContact')(c,'legacy',row.id)).full_name,row.full_name);assert.equal(c.calls[0].args.p_company_id,scope.companyId);assert.equal(c.calls[0].args.p_action,'delete');
});
test('malformed, empty and foreign responses never acknowledge contact writes',async()=>{
 for(const data of [null,[],[row,row],[{...row,id:'bad'}],[{...row,company_id:id(102)}],[{...row,id:id(202)}]]){
 const c=client({data});await assert.rejects(raw.executeContact(c,scope,'delete',row.id,{}),/sonucu doğrulanamadı/);assert.equal(c.calls.length,1);}
});
test('import verifies creator and primary flag; errors do not trigger retries',async()=>{
 for(const data of [[{...row,created_by:id(12)}],[{...row,is_primary:true}]])await assert.rejects(raw.executeContact(client({data}),scope,'import',null,{is_primary:false}),/sonucu doğrulanamadı/);
 for(const [error,re] of [[{code:'BM001'},/modül.*kapalı/],[{code:'BC409',message:'CONTACT_PRIMARY_EXISTS'},/ana yetkilisi zaten var/],[{message:'offline'},/listesini yenileyin/]]){const c=client({error});await assert.rejects(raw.executeContact(c,scope,'import',null,{is_primary:false}),re);assert.equal(c.calls.length,1);}
});
test('CSV keeps confirmed rows and stops at first uncertain write',async()=>{
 const c=client();let calls=0;c.rpc=async(name,args)=>{calls++;assert.equal(name,'contact_execute_v1');assert.equal(args.p_tenant_id,scope.tenantId);return calls===1?{data:[row],error:null}:{data:null,error:{message:'offline'}};};
 const rows=[1,2,3].map(n=>({rowIndex:n,valid:true,errors:[],data:{company_name:'Synthetic',full_name:'Person '+n,is_primary:'false',phone:'5550000000'}}));
 const result=await importer.importContacts(c,rows,new Map([['Synthetic',scope.companyId]]),{tenantId:scope.tenantId});assert.equal(result.imported,1);assert.equal(calls,2);assert.ok(result.errors.some(e=>e.includes('Kalan satırlar işlenmedi')));
});
test('company map reads all pages and rejects ambiguous names across page boundaries',async()=>{
 const rows=Array.from({length:501},(_,n)=>({id:id(n+1000),name:n===0||n===500?'Duplicate':'Company '+n}));let pages=0;
 const c={from(name){assert.equal(name,'companies');const q={select(){return q;},order(){return q;},range(from,to){q.from=from;q.to=to;return q;},abortSignal(){pages++;return Promise.resolve({data:rows.slice(q.from,q.to+1),count:501,error:null});}};return q;}};
 const map=await importer.buildCompanyNameMap(c);assert.equal(pages,2);assert.equal(map.has('Duplicate'),false);assert.equal(map.size,499);
});
test('delete server action passes the page company and does not acknowledge service errors',async()=>{
 let calls=[];let fail=false;
 const action=compile('src/app/(main)/firmalar/[id]/actions.ts',{}, {'@/lib/supabase/company-commands':{},'@/lib/document-validity':{},'@/lib/services/company-document-recovery':{},'@/lib/services/companies':{},'@/lib/services/notes':{},'@/lib/supabase/server':{createServerSupabaseClient:async()=>({})},'@/lib/services/contacts':{removeContact:async(c,company,target)=>{calls.push([company,target]);if(fail)throw Error('denied');return row;}}},'deleteContactAction');
 assert.equal((await action('legacy',row.id)).deletedName,row.full_name);assert.deepEqual(calls,[['legacy',row.id]]);fail=true;assert.equal((await action('legacy',row.id)).ok,false);
});
