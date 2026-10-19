import type {SupabaseClient} from '@supabase/supabase-js';
import type {Database} from '@/types/database.types';
import {isUuid} from '@/lib/operations/pilot-validation';
const revision=(x:unknown):x is string=>typeof x==='string'&&/^[1-9][0-9]*$/.test(x);
const text=(x:unknown,max:number):x is string=>typeof x==='string'&&x.trim().length>0&&x.length<=max;
export function parseHrEdit(raw:unknown,actor:string,tenant:string,employee:string){
 const r=raw as Record<string,unknown>|null;
 if(![actor,tenant,employee].every(isUuid)||!r||r.schemaVersion!==1||r.actorId!==actor||r.tenantId!==tenant||r.employeeId!==employee||!text(r.name,160)||!text(r.code,40)||typeof r.nameEditable!=='boolean'||!revision(r.employeeRevision)||!revision(r.personRevision)||!revision(r.policyRevision)||(r.mode!=='legacy'&&r.mode!=='scoped'))throw Error('HR_EDIT_CONTEXT');
 return {employeeId:employee,name:r.name,code:r.code,nameEditable:r.nameEditable,employeeRevision:r.employeeRevision,personRevision:r.personRevision,policyRevision:r.policyRevision,mode:r.mode};
}
export async function loadHrEdit(client:SupabaseClient<Database>,actor:string,tenant:string,employee:string){
 const {data,error}=await client.rpc('hr_employee_edit_context_v1',{p_actor:actor,p_tenant:tenant,p_employee:employee}).abortSignal(AbortSignal.timeout(12000));if(error)throw error;return parseHrEdit(data,actor,tenant,employee);
}
export function prepareHrEdit(actor:string,tenant:string,command:string,context:ReturnType<typeof parseHrEdit>,name:string,code:string){
 name=name.trim();code=code.trim();
 if(![actor,tenant,command,context.employeeId].every(isUuid)||!text(name,160)||!text(code,40)||/[0-9]{11}/.test(name+code)||(!context.nameEditable&&name!==context.name))throw Error('HR_INPUT');
 return Object.freeze({p_actor:actor,p_tenant:tenant,p_command:command,p_payload:Object.freeze({employeeId:context.employeeId,employeeRevision:context.employeeRevision,personRevision:context.personRevision,policyRevision:context.policyRevision,mode:context.mode,name,code})});
}
export async function saveHrEdit(client:SupabaseClient<Database>,intent:ReturnType<typeof prepareHrEdit>){
 const {data,error}=await client.rpc('hr_employee_edit_v1',intent).abortSignal(AbortSignal.timeout(15000));if(error)throw error;
 const r=data as Record<string,unknown>|null;
 if(!r||r.schemaVersion!==1||r.actorId!==intent.p_actor||r.tenantId!==intent.p_tenant||r.commandId!==intent.p_command||r.employeeId!==intent.p_payload.employeeId||r.code!==intent.p_payload.code||r.name!==intent.p_payload.name)throw Error('HR_RECEIPT');
}
