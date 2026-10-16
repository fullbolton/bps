import test from 'node:test';
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
  '@/lib/supabase/client':{createClient:()=>({rpc:async()=>{loads++;return {data:[{document_id:'doc',company_name:'Synthetic',created_at:'2026-10-15T06:00:00Z'}],error:null};}})},
  '@/app/(main)/evraklar/cleanup-actions':{retryDocumentCleanup:()=>{retries++;return new Promise(r=>{resolve=r;});}},
 });
 const render=()=>{const tree=d.render(Panel,{tenantId:'tenant'});d.flush();return tree;};
 let tree=render();assert.equal(loads,0);
 nodes(tree).find(n=>n.type==='button' && n.props['aria-expanded']===false).props.onClick();render();await settle();tree=render();
 const button=nodes(tree).find(n=>n.type==='button' && n.props.children==='Temizliği tekrar dene');assert.ok(button);
 button.props.onClick();button.props.onClick();assert.equal(retries,1);
 resolve({ok:true,message:'Done'});await settle();render();await settle();render();assert.equal(loads,2);d.dispose();
});
