import {isWorkDate} from '@/lib/operations/daily-demand';
import {isUuid} from '@/lib/operations/pilot-validation';
import {validateWorkAction,parseWorkRecord,parseWorkReceipt,parseWorkList,type WorkAction} from '@/lib/operations/work-approval';
import type {CommandScope} from '@/lib/operations/pending-commands';
import type {OutreachClient} from './replacement-outreach';
function args(scope:CommandScope,assignmentId:string){if(!scope||!isUuid(scope.actorId)||!isUuid(scope.tenantId)||!isUuid(assignmentId))throw Error('Çalışma kapsamı geçersiz.');return {p_actor_id:scope.actorId,p_tenant_id:scope.tenantId,p_assignment_id:assignmentId};}
export async function loadWorkRecord(client:OutreachClient,scope:CommandScope,assignmentId:string){const {data,error}=await client.rpc('ops_work_record_read',args(scope,assignmentId));if(error)throw error;return parseWorkRecord(data,assignmentId);}
export async function executeWorkRecord(client:OutreachClient,scope:CommandScope,commandId:string,assignmentId:string,revision:number,action:WorkAction,payload:unknown){
 const identity=args(scope,assignmentId),clean=validateWorkAction(action,payload);
 if(!isUuid(commandId)||!Number.isSafeInteger(revision)||revision<0||revision>2147483646)throw Error('Çalışma sürümü veya işlem kimliği geçersiz.');
 const {data,error}=await client.rpc('ops_work_record_execute',{...identity,p_command_id:commandId,p_expected_revision:revision,p_action:action,p_payload:clean});
 if(error)throw error;return parseWorkReceipt(data,commandId,assignmentId,revision,action);
}

export async function loadWorkList(client:OutreachClient,scope:CommandScope,companyId:string,workDate:string){
 args(scope,companyId);if(!isWorkDate(workDate)||workDate<'2000-01-01'||workDate>'2100-12-31')throw Error('Çalışma günü geçersiz.');
 const {data,error}=await client.rpc('ops_work_record_list',{p_actor_id:scope.actorId,p_tenant_id:scope.tenantId,p_company_id:companyId,p_work_date:workDate});
 if(error)throw error;return parseWorkList(data,companyId,workDate);
}
