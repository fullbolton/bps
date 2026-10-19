import type {SupabaseClient} from '@supabase/supabase-js';
import type {Database} from '@/types/database.types';
import {isUuid} from '@/lib/operations/pilot-validation';
const date=(x:unknown):x is string=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&x>='1900-01-01'&&x<='2199-12-31'&&!Number.isNaN(Date.parse(x))&&new Date(x).toISOString().slice(0,10)===x;
const revision=(x:unknown)=>typeof x==='string'&&/^[1-9][0-9]*$/.test(x);
type Assignment={id:string;startsOn:string;endsOn:string|null;revision:string};
function assignments(raw:unknown):Assignment[]{
 if(!Array.isArray(raw))throw Error('HR_EMPLOYMENT_CONTEXT');
 return raw.map(r=>{if(!r||!isUuid(r.id)||!date(r.startsOn)||(r.endsOn!==null&&(!date(r.endsOn)||r.endsOn<r.startsOn))||!revision(r.revision))throw Error('HR_EMPLOYMENT_CONTEXT');return {id:r.id,startsOn:r.startsOn,endsOn:r.endsOn,revision:r.revision};});
}
export function parseHrEmployment(raw:unknown,actor:string,tenant:string,employee:string){
 const r=raw as Record<string,unknown>|null;
 if(![actor,tenant,employee].every(isUuid)||!r||r.schemaVersion!==1||r.actorId!==actor||r.tenantId!==tenant||r.employeeId!==employee||!isUuid(r.periodId)||!date(r.startsOn)||(r.endsOn!==null&&(!date(r.endsOn)||r.endsOn<r.startsOn))||!revision(r.revision)||typeof r.token!=='string'||!/^[a-f0-9]{32}$/.test(r.token)||typeof r.linkedAccount!=='boolean'||!Array.isArray(r.reports))throw Error('HR_EMPLOYMENT_CONTEXT');
 const reports=r.reports.map(a=>{if(!a||!isUuid(a.id)||(a.endsOn!==null&&!date(a.endsOn))||!revision(a.revision))throw Error('HR_EMPLOYMENT_CONTEXT');return {id:a.id as string,endsOn:a.endsOn as string|null};});
 return {actorId:actor,tenantId:tenant,employeeId:employee,periodId:r.periodId,startsOn:r.startsOn,endsOn:r.endsOn as string|null,token:r.token,linkedAccount:r.linkedAccount,assignments:assignments(r.assignments),locations:assignments(r.locations),reports};
}
export async function loadHrEmployment(client:SupabaseClient<Database>,actor:string,tenant:string,employee:string){
 const {data,error}=await client.rpc('hr_employment_review_v1',{p_actor:actor,p_tenant:tenant,p_employee:employee}).abortSignal(AbortSignal.timeout(12000));if(error)throw error;return parseHrEmployment(data,actor,tenant,employee);
}
export function prepareHrEmployment(context:ReturnType<typeof parseHrEmployment>,command:string,kind:'end'|'rehire',effectiveDate:string){
 if(!isUuid(command)||!date(effectiveDate)||(kind!=='end'&&kind!=='rehire')||(kind==='end'&&(context.endsOn!==null||effectiveDate<context.startsOn))||(kind==='rehire'&&(context.endsOn===null||effectiveDate<=context.endsOn)))throw Error('HR_EMPLOYMENT_DATE');
 return Object.freeze({p_actor:context.actorId,p_tenant:context.tenantId,p_command:command,p_employee:context.employeeId,p_token:context.token,p_kind:kind,p_date:effectiveDate});
}
export async function saveHrEmployment(client:SupabaseClient<Database>,intent:ReturnType<typeof prepareHrEmployment>){
 const {data,error}=await client.rpc('hr_employment_change_v1',intent).abortSignal(AbortSignal.timeout(15000));if(error)throw error;
 const r=data as Record<string,unknown>|null;
 if(!r||r.schemaVersion!==1||r.actorId!==intent.p_actor||r.tenantId!==intent.p_tenant||r.commandId!==intent.p_command||r.employeeId!==intent.p_employee||r.kind!==intent.p_kind||r.date!==intent.p_date||!isUuid(r.periodId))throw Error('HR_RECEIPT');
 const before=parseHrEmployment(r.before,intent.p_actor,intent.p_tenant,intent.p_employee);
 if(before.token!==intent.p_token||(intent.p_kind==='end'&&r.periodId!==before.periodId)||(intent.p_kind==='rehire'&&r.periodId===before.periodId))throw Error('HR_RECEIPT');
}
