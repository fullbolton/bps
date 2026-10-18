'use server';
import {createServerSupabaseClient} from '@/lib/supabase/server';
import {assertInboxScope,inboxScopeKey,type InboxScope} from '@/lib/notifications/inbox-state';
import {parseInboxCursor,parseWorkspaceInbox} from '@/lib/notifications/workspace-inbox';
import {isUuid} from '@/lib/operations/pilot-validation';

async function context(expected:InboxScope){
 if(process.env.NEXT_PUBLIC_BPS_WORKSPACE_INBOX_ENABLED!=='true')throw Error('INBOX_DISABLED');
 inboxScopeKey(expected);
 const client=await createServerSupabaseClient(12000);
 const auth=await client.auth.getUser();
 if(auth.error||!auth.data.user)throw Error('INBOX_AUTH');
 const tenant=await client.rpc('current_user_verified_tenant');
 if(tenant.error||!isUuid(tenant.data))throw Error('INBOX_SCOPE');
 const scope={actorId:auth.data.user.id,tenantId:tenant.data};
 assertInboxScope(scope,expected);
 return {client,scope,args:{p_actor:scope.actorId,p_tenant:scope.tenantId}};
}
const failure=()=>({ok:false as const,message:'Bildirim işlemi doğrulanamadı. Şirketinizi ve bağlantınızı kontrol edip yeniden deneyin.'});
export async function workspaceInbox(expected:InboxScope,before:unknown=null){
 try{
  const cursor=parseInboxCursor(before);
  const {client,scope,args}=await context(expected);
  const result=await client.rpc('workspace_inbox_page_v1',{...args,p_before_kind:cursor?.kind??null,p_before_id:cursor?.id??null});
  if(result.error)throw result.error;
  return {ok:true as const,...parseWorkspaceInbox(result.data,scope)};
 }catch{return failure();}
}
export async function workspaceInboxRead(expected:InboxScope,event:unknown){
 try{
  const cursor=parseInboxCursor(event);if(!cursor)throw Error('INBOX_INPUT');
  const {client,scope,args}=await context(expected);
  const result=await client.rpc('workspace_inbox_read_v1',{...args,p_kind:cursor.kind,p_id:cursor.id});
  if(result.error||result.data!==true)throw Error('INBOX_READ');
  return {ok:true as const,...scope};
 }catch{return failure();}
}
