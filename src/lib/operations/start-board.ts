import {isUuid} from './pilot-validation';
import type {CheckOutcome} from './start-tracking';
export const startOutcomes:Record<CheckOutcome,string>={preparing:'Hazırlanıyor',on_way:'Yolda',claimed_arrival:'Şubede olduğunu söylüyor',unreachable:'Ulaşılamadı',cannot_attend:'Gelemeyecek'};
export type StartEvent={id:string;revision:number;planVersion:number;kind:string;payload:Record<string,unknown>;occurredAt:string;recordedAt:string;actor:string};
export type StartRow={id:string;requestId:string;companyId:string;company:string;location:string;worker:string;position:string;createdAt:string;closed:boolean;attendance:string;startAt:string|null;plannedAt:string|null;responsibleId:string|null;responsible:string|null;ownerAvailable:boolean;revision:number;planVersion:number;offsets:number[];confirmedAt:string|null;source:string|null;witness:string|null;claimedBy:string|null;claimUntil:string|null;events:StartEvent[]};
export type StartBoard={serverNow:string;day:string;total:number;rows:StartRow[];members:{id:string;name:string}[]};
const date=(v:unknown)=>typeof v==='string'&&Number.isFinite(Date.parse(v));
export function parseStartBoard(value:unknown):StartBoard{
 const b=value as StartBoard;
 if(!b||!date(b.serverNow)||!/^\d{4}-\d{2}-\d{2}$/.test(b.day)||!Number.isInteger(b.total)||b.total<0||!Array.isArray(b.rows)||b.rows.length>50||!Array.isArray(b.members))throw Error('Takip verisi doğrulanamadı.');
 for(const r of b.rows){
  if(!r||![r.id,r.requestId,r.companyId].every(isUuid)||![r.company,r.location,r.worker,r.position].every(v=>typeof v==='string')||!date(r.createdAt)||typeof r.closed!=='boolean'||typeof r.ownerAvailable!=='boolean'||!Number.isInteger(r.revision)||r.revision<0||!Array.isArray(r.offsets)||r.offsets.length>12||r.offsets.some(x=>!Number.isInteger(x)||x< -1440||x>=0)||new Set(r.offsets).size!==r.offsets.length||!Array.isArray(r.events))throw Error('Takip satırı doğrulanamadı.');
  if(r.startAt!==null&&(!date(r.startAt)||!date(r.plannedAt)||!isUuid(r.responsibleId)||r.revision<1))throw Error('Takip planı doğrulanamadı.');
  if(r.confirmedAt!==null&&(!date(r.confirmedAt)||!['branch','field'].includes(r.source??'')||!r.witness?.trim()))throw Error('Teyit doğrulanamadı.');
  for(const e of r.events)if(!e||!isUuid(e.id)||!Number.isInteger(e.revision)||!Number.isInteger(e.planVersion)||typeof e.kind!=='string'||!e.payload||typeof e.payload!=='object'||!date(e.occurredAt)||!date(e.recordedAt)||typeof e.actor!=='string')throw Error('Takip geçmişi doğrulanamadı.');
 }
 if(b.members.some(m=>!m||!isUuid(m.id)||typeof m.name!=='string'))throw Error('Sorumlular doğrulanamadı.');
 return b;
}
export function startRowState(r:StartRow,now:number){
 const calls=r.events.filter(e=>e.kind==='call'&&e.planVersion===r.planVersion).sort((a,b)=>a.revision-b.revision);
 const latest=calls.at(-1),start=r.startAt?Date.parse(r.startAt):null;
 const cut=Math.max(Date.parse(r.createdAt),Date.parse(r.plannedAt??r.createdAt));
 const steps=r.offsets.map(offset=>{const dueAt=start!+offset*60000;const event=calls.filter(e=>e.payload.offset===offset).at(-1);
  return {offset,dueAt,event,state:event?'recorded':r.closed||r.confirmedAt?'not_required':dueAt<cut?'not_applicable':now<dueAt?'upcoming':now<dueAt+300000?'due':'overdue'};});
 const status=r.closed?'closed':r.confirmedAt?'confirmed':start===null?'needs_plan':latest?.payload.outcome==='cannot_attend'?'replacement':now>=start?'unverified':latest?.payload.outcome==='claimed_arrival'?'pending':latest?.payload.outcome==='unreachable'?'unreachable':steps.some(s=>s.state==='overdue')?'overdue':steps.some(s=>s.state==='due')||(!calls.length&&steps.some(s=>s.state==='not_applicable'))?'due':'planned';
 return {steps,status,latest,urgent:['needs_plan','replacement','unverified','pending','unreachable','overdue','due'].includes(status)||(!r.closed&&!r.confirmedAt&&!r.ownerAvailable)};
}
export const startStatusLabels:Record<string,string>={closed:'Atama kapandı',confirmed:'İşe başladı · teyitli',needs_plan:'Saat ve sorumlu bekliyor',replacement:'Yedek personel gerekiyor',unverified:'Başlangıç saati geçti · teyit yok',pending:'Personel şubedeyim dedi · teyit bekleniyor',unreachable:'Ulaşılamadı',overdue:'Arama gecikti',due:'Arama zamanı',planned:'Planlandı'};
export function startError(e:unknown){const m=(e as {message?:string})?.message??'';const errors:Record<string,string>={START_STALE:'Bu kayıt değişti. Listeyi yenileyip tekrar deneyin.',START_CLAIMED:'Başka bir ekip arkadaşı bu aramayı üstlendi.',START_OWNER:'Sorumlu, bu çalışma alanında yönetici veya operasyon üyesi olmalı.',START_CLOSED:'Atama kapandı; yeni işlem kaydedilemez.',START_CONFIRMED:'İşe başlama teyitli. Düzeltmek için önce gerekçeyle teyidi geri alın.',START_TIME:'Görüşme zamanı gelecekte veya atama öncesinde olamaz.',START_CHECK_TIME:'Bu kontrol henüz gelmedi veya plan oluşturulmadan önceye ait. Ek aramayı kullanın.',START_ATTENDANCE_CONFLICT:'Gerçekleşme kaydıyla çelişki var. Günlük plandaki geldi/gelmedi kaydını kontrol edin.',START_REASON:'Değişiklik için en az üç karakterlik gerekçe yazın.',START_SCOPE:'Oturum veya çalışma alanı değişti. Yenileyin.',START_FORBIDDEN:'Bu işlem için yetkiniz yok.'};return errors[m]??'İşlem doğrulanamadı. Bekleyen işlemleri kontrol edin; bağlantı hatası kaydın yapılmadığı anlamına gelmez.';}
