import test from 'node:test';
import {importActualTypeScript} from './helpers/import-typescript.mjs';
const {listPendingDocumentCleanup}=await importActualTypeScript(new URL('../src/lib/services/document-pending-cleanup.ts',import.meta.url));
import assert from 'node:assert/strict';
import {compile, driver, nodes, settle} from './helpers/component-driver.mjs';
function action({target={data:'stored/path.pdf',error:null},ack={data:false,error:null},cleanup={confirmed:true}}={}) {
 const calls=[];
 const client={rpc:async(name,args)=>{calls.push([name,args]);return name==='document_cleanup_target_v1'?target:ack;}};
 const run=compile('src/app/(main)/evraklar/cleanup-actions.ts',{}, {
  '@/lib/supabase/server':{createServerSupabaseClient:async()=>client},
  '@/lib/services/company-document-cleanup':{removeDeletedDocumentFile:async(c,id,path)=>{assert.equal(c,client);calls.push(['remove',id,path]);return cleanup;}},
 },'retryDocumentCleanup');
 return {run,calls};
}
test('retry uses server-resolved path only and acknowledges first',async()=>{
 const a=action();assert.equal((await a.run('tenant','document')).ok,true);
 assert.deepEqual(JSON.parse(JSON.stringify(a.calls)),[['document_cleanup_target_v1',{p_tenant:'tenant',p_document_id:'document'}],['document_ack_cleanup_v1',{p_document_id:'document'}],['remove','document','stored/path.pdf']]);
});
test('already removed file is acknowledged without another Storage delete',async()=>{
 const a=action({ack:{data:true,error:null}});assert.equal((await a.run('tenant','document')).ok,true);assert.equal(a.calls.length,2);
});
test('missing target, failed and malformed acknowledgement never remove files',async()=>{
 for(const options of [{target:{data:null,error:null}},{target:{data:'path',error:{message:'denied'}}},{ack:{data:'false',error:null}},{ack:{data:null,error:null}},{ack:{data:false,error:{message:'offline'}}}]){
  const a=action(options);assert.equal((await a.run('tenant','document')).ok,false);assert.ok(!a.calls.some(c=>c[0]==='remove'));
 }
});
test('failed cleanup remains a failure with a retained-job message',async()=>{
 const a=action({cleanup:{confirmed:false,warning:'internal'}});const result=await a.run('tenant','document');assert.equal(result.ok,false);assert.match(result.message,/listede korunuyor/);
});
test('panel loads on demand, prevents double retry and refreshes after confirmation',async()=>{
 const d=driver();let loads=0,retries=0,resolve;
 const Panel=compile('src/components/documents/DocumentCleanupPanel.tsx',d.hooks,{
  '@/lib/services/document-pending-cleanup':{listPendingDocumentCleanup},
  '@/lib/supabase/client':{createClient:()=>({rpc:async()=>{loads++;return {data:[{document_id:'doc',document_name:null,company_name:'Synthetic',created_at:'2026-10-15T06:00:00Z'}],error:null};}})},
  '@/app/(main)/evraklar/cleanup-actions':{retryDocumentCleanup:()=>{retries++;return new Promise(r=>{resolve=r;});}},
 });
 const render=()=>{const tree=d.render(Panel,{tenantId:'tenant'});d.flush();return tree;};
 let tree=render();assert.equal(loads,0);
 nodes(tree).find(n=>n.type==='button' && n.props['aria-expanded']===false).props.onClick();render();await settle();tree=render();
 const button=nodes(tree).find(n=>n.type==='button' && n.props.children==='Temizliği tekrar dene');assert.ok(button);
 button.props.onClick();button.props.onClick();assert.equal(retries,1);
 resolve({ok:true,message:'Done'});await settle();render();await settle();render();assert.equal(loads,2);d.dispose();
});


