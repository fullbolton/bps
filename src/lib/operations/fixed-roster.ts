import {moduleAccessMessage} from '@/lib/modules/errors';
import {isUuid} from './pilot-validation';
import {isWorkDate} from './daily-demand';

/** A roster records a branch appointment, never attendance or payable work. Dates are inclusive. */
export type FixedRosterInput = {
  id: string; expectedRevision: number; companyId: string; locationId: string; workerId: string;
  serviceLine: string; position: string; startsOn: string; endsOn: string | null; reason: string; cancelled?:boolean;
};
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const text = (v: unknown, min: number, max: number): v is string => typeof v === 'string' && v.trim().length >= min && v.trim().length <= max && !/[\x00-\x1f\x7f]/.test(v);
const date = (v: unknown): v is string => isWorkDate(v) && (v as string) >= '2000-01-01' && (v as string) <= '2100-12-31';
export function validateFixedRosterInput(value: unknown): FixedRosterInput {
  if (!object(value) || (value.cancelled!==undefined&&typeof value.cancelled!=='boolean') || (value.expectedRevision===0&&value.cancelled===true) || !isUuid(value.id) || !isUuid(value.companyId) || !isUuid(value.locationId) || !isUuid(value.workerId) ||
    typeof value.expectedRevision !== 'number' || !Number.isInteger(value.expectedRevision) || value.expectedRevision < 0 || value.expectedRevision > 2147483646 ||
    !text(value.serviceLine, 1, 80) || !text(value.position, 1, 80) || !text(value.reason, 3, 500) || !date(value.startsOn) ||
    (value.endsOn !== null && (!date(value.endsOn) || value.endsOn < value.startsOn))) {
    throw new Error('Kadro bilgilerini kontrol edin. Personel, şube, görev ve geçerli tarih aralığı gerekir.');
  }
  return {id:value.id, expectedRevision:value.expectedRevision, companyId:value.companyId, locationId:value.locationId,
    workerId:value.workerId, serviceLine:value.serviceLine.trim(), position:value.position.trim(),
    startsOn:value.startsOn, endsOn:value.endsOn, reason:value.reason.trim(),cancelled:value.cancelled===true};
}

export function fixedRosterError(error: unknown): string {
  const moduleMessage=moduleAccessMessage(error);if(moduleMessage)return moduleMessage;
  const raw = object(error) && typeof error.message === 'string' ? error.message : '';
  const messages: Record<string, string> = {
    ROSTER_LEAVE_ASSIGNED: 'Personelin izin aralığında günlük görevlendirmesi veya Geldi kaydı var. Önce ilgili günlük kaydı kontrol edin.',
    ROSTER_WORKER_ON_LEAVE: 'Personel bu tarihte izinli. Farklı bir personel seçin.',
    ROSTER_SOURCE_NAME: 'Bu dönem kadrodaki personele bağlı. Asıl personeli bu ekrandan değiştiremezsiniz.',
    ROSTER_CANCELLED: 'Bu kadro iptal edilmiş veya personel pasif. Güncel kaydı kontrol edin.',
    ROSTER_LINKED_PERIOD: 'Bu kayda bağlı aktif İDP dönemi var. Önce İDP dönemini düzeltin veya iptal edin.',
    ROSTER_LEAVE_RANGE: 'İzin tarihleri personelin bu şubedeki görev tarihleri içinde olmalı.',
    ROSTER_LEAVE_CONFLICT: 'Bu personelin aynı tarihlere denk gelen bir İDP dönemi zaten var.',
    ROSTER_DATE_CONFLICT: 'Personelin bu tarihlerde başka bir kadro kaydı var. Önce mevcut kaydın bitiş tarihini kontrol edin.',
    ROSTER_FIXED_WORKER_REQUIRED: 'Aktif bir sabit personel seçin. Gerekirse personel havuzundaki çalışma türünü kontrol edin.',
    ROSTER_IDENTITY_LOCKED: 'Personel veya şube değişiminde mevcut kaydı bitirin ve yeni kadro kaydı açın.',
    OPS_STALE_VERSION: 'Kadro kaydı başka bir işlemle değişti. Güncel kaydı açıp tekrar deneyin.',
  };
  return Object.entries(messages).find(([key]) => raw.includes(key))?.[1] ?? 'Kadro işleminin sonucu doğrulanamadı. Aynı işlemi tekrar kontrol edin.';
}

