import type {SupabaseClient} from '@supabase/supabase-js';
import type {Database} from '@/types/database.types';
import {isUuid} from '@/lib/operations/pilot-validation';
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const count=(v:unknown):v is number=>Number.isSafeInteger(v)&&Number(v)>=0;
export function parseHrActivation(raw:unknown,actor:string,tenant:string){
 if(!isUuid(actor)||!isUuid(tenant)||!object(raw)||raw.schemaVersion!==1||raw.actorId!==actor||raw.tenantId!==tenant||!['legacy','scoped'].includes(String(raw.mode))||!count(raw.modeRevision)||!count(raw.policyRevision)||raw.policyRevision<1||!count(raw.missingHrPolicies)||typeof raw.releaseApproved!=='boolean'||typeof raw.moduleOpen!=='boolean'||typeof raw.canActivate!=='boolean'||typeof raw.token!=='string'||!/^[a-f0-9]{32}$/.test(raw.token)||!Array.isArray(raw.members)||raw.members.length>1000)throw Error('HR_ACTIVATION_INVALID');
 const members=raw.members.map(m=>{if(!object(m)||!isUuid(m.accountId)||!isUuid(m.membershipId)||!isUuid(m.membershipVersion)||typeof m.name!=='string'||!m.name.trim()||typeof m.role!=='string'||!m.role||typeof m.policyAssigned!=='boolean'||typeof m.permanentReadRule!=='boolean'||(!m.policyAssigned&&m.permanentReadRule))throw Error('HR_ACTIVATION_MEMBER');return {accountId:m.accountId,membershipId:m.membershipId,name:m.name,role:m.role,policyAssigned:m.policyAssigned,permanentReadRule:m.permanentReadRule};});
 if(!members.some(m=>m.accountId===actor&&m.role==='yonetici')||(raw.mode==='scoped'&&raw.modeRevision<1)||new Set(members.map(m=>m.accountId)).size!==members.length||new Set(members.map(m=>m.membershipId)).size!==members.length||members.filter(m=>m.role==='ik'&&(!m.policyAssigned||!m.permanentReadRule)).length!==raw.missingHrPolicies||raw.canActivate!==(raw.mode==='legacy'&&raw.releaseApproved&&raw.moduleOpen&&raw.missingHrPolicies===0))throw Error('HR_ACTIVATION_INCONSISTENT');
 return {mode:raw.mode as 'legacy'|'scoped',modeRevision:raw.modeRevision,policyRevision:raw.policyRevision,releaseApproved:raw.releaseApproved,moduleOpen:raw.moduleOpen,missingHrPolicies:raw.missingHrPolicies,canActivate:raw.canActivate,token:raw.token,members};
}
export function prepareHrActivation(actor:string,tenant:string,command:string,preflight:ReturnType<typeof parseHrActivation>){
 if(![actor,tenant,command].every(isUuid)||!preflight.canActivate||!/^[a-f0-9]{32}$/.test(preflight.token))throw Error('HR_ACTIVATION_BLOCKED');
 return Object.freeze({p_actor:actor,p_tenant:tenant,p_command:command,p_token:preflight.token});
}
export function parseHrActivationReceipt(raw:unknown,intent:ReturnType<typeof prepareHrActivation>){
 if(!object(raw)||raw.schemaVersion!==1||raw.actorId!==intent.p_actor||raw.tenantId!==intent.p_tenant||raw.commandId!==intent.p_command||raw.mode!=='scoped')throw Error('HR_ACTIVATION_RECEIPT');
 const before=parseHrActivation(raw.preflight,intent.p_actor,intent.p_tenant);
 if(!before.canActivate||before.token!==intent.p_token||raw.modeRevision!==before.modeRevision+1||raw.policyRevision!==before.policyRevision)throw Error('HR_ACTIVATION_RECEIPT');
 return {mode:'scoped' as const,modeRevision:raw.modeRevision,policyRevision:raw.policyRevision};
}
export async function loadHrActivation(client:SupabaseClient<Database>,actor:string,tenant:string){const {data,error}=await client.rpc('hr_access_activation_preflight_v1',{p_actor:actor,p_tenant:tenant}).abortSignal(AbortSignal.timeout(12000));if(error)throw error;return parseHrActivation(data,actor,tenant);}
export async function saveHrActivation(client:SupabaseClient<Database>,intent:ReturnType<typeof prepareHrActivation>){const {data,error}=await client.rpc('hr_access_activate_v1',intent).abortSignal(AbortSignal.timeout(15000));if(error)throw error;return parseHrActivationReceipt(data,intent);}
