'use server';
import {createServerSupabaseClient} from '@/lib/supabase/server';
import {loadRenewal,createRenewal} from '@/lib/services/contract-renewal';
import {loadTransferDirectory} from '@/lib/services/task-transfer';
import {renewalFailure,type RenewalCommand} from '@/lib/contract-renewal';
async function context(actorId:string,tenantId?:string){
  const client=await createServerSupabaseClient(12_000);
  const {data:{user},error}=await client.auth.getUser();if(error||!user||user.id!==actorId)throw Error('RENEWAL_SCOPE');
  const tenant=await client.rpc('current_user_verified_tenant');if(tenant.error)throw tenant.error;
  if(typeof tenant.data!=='string'||(tenantId!==undefined&&tenant.data!==tenantId))throw Error('RENEWAL_SCOPE');
  return {client,scope:{actorId:user.id,tenantId:tenant.data}};
}
export async function renewalLoadAction(actorId:string,contractId:string){
  try{const {client,scope}=await context(actorId);const snapshot=await loadRenewal(client,scope,contractId);
    const role=await client.rpc('current_user_role');if(role.error)throw role.error;
    const canCreate=role.data==='yonetici';
    const members=canCreate&&!snapshot.task?(await loadTransferDirectory(client,scope)).targets:[];
    return {ok:true as const,tenantId:scope.tenantId,snapshot,members,canCreate};
  }catch{return {ok:false as const,error:'Yenileme kaydı yüklenemedi. Bağlantınızı ve erişiminizi kontrol edip yeniden deneyin.'};}
}
export async function renewalCreateAction(actorId:string,tenantId:string,command:RenewalCommand){
  try{const {client,scope}=await context(actorId,tenantId);return {ok:true as const,result:await createRenewal(client,scope,command)};}
  catch(error){return {ok:false as const,...renewalFailure(error)};}
}
