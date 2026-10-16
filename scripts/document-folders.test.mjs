import test from 'node:test';
import assert from 'node:assert/strict';
import {importActualTypeScript} from './helpers/import-typescript.mjs';
const {DOCUMENT_FOLDERS,documentFolder}=await importActualTypeScript(new URL('../src/lib/document-folders.ts',import.meta.url));
const {changeDocumentCategory}=await importActualTypeScript(new URL('../src/lib/services/documents.ts',import.meta.url));
test('each existing category belongs to one folder; linked contracts stay together',()=>{
 const categories=DOCUMENT_FOLDERS.flatMap(f=>f.categories);
 assert.equal(categories.length,7);assert.equal(new Set(categories).size,7);
 assert.equal(documentFolder('yetki_belgesi'),'firma');
 assert.equal(documentFolder('diger','contract-id'),'sozlesme');
 assert.equal(documentFolder('ek_protokol'),'sozlesme');
});
const row={id:'doc',tenant_id:'tenant',company_id:'company',revision:4,contract_id:null};
function client(reply){
 const calls=[];const q={rpc:async(...args)=>{calls.push(args);return reply;}};
 return {q,calls};
}
test('moving uses the observed revision and tenant through the metadata command',async()=>{
 const {q,calls}=client({data:{...row,revision:5,category:'yetki_belgesi'},error:null});
 await changeDocumentCategory(q,row,'yetki_belgesi');
 assert.deepEqual(calls,[['document_edit_metadata_v1',{p_tenant:'tenant',p_id:'doc',p_company:'company',p_revision:4,p_kind:'category',p_value:'yetki_belgesi'}]]);
});
test('invalid category, denied/stale result and wrong identity never succeed',async()=>{
 const invalid=client({});await assert.rejects(changeDocumentCategory(invalid.q,row,'unknown'));assert.equal(invalid.calls.length,0);
 for(const reply of [{data:null,error:null},{data:null,error:{code:'40001'}},{data:{...row,id:'other',revision:5,category:'diger'},error:null},{data:{...row,revision:5,category:'diger',contract_id:'linked'},error:null},{data:{...row,category:'diger'},error:null}])await assert.rejects(changeDocumentCategory(client(reply).q,row,'diger'));
});
const {updateDocumentValidity}=await importActualTypeScript(new URL('../src/lib/services/documents.ts',import.meta.url));
test('validity keeps the dialog revision and requires a matching receipt',async()=>{
 const {q,calls}=client({data:{...row,revision:5,validity_date:'2027-01-01'},error:null});
 await updateDocumentValidity(q,row,{validityDate:'2027-01-01'});assert.equal(calls[0][1].p_revision,4);
 for(const revision of [undefined,-1,NaN])await assert.rejects(updateDocumentValidity(q,{...row,revision},{validityDate:'2027-01-01'}));
 await assert.rejects(updateDocumentValidity(q,row,{validityDate:'2027-02-31'}));
 await assert.rejects(updateDocumentValidity(client({data:{...row,revision:5,validity_date:'2028-01-01'},error:null}).q,row,{validityDate:'2027-01-01'}));
});
