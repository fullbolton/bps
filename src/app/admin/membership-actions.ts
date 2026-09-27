'use server';
import {createServerSupabaseClient} from '@/lib/supabase/server';
import {membershipCommandArgs,parseManagedMemberships,type MembershipCommand} from '@/lib/workspace-memberships';
import {parseWorkspaceAdminPage,verifyMembershipReceipt,workspaceAdminError} from '@/lib/workspace-admin';
import {isUuid} from '@/lib/operations/pilot-validation';
async function client(){
 if(process.env.NEXT_PUBLIC_BPS_MULTI_WORKSPACE_ENABLED!=='true')throw Error('DISABLED');
 const db=await createServerSupabaseClient();const {data,error}=await db.auth.getUser();if(error||!data.user)throw Error('AUTH');return db;
}
export async function workspaceAdminUsersAction(offset:number,query:string){
 try{
  if(!Number.isSafeInteger(offset)||offset<0||offset>1000000||typeof query!=='string'||query.length>160)throw Error('INPUT');
  const db=await client();const {data,error}=await db.rpc('admin_workspace_users',{p_offset:offset,p_query:query.trim()}).abortSignal(AbortSignal.timeout(12000));if(error)throw error;
  return {ok:true as const,data:parseWorkspaceAdminPage(data,offset,query)};
 }catch(e){return {ok:false as const,error:workspaceAdminError(e)};}
}
export async function workspaceAdminMembershipsAction(userId:string){
 try{
  if(!isUuid(userId))throw Error('INPUT');const db=await client();const {data,error}=await db.rpc('admin_user_memberships',{p_user_id:userId}).abortSignal(AbortSignal.timeout(12000));if(error)throw error;
  return {ok:true as const,data:parseManagedMemberships(data,userId)};
 }catch(e){return {ok:false as const,error:workspaceAdminError(e)};}
}
export async function workspaceAdminMutationAction(command:MembershipCommand){
 try{
  const args=membershipCommandArgs(command);const db=await client();const {data,error}=await db.rpc('admin_manage_membership',args).abortSignal(AbortSignal.timeout(12000));if(error)throw error;
  verifyMembershipReceipt(data,command);return {ok:true as const};
 }catch(e){return {ok:false as const,error:workspaceAdminError(e)};}
}

export async function workspaceAdminTenantsAction(){
 try{const db=await client();const {listTenants}=await import('@/lib/services/platform-admin');return {ok:true as const,data:await listTenants(db)};}
 catch{return {ok:false as const,error:'Şirket listesi doğrulanamadı. Yeniden deneyin.'};}
}
