'use server';
import {projectContext,type ProjectScope} from '@/lib/project-reporting/server';
import {isUuid} from '@/lib/operations/pilot-validation';
import {reportError} from '@/lib/project-reporting/view';
import type {Json} from '@/types/database.types';
export async function saveProject(scope:ProjectScope,command:string,input:Record<string,Json>){
 try{
  if(!isUuid(command))throw Error('REPORT_INPUT');
  const {c,canWrite}=await projectContext(scope);if(!canWrite)throw Error('REPORT_FORBIDDEN');
  const result=await c.rpc('reporting_project_execute',{p_actor:scope.actorId,p_tenant:scope.tenantId,p_command:command,p_input:input});
  if(result.error){
   const rejected=['23505','23514','22P02','22007','22008','P0001','42501'].includes(result.error.code);
   return {ok:false as const,message:reportError(result.error),rejected};
  }
  const r=result.data as {commandId?:unknown;projectId?:unknown;revision?:unknown;action?:unknown}|null;
  if(!r||r.commandId!==command||!isUuid(r.projectId)||!Number.isInteger(r.revision)||Number(r.revision)<1||r.action!==input.action)throw Error('REPORT_RESPONSE');
  return {ok:true as const,id:r.projectId};
 }catch(e){return {ok:false as const,message:reportError(e)};}
}
