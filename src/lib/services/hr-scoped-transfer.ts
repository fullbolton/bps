/** Private candidate command contract; no client RPC binding before HR access cutover. */
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
