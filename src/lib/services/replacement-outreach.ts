import {isUuid} from '@/lib/operations/pilot-validation';
import {parseOutreachLatest,parseOutreachSaved,validateOutreachInput} from '@/lib/operations/replacement-outreach';
import type {CommandScope} from '@/lib/operations/pending-commands';
// Narrow RPC port also permits tests without an authenticated network client.
export type OutreachClient={rpc:(name:string,args:Record<string,unknown>)=>PromiseLike<{data:unknown;error:unknown}>};
function scopeArgs(scope:CommandScope){
 if(!scope||!isUuid(scope.actorId)||!isUuid(scope.tenantId))throw Error('İşlem kapsamı doğrulanamadı.');
 return {p_actor_id:scope.actorId,p_tenant_id:scope.tenantId};
}
export async function loadOutreachLatest(client:OutreachClient,scope:CommandScope,assignmentId:string,workerId:string){
 const args=scopeArgs(scope);
 if(!isUuid(assignmentId)||!isUuid(workerId))throw Error('Personel veya atama geçersiz.');
 const {data,error}=await client.rpc('ops_replacement_outreach_latest',{...args,p_assignment_id:assignmentId,p_worker_id:workerId});
 if(error)throw error;
 return parseOutreachLatest(data,assignmentId,workerId);
}
export async function recordOutreach(client:OutreachClient,scope:CommandScope,commandId:string,value:unknown){
 const args=scopeArgs(scope),input=validateOutreachInput(value);
 if(!isUuid(commandId))throw Error('İşlem kimliği geçersiz.');
 const {data,error}=await client.rpc('ops_record_replacement_outreach',{...args,p_command_id:commandId,p_assignment_id:input.assignmentId,p_worker_id:input.workerId,p_expected_revision:input.expectedRevision,p_outcome:input.outcome,p_note:input.note});
 if(error)throw error;
 return parseOutreachSaved(data,commandId,input);
}
