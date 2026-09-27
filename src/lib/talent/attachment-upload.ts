import type {AttachmentInput} from './attachments';

type Reply = {data:unknown;error:unknown};
export type AttachmentUploadPort = {
 reserve:(input:AttachmentInput)=>Promise<Reply>;
 upload:(input:AttachmentInput,bytes:Uint8Array)=>Promise<unknown>;
 finish:(id:string)=>Promise<Reply>;
};

/** A transport status (including duplicate-object errors) cannot decide whether a file was saved. */
export async function uploadAttachment(port:AttachmentUploadPort,input:AttachmentInput,bytes:Uint8Array){
 const reserved=await port.reserve(input);
 if(reserved.error)throw reserved.error;
 const value=reserved.data as {id?:unknown;ready?:unknown}|null;
 if(value?.id!==input.id||typeof value.ready!=='boolean')throw Error('ATTACHMENT_RESPONSE');
 if(value.ready)return;
 try{await port.upload(input,bytes);}catch{
  // The object may have been committed before the response was lost. Ask the database.
 }
 // Storage uses different HTTP statuses for existing objects. Only this RPC verifies
 // the reserved object's existence, size and MIME under the current actor's authority.
 const finished=await port.finish(input.id);
 if(finished.error)throw finished.error;
 if(finished.data!==true)throw Error('ATTACHMENT_INCOMPLETE');
}