test('external refresh reloads an open cleanup panel without collapsing it and stays lazy when closed',async()=>{
 const d=driver();let loads=0,refreshVersion=0;
 const Panel=compile('src/components/documents/DocumentCleanupPanel.tsx',d.hooks,{
  '@/lib/services/document-pending-cleanup':{listPendingDocumentCleanup},
  '@/lib/supabase/client':{createClient:()=>({rpc:async()=>{loads++;return {data:loads===1?[]:[{document_id:'cancelled',document_name:'Yeni iptal',company_name:'Synthetic',created_at:'2026-10-17T06:00:00Z'}],error:null};}})},
  '@/app/(main)/evraklar/cleanup-actions':{retryDocumentCleanup:()=>assert.fail('no mutation')},
 });
 const render=()=>{const tree=d.render(Panel,{tenantId:'tenant',refreshVersion});d.flush();return tree;};
 let tree=render();refreshVersion++;render();await settle();assert.equal(loads,0);
 nodes(tree).find(n=>n.props?.['aria-expanded']===false).props.onClick();render();await settle();tree=render();assert.equal(loads,1);
 refreshVersion++;render();await settle();tree=render();assert.equal(loads,2);
 assert.ok(nodes(tree).some(n=>n.props?.['aria-expanded']===true));
 assert.ok(nodes(tree).some(n=>n.props?.children==='Yeni iptal'));
 nodes(tree).find(n=>n.props?.['aria-expanded']===true).props.onClick();render();refreshVersion++;render();await settle();assert.equal(loads,2);d.dispose();
});


test('cleanup list validates pages, nullable labels, unique ids and date values',async()=>{
 const row={document_id:'id',document_name:null,company_name:null,created_at:'2026-10-17T00:00:00Z'};
 const list=data=>listPendingDocumentCleanup({rpc:async()=>({data,error:null})},'tenant',0);
 assert.equal((await list([])).hasMore,false);
 assert.equal((await list([row])).rows.length,1);
 const page=await list(Array.from({length:51},(_,i)=>({...row,document_id:String(i)})));
 assert.equal(page.rows.length,50);assert.equal(page.hasMore,true);
 for(const data of [null,{},[null],[row,row],[{...row,document_id:' '}],[{...row,document_name:undefined}],[{...row,company_name:4}],[{...row,created_at:'invalid'}],Array.from({length:52},(_,i)=>({...row,document_id:String(i)}))])await assert.rejects(list(data));
 await assert.rejects(listPendingDocumentCleanup({rpc:async()=>({data:[],error:{message:'offline'}})},'tenant',0));
 for(const offset of [-1,1,NaN,Infinity,10000050])await assert.rejects(listPendingDocumentCleanup({rpc:()=>assert.fail('must not request')},'tenant',offset));
});

test('malformed refresh clears old cleanup rows and shows an error, not empty success',async()=>{
 const d=driver();let calls=0;
 const Panel=compile('src/components/documents/DocumentCleanupPanel.tsx',d.hooks,{
  '@/lib/services/document-pending-cleanup':{listPendingDocumentCleanup},
  '@/lib/supabase/client':{createClient:()=>({rpc:async()=>({data:++calls===1?[{document_id:'id',document_name:'Old row',company_name:null,created_at:'2026-10-17T00:00:00Z'}]:[null],error:null})})},
  '@/app/(main)/evraklar/cleanup-actions':{retryDocumentCleanup:()=>assert.fail('no mutation')},
 });
 const render=()=>{const tree=d.render(Panel,{tenantId:'tenant'});d.flush();return tree;};
 let tree=render();nodes(tree).find(n=>n.props?.['aria-expanded']===false).props.onClick();render();await settle();tree=render();
 assert.ok(nodes(tree).some(n=>n.props?.children==='Old row'));
 nodes(tree).find(n=>n.props?.children==='Listeyi yenile').props.onClick();render();await settle();tree=render();
 assert.ok(nodes(tree).some(n=>n.props?.role==='alert'));
 assert.ok(!nodes(tree).some(n=>n.props?.children==='Old row'||n.props?.children==='Bu sayfada bekleyen dosya temizliği yok.'));
 d.dispose();
});
