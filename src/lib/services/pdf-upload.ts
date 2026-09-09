import type {SupabaseClient} from '@supabase/supabase-js';
import type {Database} from '@/types/database.types';
import {transferId} from '@/lib/task-transfer';
import {parseUploadCommand,parseUploadReceipt,verifyPdfBytes,type PdfUploadCommand} from '@/lib/pdf-upload';
type Client=SupabaseClient<Database>;
export interface UploadScope {actorId:string;tenantId:string}
function args(scope:UploadScope,command:PdfUploadCommand){return {p_actor_id:transferId(scope.actorId),p_tenant_id:transferId(scope.tenantId),p_contract_id:command.contractId,p_command_id:command.commandId};}
export async function preparePdfUpload(client:Client,scope:UploadScope,input:PdfUploadCommand,cancel=false){
 const command=parseUploadCommand(input);
 const inputArgs={...args(scope,command),p_document_id:command.expectedDocumentId,p_revision:command.expectedRevision,p_filename:command.filename,p_byte_size:command.byteSize,p_sha256:command.sha256,p_cancel:cancel};
 const {data,error}=command.targetRole==='appendix'?await client.rpc('prepare_contract_document_upload',{...inputArgs,p_target_role:'appendix',p_appendix_title:command.appendixTitle!}):await client.rpc('prepare_contract_pdf_upload',inputArgs);
 if(error)throw error;return parseUploadReceipt(data,command);
}
export async function getPdfUpload(client:Client,scope:UploadScope,input:PdfUploadCommand){
 const command=parseUploadCommand(input),{data,error}=await client.rpc('get_contract_pdf_upload',args(scope,command));
 if(error)throw error;return data===null?null:parseUploadReceipt(data,command);
}
export async function executePdfUpload(client:Client,scope:UploadScope,input:PdfUploadCommand,bytes:ArrayBuffer){
 const command=parseUploadCommand(input);await verifyPdfBytes(command,bytes);
 const prepared=await preparePdfUpload(client,scope,command);
 if(prepared.state==='published')return prepared;
 if(prepared.state==='cancelled')throw Error('PDF_UPLOAD_CANCELLED');
 // A lost upload response and an existing immutable object both reconcile by reading actual bytes.
 const bucket=client.storage.from('documents');
 try{await bucket.upload(prepared.path,bytes,{contentType:'application/pdf',upsert:false});}catch{/* Read back even when the upload transport threw. */}
 const stored=await bucket.download(prepared.path);
 if(stored.error||!stored.data)throw Error('PDF_UPLOAD_UNCERTAIN');
 if(stored.data.size!==command.byteSize)throw Error('PDF_UPLOAD_CONTENT');
 await verifyPdfBytes(command,await stored.data.arrayBuffer());
 const {data,error}=await client.rpc('finish_contract_pdf_upload',args(scope,command));
 if(error)throw error;const receipt=parseUploadReceipt(data,command);
 if(receipt.state!=='published')throw Error('PDF_UPLOAD_RESPONSE');return receipt;
}
