import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import ts from 'typescript';import{readFileSync}from'node:fs';
import{importActualTypeScript}from'./helpers/import-typescript.mjs';
const validity=await importActualTypeScript(new URL('../src/lib/document-validity.ts',import.meta.url));
const expired={id:'doc',company_id:'company',status:'tam',storage_path:'fixture.pdf',validity_date:'2000-01-01'};
function service(rows){
 const exports={};const all=async()=>rows;
 const code=ts.transpileModule(readFileSync(new URL('../src/lib/services/documents.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
 vm.runInNewContext(code,{exports,Date,Map,Set,require(name){
  if(name==='@/lib/document-validity')return validity;
  if(name==='@/lib/supabase/documents')return{selectAllDocuments:all,selectDocumentsByCompanyId:all,selectDocumentsByCompanyIds:all,selectDocumentById:async()=>rows[0]??null};
  if(name==='@/lib/services/companies')return{requireCompanyByLegacyMockId:async()=>({id:'company'}),getCompanyIdMapByLegacyMockIds:async()=>({legacy:'company'})};
  throw Error(name);
 }});return exports;
}
for(const name of ['listAllDocuments','listDocumentsByLegacyCompanyId'])test(name+' derives expiry without mutating stored status',async()=>{
 const rows=await service([expired])[name]({},'legacy');assert.equal(rows[0].status,'suresi_doldu');assert.equal(expired.status,'tam');
});
test('single document derives expiry and preserves missing record',async()=>{
 assert.equal((await service([expired]).getDocumentById({},'doc')).status,'suresi_doldu');assert.equal(await service([]).getDocumentById({},'missing'),null);
});
test('company compliance counts expired stored-complete files as non-compliant',async()=>{
 const result=await service([expired]).getDocumentComplianceByLegacyIds({},['legacy']);
 assert.equal(result.legacy.tam,0);assert.equal(result.legacy.suresiDoldu,1);
});
