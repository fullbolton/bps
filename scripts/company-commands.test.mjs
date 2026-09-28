import test from 'node:test';
import assert from 'node:assert/strict';
import {importActualTypeScript} from './helpers/import-typescript.mjs';
import {compile} from './helpers/component-driver.mjs';
const commands=await importActualTypeScript(new URL('../src/lib/supabase/company-commands.ts',import.meta.url));
const raw=await importActualTypeScript(new URL('../src/lib/supabase/companies.ts',import.meta.url));
const importer=await importActualTypeScript(new URL('../src/lib/import/import-service.ts',import.meta.url));
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const base={id:id(101),tenant_id:id(1),name:'Synthetic',status:'aday',risk:'dusuk',created_by:id(11)};
const input={tenant_id:id(1),created_by:id(11),name:'Synthetic'};
function client({error=null,data=[base],identityError=null}={}){
 const calls=[];
 return {calls,auth:{getUser:async()=>({data:{user:{id:id(11)}},error:identityError})},from(){throw Error('Direct write must not run');},rpc:async(name,args)=>{
  calls.push({name,args});if(name==='current_user_verified_tenant')return {data:id(1),error:null};
  assert.equal(name,'company_execute_v1');return {data,error};
 }};
}
test('existing insert helper uses one scoped RPC with explicit actor, tenant and allowed business fields',async()=>{
 const c=client();assert.equal((await raw.insertCompany(c,input)).id,base.id);assert.equal(c.calls.length,1);
 assert.deepEqual(c.calls[0].args,{p_action:'create',p_company_id:null,p_tenant_id:id(1),p_actor_id:id(11),p_input:{name:'Synthetic',city:null,sector:null,status:'aday',risk:'dusuk'}});
});
test('missing identity and protected input fields stop before a write',async()=>{
 for(const payload of [{...input,created_by:null},{...input,id:id(102)},{...input,tenant_id:'bad'},{...input,legacy_mock_id:'f1'}]){const c=client();await assert.rejects(raw.insertCompany(c,payload));assert.equal(c.calls.length,0);}
});
test('transport uncertainty, empty and wrong-scope responses never become success or automatic retries',async()=>{
 for(const data of [null,[],[base,base],[{...base,tenant_id:id(2)}],[{...base,created_by:id(12)}],[{...base,id:'bad'}]]){
  const c=client({data});await assert.rejects(raw.insertCompany(c,input),/Tekrar denemeden önce/);assert.equal(c.calls.length,1);
 }
 const c=client({error:{message:'network'}});await assert.rejects(raw.insertCompany(c,input),/sonucu doğrulanamadı/);assert.equal(c.calls.length,1);
});
test('module and input rejections use actionable messages',async()=>{
 await assert.rejects(raw.insertCompany(client({error:{code:'BM001'}}),input),/modül.*kapalı/);
 await assert.rejects(raw.insertCompany(client({error:{code:'BC400'}}),input),/bilgileri geçersiz/);
});
test('company import retains confirmed rows then stops on uncertain or disabled writes',async()=>{
 for(const error of [{message:'network'},{code:'BM001'}]){
  const c=client();let calls=0;c.rpc=async(name,args)=>{assert.equal(name,'company_execute_v1');calls++;return calls===1?{data:[{...base,name:args.p_input.name,status:'aktif'}],error:null}:{data:null,error};};
  const rows=[1,2,3].map(n=>({rowIndex:n,data:{name:'Company '+n},valid:true,errors:[]}));
  const result=await importer.importCompanies(c,rows,{tenantId:id(1)});assert.equal(result.imported,1);assert.equal(calls,2);assert.ok(result.errors.some(e=>e.includes('Kalan satırlar işlenmedi')));
 }
});
test('status helper verifies returned target and requested status',async()=>{
 assert.equal((await commands.setCompanyStatus(client({data:[{...base,status:'pasif'}]}),id(101),id(1),id(11),'pasif')).status,'pasif');
 for(const row of [{...base,status:'aktif'},{...base,id:id(102),status:'pasif'}])await assert.rejects(commands.setCompanyStatus(client({data:[row]}),id(101),id(1),id(11),'pasif'),/sonucu doğrulanamadı/);
});
function action(name,c){return compile('src/app/(main)/firmalar/[id]/actions.ts',{}, {
 '@/lib/supabase/company-commands':commands,'@/lib/document-validity':{},'@/lib/services/company-document-recovery':{},
 '@/lib/supabase/server':{createServerSupabaseClient:async()=>c},'@/lib/services/companies':{},'@/lib/services/contacts':{},'@/lib/services/notes':{},
},name);}
test('both status server actions use verified tenant and shared command with no direct writes',async()=>{
 for(const [name,status] of [['passivateCompanyAction','pasif'],['reactivateCompanyAction','aktif']]){
  const c=client({data:[{...base,status}]});const result=await action(name,c)(id(101));assert.equal(result.ok,true);
  assert.deepEqual(c.calls.map(c=>c.name),['current_user_verified_tenant','company_execute_v1']);assert.deepEqual(c.calls[1].args.p_input,{status});
 }
});
test('status actions reject invalid identity and missing targets instead of reporting success',async()=>{
 const auth=client({identityError:{message:'offline'}});assert.equal((await action('passivateCompanyAction',auth)(id(101))).ok,false);assert.equal(auth.calls.length,0);
 const missing=client({error:{code:'42501'}});assert.equal((await action('passivateCompanyAction',missing)(id(101))).ok,false);
});
