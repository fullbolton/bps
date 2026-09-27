'use server';
import {pdfUploadContext} from '@/lib/services/pdf-upload-context';
import {getPdfUpload,preparePdfUpload} from '@/lib/services/pdf-upload';
import {uploadFailure,type PdfUploadCommand} from '@/lib/pdf-upload';
export async function pdfUploadStatusAction(actorId:string,tenantId:string,command:PdfUploadCommand){
 try{const {client,scope}=await pdfUploadContext(actorId,tenantId);return {ok:true as const,receipt:await getPdfUpload(client,scope,command)};}
 catch(error){return uploadFailure(error);}
}
export async function pdfUploadCancelAction(actorId:string,tenantId:string,command:PdfUploadCommand){
 try{const {client,scope}=await pdfUploadContext(actorId,tenantId);return {ok:true as const,receipt:await preparePdfUpload(client,scope,command,true)};}
 catch(error){return uploadFailure(error);}
}
