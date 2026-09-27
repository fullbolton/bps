import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';
import type { TransferCommand } from '@/lib/task-transfer';
type Client=SupabaseClient<Database>;
export interface TransferScope { actorId:string;tenantId:string }
export async function readTransferDirectory(client:Client,scope:TransferScope) {
  const {data,error}=await client.rpc('task_transfer_directory',{p_actor_id:scope.actorId,p_tenant_id:scope.tenantId});
  if(error)throw error;return data;
}
export async function readTransferPreview(client:Client,scope:TransferScope,sourceId:string) {
  const {data,error}=await client.rpc('preview_task_transfer',{p_actor_id:scope.actorId,p_tenant_id:scope.tenantId,p_source_id:sourceId});
  if(error)throw error;return data;
}
export async function writeTransfer(client:Client,scope:TransferScope,command:TransferCommand) {
  const {data,error}=await client.rpc('transfer_tasks_scoped',{p_actor_id:scope.actorId,p_tenant_id:scope.tenantId,p_command_id:command.commandId,p_source_id:command.sourceId,p_target_id:command.targetId,p_tasks:command.tasks});
  if(error)throw error;return data;
}
