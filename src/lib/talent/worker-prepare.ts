import {isUuid} from '@/lib/operations/pilot-validation';
export type WorkerPreparation={personId:string;commandId:string;expectedRevision:number;code:string;kind:'idp'|'sabit'};
export function validateWorkerPreparation(value:unknown):WorkerPreparation{
 if(!value||typeof value!=='object')throw Error('TALENT_VALIDATION');
 const v=value as WorkerPreparation;
 if(!isUuid(v.personId)||!isUuid(v.commandId)||!Number.isSafeInteger(v.expectedRevision)||v.expectedRevision<0||v.expectedRevision>=2147483647||typeof v.code!=='string'||!v.code.trim()||v.code.trim().length>40||/[\u0000-\u001f\u007f]/.test(v.code)||!['idp','sabit'].includes(v.kind))throw Error('TALENT_VALIDATION');
 return {personId:v.personId,commandId:v.commandId,expectedRevision:v.expectedRevision,code:v.code.trim(),kind:v.kind};
}
export function parseWorkerPreparation(value:unknown,input:WorkerPreparation){
 if(!value||typeof value!=='object')throw Error('TALENT_RESPONSE');
 const v=value as {id:string;commandId:string;revision:number;workerId:string};
 if(v.id!==input.personId||v.commandId!==input.commandId||v.revision!==input.expectedRevision+1||!isUuid(v.workerId))throw Error('TALENT_RESPONSE');
 return {id:v.id,commandId:v.commandId,revision:v.revision,workerId:v.workerId};
}
