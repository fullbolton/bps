import {isUuid} from './pilot-validation';
import {isWorkDate} from './daily-demand';
import {validateIdpInput} from './idp-context';
export type PeriodChange={action:'cancel';reason:string}|{action:'update';reason:string;originalName:string;leaveStart:string;leaveEnd:string;dates:string[]};
export type PeriodCommand={commandId:string;periodId:string;expectedRevision:number;change:PeriodChange};
export function validatePeriodCommand(v:PeriodCommand):PeriodCommand{
 if(!v||!isUuid(v.commandId)||!isUuid(v.periodId)||!Number.isInteger(v.expectedRevision)||v.expectedRevision<1||v.expectedRevision>2147483646||!v.change||typeof v.change.reason!=='string'||v.change.reason.trim().length<3||v.change.reason.trim().length>500)throw Error('Dönem ve değişiklik gerekçesini kontrol edin.');
 const reason=v.change.reason.trim();
 if(v.change.action==='cancel')return {...v,change:{action:'cancel',reason}};
 if(v.change.action!=='update')throw Error('İşlem geçersiz.');
 const c=v.change,validated=validateIdpInput({commandId:v.commandId,requestId:v.periodId,expectedRevision:v.expectedRevision,originalName:c.originalName,leaveStart:c.leaveStart,leaveEnd:c.leaveEnd});
 if((Date.parse(c.leaveEnd)-Date.parse(c.leaveStart))/86400000>30||!Array.isArray(c.dates)||c.dates.length>31||new Set(c.dates).size!==c.dates.length||c.dates.some(d=>!isWorkDate(d)||d<c.leaveStart||d>c.leaveEnd))throw Error('Yeni çalışma günleri izin aralığında olmalı; dönem en fazla 31 gün olabilir.');
 return {...v,change:{action:'update',reason,originalName:validated.originalName,leaveStart:c.leaveStart,leaveEnd:c.leaveEnd,dates:[...c.dates].sort()}};
}
export function parsePeriodReceipt(value:unknown,input:PeriodCommand){
 const v=value as {commandId:string;periodId:string;revision:number;created:number;cancelled:number};
 if(!v||v.commandId!==input.commandId||v.periodId!==input.periodId||v.revision!==input.expectedRevision+1||v.created!==(input.change.action==='update'?input.change.dates.length:0)||!Number.isInteger(v.cancelled)||v.cancelled<0||v.cancelled>31||(input.change.action==='update'&&v.cancelled!==0))throw Error('İşlem sonucu doğrulanamadı.');
 return v;
}
