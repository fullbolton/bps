import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {importActualTypeScript} from './helpers/import-typescript.mjs';
const {recoverCompanyDocumentInsert:recover}=await importActualTypeScript(new URL('../src/lib/services/company-document-recovery.ts',import.meta.url));
const {removeDeletedDocumentFile:cleanup}=await importActualTypeScript(new URL('../src/lib/services/company-document-cleanup.ts',import.meta.url));
const attempt={id:'document',companyId:'company',tenantId:'tenant',userId:'actor',storagePath:'company/document.pdf'};
const row={id:attempt.id,company_id:attempt.companyId,tenant_id:attempt.tenantId,created_by:attempt.userId,storage_path:attempt.storagePath};
function client({existing=null,readError=null,refs=[],remove={data:[{name:attempt.storagePath}],error:null},throws=false}={}) {
 const calls=[];
 return {calls,rpc:async(name,args)=>{assert.equal(name,'document_ack_cleanup_v1');assert.equal(args.p_document_id,attempt.id);return {data:true,error:null};},from(table){assert.equal(table,'documents');const q={select:()=>q,eq:()=>q,maybeSingle:async()=>({data:existing,error:readError}),limit:async()=>({data:refs,error:null})};return q;},storage:{from(bucket){assert.equal(bucket,'documents');return {remove:async paths=>{calls.push(paths);if(throws)throw Error('network');return remove;}};}}};
}
test('lost insert response recovers the exact committed document without deleting its file',async()=>{
 const c=client({existing:row});assert.deepEqual(await recover(c,attempt),{ok:true,documentId:attempt.id});assert.equal(c.calls.length,0);
});
test('invisible row or transport error never proves rollback',async()=>{
 for(const code of [undefined,'08006','PGRST116']){const c=client();assert.equal((await recover(c,attempt,code)).reviewRequired,true);assert.equal(c.calls.length,0);}
});
test('wrong tenant, company, author or path cannot recover as success',async()=>{
 for(const field of ['tenant_id','company_id','created_by','storage_path']){const c=client({existing:{...row,[field]:'other'}});assert.equal((await recover(c,attempt,'23514')).reviewRequired,true);assert.equal(c.calls.length,0);}
});
test('read failure or a retained reference prevents cleanup after rejected insert',async()=>{
 for(const options of [{readError:{code:'42501'}},{refs:[{id:'retained'}]}]){const c=client(options);assert.equal((await recover(c,attempt,'23514')).reviewRequired,true);assert.equal(c.calls.length,0);}
});
test('explicit rejected insert and confirmed removal permits a retry',async()=>{
 const c=client();assert.equal((await recover(c,attempt,'23514')).reviewRequired,false);assert.deepEqual(c.calls,[[attempt.storagePath]]);
});
test('cleanup after rejected insert requires an exact removal receipt',async()=>{
 for(const options of [{remove:{data:[],error:null}},{remove:{data:[{name:'other'}],error:null}},{throws:true}]){const c=client(options);assert.equal((await recover(c,attempt,'23514')).reviewRequired,true);assert.equal(c.calls.length,1);}
});
test('deleted-document cleanup confirms only the requested object',async()=>{
 const c=client();assert.deepEqual(await cleanup(c,attempt.id,attempt.storagePath),{confirmed:true});assert.deepEqual(c.calls,[[attempt.storagePath]]);
});
test('cleanup remains pending when database receipt is rejected, nonboolean or lost',async()=>{
 for(const receipt of [{data:false,error:null},{data:null,error:null},{data:'true',error:null},{data:true,error:{message:'denied'}},null]){
  const c=client();c.rpc=async()=>{if(!receipt)throw Error('network');return receipt;};
  assert.equal((await cleanup(c,attempt.id,attempt.storagePath)).confirmed,false);assert.equal(c.calls.length,1);
 }
});
test('empty, mismatched, rejected or thrown removal stays a warning with no automatic retry',async()=>{
 for(const options of [{remove:{data:null,error:null}},{remove:{data:[],error:null}},{remove:{data:[{name:'other'}],error:null}},{remove:{data:[{name:attempt.storagePath}],error:{message:'denied'}}},{throws:true}]){
  const c=client(options);const result=await cleanup(c,attempt.id,attempt.storagePath);assert.equal(result.confirmed,false);assert.match(result.warning,/Belge listeden kaldırıldı/);assert.ok(!result.warning.includes(attempt.storagePath));assert.equal(c.calls.length,1);
 }
});
function uploadAction(client) {
 const exports={};
 const dependencies={
  '@/lib/supabase/company-commands':{},'@/lib/document-validity':{documentStatusForFile:()=> 'tam'},
  '@/lib/services/company-document-recovery':{recoverCompanyDocumentInsert:recover},
  '@/lib/services/company-document-cleanup':{},
  '@/lib/supabase/server':{createServerSupabaseClient:async timeout=>{assert.equal(timeout,30_000);return client;}},
  '@/lib/services/companies':{assertCompanyIsActiveForNewOperation:async()=>({ok:true})},
  '@/lib/services/contacts':{},'@/lib/services/notes':{},
 };
 const code=ts.transpileModule(readFileSync(new URL('../src/app/(main)/firmalar/[id]/actions.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 vm.runInNewContext(code,{exports,console,Date,Set,File,FormData,Uint8Array,crypto:{randomUUID:()=>attempt.id},require:name=>{assert.ok(name in dependencies,name);return dependencies[name];}});
 return exports.uploadCompanyDocumentAction;
}
test('upload action routes thrown upload and finalize failures to review or reconciliation',async()=>{
 for(const stage of ['upload','timeout','finalize']){
  const c=client({existing:stage==='finalize'?row:null});const baseFrom=c.from;
  const rpcCalls=[];let inserts=0;
  c.auth={getUser:async()=>({data:{user:{id:attempt.userId}}})};
  c.rpc=async name=>{rpcCalls.push(name);if(name==='document_finalize_upload_v1')throw Error('lost response');return {data:name==='current_user_role'?'yonetici':name==='document_prepare_upload_v1'?attempt.storagePath:attempt.tenantId,error:null};};
  c.storage.from=()=>({upload:async()=>{if(stage==='upload')throw Error('network');if(stage==='timeout')throw new DOMException('Storage deadline exceeded','TimeoutError');return {error:null};},remove:async()=>{throw Error('must not delete');}});
  c.from=table=>{
   if(table==='profiles'){const q={select:()=>q,eq:()=>q,maybeSingle:async()=>{if(stage==='profile')throw Error('network');return {data:null};}};return q;}
   return {...baseFrom(table),insert:()=>{inserts++;const q={select:()=>q,single:async()=>{throw Error('lost response');}};return q;}};
  };
  const form=new FormData();form.set('company_id',attempt.companyId);form.set('name','Synthetic');form.set('category','diger');form.set('file',new File(['%PDF-test'],'test.pdf',{type:'application/pdf'}));
  const result=await uploadAction(c)(form);
  assert.deepEqual(rpcCalls,['current_user_role','current_user_verified_tenant','document_prepare_upload_v1',...(stage==='finalize'?['document_finalize_upload_v1']:[])]);
  assert.equal(result.ok,stage==='finalize');
  if(stage!=='finalize')assert.equal(result.reviewRequired,true);
  assert.equal(inserts,0);
 }
});
test('unconfirmed preparation never uploads bytes or inserts a document',async()=>{
 for(const response of [null,{data:'wrong/path',error:null},{data:attempt.storagePath,error:{message:'denied'}},{data:null,error:null}]){
  const c={auth:{getUser:async()=>({data:{user:{id:attempt.userId}}})},rpc:async name=>{
   if(name==='current_user_role')return {data:'yonetici'};
   if(name==='current_user_verified_tenant')return {data:attempt.tenantId};
   if(!response)throw Error('network');return response;
  },storage:{from:()=>{assert.fail('Upload must not start');}},from:()=>{assert.fail('Insert must not start');}};
  const form=new FormData();form.set('company_id',attempt.companyId);form.set('name','Synthetic');form.set('category','diger');form.set('file',new File(['%PDF-test'],'test.pdf',{type:'application/pdf'}));
  const result=await uploadAction(c)(form);assert.equal(result.ok,false);assert.equal(result.reviewRequired,true);
 }
});
test('upload finalizes through RPC and requires the original document receipt',async()=>{
 for(const receipt of [attempt.id,'other',null]){
  const c=client();const calls=[];
  c.auth={getUser:async()=>({data:{user:{id:attempt.userId}}})};
  c.rpc=async name=>{calls.push(name);return {data:name==='current_user_role'?'yonetici':name==='current_user_verified_tenant'?attempt.tenantId:name==='document_prepare_upload_v1'?attempt.storagePath:receipt,error:null};};
  c.storage.from=()=>({upload:async()=>({error:null}),remove:()=>assert.fail('No implicit deletion')});
  const form=new FormData();form.set('company_id',attempt.companyId);form.set('name','Synthetic');form.set('category','diger');form.set('file',new File(['%PDF-test'],'test.pdf',{type:'application/pdf'}));
  const result=await uploadAction(c)(form);assert.equal(result.ok,receipt===attempt.id);
  assert.equal(calls.filter(name=>name==='document_finalize_upload_v1').length,1);
  if(!result.ok)assert.equal(result.reviewRequired,true);
 }
});
