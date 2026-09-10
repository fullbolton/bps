import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
// Execute the actual server action with only its session-client dependency replaced.
const path=new URL('../src/app/(main)/firmalar/[id]/actions.ts',import.meta.url);
const ast=ts.createSourceFile(path.pathname,readFileSync(path,'utf8'),ts.ScriptTarget.Latest,true);
const node=ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='deleteCompanyDocumentAction');
assert.ok(node);
const js=ts.transpileModule(node.getText(ast),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText.replace(/^export /,'');
const load=new Function('createServerSupabaseClient',js+';return deleteCompanyDocumentAction;');
function setup({role='yonetici',read={data:{storage_path:'old.pdf'},error:null},deleted={data:[{storage_path:'returned.pdf'}],error:null},storageError=null}={}){
 const calls=[];let deleting=false;
 const chain={select:()=>chain,eq:()=>chain,maybeSingle:async()=>{calls.push('read');return read;},delete:()=>{calls.push('delete');deleting=true;return chain;},then:(resolve,reject)=>Promise.resolve(deleted).then(resolve,reject)};
 const client={auth:{getUser:async()=>({data:{user:{id:'user'}}})},rpc:async()=>({data:role,error:null}),from:()=>{assert.equal(deleting,false);return chain;},storage:{from:()=>({remove:async paths=>{calls.push(['storage',paths]);return {data:[],error:storageError};}})}};
 return {run:()=>load(async()=>client)('document-id'),calls};
}
test('role rejection touches neither document nor storage',async()=>{const s=setup({role:'operasyon'});assert.equal((await s.run()).ok,false);assert.deepEqual(s.calls,[]);});
test('read failure leaves both records untouched',async()=>{const s=setup({read:{data:null,error:{message:'offline'}}});assert.equal((await s.run()).ok,false);assert.deepEqual(s.calls,['read']);});
test('missing read and zero-row delete explicitly report no confirmed deletion',async()=>{
 for(const option of [{read:{data:null,error:null}},{deleted:{data:[],error:null}}]){const s=setup(option);assert.deepEqual(await s.run(),{ok:true,deleted:false});assert.ok(!s.calls.some(Array.isArray));}
});
test('blocked database deletion never removes the file',async()=>{const s=setup({deleted:{data:null,error:{message:'contract_document_versions_document_id_fkey'}}});const result=await s.run();assert.equal(result.ok,false);assert.match(result.error,/Sürüm geçmişi/);assert.deepEqual(s.calls,['read','delete']);});
test('confirmed row deletion uses RETURNING path, after deleting the row',async()=>{const s=setup();assert.deepEqual(await s.run(),{ok:true,deleted:true});assert.deepEqual(s.calls,['read','delete',['storage',['returned.pdf']]]);});
test('record without a file is a confirmed deletion with no storage operation',async()=>{const s=setup({deleted:{data:[{storage_path:null}],error:null}});assert.deepEqual(await s.run(),{ok:true,deleted:true});assert.deepEqual(s.calls,['read','delete']);});
test('storage failure preserves confirmed deletion and warning, never suggests row retry',async()=>{const s=setup({storageError:{message:'offline'}});const r=await s.run();assert.equal(r.ok,true);assert.equal(r.deleted,true);assert.match(r.warning,/returned.pdf/);assert.equal(s.calls.length,3);});
