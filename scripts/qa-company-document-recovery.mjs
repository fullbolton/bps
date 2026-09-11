/** Safety table for ambiguous responses: never delete a possibly committed document. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const source=readFileSync(new URL('../src/lib/services/company-document-recovery.ts',import.meta.url),'utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const module={exports:{}};new Function('exports',compiled)(module.exports);
const recover=module.exports.recoverCompanyDocumentInsert;
const attempt={id:'doc',companyId:'company',tenantId:'tenant',userId:'user',storagePath:'company/doc.pdf'};
const committed={id:'doc',company_id:'company',tenant_id:'tenant',created_by:'user',storage_path:'company/doc.pdf'};
let diagnostics=0;const original=console.error;console.error=()=>diagnostics++;
try {
 for(const code of [undefined,'','PGRST116','FETCH_ERROR','57014','XX000']) {
  let removes=0;
  const client={from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:null,error:null})})})}),storage:{from:()=>({remove:async()=>{removes++;return {data:[{name:attempt.storagePath}],error:null};}})}};
  const result=await recover(client,attempt,code);assert.equal(result.ok,false);assert.equal(result.reviewRequired,true);assert.equal(removes,0);assert.ok(!result.error.includes(attempt.storagePath));
 }
 const cases=[
  {label:'committed after lost response',row:committed,code:undefined,ok:true,remove:0},
  {label:'mismatched saved row',row:{...committed,created_by:'other'},code:'23514',review:true,remove:0},
  {label:'unverifiable read',readError:true,code:'23514',review:true,remove:0},
  {label:'another document references file',references:[{id:'other'}],code:'23514',review:true,remove:0},
  {label:'reference read denied',referenceError:true,code:'P0001',review:true,remove:0},
  {label:'definite rejected insert cleanup',code:'23514',review:false,remove:1},
  {label:'delete denied',code:'P0001',deleteError:true,review:true,remove:1},
  {label:'delete returned no matching object',code:'42501',deleted:[],review:true,remove:1},
  {label:'delete returned another object',code:'23505',deleted:[{name:'other.pdf'}],review:true,remove:1},
 ];
 for(const c of cases){let removes=0;
  const client={from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:c.row??null,error:c.readError?{}:null}),limit:async()=>({data:c.references??[],error:c.referenceError?{}:null})})})}),storage:{from:()=>({remove:async paths=>{removes++;assert.deepEqual(paths,[attempt.storagePath]);return {data:c.deleted??[{name:attempt.storagePath}],error:c.deleteError?{}:null};}})}};
  const result=await recover(client,attempt,c.code);assert.equal(result.ok,c.ok??false,c.label);if(!result.ok)assert.equal(result.reviewRequired,c.review,c.label);assert.equal(removes,c.remove,c.label);
 }
 assert.ok(diagnostics>0);
}finally{console.error=original;}
console.log('PASS 15 recovery cases: ambiguous/no response never deletes, committed row recovered, identity/reference guards, definitive rollback cleanup and exact deletion confirmation');
