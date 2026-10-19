/** Candidate contracts. No RPC client binding until the coordinated HR access cutover. */
import {isUuid} from '@/lib/operations/pilot-validation';
const zero='00000000-0000-0000-0000-000000000000';
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const text=(v:unknown,max:number):v is string=>typeof v==='string'&&v.trim().length>0&&v.length<=max;
const date=(v:unknown):v is string=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&v>='1900-01-01'&&v<='2199-12-31'&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;
const revision=(v:unknown):v is number=>Number.isSafeInteger(v)&&Number(v)>0;
export type HrCreateOption={key:string;departmentId:string|null;departmentName:string|null;locationId:string|null;locationName:string|null};
export function parseHrCreateOptions(raw:unknown,actor:string,tenant:string){
 if(!isUuid(actor)||!isUuid(tenant)||!object(raw)||raw.schemaVersion!==1||raw.actorId!==actor||raw.tenantId!==tenant||!revision(raw.policyRevision)||!Array.isArray(raw.options)||raw.options.length>50||typeof raw.hasMore!=='boolean'||typeof raw.canCreateFuture!=='boolean')throw Error('HR_CREATE_OPTIONS');
 let last='';
 const options=raw.options.map(row=>{
  if(!object(row))throw Error('HR_CREATE_OPTION');
  for(const [id,name] of [['departmentId','departmentName'],['locationId','locationName']]){
   if(row[id]===null?row[name]!==null:!isUuid(row[id])||row[id]===zero||!text(row[name],120))throw Error('HR_CREATE_OPTION');
  }
  const key=`${row.departmentId??zero}:${row.locationId??zero}`;
  if(row.key!==key||key<=last)throw Error('HR_CREATE_ORDER');last=key;
  return {key,departmentId:row.departmentId,departmentName:row.departmentName,locationId:row.locationId,locationName:row.locationName} as HrCreateOption;
 });
 if(raw.hasMore&&options.length!==50)throw Error('HR_CREATE_PAGE');
 return {actorId:actor,tenantId:tenant,policyRevision:raw.policyRevision,options,hasMore:raw.hasMore,canCreateFuture:raw.canCreateFuture};
}
/** The page carries a company revision; do not combine choices from different revisions. */
export function mergeHrCreateOptions(first:ReturnType<typeof parseHrCreateOptions>,next:ReturnType<typeof parseHrCreateOptions>){
 if(first.actorId!==next.actorId||first.tenantId!==next.tenantId||first.policyRevision!==next.policyRevision||first.canCreateFuture!==next.canCreateFuture)throw Error('HR_OPTIONS_CHANGED');
 if(!first.hasMore||!first.options.length||(next.options.length>0&&next.options[0].key<=first.options.at(-1)!.key))throw Error('HR_CREATE_ORDER');
 return {...next,options:[...first.options,...next.options]};
}
export function prepareScopedHrEmployee(actor:string,tenant:string,command:string,policyRevision:number,payload:{name:string;code:string;startsOn:string;departmentId?:string;position?:string;locationId?:string}){
 if(![actor,tenant,command].every(isUuid)||!revision(policyRevision)||!object(payload)||Object.keys(payload).some(k=>!['name','code','startsOn','departmentId','position','locationId'].includes(k))||!text(payload.name,160)||!text(payload.code,40)||!date(payload.startsOn))throw Error('HR_INPUT');
 if(payload.departmentId!==undefined?(!isUuid(payload.departmentId)||!text(payload.position,120)):payload.position!==undefined)throw Error('HR_INPUT');
 if(payload.locationId!==undefined&&!isUuid(payload.locationId))throw Error('HR_INPUT');
 return Object.freeze({p_actor:actor,p_tenant:tenant,p_command:command,p_revision:policyRevision,p_payload:Object.freeze({...payload})});
}
export function parseScopedHrReceipt(raw:unknown,intent:ReturnType<typeof prepareScopedHrEmployee>){
 if(!object(raw)||raw.schemaVersion!==1||raw.actorId!==intent.p_actor||raw.tenantId!==intent.p_tenant||raw.commandId!==intent.p_command||raw.kind!=='employee'||!isUuid(raw.id))throw Error('HR_RECEIPT');
 return raw.id;
}
