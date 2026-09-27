'use server';
import {createServerSupabaseClient} from '@/lib/supabase/server';
import {loadTransferDirectory,loadTransferPreview,submitTransfer} from '@/lib/services/task-transfer';
import {transferFailure,transferId,type TransferCommand} from '@/lib/task-transfer';
async function context(expectedActor:string,expectedTenant?:string){
  const client=await createServerSupabaseClient(12_000);
  const {data:{user},error}=await client.auth.getUser();
  if(error||!user||user.id!==expectedActor)throw new Error('TRANSFER_SCOPE');
  const {data:tenant,error:tenantError}=await client.rpc('current_user_verified_tenant');
  if(tenantError)throw tenantError;
  if(typeof tenant!=='string'||(expectedTenant!==undefined&&expectedTenant!==tenant))throw new Error('TRANSFER_SCOPE');
  return {client,scope:{actorId:transferId(user.id),tenantId:transferId(tenant)}};
}
export async function transferDirectoryAction(actorId:string){
  try{const {client,scope}=await context(actorId);return {ok:true as const,tenantId:scope.tenantId,directory:await loadTransferDirectory(client,scope)};}
  catch{return {ok:false as const,error:'Devir listesi yüklenemedi. Yönetici yetkinizi ve bağlantınızı kontrol edin.'};}
}
export async function transferPreviewAction(actorId:string,tenantId:string,sourceId:string){
  try{const {client,scope}=await context(actorId,tenantId);return {ok:true as const,preview:await loadTransferPreview(client,scope,sourceId)};}
  catch{return {ok:false as const,error:'Önizleme alınamadı. Listeyi yenileyin; hiçbir görev devredilmedi.'};}
}
export async function transferSubmitAction(actorId:string,tenantId:string,command:TransferCommand){
  try{const {client,scope}=await context(actorId,tenantId);return {ok:true as const,result:await submitTransfer(client,scope,command)};}
  catch(error){return {ok:false as const,...transferFailure(error)};}
}
