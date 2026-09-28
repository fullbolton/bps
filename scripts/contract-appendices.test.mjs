import test from 'node:test';import assert from 'node:assert/strict';
import {importActualTypeScript} from './helpers/import-typescript.mjs';import {id} from './fixtures/daily-operations.mjs';
const b=await importActualTypeScript(new URL('../src/lib/contract-appendices.ts',import.meta.url));
const upload=await importActualTypeScript(new URL('../src/lib/pdf-upload.ts',import.meta.url));
const service=await importActualTypeScript(new URL('../src/lib/services/contract-appendices.ts',import.meta.url));
const doc={id:id(100),title:'Protokol A',name:'a.pdf',revision:0},scope={actorId:id(10),tenantId:id(1)};
test('appendix list distinguishes empty, malformed and wrong scope',()=>{
 assert.deepEqual(b.parseAppendices({contractId:id(20),documents:[]},id(20)),{documents:[],nextCursor:null});
 for(const value of [null,{}, {contractId:id(21),documents:[]},{contractId:id(20),documents:[{...doc,title:null}]}])assert.throws(()=>b.parseAppendices(value,id(20)));
});
test('keyset pagination has bounded continuation and rejects duplicates or borrowed preceding rows',()=>{
 const documents=Array.from({length:21},(_,n)=>({...doc,id:id(n+100)}));const r=b.parseAppendices({contractId:id(20),documents},id(20));assert.equal(r.documents.length,20);assert.equal(r.nextCursor,id(119));
 for(const rows of [[doc,doc],documents.toReversed()])assert.throws(()=>b.parseAppendices({contractId:id(20),documents:rows},id(20)));
 assert.throws(()=>b.parseAppendices({contractId:id(20),documents:[doc]},id(20),doc.id));
});
test('document history rejects another document even within same contract',()=>{
 const version={id:id(200),documentId:doc.id,revision:0,name:'a.pdf',actorName:null,recordedAt:'2026-09-09T00:00:00Z',origin:'upload',current:true};
 const payload={contractId:id(20),documentId:doc.id,versions:[version]};assert.equal(b.parseDocumentHistory(payload,id(20),doc.id).versions.length,1);
 assert.throws(()=>b.parseDocumentHistory({...payload,versions:[{...version,documentId:id(101)}]},id(20),doc.id));assert.throws(()=>b.parseDocumentHistory(payload,id(20),id(101)));
});
test('legacy main commands keep their storage key; appendix targets remain isolated',()=>{
 const old=`bps:pdf-upload:v1:${id(10)}:${id(1)}:${id(20)}`;assert.equal(upload.uploadStorageKey(id(10),id(1),id(20)),old);
 assert.equal(new Set(['main','new-appendix',id(100),id(101)].map(t=>upload.uploadStorageKey(id(10),id(1),id(20),t))).size,4);
});
test('appendix title is command identity; main receipt cannot acknowledge appendix command',()=>{
 const base={commandId:id(30),contractId:id(20),expectedDocumentId:null,expectedRevision:null,filename:'a.pdf',byteSize:5,sha256:'a'.repeat(64)};
 const appendix={...base,targetRole:'appendix',appendixTitle:'A'};assert.deepEqual(upload.parseUploadCommand(appendix),appendix);
 for(const patch of [{targetRole:'appendix'}, {targetRole:'main',appendixTitle:'A'}, {targetRole:'appendix',appendixTitle:'  A'}, {targetRole:'other'}])assert.throws(()=>upload.parseUploadCommand({...base,...patch}));
 const receipt={...base,path:`${id(20)}/${id(31)}.pdf`,state:'pending',documentId:null,versionId:null};assert.throws(()=>upload.parseUploadReceipt(receipt,appendix));
 assert.throws(()=>upload.parseUploadReceipt({...receipt,...appendix,appendixTitle:'B'},appendix));
});
test('version download checks contract/document before signing any path',async()=>{
 let signs=0;const client={rpc:async(name,args)=>{assert.equal(name,'contract_document_version_path');assert.equal(args.p_document_id,doc.id);assert.equal(args.p_contract_id,id(20));return {data:null,error:null};},storage:{from:()=>({createSignedUrl:()=>{signs++;}})}};
 await assert.rejects(()=>service.downloadDocumentVersion(client,scope,id(20),doc.id,id(200)));assert.equal(signs,0);
});
