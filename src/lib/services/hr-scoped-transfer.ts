/** Strict transfer contracts; public RPC routes require the company scoped HR access mode. */
import {isUuid} from '@/lib/operations/pilot-validation';
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const revision=(v:unknown):v is number=>Number.isSafeInteger(v)&&Number(v)>0;
export function prepareHrLocationTransfer(actor:string,tenant:string,command:string,policyRevision:number,payload:{assignmentId:string;expectedRevision:number;locationId:string}){
 if(![actor,tenant,command].every(isUuid)||!revision(policyRevision)||!object(payload)||Object.keys(payload).length!==3||!isUuid(payload.assignmentId)||!isUuid(payload.locationId)||!revision(payload.expectedRevision))throw Error('HR_INPUT');
 return Object.freeze({p_actor:actor,p_tenant:tenant,p_command:command,p_revision:policyRevision,p_payload:Object.freeze({...payload})});
}
export function parseHrLocationTransferReceipt(raw:unknown,intent:ReturnType<typeof prepareHrLocationTransfer>,employee:string){
 if(!isUuid(employee)||!object(raw)||raw.schemaVersion!==1||raw.actorId!==intent.p_actor||raw.tenantId!==intent.p_tenant||raw.commandId!==intent.p_command||raw.kind!=='transfer_location'||raw.previousId!==intent.p_payload.assignmentId||raw.employeeId!==employee||!isUuid(raw.id)||raw.id===raw.previousId||raw.revision!==1||typeof raw.startsOn!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(raw.startsOn)||!Number.isFinite(Date.parse(raw.startsOn))||new Date(raw.startsOn).toISOString().slice(0,10)!==raw.startsOn)throw Error('HR_RECEIPT');
 return {id:raw.id,previousId:raw.previousId as string,employeeId:employee,startsOn:raw.startsOn,revision:1};
}
export function parseHrTransferOptions(raw:unknown,actor:string,tenant:string,employee:string){
 if(![actor,tenant,employee].every(isUuid)||!object(raw)||raw.schemaVersion!==1||raw.actorId!==actor||raw.tenantId!==tenant||raw.employeeId!==employee||!revision(raw.policyRevision)||!revision(raw.assignmentRevision)||!isUuid(raw.assignmentId)||!isUuid(raw.sourceLocationId)||typeof raw.sourceLocationName!=='string'||!raw.sourceLocationName.trim()||typeof raw.effectiveOn!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(raw.effectiveOn)||!Number.isFinite(Date.parse(raw.effectiveOn))||new Date(raw.effectiveOn).toISOString().slice(0,10)!==raw.effectiveOn||!Array.isArray(raw.locations)||raw.locations.length>50||typeof raw.hasMore!=='boolean')throw Error('HR_TRANSFER_OPTIONS');
 let last='';const locations=raw.locations.map(x=>{if(!object(x)||!isUuid(x.id)||x.id===raw.sourceLocationId||x.id<=last||typeof x.name!=='string'||!x.name.trim()||x.name.length>120)throw Error('HR_TRANSFER_OPTION');last=x.id;return {id:x.id,name:x.name};});
 if(raw.hasMore&&locations.length!==50)throw Error('HR_TRANSFER_PAGE');
 return {actorId:actor,tenantId:tenant,employeeId:employee,policyRevision:raw.policyRevision,assignmentId:raw.assignmentId,assignmentRevision:raw.assignmentRevision,sourceLocationId:raw.sourceLocationId,sourceLocationName:raw.sourceLocationName,effectiveOn:raw.effectiveOn,locations,hasMore:raw.hasMore};
}
export function mergeHrTransferOptions(first:ReturnType<typeof parseHrTransferOptions>,next:ReturnType<typeof parseHrTransferOptions>){
 for(const key of ['actorId','tenantId','employeeId','policyRevision','assignmentId','assignmentRevision','sourceLocationId','sourceLocationName','effectiveOn'] as const)if(first[key]!==next[key])throw Error('HR_TRANSFER_CHANGED');
 if(!first.hasMore||!first.locations.length||(next.locations.length&&next.locations[0].id<=first.locations.at(-1)!.id))throw Error('HR_TRANSFER_PAGE');
 return {...next,locations:[...first.locations,...next.locations]};
}
