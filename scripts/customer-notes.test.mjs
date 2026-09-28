import test from 'node:test';
import assert from 'node:assert/strict';
import {importActualTypeScript} from './helpers/import-typescript.mjs';
import {compile} from './helpers/component-driver.mjs';
const raw=await importActualTypeScript(new URL('../src/lib/supabase/notes.ts',import.meta.url));
const tags=await importActualTypeScript(new URL('../src/lib/note-tags.ts',import.meta.url));
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const scope={companyId:id(101),tenantId:id(1),actorId:id(11)};
const row={id:id(201),company_id:scope.companyId,tenant_id:scope.tenantId,author_id:scope.actorId,author_name:'Synthetic manager',content:'Synthetic note',is_pinned:false,tag:null};
function client({data=[row],error=null,identityError=null}={}){
 const calls=[];return {calls,auth:{getUser:async()=>({data:{user:{id:scope.actorId}},error:identityError})},from(){throw Error('No raw writes or profiles read expected');},rpc:async(name,args)=>{calls.push({name,args});assert.equal(name,'note_execute_v1');return {data,error};}};
}
function service(name,c,company={id:scope.companyId,tenant_id:scope.tenantId}){
 return compile('src/lib/services/notes.ts',{}, {
 '@/lib/supabase/notes':raw,'@/lib/note-tags':tags,'@/lib/services/companies':{requireCompanyByLegacyMockId:async()=>company},
 },name);
}
test('note create sends the resolved company/tenant/actor but no client author or pin fields',async()=>{
 const c=client();await service('createNote',c)(c,'legacy',{content:'  Synthetic note  ',tag:'genel',author_name:'forged',is_pinned:true},{tenantId:scope.tenantId});
 assert.deepEqual(JSON.parse(JSON.stringify(c.calls[0].args)),{p_action:'create',p_note_id:null,p_company_id:scope.companyId,p_tenant_id:scope.tenantId,p_actor_id:scope.actorId,p_input:{content:'Synthetic note',tag:'genel'}});
});
test('note edits, pin and delete all preserve the expected company in the actual request',async()=>{
 for(const [name,action,input] of [['updateNoteContent','edit',{content:'Synthetic note'}],['pinNote','pin'],['unpinNote','pin'],['deleteNoteById','delete']]){
  const c=client({data:[{...row,is_pinned:name==='pinNote'}]});await service(name,c)(c,'legacy',row.id,input);assert.equal(c.calls[0].args.p_company_id,scope.companyId);assert.equal(c.calls[0].args.p_action,action);assert.equal(c.calls[0].args.p_note_id,row.id);
 }
});
test('changed tenant, invalid identity or blank content stops before command submission',async()=>{
 const c=client();await assert.rejects(service('createNote',c)(c,'legacy',{content:'x'},{tenantId:id(2)}),/Çalışma alanı değişti/);assert.equal(c.calls.length,0);
 const bad=client({identityError:{message:'offline'}});await assert.rejects(service('pinNote',bad)(bad,'legacy',row.id),/Oturum/);assert.equal(bad.calls.length,0);
 await assert.rejects(service('createNote',c)(c,'legacy',{content:'\u00a0'},{tenantId:scope.tenantId}),/boş/);assert.equal(c.calls.length,0);
});
test('unknown result, malformed rows and wrong company cannot acknowledge a note command',async()=>{
 for(const data of [null,[],[row,row],[{...row,id:'bad'}],[{...row,company_id:id(103)}],[{...row,tenant_id:id(2)}],[{...row,author_id:id(12)}],[{...row,is_pinned:true}]]){
  const c=client({data});await assert.rejects(raw.executeNote(c,scope,'create',null,{content:'x'}),/sonucu doğrulanamadı/);assert.equal(c.calls.length,1);
 }
});
test('module errors and transport failures are distinct, and neither retries the command',async()=>{
 const closed=client({error:{code:'BM001'}});await assert.rejects(raw.executeNote(closed,scope,'delete',row.id,{}),/modül.*kapalı/);assert.equal(closed.calls.length,1);
 const net=client({error:{message:'offline'}});await assert.rejects(raw.executeNote(net,scope,'create',null,{content:'x'}),/notları yenileyin/);assert.equal(net.calls.length,1);
});
test('pin acknowledgment must match the requested flag and target',async()=>{
 for(const data of [[row],[{...row,id:id(202),is_pinned:true}]])await assert.rejects(raw.executeNote(client({data}),scope,'pin',row.id,{is_pinned:true}),/sonucu doğrulanamadı/);
});

test('missing author and ownership rejection explain the actual corrective action',async()=>{
 for(const [message,expected] of [['NOTE_AUTHOR_MISSING',/profilinizde adınızı/],['NOTE_OWNERSHIP',/yalnızca yazarı/]])await assert.rejects(raw.executeNote(client({error:{code:'42501',message}}),scope,'create',null,{content:'x'}),expected);
});
