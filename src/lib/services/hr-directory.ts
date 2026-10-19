import type {SupabaseClient} from '@supabase/supabase-js';
import type {Database} from '@/types/database.types';
import {isUuid} from '@/lib/operations/pilot-validation';
export type HrPayload={kind:'department';name:string}|{kind:'employee';name:string;code:string;startsOn:string;departmentId?:string;position?:string};
export type HrEmployee={id:string;code:string;name:string;startsOn:string;endsOn:string|null;department:string|null;position:string|null};
const object=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value);
const text=(value:unknown,max:number):value is string=>typeof value==='string'&&value.trim().length>0&&value.length<=max;
const date=(value:unknown):value is string=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;
export function parseHrDirectory(value:unknown,actor:string,tenant:string){
 if(!isUuid(actor)||!isUuid(tenant)||!object(value)||value.schemaVersion!==1||value.actorId!==actor||value.tenantId!==tenant||!Array.isArray(value.employees)||value.employees.length>50||!Array.isArray(value.departments)||value.departments.length>1000||typeof value.hasMore!=='boolean')throw Error('HR_RESPONSE');
 const seen=new Set<string>();
 const employees=value.employees.map(row=>{
  if(!object(row)||!isUuid(row.id)||seen.has(row.id)||!text(row.name,160)||!text(row.code,40)||!date(row.startsOn)||(row.endsOn!==null&&(!date(row.endsOn)||row.endsOn<row.startsOn))||(row.department!==null&&!text(row.department,120))||(row.position!==null&&!text(row.position,120)))throw Error('HR_ROW');
  seen.add(row.id);return row as HrEmployee;
 });
 const departmentIds=new Set<string>();
 const departments=value.departments.map(row=>{if(!object(row)||!isUuid(row.id)||departmentIds.has(row.id)||!text(row.name,120))throw Error('HR_DEPARTMENT');departmentIds.add(row.id);return {id:row.id,name:row.name};});
 if(value.hasMore&&employees.length!==50)throw Error('HR_PAGE');
 return {employees,departments,hasMore:value.hasMore};
}
export async function loadHrDirectory(client:SupabaseClient<Database>,actor:string,tenant:string,after:string|null){
 const {data,error}=await client.rpc('hr_directory_v1',{p_actor:actor,p_tenant:tenant,p_after:after??undefined}).abortSignal(AbortSignal.timeout(12000));
 if(error)throw error;return parseHrDirectory(data,actor,tenant);
}
export function prepareHrRecord(actor:string,tenant:string,command:string,payload:HrPayload){
 if(![actor,tenant,command].every(isUuid)||!text(payload.name,payload.kind==='department'?120:160))throw Error('HR_INPUT');
 if(payload.kind==='employee'&&(!text(payload.code,40)||!date(payload.startsOn)||(payload.departmentId!==undefined&&(!isUuid(payload.departmentId)||!text(payload.position,120)))))throw Error('HR_INPUT');
 return Object.freeze({p_actor:actor,p_tenant:tenant,p_command:command,p_payload:Object.freeze({...payload})});
}
export async function saveHrRecord(client:SupabaseClient<Database>,intent:ReturnType<typeof prepareHrRecord>){
 const {data,error}=await client.rpc('hr_create_record_v1',intent).abortSignal(AbortSignal.timeout(15000));
 if(error)throw error;
 if(!object(data)||data.schemaVersion!==1||data.actorId!==intent.p_actor||data.tenantId!==intent.p_tenant||data.commandId!==intent.p_command||data.kind!==intent.p_payload.kind||!isUuid(data.id))throw Error('HR_RECEIPT');
 return data.id;
}
