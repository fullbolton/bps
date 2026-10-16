import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {importActualTypeScript} from './helpers/import-typescript.mjs';
const {removeDeletedDocumentFile}=await importActualTypeScript(new URL('../src/lib/services/company-document-cleanup.ts',import.meta.url));
// Execute the actual server action with only its session-client dependency replaced.
const path=new URL('../src/app/(main)/firmalar/[id]/actions.ts',import.meta.url);
const ast=ts.createSourceFile(path.pathname,readFileSync(path,'utf8'),ts.ScriptTarget.Latest,true);
const node=ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='deleteCompanyDocumentAction');
assert.ok(node);
const js=ts.transpileModule(node.getText(ast),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText.replace(/^export /,'');
const load=new Function('createServerSupabaseClient','removeDeletedDocumentFile',js+';return deleteCompanyDocumentAction;');
const snapshot={tenantId:'tenant',companyId:'company',revision:4};
const receipt={id:'document-id',tenant_id:'tenant',company_id:'company',revision:4,storage_path:'returned.pdf'};
function setup({data=receipt,error=null,storageError=null,throws=false}={}){
 const calls=[];
 const client={rpc:async(name,args)=>{if(name==='document_ack_cleanup_v1')return {data:true,error:null};calls.push(['delete',args]);if(throws)throw Error('offline');assert.equal(name,'document_delete_v1');return {data,error};},storage:{from:()=>({remove:async paths=>{calls.push(['storage',paths]);return {data:paths.map(name=>({name})),error:storageError};}})}};
 return {run:(expected=snapshot)=>load(async()=>client,removeDeletedDocumentFile)('document-id',expected),calls};
}
test('invalid confirmation revision does not issue a command',async()=>{const s=setup();assert.equal((await s.run({...snapshot,revision:undefined})).ok,false);assert.deepEqual(s.calls,[]);});
test('authorization and stale revision errors never touch Storage',async()=>{
 for(const code of ['42501','40001']){const s=setup({data:null,error:{code}});const r=await s.run();assert.equal(r.ok,false);assert.equal(s.calls.length,1);if(code==='40001')assert.match(r.error,/Belge değişmiş/);}
});
test('missing, malformed and wrong-scope receipts never report deletion or remove files',async()=>{
 for(const data of [null,[],{},true,{...receipt,id:'other'},{...receipt,tenant_id:'other'},{...receipt,company_id:'other'},{...receipt,revision:5},{...receipt,storage_path:undefined}]){const s=setup({data});assert.equal((await s.run()).ok,false);assert.equal(s.calls.length,1);}
});
test('retained history blocks deletion without touching the file',async()=>{const s=setup({data:null,error:{code:'23503'}});const r=await s.run();assert.equal(r.ok,false);assert.match(r.error,/Sürüm geçmişi/);assert.equal(s.calls.length,1);});
test('confirmed deletion uses the authoritative receipt path and expected snapshot',async()=>{const s=setup();assert.deepEqual(await s.run(),{ok:true,deleted:true});assert.deepEqual(s.calls,[['delete',{p_tenant:'tenant',p_id:'document-id',p_company:'company',p_revision:4}],['storage',['returned.pdf']]]);});
test('pathless deletion needs no Storage call; transport failure is uncertain',async()=>{
 const s=setup({data:{...receipt,storage_path:null}});assert.deepEqual(await s.run(),{ok:true,deleted:true});assert.equal(s.calls.length,1);
 const t=setup({throws:true});assert.equal((await t.run()).ok,false);assert.equal(t.calls.length,1);
});
test('storage failure preserves confirmed deletion and keeps the cleanup warning',async()=>{const s=setup({storageError:{message:'offline'}});const r=await s.run();assert.equal(r.ok,true);assert.equal(r.deleted,true);assert.match(r.warning,/document-id/);assert.ok(!r.warning.includes('returned.pdf'));});
