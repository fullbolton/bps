import test from 'node:test';
import assert from 'node:assert/strict';
import {importActualTypeScript} from './helpers/import-typescript.mjs';
import {id} from './fixtures/daily-operations.mjs';
const boundary=await importActualTypeScript(new URL('../src/lib/pdf-upload.ts',import.meta.url));
const service=await importActualTypeScript(new URL('../src/lib/services/pdf-upload.ts',import.meta.url));
const body=await importActualTypeScript(new URL('../src/lib/pdf-upload-body.ts',import.meta.url));
const bytes=new TextEncoder().encode('%PDF-1.7\nSynthetic').buffer;
const command={commandId:id(50),contractId:id(100),expectedDocumentId:null,expectedRevision:null,filename:'test.pdf',byteSize:bytes.byteLength,sha256:await boundary.pdfDigest(bytes)};
const receipt={...command,path:`${id(20)}/${id(200)}.pdf`,state:'pending',documentId:null,versionId:null};
const done={...receipt,state:'published',documentId:id(300),versionId:id(400)};
const scope={actorId:id(10),tenantId:id(1)};
function mock({prepare=receipt,finish=done,uploadThrows=false,stored=bytes,get=done,error=null}={}){
 const calls=[];return {calls,rpc:async(name,args)=>{calls.push(name);assert.equal(args.p_actor_id,scope.actorId);return {data:name.startsWith('prepare')?prepare:name.startsWith('finish')?finish:get,error};},storage:{from:()=>({upload:async()=>{calls.push('upload');if(uploadThrows)throw Error('lost response');return {error:{message:'already exists'}};},download:async()=>{calls.push('download');return {data:stored===null?null:new Blob([stored]),error:null};}})}};
}
test('command boundaries reject missing or invalid CAS, hash, bytes and filename',()=>{
 assert.deepEqual(boundary.parseUploadCommand(command),command);
 for(const patch of [{expectedDocumentId:id(1)},{expectedRevision:0},{expectedRevision:NaN},{byteSize:10*1024*1024+1},{sha256:'true'},{filename:'../a.pdf'},{filename:' a.pdf'},{filename:'\u0000a.pdf'}])assert.throws(()=>boundary.parseUploadCommand({...command,...patch}));
});
test('receipt identity and terminal states cannot be borrowed or interpreted loosely',()=>{
 assert.deepEqual(boundary.parseUploadReceipt(done,command),done);
 for(const patch of [{commandId:id(51)},{sha256:'0'.repeat(64)},{state:'publishing'},{state:true},{documentId:null},{path:'../other.pdf'}])assert.throws(()=>boundary.parseUploadReceipt({...done,...patch},command));
});
test('invalid file is rejected before any RPC, including same-size different content',async()=>{
 const client=mock();await assert.rejects(()=>service.executePdfUpload(client,scope,command,new TextEncoder().encode('%PDF-1.7\nDifferent').buffer));assert.deepEqual(client.calls,[]);
});
test('lost upload response reconciles bytes before finish; same command retry returns receipt without Storage',async()=>{
 const client=mock({uploadThrows:true});assert.deepEqual(await service.executePdfUpload(client,scope,command,bytes),done);assert.deepEqual(client.calls,['prepare_contract_pdf_upload','upload','download','finish_contract_pdf_upload']);
 const replay=mock({prepare:done});assert.deepEqual(await service.executePdfUpload(replay,scope,command,bytes),done);assert.deepEqual(replay.calls,['prepare_contract_pdf_upload']);
});
test('missing or mismatched Storage bytes cannot finish',async()=>{
 for(const stored of [null,new TextEncoder().encode('%PDF-1.7\nDifferent').buffer]){const client=mock({stored});await assert.rejects(()=>service.executePdfUpload(client,scope,command,bytes));assert.ok(!client.calls.includes('finish_contract_pdf_upload'));}
});
test('cancelled command never uploads; cancel-before-prepare uses full immutable command',async()=>{
 const client=mock({prepare:{...receipt,state:'cancelled'}});await assert.rejects(()=>service.executePdfUpload(client,scope,command,bytes),/CANCELLED/);assert.deepEqual(client.calls,['prepare_contract_pdf_upload']);
 const cancellation={rpc:async(name,args)=>{assert.equal(name,'prepare_contract_pdf_upload');assert.equal(args.p_cancel,true);assert.equal(args.p_sha256,command.sha256);return {data:{...receipt,state:'cancelled'},error:null};}};assert.equal((await service.preparePdfUpload(cancellation,scope,command,true)).state,'cancelled');
});
test('status distinguishes unknown transport, confirmed missing, malformed and published',async()=>{
 await assert.rejects(()=>service.getPdfUpload(mock({error:Error('network')}),scope,command));
 assert.equal(await service.getPdfUpload(mock({get:null}),scope,command),null);
 await assert.rejects(()=>service.getPdfUpload(mock({get:{}}),scope,command));
 assert.equal((await service.getPdfUpload(mock(),scope,command)).state,'published');
 assert.equal(boundary.uploadFailure(Error('network')).uncertain,true);
});
test('bounded multipart accepts a file above Server Action default and exactly 10 MiB',async()=>{
 for(const size of [1024*1024+10,10*1024*1024]){const form=new FormData();form.set('file',new Blob([new Uint8Array(size)]),'a.pdf');const parsed=await body.readPdfUploadForm(new Request('http://localhost/upload',{method:'POST',body:form}));assert.equal(parsed.get('file').size,size);}
});
test('body limit enforced on actual chunks despite missing or lying Content-Length',async()=>{
 for(const length of [undefined,'1',String(body.MAX_UPLOAD_BODY+1)]){
  const headers={'content-type':'multipart/form-data; boundary=x'};if(length)headers['content-length']=length;
  const request=new Request('http://localhost/upload',{method:'POST',headers,duplex:'half',body:new ReadableStream({start(c){c.enqueue(new Uint8Array(body.MAX_UPLOAD_BODY+1));c.close();}})});
  await assert.rejects(()=>body.readPdfUploadForm(request));
 }
});

test('malformed successful RPC data remains an unverifiable result, not invalid caller input',()=>{
 for(const value of [null,{}, {...done,byteSize:null}]){
  try{boundary.parseUploadReceipt(value,command);assert.fail('must reject');}
  catch(error){assert.equal(error.message,'PDF_UPLOAD_RESPONSE');assert.equal(boundary.uploadFailure(error).uncertain,true);}
 }
});
