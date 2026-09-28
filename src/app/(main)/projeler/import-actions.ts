'use server';
import {projectContext,type ProjectScope} from '@/lib/project-reporting/server';
import {parseImportPeople,parseImportPreview,importError} from '@/lib/project-reporting/import-view';
import {isUuid} from '@/lib/operations/pilot-validation';
import type {ActualRow} from '@/lib/project-reporting/actual-preview';
import {requireSafePersonCode} from '@/lib/project-reporting/person-code';
const source='puantaj';
export async function importPeople(scope:ProjectScope,project:string,codes:string[],search:string){
 try{const {c,canWrite}=await projectContext(scope);if(!canWrite||!isUuid(project))throw Error('REPORT_FORBIDDEN');codes.forEach(requireSafePersonCode);const r=await c.rpc('reporting_import_people',{p_actor:scope.actorId,p_tenant:scope.tenantId,p_project:project,p_source:source,p_codes:codes,p_search:search});if(r.error)throw r.error;return {ok:true as const,data:parseImportPeople(r.data)};}catch(e){return {ok:false as const,message:importError(e)};}
}
export async function importMapPerson(scope:ProjectScope,project:string,revision:number,code:string,person:string){
 try{const {c,canWrite}=await projectContext(scope);if(!canWrite||!isUuid(project)||!isUuid(person))throw Error('REPORT_FORBIDDEN');requireSafePersonCode(code);const r=await c.rpc('reporting_person_code_set',{p_actor:scope.actorId,p_tenant:scope.tenantId,p_project:project,p_revision:revision,p_source:source,p_code:code,p_person:person});if(r.error)throw r.error;if(!Number.isInteger(r.data))throw Error('REPORT_RESPONSE');return {ok:true as const};}catch(e){return {ok:false as const,message:importError(e)};}
}
export async function importPrepare(scope:ProjectScope,project:string,command:string,month:string,rows:ActualRow[]){
 try{const {c,canWrite}=await projectContext(scope);if(!canWrite||!isUuid(project)||!isUuid(command))throw Error('REPORT_FORBIDDEN');rows.forEach(row=>requireSafePersonCode(row.personCode));const r=await c.rpc('reporting_import_prepare',{p_actor:scope.actorId,p_tenant:scope.tenantId,p_project:project,p_command:command,p_month:month,p_source:source,p_rows:rows.map(row=>({...row}))});if(r.error)return {ok:false as const,message:importError(r.error),rejected:['P0001','23505','23514','22007','22008','22P02'].includes(r.error.code)};const data=parseImportPreview(r.data);const expected=new Map(rows.map(row=>[row.sourceId,row]));if(data.rows.length!==rows.length||data.rows.some(row=>{const old=expected.get(row.sourceId);return !old||(['locationCode','personCode','day','slotCode','minutes'] as const).some(k=>old[k]!==row[k]);}))throw Error('REPORT_RESPONSE');return {ok:true as const,data};}catch(e){return {ok:false as const,message:importError(e),rejected:false};}
}
export async function importFinish(scope:ProjectScope,batch:string,approve:boolean){
 try{const {c,canWrite}=await projectContext(scope);if(!canWrite||!isUuid(batch))throw Error('REPORT_FORBIDDEN');const r=await c.rpc('reporting_import_finish',{p_actor:scope.actorId,p_tenant:scope.tenantId,p_batch:batch,p_approve:approve});if(r.error)throw r.error;if(r.data!==(approve?'approved':'cancelled'))throw Error('REPORT_RESPONSE');return {ok:true as const,status:r.data as 'approved'|'cancelled'};}catch(e){return {ok:false as const,message:importError(e)};}
}
