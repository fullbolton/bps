import {moduleAccessMessage} from '@/lib/modules/errors';
import {isUuid} from '@/lib/operations/pilot-validation';
export const projectKinds={idp:'İDP',fixed:'Sabit personel',hospitality:'Otel ve dönemsel',other:'Diğer'};
export type Project={id:string;companyId:string;companyName:string;code:string;name:string;kind:keyof typeof projectKinds;revision:number;latestPeriod:string|null};
export type LocationLink={locationId:string;name:string;code:string|null;validFrom:string;validUntil:string|null};
export type Period={month:string;status:'open'|'closed';revision:number;lastReason:string|null};
export type Slice<T>={offset:number;total:number;rows:T[]};
export type ProjectDetail={tenantId:string;projectId:string;companyId:string;code:string;name:string;kind:keyof typeof projectKinds;revision:number;locations:Slice<LocationLink>;periods:Slice<Period>};
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const text=(v:unknown):v is string=>typeof v==='string'&&v.length>0;
const integer=(v:unknown):v is number=>Number.isSafeInteger(v)&&Number(v)>=0;
const date=(v:unknown):v is string=>typeof v==='string'&&/^20\d{2}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;
const base=(v:Record<string,unknown>)=>text(v.name)&&text(v.code)&&isUuid(v.companyId)&&typeof v.kind==='string'&&Object.hasOwn(projectKinds,v.kind)&&integer(v.revision)&&v.revision>0;
export function pageOffset(v:unknown){if(v===undefined)return 0;if(typeof v!=='string'||!/^\d+$/.test(v)||Number(v)>1000000||Number(v)%50)throw Error('REPORT_INPUT');return Number(v);}
function slice<T>(v:unknown,offset:number,check:(row:Record<string,unknown>)=>boolean,key:(row:Record<string,unknown>)=>string):Slice<T>{
 if(!object(v)||v.offset!==offset||!integer(v.total)||!Array.isArray(v.rows)||v.rows.length!==Math.min(50,Math.max(0,v.total-offset)))throw Error('REPORT_RESPONSE');
 const seen=new Set<string>();for(const r of v.rows){if(!object(r)||!check(r)||seen.has(key(r)))throw Error('REPORT_RESPONSE');seen.add(key(r));}return v as Slice<T>;
}
export function parseProjectList(v:unknown,tenant:string,offset:number):Slice<Project>{
 if(!object(v)||v.tenantId!==tenant)throw Error('REPORT_SCOPE');
 return slice<Project>(v,offset,r=>base(r)&&isUuid(r.id)&&text(r.companyName)&&(r.latestPeriod===null||date(r.latestPeriod)),r=>String(r.id));
}
export function parseProjectDetail(v:unknown,tenant:string,id:string,locationsOffset:number,periodsOffset:number):ProjectDetail{
 if(!object(v)||v.tenantId!==tenant||v.projectId!==id||!base(v))throw Error('REPORT_RESPONSE');
 slice<LocationLink>(v.locations,locationsOffset,r=>isUuid(r.locationId)&&text(r.name)&&(r.code===null||text(r.code))&&date(r.validFrom)&&(r.validUntil===null||(date(r.validUntil)&&r.validUntil>=String(r.validFrom))),r=>`${r.locationId}:${r.validFrom}`);
 slice<Period>(v.periods,periodsOffset,r=>date(r.month)&&String(r.month).endsWith('-01')&&['open','closed'].includes(String(r.status))&&integer(r.revision)&&r.revision>0&&(r.lastReason===null||text(r.lastReason)),r=>String(r.month));
 return v as ProjectDetail;
}
export function reportError(e:unknown){
 const moduleMessage=moduleAccessMessage(e);if(moduleMessage)return moduleMessage;
 const message=object(e)&&typeof e.message==='string'?e.message:e instanceof Error?e.message:'';
 if(message.includes('REPORT_PERIOD_CLOSED'))return 'Bu tarihlerde kapalı bir rapor dönemi var. Önce yöneticinizin dönemi yeniden açması gerekir.';
 if(message.includes('REPORT_REASON'))return 'Değişiklik gerekçesini en az 5 karakterle yazın.';
 if(message.includes('REPORT_PERIOD_STATE'))return 'Dönemin durumu değişmiş. Sayfayı yenileyin.';
 if(message.includes('REPORT_INPUT'))return 'Bilgileri ve tarih aralığını kontrol edin.';
 if(message.includes('REPORT_CONFLICT'))return 'Bu proje değişmiş. Sayfayı yenileyip tekrar deneyin.';
 if(message.includes('REPORT_LOCATION_OVERLAP'))return 'Bu şube seçtiğiniz tarihlerde projeye zaten bağlı.';
 if(message.includes('duplicate key'))return 'Bu proje kodu veya rapor dönemi zaten kayıtlı.';
 if(message.includes('REPORT_SCOPE')||message.includes('REPORT_FORBIDDEN'))return 'Çalışma alanınız veya yetkiniz değişmiş. Sayfayı yenileyin.';
 if(message.includes('REPORT_LOCATION')||message.includes('REPORT_COMPANY'))return 'Seçilen firma veya şube bu işlem için uygun değil.';
 return 'İşlem doğrulanamadı. Aynı bilgilerle tekrar deneyin.';
}
