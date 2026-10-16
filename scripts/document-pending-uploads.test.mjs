import test from 'node:test';
import assert from 'node:assert/strict';
import {importActualTypeScript} from './helpers/import-typescript.mjs';
import {compile,driver,nodes,settle} from './helpers/component-driver.mjs';
const {listPendingDocumentUploads:list}=await importActualTypeScript(new URL('../src/lib/services/document-pending-uploads.ts',import.meta.url));
const row={document_id:'doc',tenant_id:'tenant',document_name:'Synthetic',company_name:'Company',created_at:'2026-10-16T10:00:00Z',file_present:false,can_resume:true};
const client=(data,error=null)=>({rpc:async()=>({data,error})});
test('pending pages use a sentinel and never drop the next-page indicator',async()=>{
 const result=await list(client(Array.from({length:51},(_,n)=>({...row,document_id:String(n)}))),'tenant',0);
 assert.equal(result.rows.length,50);assert.equal(result.hasMore,true);
 assert.equal((await list(client([row]),'tenant',50)).hasMore,false);
});
test('malformed, duplicate, foreign and transport responses never become an empty list',async()=>{
 for(const data of [null,[row,row],[{...row,tenant_id:'foreign'}],[{...row,file_present:'false'}],[{...row,created_at:'invalid'}],[{...row,document_name:''}],Array(52).fill(row)])await assert.rejects(list(client(data),'tenant',0));
 await assert.rejects(list(client([],{message:'offline'}),'tenant',0));
});
test('invalid offsets are rejected without a request',async()=>{
 for(const offset of [-1,1,NaN,Infinity,10000050])await assert.rejects(list({rpc:()=>assert.fail('request')},'tenant',offset));
});
test('panel loads only on opening and displays failure rather than an empty state',async()=>{
 const d=driver();let calls=0;
 const useScopedResource=compile('src/components/ui/useScopedResource.ts',d.hooks,{},'useScopedResource');
 const Panel=compile('src/components/documents/PendingDocumentUploads.tsx',d.hooks,{
  '@/app/(main)/evraklar/upload-actions':{recoverDocumentUpload:async()=>assert.fail('unexpected mutation')},
  '@/lib/supabase/client':{createClient:()=>({})},
  '@/components/ui/useScopedResource':{useScopedResource},
  '@/lib/services/document-pending-uploads':{listPendingDocumentUploads:async()=>{calls++;throw Error('offline');}},
 });
 const render=()=>{const tree=d.render(Panel,{tenantId:'tenant'});d.flush();return tree;};
 let tree=render();assert.equal(calls,0);nodes(tree).find(n=>n.type==='button').props.onClick();render();await settle();tree=render();
 assert.equal(calls,1);assert.ok(nodes(tree).some(n=>n.props?.role==='alert'));
 assert.ok(!nodes(tree).some(n=>n.props?.children==='Bu sayfada bekleyen yükleme yok.'));d.dispose();
});

const {resumeDocumentUpload:resume}=await importActualTypeScript(new URL('../src/lib/services/document-upload-recovery.ts',import.meta.url));
const {cancelPendingDocumentUpload:cancelUpload}=await importActualTypeScript(new URL('../src/lib/services/document-upload-recovery.ts',import.meta.url));
test('cancellation requires a true receipt and never treats transport failure as success',async()=>{
 for(const data of [null,false,'true',{},1]) assert.equal((await cancelUpload(client(data),'tenant','doc')).ok,false);
 assert.equal((await cancelUpload(client(true,{}),'tenant','doc')).ok,false);
 assert.equal((await cancelUpload({rpc:async()=>{throw Error('offline');}},'tenant','doc')).ok,false);
 let count=0;
 assert.equal((await cancelUpload({rpc:async(name,args)=>{count++;assert.equal(name,'document_cancel_upload_v1');assert.deepEqual(args,{p_tenant:'tenant',p_id:'doc'});return {data:true,error:null};}},'tenant','doc')).ok,true);
 assert.equal(count,1);
});
function recoveryClient({targetError=null,targetId='doc',blob=new Blob(['%PDF-12345']),downloadError=null,receipt='doc',finishError=null}={}) {
 const calls=[];
 return {calls,rpc:async(name)=>{calls.push(name);return name==='document_upload_recovery_target_v1'
 ? {data:{document_id:targetId,storage_path:'company/doc.pdf',file_size:10},error:targetError}
 : {data:receipt,error:finishError};},storage:{from:()=>({download:async()=>{calls.push('download');return {data:blob,error:downloadError};}})}};
}
test('recovery verifies stored bytes before finalizing the original id exactly once',async()=>{
 const c=recoveryClient();assert.equal((await resume(c,'tenant','doc')).ok,true);
 assert.deepEqual(c.calls,['document_upload_recovery_target_v1','download','document_finalize_upload_v1']);
});
test('denied scope, missing file, wrong size and disguised PDF never finalize',async()=>{
 for(const options of [{targetError:{}},{targetId:'other'},{downloadError:{}},{blob:new Blob(['%PDF-'])},{blob:new Blob(['notpdf1234'])}]) {
  const c=recoveryClient(options);assert.equal((await resume(c,'tenant','doc')).ok,false);assert.ok(!c.calls.includes('document_finalize_upload_v1'));
 }
});
test('unverifiable finalization never reports success or retries the write',async()=>{
 for(const options of [{receipt:null},{receipt:'other'},{finishError:{message:'transport'}}]) {
  const c=recoveryClient(options);assert.equal((await resume(c,'tenant','doc')).ok,false);
  assert.equal(c.calls.filter(n=>n==='document_finalize_upload_v1').length,1);
 }
});
test('recovery button prevents duplicate clicks and refreshes both lists after success',async()=>{
 const d=driver();let calls=0, refreshed=0, resolve;
 const useScopedResource=compile('src/components/ui/useScopedResource.ts',d.hooks,{},'useScopedResource');
 const Panel=compile('src/components/documents/PendingDocumentUploads.tsx',d.hooks,{
  '@/lib/supabase/client':{createClient:()=>({})},
  '@/components/ui/useScopedResource':{useScopedResource},
  '@/lib/services/document-pending-uploads':{listPendingDocumentUploads:async()=>({rows:[{...row,file_present:true}],hasMore:false})},
  '@/app/(main)/evraklar/upload-actions':{recoverDocumentUpload:()=>{calls++;return new Promise(r=>{resolve=r;});}},
 });
 const render=()=>{const tree=d.render(Panel,{tenantId:'tenant',onRecovered:()=>refreshed++});d.flush();return tree;};
 let tree=render();nodes(tree).find(n=>n.type==='button').props.onClick();render();await settle();tree=render();
 const button=nodes(tree).find(n=>n.props?.children==='Yüklemeyi tamamla');assert.ok(button);
 button.props.onClick();button.props.onClick();assert.equal(calls,1);
 resolve({ok:true,message:'done'});await settle();render();assert.equal(refreshed,1);d.dispose();
});

