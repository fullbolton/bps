'use server';
import {createServerSupabaseClient} from '@/lib/supabase/server';
import {loadAppendices,loadDocumentHistory,downloadDocumentVersion} from '@/lib/services/contract-appendices';
import {loadContractPdfVersions,downloadContractPdfVersion} from '@/lib/services/contract-pdf';
async function context(expectedActor:string){
 const client=await createServerSupabaseClient(12_000),auth=await client.auth.getUser();
 if(auth.error||!auth.data.user||auth.data.user.id!==expectedActor)throw Error('Hesap değişti.');
 const tenant=await client.rpc('current_user_verified_tenant');if(tenant.error||typeof tenant.data!=='string')throw Error('Çalışma alanı doğrulanamadı.');
 return {client,scope:{actorId:auth.data.user.id,tenantId:tenant.data}};
}
export async function pdfHistoryAction(actorId:string,contractId:string,documentId?:string){
 try{const {client,scope}=await context(actorId);return {ok:true as const,...await (documentId?loadDocumentHistory(client,scope,contractId,documentId):loadContractPdfVersions(client,scope,contractId))};}
 catch{return {ok:false as const,error:'PDF geçmişi yüklenemedi. Yeniden deneyin.'};}
}
export async function pdfVersionDownloadAction(actorId:string,versionId:string,contractId?:string,documentId?:string){
 try{const {client,scope}=await context(actorId);return {ok:true as const,url:await (contractId&&documentId?downloadDocumentVersion(client,scope,contractId,documentId,versionId):downloadContractPdfVersion(client,scope,versionId))};}
 catch{return {ok:false as const,error:'PDF sürümüne erişilemiyor veya dosya bulunamıyor.'};}
}

export async function appendicesAction(actorId:string,contractId:string,afterId:string|null=null){
 try{const {client,scope}=await context(actorId);return {ok:true as const,...await loadAppendices(client,scope,contractId,afterId)};}
 catch{return {ok:false as const,error:'Ek protokoller yüklenemedi. Yeniden deneyin.'};}
}