export type FixedRosterRecord = {
  tenant_id:string; id:string; company_id:string; location_id:string; worker_id:string;
  service_line:string; position:string; starts_on:string; ends_on:string|null; revision:number;
  cancelled:boolean; created_by:string; updated_by:string; created_at:string; updated_at:string;
};
export type FixedRosterQuery = {companyId:string; locationId:string; day:string; offset:number; history?:boolean};
export function validateFixedRosterQuery(value:unknown):FixedRosterQuery {
  if(!object(value)||(value.history!==undefined&&typeof value.history!=='boolean')||!isUuid(value.companyId)||!isUuid(value.locationId)||!date(value.day)||
    typeof value.offset!=='number'||!Number.isInteger(value.offset)||value.offset<0||value.offset>100000)throw Error('Şube ve tarih seçimini kontrol edin.');
  return {companyId:value.companyId,locationId:value.locationId,day:value.day,offset:value.offset,history:value.history===true};
}
export function parseFixedRosterRecord(value:unknown,tenantId:string):FixedRosterRecord {
  if(!object(value)||typeof value.cancelled!=='boolean'||!isUuid(tenantId)||value.tenant_id!==tenantId||!isUuid(value.created_by)||!isUuid(value.updated_by)||
    typeof value.revision!=='number'||!Number.isInteger(value.revision)||value.revision<1||value.revision>2147483647||
    typeof value.created_at!=='string'||!Number.isFinite(Date.parse(value.created_at))||typeof value.updated_at!=='string'||!Number.isFinite(Date.parse(value.updated_at)))throw Error('Kadro kaydı doğrulanamadı.');
  const clean=validateFixedRosterInput({id:value.id,expectedRevision:value.revision-1,companyId:value.company_id,locationId:value.location_id,workerId:value.worker_id,serviceLine:value.service_line,position:value.position,startsOn:value.starts_on,endsOn:value.ends_on,reason:'Yanıt kontrolü'});
  return {tenant_id:tenantId,id:clean.id,company_id:clean.companyId,location_id:clean.locationId,worker_id:clean.workerId,
    service_line:clean.serviceLine,position:clean.position,starts_on:clean.startsOn,ends_on:clean.endsOn,revision:value.revision,cancelled:value.cancelled,
    created_by:value.created_by,updated_by:value.updated_by,created_at:value.created_at,updated_at:value.updated_at};
}
export function parseFixedRosterReceipt(value:unknown,tenantId:string,actorId:string,commandId:string,input:FixedRosterInput) {
  const p=validateFixedRosterInput(input);
  if(!object(value)||!isUuid(commandId)||!isUuid(actorId)||value.commandId!==commandId)throw Error('Kadro işlem sonucu doğrulanamadı.');
  const row=parseFixedRosterRecord(value.record,tenantId);
  if(row.cancelled!==(p.cancelled===true)||row.id!==p.id||row.company_id!==p.companyId||row.location_id!==p.locationId||row.worker_id!==p.workerId||row.service_line!==p.serviceLine||row.position!==p.position||row.starts_on!==p.startsOn||row.ends_on!==p.endsOn||row.revision!==p.expectedRevision+1||row.updated_by!==actorId)throw Error('Kadro işlem sonucu gönderilen bilgilerle eşleşmiyor.');
  if(p.expectedRevision===0){if(value.previous!==null||row.created_by!==actorId)throw Error('Kadro oluşturma sonucu doğrulanamadı.');}
  else {
    const old=parseFixedRosterRecord(value.previous,tenantId);
    if(old.id!==row.id||old.company_id!==row.company_id||old.location_id!==row.location_id||old.worker_id!==row.worker_id||old.revision!==p.expectedRevision||old.created_by!==row.created_by||old.created_at!==row.created_at)throw Error('Kadro değişiklik geçmişi doğrulanamadı.');
  }
  return {commandId,record:row};
}
export function parseFixedRosterPage(value:unknown,tenantId:string,query:FixedRosterQuery) {
  const q=validateFixedRosterQuery(query);
  if(!object(value)||!text(value.companyName,1,300)||!text(value.locationName,1,160)||value.offset!==q.offset||!Array.isArray(value.rows)||value.rows.length>51)throw Error('Kadro listesi doğrulanamadı.');
  const rows=value.rows.map(v=>{
    const row=parseFixedRosterRecord(v,tenantId);
    if(!object(v)||!text(v.worker_name,1,160)||typeof v.worker_active!=='boolean'||row.company_id!==q.companyId||row.location_id!==q.locationId||(!q.history&&(row.cancelled||row.starts_on>q.day||(row.ends_on!==null&&row.ends_on<q.day))))throw Error('Kadro listesi seçilen şube ve tarihle eşleşmiyor.');
    return {...row,workerName:v.worker_name,workerActive:v.worker_active};
  });
  if(new Set(rows.map(r=>r.id)).size!==rows.length||(!q.history&&new Set(rows.map(r=>r.worker_id)).size!==rows.length))throw Error('Kadro listesinde tekrarlanan kayıt var.');
  return {rows:rows.slice(0,50),hasMore:rows.length>50,offset:q.offset,companyName:value.companyName,locationName:value.locationName};
}

