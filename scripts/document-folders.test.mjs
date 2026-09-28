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
const row={id:'doc',company_id:'company',updated_at:'revision'};
function client(reply){
 const calls=[];const q={};
 for(const method of ['from','update','eq','is','select'])q[method]=(...args)=>{calls.push([method,...args]);return q;};
 q.maybeSingle=async()=>reply;
 return {q,calls};
}
test('moving changes category only, scoped by company, revision and unlinked contract',async()=>{
 const {q,calls}=client({data:{...row,category:'yetki_belgesi',contract_id:null},error:null});
 await changeDocumentCategory(q,row,'yetki_belgesi');
 assert.deepEqual(calls,[['from','documents'],['update',{category:'yetki_belgesi'}],['eq','id','doc'],['eq','company_id','company'],['eq','updated_at','revision'],['is','contract_id',null],['select','*']]);
});
test('invalid category, denied/stale result, transport error and wrong identity never succeed',async()=>{
 const invalid=client({});await assert.rejects(changeDocumentCategory(invalid.q,row,'unknown'));assert.equal(invalid.calls.length,0);
 for(const reply of [{data:null,error:null},{data:null,error:{message:'denied'}},{data:{...row,id:'other',category:'diger',contract_id:null},error:null},{data:{...row,category:'diger',contract_id:'linked'},error:null}])await assert.rejects(changeDocumentCategory(client(reply).q,row,'diger'));
});
