import {requireOperationalText,privateTextError} from '@/lib/privacy/operational-text';
import {shiftDuration} from './shift-window';
import {isUuid} from './pilot-validation';
export const workStatusLabels={draft:'Taslak',submitted:'Onay bekliyor',approved:'Onaylandı',returned:'Düzeltme istendi'} as const;
export type WorkStatus=keyof typeof workStatusLabels;
export type WorkAction='save'|'submit'|'approve'|'return'|'reopen';
export type WorkFields={startTime:string;endTime:string;nextDay:boolean;breakMinutes:number;note:string};
export type WorkEvent={revision:number;action:WorkAction;reason:string;recordedAt:string;netMinutes:number};
export const workActionLabels={save:"Saatler kaydedildi",submit:"Onaya gönderildi",approve:"Onaylandı",return:"Düzeltme istendi",reopen:"Onay düzeltmeye açıldı"} as const;
export type WorkRecord=WorkFields&{history:WorkEvent[];revision:number;status:WorkStatus;netMinutes:number;updatedAt:string};
const asObject=(value:unknown):Record<string,unknown>=>{if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Çalışma kaydı doğrulanamadı.');return value as Record<string,unknown>;};
export function workMinutes(value:WorkFields){
 if(!value||!Number.isSafeInteger(value.breakMinutes)||value.breakMinutes<0||typeof value.note!=='string'||value.note.length>1000)throw Error('Saat, mola veya not alanları geçersiz.');
 const gross=shiftDuration(value);
 if(value.breakMinutes>=gross)throw Error('Mola çalışma süresinden kısa olmalı.');
 return gross-value.breakMinutes;
}
export function validateWorkAction(action:WorkAction,payload:unknown){
 const p=asObject(payload);
 if(action==='save'){const fields={startTime:p.startTime,endTime:p.endTime,nextDay:p.nextDay,breakMinutes:p.breakMinutes,note:p.note} as WorkFields;workMinutes(fields);requireOperationalText(fields.note);return fields;}
 if(!['submit','approve','return','reopen'].includes(action))throw Error('Çalışma işlemi geçersiz.');
 if(action==='return'||action==='reopen'){
  if(typeof p.reason!=='string'||p.reason.trim().length<3||p.reason.length>1000)throw Error('En az üç karakterlik düzeltme gerekçesi yazın.');
  requireOperationalText(p.reason);
  return {reason:p.reason.trim()};
 }
 return {};
}
export function parseWorkRecord(value:unknown,assignmentId:string):WorkRecord|null{
 const v=asObject(value);if(v.assignmentId!==assignmentId||!Object.hasOwn(v,'record'))throw Error('Çalışma kaydının kapsamı doğrulanamadı.');
 if(v.record===null)return null;
 const r=asObject(v.record);
 if(!Number.isSafeInteger(r.revision)||Number(r.revision)<1||Number(r.revision)>2147483647||typeof r.status!=='string'||!Object.hasOwn(workStatusLabels,r.status)||typeof r.updatedAt!=='string'||!Number.isFinite(Date.parse(r.updatedAt)))throw Error('Çalışma sürümü doğrulanamadı.');
 if(workMinutes(r as WorkFields)!==r.netMinutes)throw Error('Net çalışma süresi doğrulanamadı.');
 if(!Array.isArray(r.history)||r.history.length!==Math.min(Number(r.revision),20)||r.history.some((e,i)=>!e||typeof e!=='object'||e.revision!==Number(r.revision)-i||!Object.hasOwn(workActionLabels,e.action)||typeof e.reason!=='string'||e.reason.length>1000||typeof e.recordedAt!=='string'||!Number.isFinite(Date.parse(e.recordedAt))||!Number.isSafeInteger(e.netMinutes)||e.netMinutes<1||e.netMinutes>1440))throw Error('Çalışma geçmişi doğrulanamadı.');
 return r as WorkRecord;
}
export function parseWorkReceipt(value:unknown,commandId:string,assignmentId:string,revision:number,action:WorkAction){
 const r=asObject(value),expected={save:'draft',submit:'submitted',approve:'approved',return:'returned',reopen:'returned'}[action];
 if(!isUuid(commandId)||r.commandId!==commandId||r.assignmentId!==assignmentId||r.revision!==revision+1||r.status!==expected)throw Error('Çalışma işleminin sonucu doğrulanamadı.');
 return {commandId,revision:r.revision as number,status:expected as WorkStatus};
}
export function workError(error:unknown){
 const privacy=privateTextError(error);if(privacy)return privacy;
 const code=error&&typeof error==='object'&&'message' in error?String(error.message):'';
 const messages:Record<string,string>={WORK_STALE:'Kayıt değişti. Son kaydı yenileyip taslağınızı karşılaştırın.',WORK_FORBIDDEN:'Bu onay işlemi için yönetici yetkisi gerekir.',WORK_ATTENDANCE:'Onaya göndermek için Geldi kaydı bulunmalı.',WORK_NOT_FINISHED:'Bitiş zamanı henüz gelmedi; tamamlanmamış çalışma onaya gönderilemez.',WORK_LOCKED:'Onaydaki kayıt doğrudan değiştirilemez. Önce gerekçeyle düzeltmeye açın.',WORK_STATE:'Kayıt bu işleme uygun durumda değil; yenileyin.',WORK_CLOSED:'Atama kapalı veya talep iptal edilmiş.',WORK_REASON:'Düzeltme gerekçesi yazın.',WORK_APPROVAL_LOCKED:'Çalışma onayda veya onaylı. Önce çalışma kaydını gerekçeyle düzeltmeye açın.'};
 return messages[code]??'İşlem sonucu doğrulanamadı. Bekleyen işlemi kontrol edin.';
}

export type WorkSummary={assignmentId:string;workerName:string;locationName:string;status:WorkStatus;revision:number;netMinutes:number;closed:boolean};
export function parseWorkList(value:unknown,companyId:string,workDate:string):WorkSummary[]{
 const v=asObject(value);
 if(v.companyId!==companyId||v.workDate!==workDate||!Array.isArray(v.records)||v.records.length>1000)throw Error('Çalışma listesinin kapsamı doğrulanamadı.');
 const seen=new Set<string>();
 for(const item of v.records){const r=asObject(item);if(!isUuid(r.assignmentId)||seen.has(r.assignmentId)||typeof r.workerName!=='string'||!r.workerName.trim()||typeof r.locationName!=='string'||!r.locationName.trim()||typeof r.status!=='string'||!Object.hasOwn(workStatusLabels,r.status)||!Number.isSafeInteger(r.revision)||Number(r.revision)<1||!Number.isSafeInteger(r.netMinutes)||Number(r.netMinutes)<1||Number(r.netMinutes)>1440||typeof r.closed!=='boolean')throw Error('Çalışma listesi doğrulanamadı.');seen.add(r.assignmentId);}
 return v.records as WorkSummary[];
}