export type RosterLeave={rosterId:string;expectedRevision:number;start:string;end:string;dates:string[]};
export function validateRosterLeave(value:unknown):RosterLeave {
  if(!object(value)||!isUuid(value.rosterId)||typeof value.expectedRevision!=='number'||!Number.isInteger(value.expectedRevision)||value.expectedRevision<1||value.expectedRevision>2147483647||!date(value.start)||!date(value.end)||value.end<value.start||(Date.parse(value.end)-Date.parse(value.start))/86400000>30||!Array.isArray(value.dates)||value.dates.length<1||value.dates.length>31)throw Error('İzin tarihlerini ve çalışma günlerini kontrol edin (en fazla 31 gün).');
  const start=value.start,end=value.end;
  if(value.dates.some(d=>!date(d)||d<start||d>end)||new Set(value.dates).size!==value.dates.length)throw Error('Çalışma günleri izin aralığında ve birbirinden farklı olmalı.');
  return {rosterId:value.rosterId,expectedRevision:value.expectedRevision,start,end,dates:[...value.dates].sort()};
}
export type RosterHistoryEntry={commandId:string;at:string;reason:string;kind:'save'|'idp';record:FixedRosterRecord|null;previous:FixedRosterRecord|null;periodId:string|null;start:string;end:string|null};
export function parseRosterHistory(value:unknown,tenantId:string,rosterId:string):{rows:RosterHistoryEntry[];hasMore:boolean} {
  if(!Array.isArray(value)||value.length>51||!isUuid(rosterId))throw Error('Kadro geçmişi doğrulanamadı.');
  const rows: RosterHistoryEntry[]=value.map(v=>{
    if(!object(v)||!isUuid(v.command_id)||!isUuid(v.actor_id)||typeof v.created_at!=='string'||!Number.isFinite(Date.parse(v.created_at))||!object(v.payload)||!object(v.result)||v.result.commandId!==v.command_id)throw Error('Kadro geçmişi doğrulanamadı.');
    if(v.payload.kind==='idp'){
      const p=validateRosterLeave({rosterId:v.payload.rosterId,expectedRevision:v.payload.revision,start:v.payload.start,end:v.payload.end,dates:v.payload.dates});
      if(p.rosterId!==rosterId||!isUuid(v.result.periodId))throw Error('İDP geçmişi doğrulanamadı.');
      return {commandId:v.command_id,at:v.created_at,reason:'İDP talebi açıldı',kind:'idp',record:null,previous:null,periodId:v.result.periodId,start:p.start,end:p.end};
    }
    const record=parseFixedRosterRecord(v.result.record,tenantId),previous=v.result.previous===null?null:parseFixedRosterRecord(v.result.previous,tenantId);
    if(record.id!==rosterId||(previous&&previous.id!==rosterId)||!text(v.payload.reason,3,500))throw Error('Kadro geçmişi doğrulanamadı.');
    return {commandId:v.command_id,at:v.created_at,reason:v.payload.reason,kind:'save',record,previous,periodId:null,start:record.starts_on,end:record.ends_on};
  });
  if(new Set(rows.map(r=>r.commandId)).size!==rows.length)throw Error('Kadro geçmişinde tekrarlanan kayıt var.');
  return {rows:rows.slice(0,50),hasMore:rows.length>50};
}
