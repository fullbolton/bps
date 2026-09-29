import {moduleAccessMessage} from '@/lib/modules/errors';
import {isUuid} from './pilot-validation';
import {shiftBounds,shiftDuration,shiftsOverlap,type ShiftClock,type ShiftException} from './shift-window';
import {addDays} from './weekly-plan';
export type SchedulePlan={companyId:string;locationId:string;title:string;serviceLine:string;position:string;requiredCount:number;meetingNote:string;start:string;end:string;weekdays:number[];clock:ShiftClock;exceptions:ShiftException[]};
export type ScheduleSave={id:string|null;revision:number;plan:SchedulePlan;archived:boolean};
export type Schedule={id:string;revision:number;plan:SchedulePlan;archived:boolean;updatedAt:string};
export type ScheduleQuery={id:string;revision:number;start:string;end:string};
export type ScheduleWindow={tenantId:string;scheduleId:string;revision:number;start:string;end:string;rows:{workDate:string;requestId:string|null;lifecycle:'new'|'active'|'cancelled';clock:ShiftClock;requiredCount:number;position:string}[]};
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const fail=():never=>{throw Error('Plan bilgisi doğrulanamadı. Alanları ve tarihleri kontrol edin.');};
const keys=(v:unknown,names:string[])=>{if(!object(v)||Object.keys(v).length!==names.length||Object.keys(v).some(k=>!names.includes(k)))fail();return v as Record<string,unknown>;};
function text(v:unknown,max:number,empty=false){if(typeof v!=='string'||/[\u0000-\u001f\u007f]/.test(v)||v.trim().length>max||(!empty&&!v.trim()))return fail();return v.trim();}
function integer(v:unknown,min:number,max:number){if(typeof v!=='number'||!Number.isInteger(v)||v<min||v>max)return fail();return v;}
function uuid(v:unknown){if(!isUuid(v))return fail();return v.toLowerCase();}
function date(v:unknown){if(typeof v!=='string')return fail();shiftBounds({workDate:v,clock:null});return v;}
function clock(v:unknown):ShiftClock{const c=keys(v,['startTime','endTime','nextDay']);shiftDuration(c as ShiftClock);return {startTime:c.startTime as string,endTime:c.endTime as string,nextDay:c.nextDay as boolean};}
export function validateSchedulePlan(value:unknown):SchedulePlan{
 const p=keys(value,['companyId','locationId','title','serviceLine','position','requiredCount','meetingNote','start','end','weekdays','clock','exceptions']);
 const start=date(p.start),end=date(p.end);if(end<start||Date.parse(end)-Date.parse(start)>365*86400000)fail();
 if(!Array.isArray(p.weekdays)||!p.weekdays.length||p.weekdays.length>7||new Set(p.weekdays).size!==p.weekdays.length||!Array.isArray(p.exceptions)||p.exceptions.length>31)fail();
 const weekdays=(p.weekdays as unknown[]).map(n=>integer(n,1,7)).sort((a,b)=>a-b),defaultClock=clock(p.clock);
 const exceptions=(p.exceptions as unknown[]).map(v=>{const e=keys(v,['day','clock']),day=date(e.day);if(day<start||day>end)fail();return {day,clock:e.clock===null?null:clock(e.clock)};}).sort((a,b)=>a.day.localeCompare(b.day));
 if(new Set(exceptions.map(e=>e.day)).size!==exceptions.length)fail();
 const byDay=new Map(exceptions.map(e=>[e.day,e.clock]));let previous:{workDate:string;clock:ShiftClock}|null=null;
 for(let day=start;day<=end;day=addDays(day,1)){
  const c=byDay.has(day)?byDay.get(day):weekdays.includes(new Date(day+'T00:00:00Z').getUTCDay()||7)?defaultClock:null;
  if(c){const current={workDate:day,clock:c};if(previous&&shiftsOverlap(previous,current))throw Error('Ardışık günlerin vardiyaları çakışıyor.');previous=current;}
 }
 return {companyId:uuid(p.companyId),locationId:uuid(p.locationId),title:text(p.title,120),serviceLine:text(p.serviceLine,80),position:text(p.position,80),requiredCount:integer(p.requiredCount,1,100),meetingNote:text(p.meetingNote,500,true),start,end,weekdays,clock:defaultClock,exceptions};
}
export function validateScheduleSave(value:unknown):ScheduleSave{const p=keys(value,['id','revision','plan','archived']);const id=p.id===null?null:uuid(p.id),revision=integer(p.revision,0,2147483646);if(typeof p.archived!=='boolean'||(id===null&&(revision!==0||p.archived)))fail();return{id,revision,plan:validateSchedulePlan(p.plan),archived:p.archived as boolean};}
export function validateScheduleQuery(value:unknown):ScheduleQuery{const p=keys(value,['id','revision','start','end']);const start=date(p.start),end=date(p.end);if(end<start||Date.parse(end)-Date.parse(start)>30*86400000)fail();return{id:uuid(p.id),revision:integer(p.revision,1,2147483646),start,end};}
export function parseScheduleList(value:unknown,tenant:string,company:string,offset:number):Schedule[]{
 if(!object(value)||value.tenantId!==tenant||value.companyId!==company||value.offset!==offset||!Array.isArray(value.rows)||value.rows.length>26)return fail();
 const seen=new Set<string>();return value.rows.map((v:unknown)=>{if(!object(v)||typeof v.archived!=='boolean'||typeof v.updatedAt!=='string'||!Number.isFinite(Date.parse(v.updatedAt)))return fail();const id=uuid(v.id);if(seen.has(id))fail();seen.add(id);const plan=validateSchedulePlan(v.plan);if(plan.companyId!==company)fail();return{id,revision:integer(v.revision,1,2147483647),plan,archived:v.archived,updatedAt:v.updatedAt};});
}
export function parseScheduleWindow(value:unknown,tenant:string,q:ScheduleQuery):ScheduleWindow{
 if(!object(value)||value.tenantId!==tenant||value.scheduleId!==q.id||value.revision!==q.revision||value.start!==q.start||value.end!==q.end||!Array.isArray(value.rows)||value.rows.length>31)return fail();
 let prior='';const ids=new Set<string>();const rows=value.rows.map((v:unknown)=>{if(!object(v))return fail();const day=date(v.workDate);if(day<q.start||day>q.end||day<=prior)fail();prior=day;if(!['new','active','cancelled'].includes(String(v.lifecycle)))fail();const requestId=v.requestId===null?null:uuid(v.requestId);if((v.lifecycle==='new')!==(requestId===null)||requestId&&ids.has(requestId))fail();if(requestId)ids.add(requestId);return{workDate:day,requestId,lifecycle:v.lifecycle as 'new'|'active'|'cancelled',clock:clock(v.clock),requiredCount:integer(v.requiredCount,1,100),position:text(v.position,80)};});
 return{tenantId:tenant,scheduleId:q.id,revision:q.revision,start:q.start,end:q.end,rows};
}
export function parseScheduleSaveReceipt(value:unknown,tenant:string,command:string,p:ScheduleSave){
 if(!object(value)||value.tenantId!==tenant||value.commandId!==command||!object(value.intent))return fail();const intent=validateScheduleSave(value.intent);if(JSON.stringify(intent)!==JSON.stringify(p)||value.id!==(p.id??command)||value.revision!==p.revision+1)return fail();return{id:value.id as string,revision:value.revision as number};
}
export function parseScheduleGeneration(value:unknown,tenant:string,command:string,p:ScheduleQuery){
 if(!object(value)||value.tenantId!==tenant||value.commandId!==command||!object(value.intent))return fail();const intent=validateScheduleQuery(value.intent);if(JSON.stringify(intent)!==JSON.stringify(p))fail();const window=parseScheduleWindow(value.window,tenant,p),created=integer(value.created,0,31),kept=integer(value.kept,0,31);if(created+kept!==window.rows.length||window.rows.some(r=>r.lifecycle==='new'))fail();return{created,kept,window};
}
export function scheduleError(error:unknown){const moduleMessage=moduleAccessMessage(error);if(moduleMessage)return moduleMessage;const m=error&&typeof error==='object'&&'message'in error?String(error.message):'';const labels:Record<string,string>={OPS_SCOPE_CHANGED:'Çalışma şirketiniz değişmiş. Şirketinizi yeniden seçin.',TALENT_FORBIDDEN:'Bu şirkette plan yönetimi yetkiniz yok.',OPS_FORBIDDEN:'Bu işlem için operasyon veya yönetici yetkisi gerekir.',SCHEDULE_INPUT:'Plan bilgilerini ve tarihleri kontrol edin.',SCHEDULE_OVERLAP:'Ardışık günlerin vardiyaları çakışıyor.',SCHEDULE_WINDOW:'Planın geçerlilik tarihleri içinde en fazla 31 günlük aralık seçin.',SCHEDULE_ARCHIVED:'Bu plan arşivde. Yeni iş üretmek için önce yeniden etkinleştirin.',SCHEDULE_NAME:'Bu şubede aynı isimde bir plan var. Mevcut planı açın veya farklı isim kullanın.',SCHEDULE_IDENTITY:'Kaydedilmiş planın firması ve şubesi değiştirilemez.',OPS_STALE_VERSION:'Plan değişmiş. Listeyi yenileyip güncel planla yeniden deneyin.',OPS_INACTIVE_COMPANY:'Firma operasyona kapalı.',OPS_INACTIVE_LOCATION:'Şube operasyona kapalı.',OPS_SHIFT_LEGACY_REQUEST:'Bu günlerde saati belirtilmemiş talep var. Önce günlük plandaki talepleri kontrol edin.'};return labels[m]??(m.includes('ops_timed_request_identity')?'Aynı gün ve saat için başka bir talep var. Günlük planı kontrol edin; mevcut iş otomatik olarak bu plana bağlanmaz.':'İşlemin sonucu doğrulanamadı. Aynı işlemi yeniden kontrol edin.');}
