import test from 'node:test';
import assert from 'node:assert/strict';
import {importActualTypeScript} from './helpers/import-typescript.mjs';
import {id} from './fixtures/daily-operations.mjs';
const boundary=await importActualTypeScript(new URL('../src/lib/contract-pdf.ts',import.meta.url));
const service=await importActualTypeScript(new URL('../src/lib/services/contract-pdf.ts',import.meta.url));
const documents=await importActualTypeScript(new URL('../src/lib/services/documents.ts',import.meta.url));
const version={id:id(10),documentId:id(20),revision:0,name:'a.pdf',actorName:null,recordedAt:'2026-09-09T00:00:00Z',origin:'baseline',current:true};
const payload={contractId:id(100),versions:[version]};
test('missing, unavailable and malformed versions never mean empty history',()=>{
 assert.deepEqual(boundary.parsePdfVersions({...payload,versions:[]},id(100)),{versions:[],hasMore:false});
 for(const v of [null,{}, {...payload,versions:null},{...payload,contractId:id(101)},{...payload,versions:[{...version,current:'true'}]},{...payload,versions:[version,version]}])assert.throws(()=>boundary.parsePdfVersions(v,id(100)));
});
test('bounded history explicitly reports more and rejects unordered or duplicate evidence',()=>{
 const versions=Array.from({length:51},(_,i)=>({...version,id:id(i+200),revision:60-i,current:i===0}));
 const parsed=boundary.parsePdfVersions({...payload,versions},id(100));assert.equal(parsed.versions.length,50);assert.equal(parsed.hasMore,true);
 assert.throws(()=>boundary.parsePdfVersions({...payload,versions:versions.toReversed()},id(100)));
});
test('signed download resolves version through scoped RPC, never arbitrary caller path',async()=>{
 let signCalls=0;let response={data:null,error:null};const client={rpc:async(name,args)=>{assert.equal(name,'contract_pdf_version_path');assert.equal(args.p_version_id,version.id);return response;},storage:{from:bucket=>{assert.equal(bucket,'documents');return {createSignedUrl:async(path,seconds)=>{signCalls++;assert.equal(path,'company/server-resolved.pdf');assert.equal(seconds,60);return {data:{signedUrl:'http://127.0.0.1/synthetic'},error:null};}};}}};
 const scope={actorId:id(11),tenantId:id(1)};await assert.rejects(()=>service.downloadContractPdfVersion(client,scope,version.id));assert.equal(signCalls,0);
 response={data:'company/server-resolved.pdf',error:null};assert.equal(await service.downloadContractPdfVersion(client,scope,version.id),'http://127.0.0.1/synthetic');assert.equal(signCalls,1);
});
test('actual PDF replace service gates revision and uses CAS, zero rows is failure',async()=>{
 const filters=[];let calls=0;let data=null;
 const chain={eq:(k,v)=>{filters.push([k,v]);return chain;},select:()=>chain,maybeSingle:async()=>({data,error:null})};
 const client={from:name=>{calls++;assert.equal(name,'documents');return {update:()=>chain};}};
 const patch={name:'new.pdf',storagePath:'path.pdf',uploadedBy:null};
 await assert.rejects(()=>documents.updateContractDocumentFile(client,id(20),patch,undefined));assert.equal(calls,0);
 await assert.rejects(()=>documents.updateContractDocumentFile(client,id(20),patch,4),/Belge değişmiş/);assert.deepEqual(filters,[['id',id(20)],['revision',4]]);
 data={id:id(20),revision:5};assert.equal((await documents.updateContractDocumentFile(client,id(20),patch,4)).revision,5);
});
