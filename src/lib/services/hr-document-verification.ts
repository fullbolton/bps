import type {SupabaseClient} from '@supabase/supabase-js';
import type {Database} from '@/types/database.types';
import {isUuid} from '@/lib/operations/pilot-validation';
import {pdfDigest} from '@/lib/pdf-upload';
import {parseHrUploadReceipt,prepareHrUpload,cancelEmptyHrUpload,type HrUploadInput} from './hr-document-upload';

/** Server orchestration only. The caller supplies a scoped user client and a
 * trusted verifier client. The database never grants attestation to browsers.
 * No credentials are constructed here; no public route is enabled yet. */
export async function verifyAndFinishHrDocument(
 user:SupabaseClient<Database>, verifier:SupabaseClient<Database>,
 context:{actor:string;tenant:string;employee:string}, expected:HrUploadInput,
){
 const args={p_actor:context.actor,p_tenant:context.tenant,p_upload:expected.id};
 const snapshot=await user.rpc('hr_document_verification_context_v1',args).abortSignal(AbortSignal.timeout(12000));
 if(snapshot.error)throw snapshot.error;
 const receipt=parseHrUploadReceipt(snapshot.data,context,expected);
 if(receipt.state==='cancelled')throw Error('HR_UPLOAD_CANCELLED');
 const object=snapshot.data as Record<string,unknown>;
 const path=`${context.tenant}/${expected.id}.pdf`;
 if(!isUuid(object.objectId)||typeof object.objectVersion!=='string'||!object.objectVersion||object.path!==path)throw Error('HR_UPLOAD_OBJECT');
 // Use the user client for download, so a server credential never bypasses read scope.
 const stored=await user.storage.from('hr-private').download(path);
 if(stored.error||!stored.data)throw Error('HR_UPLOAD_UNCERTAIN');
 if(stored.data.size!==expected.size)throw Error('HR_UPLOAD_CONTENT');
 const bytes=await stored.data.arrayBuffer();
 if(await pdfDigest(bytes)!==expected.sha256)throw Error('HR_UPLOAD_CONTENT');
 const attestation=await verifier.rpc('hr_document_attest_v1',{
  p_tenant:context.tenant,p_actor:context.actor,p_upload:expected.id,
  p_object:object.objectId,p_version:object.objectVersion,p_size:expected.size,p_sha256:expected.sha256,
 }).abortSignal(AbortSignal.timeout(12000));
 if(attestation.error)throw attestation.error;
 const finished=await user.rpc('hr_document_finish_v1',args).abortSignal(AbortSignal.timeout(12000));
 if(finished.error)throw finished.error;
 const result=parseHrUploadReceipt(finished.data,context,expected);
 if(result.state!=='published')throw Error('HR_UPLOAD_RESPONSE');
 return result;
}

export async function executeHrDocumentUpload(user:SupabaseClient<Database>,verifier:SupabaseClient<Database>,context:{actor:string;tenant:string;employee:string},input:HrUploadInput,bytes:ArrayBuffer){
 if(bytes.byteLength!==input.size||await pdfDigest(bytes)!==input.sha256)throw Error('HR_UPLOAD_CONTENT');
 const prepared=await prepareHrUpload(user,context,input);
 if(prepared.state==='cancelled')throw Error('HR_UPLOAD_CANCELLED');
 if(prepared.state==='pending'){
  try{await user.storage.from('hr-private').upload(`${context.tenant}/${input.id}.pdf`,bytes,{contentType:'application/pdf',upsert:false});}catch{/* Reconcile using actual bytes after a lost response. */}
 }
 return verifyAndFinishHrDocument(user,verifier,context,input);
}
export async function cancelHrDocumentUpload(user:SupabaseClient<Database>,context:{actor:string;tenant:string;employee:string},id:string){
 if(!isUuid(id))throw Error('HR_UPLOAD_INPUT');
 const {data,error}=await user.rpc('hr_document_cancel_request_v1',{p_actor:context.actor,p_tenant:context.tenant,p_upload:id}).abortSignal(AbortSignal.timeout(12000));
 if(error)throw error;
 const r=data as Record<string,unknown>|null;
 if(!r||r.schemaVersion!==1||r.actorId!==context.actor||r.tenantId!==context.tenant||r.id!==id||r.cleanupRequested!==true)throw Error('HR_UPLOAD_RESPONSE');
 try{await user.storage.from('hr-private').remove([`${context.tenant}/${id}.pdf`]);}catch{/* Empty finalizer checks whether removal really completed. */}
 return cancelEmptyHrUpload(user,context,id);
}
