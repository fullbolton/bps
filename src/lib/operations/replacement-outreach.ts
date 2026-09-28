import {requireOperationalText} from '@/lib/privacy/operational-text';
import {isUuid} from './pilot-validation';
export const outreachLabels={unreachable:'Ulaşılamadı',considering:'Değerlendiriyor',declined:'Reddetti',accepted:'Kabul etti · yerleştirilmedi',withdrawn:'Kabulden vazgeçti'} as const;
export type OutreachOutcome=keyof typeof outreachLabels;
export type OutreachInput={assignmentId:string;workerId:string;expectedRevision:number;outcome:OutreachOutcome;note:string};
export type OutreachLatest={revision:number;outcome:OutreachOutcome;note:string;recordedAt:string;actorId:string};
const object=(value:unknown):Record<string,unknown>=>{if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Görüşme verisi doğrulanamadı.');return value as Record<string,unknown>;};
const validOutcome=(v:unknown):v is OutreachOutcome=>typeof v==='string'&&Object.hasOwn(outreachLabels,v);
export function validateOutreachInput(value:unknown):OutreachInput{
 const v=object(value);
 if(!isUuid(v.assignmentId)||!isUuid(v.workerId)||!Number.isSafeInteger(v.expectedRevision)||Number(v.expectedRevision)<0||Number(v.expectedRevision)>2147483646||!validOutcome(v.outcome)||typeof v.note!=='string'||v.note.length>1000)throw Error('Görüşme alanları geçersiz.');
 requireOperationalText(v.note);
 return {assignmentId:v.assignmentId,workerId:v.workerId,expectedRevision:v.expectedRevision as number,outcome:v.outcome,note:v.note};
}
export function parseOutreachLatest(value:unknown,assignmentId:string,workerId:string):OutreachLatest|null{
 const v=object(value);
 if(v.assignmentId!==assignmentId||v.workerId!==workerId||!Object.hasOwn(v,'latest'))throw Error('Görüşme kapsamı doğrulanamadı.');
 if(v.latest===null)return null;
 const row=object(v.latest);
 if(!Number.isSafeInteger(row.revision)||Number(row.revision)<1||Number(row.revision)>2147483647||!validOutcome(row.outcome)||typeof row.note!=='string'||row.note.length>1000||typeof row.recordedAt!=='string'||!Number.isFinite(Date.parse(row.recordedAt))||!isUuid(row.actorId))throw Error('Güncel görüşme doğrulanamadı.');
 return row as OutreachLatest;
}
export function parseOutreachSaved(value:unknown,commandId:string,input:OutreachInput){
 const v=object(value);
 if(v.commandId!==commandId||v.revision!==input.expectedRevision+1||v.outcome!==input.outcome)throw Error('Görüşmenin kaydedildiği doğrulanamadı. Bekleyen işlemi kontrol edin.');
 return {commandId,revision:v.revision as number,outcome:input.outcome};
}
