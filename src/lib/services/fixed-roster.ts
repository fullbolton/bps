import type {SupabaseClient} from '@supabase/supabase-js';
import type {Database} from '@/types/database.types';
import type {CommandScope} from '@/lib/operations/pending-commands';
import {isUuid} from '@/lib/operations/pilot-validation';
import {validateFixedRosterInput,validateFixedRosterQuery,parseFixedRosterReceipt,parseFixedRosterPage} from '@/lib/operations/fixed-roster';
function checkScope(scope:CommandScope){
  if(!scope||!isUuid(scope.actorId)||!isUuid(scope.tenantId))throw Error('OPS_SCOPE_CHANGED');
}
export async function saveFixedRoster(client:SupabaseClient<Database>,scope:CommandScope,commandId:string,value:unknown){
  checkScope(scope);
  if(!isUuid(commandId))throw Error('OPS_VALIDATION');
  const p=validateFixedRosterInput(value);
  const {data,error}=await client.rpc('ops_fixed_roster_save',{
    p_actor_id:scope.actorId,p_tenant_id:scope.tenantId,p_command_id:commandId,p_id:p.id,p_expected_revision:p.expectedRevision,
    p_company_id:p.companyId,p_location_id:p.locationId,p_worker_id:p.workerId,p_service_line:p.serviceLine,
    p_position:p.position,p_starts_on:p.startsOn,p_ends_on:p.endsOn,p_reason:p.reason,p_cancelled:p.cancelled===true,
  }).abortSignal(AbortSignal.timeout(12000));
  if(error)throw error;
  return parseFixedRosterReceipt(data,scope.tenantId,scope.actorId,commandId,p);
}
export async function loadFixedRoster(client:SupabaseClient<Database>,scope:CommandScope,value:unknown){
  checkScope(scope);
  const q=validateFixedRosterQuery(value);
  const {data,error}=await client.rpc('ops_fixed_roster_list',{
    p_actor_id:scope.actorId,p_tenant_id:scope.tenantId,p_company_id:q.companyId,p_location_id:q.locationId,p_day:q.day,p_offset:q.offset,p_history:q.history===true,
  }).abortSignal(AbortSignal.timeout(12000));
  if(error)throw error;
  return parseFixedRosterPage(data,scope.tenantId,q);
}

export async function createRosterLeave(client:SupabaseClient<Database>,scope:CommandScope,commandId:string,value:unknown){
  checkScope(scope);if(!isUuid(commandId))throw Error('OPS_VALIDATION');
  const {validateRosterLeave}=await import('@/lib/operations/fixed-roster');
  const {parseBatchResult}=await import('@/lib/operations/request-batch');
  const p=validateRosterLeave(value);
  const {data,error}=await client.rpc('ops_fixed_roster_idp_create',{p_actor_id:scope.actorId,p_tenant_id:scope.tenantId,p_command_id:commandId,p_roster_id:p.rosterId,p_expected_revision:p.expectedRevision,p_start:p.start,p_end:p.end,p_dates:p.dates}).abortSignal(AbortSignal.timeout(12000));
  if(error)throw error;
  if(!data||typeof data!=='object'||Array.isArray(data)||!isUuid(data.periodId))throw Error('İDP sonucu doğrulanamadı.');
  return {...parseBatchResult(commandId,p.dates.length,data),periodId:data.periodId};
}
export async function loadRosterHistory(client:SupabaseClient<Database>,scope:CommandScope,id:string,offset:number){
  checkScope(scope);if(!isUuid(id)||!Number.isInteger(offset)||offset<0||offset>100000)throw Error('OPS_VALIDATION');
  const {parseRosterHistory}=await import('@/lib/operations/fixed-roster');
  const {data,error}=await client.rpc('ops_fixed_roster_history',{p_actor_id:scope.actorId,p_tenant_id:scope.tenantId,p_id:id,p_offset:offset}).abortSignal(AbortSignal.timeout(12000));
  if(error)throw error;return parseRosterHistory(data,scope.tenantId,id);
}
