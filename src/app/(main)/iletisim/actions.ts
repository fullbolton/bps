'use server';
import {createServerSupabaseClient} from '@/lib/supabase/server';
import type {SupabaseClient} from '@supabase/supabase-js';
import {sendRequestComment} from '@/lib/services/conversation';
import {validateCommentCommand,parseCommentResolution} from '@/lib/operations/conversation-command';
import {parsePeople,parseMessages,parseInbox} from '@/lib/operations/conversation-read';
import {isUuid} from '@/lib/operations/pilot-validation';
async function context(){
 if(process.env.NEXT_PUBLIC_BPS_CONVERSATION_ENABLED!=='true')throw Error('COMM_DISABLED');
 const client:SupabaseClient=await createServerSupabaseClient(12000);
 const auth=await client.auth.getUser();if(auth.error||!auth.data.user)throw Error('COMM_FORBIDDEN');
 const tenant=await client.rpc('current_user_verified_tenant');if(tenant.error||!isUuid(tenant.data))throw Error('COMM_FORBIDDEN');
 return {client,args:{p_actor_id:auth.data.user.id,p_tenant_id:tenant.data}};
}
function message(){return 'İşlem doğrulanamadı. Bağlantınızı ve erişiminizi kontrol edip yeniden deneyin.';}
export async function conversationLoad(requestId:string,before:string|null=null){
 try{if(!isUuid(requestId)||(before!==null&&!isUuid(before)))throw Error('COMM_INPUT');const {client,args}=await context();
 const [m,p]=await Promise.all([client.rpc('ops_comment_list',{...args,p_request_id:requestId,p_before:before}),client.rpc('ops_comment_people',{...args,p_request_id:requestId})]);
 if(m.error||p.error)throw Error('COMM_READ');return {ok:true as const,messages:parseMessages(m.data),people:parsePeople(p.data),actorId:args.p_actor_id,tenantId:args.p_tenant_id};
 }catch{return {ok:false as const,message:message()};}
}
export async function conversationSend(input:unknown){
 try{const c=validateCommentCommand(input);const {client,args}=await context();if(c.actorId!==args.p_actor_id||c.tenantId!==args.p_tenant_id)throw Error('COMM_SCOPE');return {ok:true as const,...await sendRequestComment(client,c)};}catch{return {ok:false as const,message:message()};}
}
export async function conversationInbox(before:string|null=null){
 try{if(before!==null&&!isUuid(before))throw Error('COMM_INPUT');const {client,args}=await context();const r=await client.rpc('ops_comment_inbox_page',{...args,p_before:before});if(r.error)throw r.error;return {ok:true as const,...parseInbox(r.data)};}catch{return {ok:false as const,message:message()};}
}
export async function conversationRead(messageId:string){
 try{if(!isUuid(messageId))throw Error('COMM_INPUT');const {client,args}=await context();const r=await client.rpc('ops_comment_read',{...args,p_message_id:messageId});if(r.error||r.data!==true)throw Error('COMM_READ');return {ok:true as const};}catch{return {ok:false as const,message:message()};}
}
export async function conversationResolve(input:unknown){
 try{const c=validateCommentCommand(input);const {client,args}=await context();if(c.actorId!==args.p_actor_id||c.tenantId!==args.p_tenant_id)throw Error('COMM_SCOPE');
 const r=await client.rpc('ops_comment_resolve',{...args,p_command_id:c.commandId,p_request_id:c.requestId,p_body:c.body,p_parent_id:c.parentId,p_mentions:c.mentionIds});if(r.error)throw r.error;
 return {ok:true as const,...parseCommentResolution(r.data,c)};
 }catch{return {ok:false as const,message:message()};}
}
