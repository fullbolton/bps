import type {SupabaseClient} from '@supabase/supabase-js';
import type {Database} from '@/types/database.types';
import {isUuid} from '@/lib/operations/pilot-validation';
import {pdfDigest} from '@/lib/pdf-upload';
import {parseHrUploadReceipt,prepareHrUpload,type HrUploadInput} from './hr-document-upload';
import {parseHrScanStatus} from './hr-scan-status';
type Context={actor:string;tenant:string;employee:string};
export async function readHrDocumentScan(user:SupabaseClient<Database>,context:Context,id:string){
 if(![context.actor,context.tenant,context.employee,id].every(isUuid))throw Error('HR_SCOPE');
 const {data,error}=await user.rpc('hr_malware_status_v1',{p_actor:context.actor,p_tenant:context.tenant,p_upload:id}).abortSignal(AbortSignal.timeout(12000));
 if(error)throw error;
 return parseHrScanStatus(data,{...context,upload:id});
}
/** Upload into quarantine. Only the independent leased worker can attest bytes. */
export async function enqueueHrDocumentUpload(user:SupabaseClient<Database>,context:Context,input:HrUploadInput,bytes:ArrayBuffer){
 if(bytes.byteLength!==input.size||await pdfDigest(bytes)!==input.sha256)throw Error('HR_UPLOAD_CONTENT');
 const receipt=await prepareHrUpload(user,context,input);
 if(receipt.state==='cancelled')throw Error('HR_UPLOAD_CANCELLED');
 if(receipt.state==='published')return receipt;
 try{await user.storage.from('hr-private').upload(`${context.tenant}/${input.id}.pdf`,bytes,{contentType:'application/pdf',upsert:false});}catch{/* Context below reconciles a lost upload response. */}
 const {data,error}=await user.rpc('hr_document_verification_context_v1',{p_actor:context.actor,p_tenant:context.tenant,p_upload:input.id}).abortSignal(AbortSignal.timeout(12000));
 if(error)throw error;
 const stored=parseHrUploadReceipt(data,context,input);
 if(stored.state!=='pending')throw Error('HR_UPLOAD_UNCERTAIN');
 const queued=await user.rpc('hr_malware_enqueue_v1',{p_actor:context.actor,p_tenant:context.tenant,p_upload:input.id}).abortSignal(AbortSignal.timeout(12000));
 if(queued.error)throw queued.error;
 await readHrDocumentScan(user,context,input.id);
 return stored;
}
export async function actOnHrDocumentScan(user:SupabaseClient<Database>,context:Context,input:HrUploadInput,action:'status'|'finalize'|'rescan',requestId?:string){
 parseHrUploadReceipt({schemaVersion:1,actorId:context.actor,tenantId:context.tenant,employeeId:context.employee,...input,state:'pending'},context,input);
 // Validate employee scope before any mutation, including a replay.
 const current=await readHrDocumentScan(user,context,input.id);
 if(action==='status')return {scan:current};
 if(action==='rescan'){
  if(!isUuid(requestId))throw Error('HR_SCAN_REQUEST');
  const {error}=await user.rpc('hr_malware_rescan_v1',{p_actor:context.actor,p_tenant:context.tenant,p_upload:input.id,p_request:requestId}).abortSignal(AbortSignal.timeout(12000));
  if(error)throw error;
  return {scan:await readHrDocumentScan(user,context,input.id)};
 }
 if(action!=='finalize'||(!current.canFinalize&&current.status!=='published'))throw Error('HR_SCAN_NOT_READY');
 const {data,error}=await user.rpc('hr_document_finish_v1',{p_actor:context.actor,p_tenant:context.tenant,p_upload:input.id}).abortSignal(AbortSignal.timeout(12000));
 if(error)throw error;
 const receipt=parseHrUploadReceipt(data,context,input);
 if(receipt.state!=='published')throw Error('HR_UPLOAD_UNCERTAIN');
 return {receipt};
}
