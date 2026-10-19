import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {writeFileSync} from 'node:fs';
import {importActualTypeScript} from '../../scripts/helpers/import-typescript.mjs';
const {verifyAndFinishHrDocument,cancelHrDocumentUpload}=await importActualTypeScript(new URL('../../src/lib/services/hr-document-verification.ts',import.meta.url));
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const context={actor:id(1),tenant:id(2),employee:id(3)},bytes='%PDF-synthetic';
const input={id:id(4),employmentId:id(5),title:'Synthetic',size:Buffer.byteLength(bytes),sha256:createHash('sha256').update(bytes).digest('hex'),validityDate:null};
const receipt={schemaVersion:1,actorId:context.actor,tenantId:context.tenant,employeeId:context.employee,...input,state:'pending',objectId:id(6),objectVersion:'v1',path:`${context.tenant}/${input.id}.pdf`};
const run=async({content=bytes,snapshot=receipt,attestError=null,finishError=null}={})=>{
 const calls=[];
 const user={rpc:(name,args)=>{calls.push(name);return {abortSignal:async()=>({data:name==='hr_document_finish_v1'?{...receipt,state:'published'}:snapshot,error:name==='hr_document_finish_v1'?finishError:null})};},storage:{from:bucket=>{assert.equal(bucket,'hr-private');return {download:async path=>{assert.equal(path,receipt.path);calls.push('download');return {data:new Blob([content]),error:null};}};}}};
 const verifier={rpc:(name,args)=>{calls.push(name);assert.equal(args.p_object,id(6));assert.equal(args.p_version,'v1');assert.equal(args.p_sha256,input.sha256);return {abortSignal:async()=>({data:null,error:attestError})};}};
 try{return {result:await verifyAndFinishHrDocument(user,verifier,context,input),calls};}catch(error){return {error,calls};}
};
const ok=await run();assert.equal(ok.result.state,'published');assert.deepEqual(ok.calls,['hr_document_verification_context_v1','download','hr_document_attest_v1','hr_document_finish_v1']);
for(const content of ['bad',bytes.replace('synthetic','different'),'xxxxxsynthetic']){const r=await run({content});assert.ok(r.error);assert.equal(r.calls.includes('hr_document_attest_v1'),false);}
for(const snapshot of [{...receipt,path:'other.pdf'},{...receipt,tenantId:id(9)},{...receipt,objectVersion:''}]){const r=await run({snapshot});assert.ok(r.error);assert.equal(r.calls.includes('download'),false);}
const denied=await run({attestError:new Error('HR_UPLOAD_OBJECT')});assert.ok(denied.error);assert.equal(denied.calls.includes('hr_document_finish_v1'),false);
const lost=await run({finishError:new Error('transport')});assert.ok(lost.error);assert.equal(lost.result,undefined);
const cancellationCalls=[];
const cancelClient={rpc:(name,args)=>{cancellationCalls.push(name);return {abortSignal:async()=>({data:{schemaVersion:1,actorId:context.actor,tenantId:context.tenant,id:input.id,...(name==='hr_document_cancel_request_v1'?{cleanupRequested:true}:{state:'cancelled'})},error:null})};},storage:{from:()=>({remove:async()=>{cancellationCalls.push('remove');throw Error('lost response');}})}};
assert.equal((await cancelHrDocumentUpload(cancelClient,context,input.id)).state,'cancelled');
assert.deepEqual(cancellationCalls,['hr_document_cancel_request_v1','remove','hr_document_cancel_empty_v1']);
writeFileSync(new URL('./hr-document-verification-client-result.json',import.meta.url),JSON.stringify({passed:6,actualSource:true,actualBytes:true,realStorageHttp:false,checks:['Download then attest then finalize','Size digest and PDF header mismatch fail before attestation','Scope path and object-version binding before download','Attestation failure prevents finalize','Lost finalize response never reported successful','Cancellation fences upload before removal and reconciles lost delete response']},null,2)+'\n');console.log('PASS 6 HR verification orchestration groups');
