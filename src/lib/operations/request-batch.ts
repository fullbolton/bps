import {isWorkDate} from './daily-demand';
import {isUuid,validatePilotPayload} from './pilot-validation';
import {addDays} from './weekly-plan';
export type RequestBatch={companyId:string;locationId:string;serviceLine:string;position:string;requiredCount:number;dates:string[]};
export function buildRequestDates(start:string,end:string,weekdays:number[]):string[]{
  if(!isWorkDate(start)||!isWorkDate(end)||start<'2000-01-01'||end>'2100-12-31'||end<start||end>addDays(start,30))throw new Error('Başlangıç ve bitiş arasında en fazla 31 gün seçin (2000–2100).');
  if(!Array.isArray(weekdays)||!weekdays.length||weekdays.some(n=>!Number.isInteger(n)||n<1||n>7)||new Set(weekdays).size!==weekdays.length)throw new Error('En az bir çalışma günü seçin.');
  const days=[];
  for(let date=start;date<=end;date=addDays(date,1))if(weekdays.includes(new Date(date+'T00:00:00Z').getUTCDay()||7))days.push(date);
  if(!days.length)throw new Error('Bu aralıkta seçtiğiniz çalışma günü yok.');
  return days;
}
export function validateRequestBatch(value:unknown):RequestBatch{
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Toplu talep verisi geçersiz.');
  const v=value as Record<string,unknown>;
  if(!Array.isArray(v.dates)||v.dates.length<1||v.dates.length>31||!v.dates.every(d=>isWorkDate(d)&&d>='2000-01-01'&&d<='2100-12-31')||new Set(v.dates).size!==v.dates.length)throw new Error('1–31 farklı ve geçerli gün gerekir.');
  const dates=[...v.dates].sort() as string[];
  if(dates.at(-1)!>addDays(dates[0],30))throw new Error('Talep günleri en fazla 31 günlük aralıkta olmalı.');
  const clean=validatePilotPayload('request',{...v,workDate:dates[0]});
  return {companyId:clean.companyId as string,locationId:clean.locationId as string,serviceLine:clean.serviceLine as string,position:clean.position as string,requiredCount:clean.requiredCount as number,dates};
}
export function parseBatchResult(id:string,days:number,value:unknown):{commandId:string;created:number;requestIds:string[]}{
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Toplu talep sonucu doğrulanamadı.');
  const v=value as Record<string,unknown>;
  if(v.commandId!==id||v.created!==days||!Array.isArray(v.requestIds)||v.requestIds.length!==days||!v.requestIds.every(isUuid)||new Set(v.requestIds).size!==days)throw new Error('Toplu talep sonucu doğrulanamadı.');
  return {commandId:id,created:days,requestIds:v.requestIds};
}
