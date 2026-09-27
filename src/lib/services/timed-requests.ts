import type {SupabaseClient} from '@supabase/supabase-js';
import type {Database} from '@/types/database.types';
import type {CommandScope} from '@/lib/operations/pending-commands';
import {isUuid} from '@/lib/operations/pilot-validation';
import {validateTimedRequests,parseTimedRequestReceipt} from '@/lib/operations/timed-requests';
/** Not wired to a page until the full shift migration and read paths are released together. */
export async function createTimedRequests(client:SupabaseClient<Database>,scope:CommandScope,commandId:string,value:unknown){
 if(!scope||!isUuid(scope.actorId)||!isUuid(scope.tenantId)||!isUuid(commandId))throw Error('OPS_SCOPE_CHANGED');
 const input=validateTimedRequests(value);
 const {data,error}=await client.rpc('ops_create_timed_requests',{p_actor_id:scope.actorId,p_tenant_id:scope.tenantId,p_command_id:commandId,p_payload:input}).abortSignal(AbortSignal.timeout(12000));
 if(error)throw error;
 return parseTimedRequestReceipt(data,scope.tenantId,commandId,input);
}