test('cancellation needs confirmation and prevents duplicate submissions',async()=>{
 const d=driver();let calls=0,resolve;
 const useScopedResource=compile('src/components/ui/useScopedResource.ts',d.hooks,{},'useScopedResource');
 const Panel=compile('src/components/documents/PendingDocumentUploads.tsx',d.hooks,{
  '@/lib/supabase/client':{createClient:()=>({})},
  '@/components/ui/useScopedResource':{useScopedResource},
  '@/lib/services/document-pending-uploads':{listPendingDocumentUploads:async()=>({rows:[row],hasMore:false})},
  '@/app/(main)/evraklar/upload-actions':{cancelDocumentUpload:()=>{calls++;return new Promise(r=>{resolve=r;});},recoverDocumentUpload:()=>assert.fail('wrong action')},
 });
 const render=()=>{const tree=d.render(Panel,{tenantId:'tenant'});d.flush();return tree;};
 let tree=render();nodes(tree).find(n=>n.type==='button').props.onClick();render();await settle();tree=render();
 nodes(tree).find(n=>n.props?.children==='Yüklemeyi iptal et').props.onClick();tree=render();assert.equal(calls,0);
 nodes(tree).find(n=>n.props?.children==='Vazgeç').props.onClick();tree=render();assert.equal(calls,0);
 nodes(tree).find(n=>n.props?.children==='Yüklemeyi iptal et').props.onClick();tree=render();
 const confirm=nodes(tree).find(n=>n.props?.children==='İptali onayla');confirm.props.onClick();confirm.props.onClick();assert.equal(calls,1);
 resolve({ok:true,message:'İptal edildi; temizlik bekliyor.'});await settle();tree=render();
 assert.ok(nodes(tree).some(n=>n.props?.children==='İptal edildi; temizlik bekliyor.'));d.dispose();
});


test('recovery distinguishes verified access denial from transport and malformed responses',async()=>{
 for(const error of [{message:'Failed to fetch'}, {code:'PGRST000'}, {code:'57014'}, {}]) {
  const c=recoveryClient({targetError:error});const result=await resume(c,'tenant','doc');
  assert.equal(result.ok,false);assert.match(result.message,/doğrulanamadı/);
  assert.doesNotMatch(result.message,/yetki|bulunamadı|modülü kapalı/);
  assert.deepEqual(c.calls,['document_upload_recovery_target_v1']);
 }
 for(const data of [null,{},[],{document_id:'other'},'true']){
  let calls=0;const result=await resume({rpc:async()=>{calls++;return {data,error:null};},storage:{from:()=>assert.fail('invalid target must not download')}},'tenant','doc');
  assert.equal(result.ok,false);assert.doesNotMatch(result.message,/yetki|bulunamadı/);assert.equal(calls,1);
 }
 const denied=recoveryClient({targetError:{code:'42501'}});
 assert.match((await resume(denied,'tenant','doc')).message,/erişiminiz/);
 assert.deepEqual(denied.calls,['document_upload_recovery_target_v1']);
 const closed=recoveryClient({targetError:{code:'BM001'}});
 assert.match((await resume(closed,'tenant','doc')).message,/modülü kapalı/);
 assert.deepEqual(closed.calls,['document_upload_recovery_target_v1']);
});
