import type {SupabaseClient} from '@supabase/supabase-js';
import type {Database} from '@/types/database.types';
import {isUuid} from '@/lib/operations/pilot-validation';
import {parseHrCreateOptions,parseScopedHrReceipt,prepareScopedHrEmployee} from './hr-scoped-create';
export function parseHrScreen(raw:unknown,actor:string,tenant:string){
 if(!isUuid(actor)||!isUuid(tenant)||!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('HR_CONTEXT');
 const r=raw as Record<string,unknown>;
 if(r.schemaVersion!==1||r.actorId!==actor||r.tenantId!==tenant||(r.mode!=='legacy'&&r.mode!=='scoped')||typeof r.manager!=='boolean'||r.writeMode!==(r.mode==='legacy'||r.manager?'legacy':'scoped'))throw Error('HR_CONTEXT');
 return {mode:r.mode as 'legacy'|'scoped',manager:r.manager,writeMode:r.writeMode as 'legacy'|'scoped'};
}
export async function loadHrScreen(client:SupabaseClient<Database>,actor:string,tenant:string){
 const {data,error}=await client.rpc('hr_screen_context_v1',{p_actor:actor,p_tenant:tenant}).abortSignal(AbortSignal.timeout(12000));if(error)throw error;return parseHrScreen(data,actor,tenant);
}
export async function loadScopedHrOptions(client:SupabaseClient<Database>,actor:string,tenant:string,after?:string){
 const {data,error}=await client.rpc('hr_scoped_create_options_v1',{p_actor:actor,p_tenant:tenant,p_after:after}).abortSignal(AbortSignal.timeout(12000));if(error)throw error;return parseHrCreateOptions(data,actor,tenant);
}
export async function saveScopedHrEmployee(client:SupabaseClient<Database>,intent:ReturnType<typeof prepareScopedHrEmployee>){
 const {data,error}=await client.rpc('hr_scoped_employee_create_v1',intent).abortSignal(AbortSignal.timeout(15000));if(error)throw error;return parseScopedHrReceipt(data,intent);
}
