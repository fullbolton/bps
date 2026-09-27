import {isUuid} from './pilot-validation';
import {shiftBounds,shiftDuration,type ShiftClock} from './shift-window';
export type TimedRequestShift=ShiftClock&{workDate:string};
export type TimedRequests={companyId:string;locationId:string;serviceLine:string;position:string;requiredCount:number;meetingNote:string;shifts:TimedRequestShift[]};
const object=(value:unknown):Record<string,unknown>=>{if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Vardiya talebi doğrulanamadı.');return value as Record<string,unknown>;};
const fields=(value:Record<string,unknown>,keys:string[])=>{if(Object.keys(value).some(k=>!keys.includes(k)))throw Error('Vardiya talebinde desteklenmeyen alan var.');};
const text=(value:unknown,max:number,empty=false)=>{if(typeof value!=='string'||/[\x00-\x1f\x7f]/.test(value)||value.trim().length>max||(!empty&&!value.trim()))throw Error('Vardiyanın açıklama alanlarını kontrol edin.');return value.trim();};
const signature=(shift:TimedRequestShift)=>[shift.workDate,shift.startTime,shift.endTime,String(shift.nextDay)].join('|');
export function validateTimedRequests(value:unknown):TimedRequests {
 const v=object(value);fields(v,['companyId','locationId','serviceLine','position','requiredCount','meetingNote','shifts']);
 if(!isUuid(v.companyId)||!isUuid(v.locationId)||!Number.isInteger(v.requiredCount)||Number(v.requiredCount)<1||Number(v.requiredCount)>100||!Array.isArray(v.shifts)||v.shifts.length<1||v.shifts.length>31)throw Error('Firma, şube, kişi sayısı ve 1–31 vardiya seçimini kontrol edin.');
 const shifts=v.shifts.map(raw=>{
  const s=object(raw);fields(s,['workDate','startTime','endTime','nextDay']);
  const shift={workDate:s.workDate,startTime:s.startTime,endTime:s.endTime,nextDay:s.nextDay} as TimedRequestShift;
  shiftDuration(shift);shiftBounds({workDate:shift.workDate,clock:shift});return shift;
 }).sort((a,b)=>signature(a)<signature(b)?-1:signature(a)>signature(b)?1:0);
 if(new Set(shifts.map(signature)).size!==shifts.length||Date.parse(shifts.at(-1)!.workDate)-Date.parse(shifts[0].workDate)>30*86400000)throw Error('Vardiyalar farklı olmalı ve en fazla 31 günlük aralıkta yer almalı.');
 return {companyId:(v.companyId as string).toLowerCase(),locationId:(v.locationId as string).toLowerCase(),serviceLine:text(v.serviceLine,80),position:text(v.position,80),requiredCount:v.requiredCount as number,meetingNote:text(v.meetingNote,500,true),shifts};
}
export function parseTimedRequestReceipt(value:unknown,tenantId:string,commandId:string,input:TimedRequests){
 const v=object(value),expected=validateTimedRequests(input);
 if(!isUuid(tenantId)||!isUuid(commandId)||v.tenantId!==tenantId||v.commandId!==commandId||JSON.stringify(validateTimedRequests(v.payload))!==JSON.stringify(expected)||!Array.isArray(v.rows)||v.rows.length!==expected.shifts.length)throw Error('Vardiya kayıt sonucu doğrulanamadı.');
 const seen=new Set<string>();
 const rows=v.rows.map((raw,i)=>{
  const r=object(raw),shift=expected.shifts[i];
  if(!isUuid(r.id)||seen.has(r.id as string)||r.workDate!==shift.workDate||r.startTime!==shift.startTime||r.endTime!==shift.endTime||r.nextDay!==shift.nextDay)throw Error('Kaydedilen vardiyalar doğrulanamadı.');
  seen.add(r.id as string);return {id:r.id as string,...shift};
 });
 return {commandId,tenantId,payload:expected,rows};
}
