import type {SupabaseClient} from '@supabase/supabase-js';
import type {Database} from '@/types/database.types';
import type {RenewalCommand} from '@/lib/contract-renewal';
export interface RenewalScope {actorId:string;tenantId:string}
type Client=SupabaseClient<Database>;
export async function readRenewal(client:Client,scope:RenewalScope,contractId:string){
  const {data,error}=await client.rpc('contract_renewal_snapshot',{p_actor_id:scope.actorId,p_tenant_id:scope.tenantId,p_contract_id:contractId});if(error)throw error;return data;
}
export async function writeRenewal(client:Client,scope:RenewalScope,c:RenewalCommand){
  const {data,error}=await client.rpc('create_contract_renewal_task',{p_actor_id:scope.actorId,p_tenant_id:scope.tenantId,p_contract_id:c.contractId,p_command_id:c.commandId,p_revision:c.revision,p_assignee_id:c.assigneeId,p_due_date:c.dueDate,p_basis:c.basis});if(error)throw error;return data;
}
