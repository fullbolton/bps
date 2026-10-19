import {parseAccessPolicy,type AccessPolicy} from '../access/policy';
import type {SupabaseClient} from '@supabase/supabase-js';
import type {Database} from '@/types/database.types';
type Option={id:string;name:string;closed:boolean};
export type AccessSettings={revision:number;roles:{id:string;name:string;archived:boolean;rules:AccessPolicy['rules']}[];assignments:{accountId:string;roleId:string;membershipId:string}[];people:{id:string;name:string;role:string;membershipId:string}[];departments:Option[];locations:Option[];history:{revision:number;createdAt:string}[]};
const uuid=(x:unknown):x is string=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(x);
const obj=(x:unknown):Record<string,unknown>=>{if(!x||typeof x!=='object'||Array.isArray(x))throw Error('ACCESS_SETTINGS_INVALID');return x as Record<string,unknown>;};
const array=(x:unknown,max:number)=>{if(!Array.isArray(x)||x.length>max)throw Error('ACCESS_SETTINGS_INVALID');return x.map(obj);};
const name=(x:unknown):string=>{if(typeof x!=='string'||!x.trim())throw Error('ACCESS_SETTINGS_INVALID');return x;};
const id=(x:unknown)=>{if(!uuid(x))throw Error('ACCESS_SETTINGS_INVALID');return x;};
const bool=(x:unknown)=>{if(typeof x!=='boolean')throw Error('ACCESS_SETTINGS_INVALID');return x;};
const unique=(items:{id:string}[])=>{if(new Set(items.map(x=>x.id)).size!==items.length)throw Error('ACCESS_SETTINGS_INVALID');};
export function parseAccessSettings(raw:unknown,choices:unknown,actor:string,tenant:string):AccessSettings {
 const s=obj(raw),o=obj(choices);
 if(!uuid(actor)||!uuid(tenant)||[s,o].some(x=>x.schemaVersion!==1||x.actorId!==actor||x.tenantId!==tenant)||s.enforcement!=='preview_only'||!Number.isSafeInteger(s.revision)||Number(s.revision)<1)throw Error('ACCESS_SETTINGS_SCOPE');
 const revision=s.revision as number;
 const roles=array(s.roles,250).map(r=>{if(r.tenant_id!==tenant)throw Error('ACCESS_SETTINGS_SCOPE');return {id:id(r.id),name:name(r.name),archived:bool(r.archived),rules:parseAccessPolicy({version:1,actorId:actor,tenantId:tenant,roleId:r.id,revision,rules:r.rules,exceptions:[]}).rules};});unique(roles);
 const assignments=array(s.assignments,1000).map(a=>{if(a.tenant_id!==tenant||!roles.some(r=>r.id===a.role_id))throw Error('ACCESS_SETTINGS_SCOPE');return {accountId:id(a.account_id),roleId:id(a.role_id),membershipId:id(a.membership_id)};});
 if(new Set(assignments.map(a=>a.accountId)).size!==assignments.length)throw Error('ACCESS_SETTINGS_INVALID');
 const people=array(o.people,1000).map(p=>({id:id(p.id),name:name(p.name),role:name(p.role),membershipId:id(p.membershipId)}));unique(people);
 const options=(raw:unknown)=>{const result=array(raw,1000).map(x=>({id:id(x.id),name:name(x.name),closed:bool(x.closed)}));unique(result);return result;};
 const history=array(s.recentHistory,20).map(h=>{if(h.tenant_id!==tenant||!Number.isSafeInteger(h.revision)||Number(h.revision)<2||Number(h.revision)>revision||typeof h.created_at!=='string'||!Number.isFinite(Date.parse(h.created_at)))throw Error('ACCESS_SETTINGS_INVALID');return {revision:h.revision as number,createdAt:h.created_at};});
 if(history.some((h,i)=>i>0&&h.revision>=history[i-1].revision))throw Error('ACCESS_SETTINGS_INVALID');
 return {revision,roles,assignments,people,departments:options(o.departments),locations:options(o.locations),history};
}
export async function loadAccessSettings(client:SupabaseClient<Database>,actor:string,tenant:string){
 const args={p_actor:actor,p_tenant:tenant};
 const [s,o]=await Promise.all([client.rpc('company_access_settings_v1',args).abortSignal(AbortSignal.timeout(12000)),client.rpc('company_access_options_v1',args).abortSignal(AbortSignal.timeout(12000))]);
 if(s.error)throw s.error;if(o.error)throw o.error;
 return parseAccessSettings(s.data,o.data,actor,tenant);
}
