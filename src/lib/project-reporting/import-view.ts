import {moduleAccessMessage} from '@/lib/modules/errors';
import {PERSON_CODE_MESSAGE} from './person-code';
import {isUuid} from '@/lib/operations/pilot-validation';
import type {ActualRow} from './actual-preview';
export type ImportPreview={batchId:string;status:'pending'|'approved'|'cancelled';rows:(ActualRow&{locationId:string;personId:string;locationName:string;personName:string;previousMinutes:number|null;status:'new'|'unchanged'|'changed'})[]};
export type ImportPeople={revision:number;mappings:{code:string;personId:string;name:string}[];candidates:{id:string;name:string;city:string|null}[]};
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const minutes=(v:unknown)=>Number.isInteger(v)&&Number(v)>=0&&Number(v)<=1440;
export function parseImportPreview(v:unknown):ImportPreview{
 if(!object(v)||!isUuid(v.batchId)||!['pending','approved','cancelled'].includes(String(v.status))||!Array.isArray(v.rows)||!v.rows.length||v.rows.length>1000)throw Error('REPORT_RESPONSE');
 const ids=new Set<string>();for(const r of v.rows){if(!object(r)||!isUuid(r.locationId)||!isUuid(r.personId)||typeof r.sourceId!=='string'||!r.sourceId||ids.has(r.sourceId)||!['locationCode','personCode','day','slotCode','locationName','personName'].every(k=>typeof r[k]==='string'&&r[k].length>0)||!minutes(r.minutes)||(r.previousMinutes!==null&&!minutes(r.previousMinutes))||!['new','unchanged','changed'].includes(String(r.status)))throw Error('REPORT_RESPONSE');if((r.status==='new'&&r.previousMinutes!==null)||(r.status==='unchanged'&&r.previousMinutes!==r.minutes)||(r.status==='changed'&&(r.previousMinutes===null||r.previousMinutes===r.minutes)))throw Error('REPORT_RESPONSE');ids.add(r.sourceId);}
 return v as ImportPreview;
}
export function parseImportPeople(v:unknown):ImportPeople{
 if(!object(v)||!Number.isInteger(v.revision)||Number(v.revision)<1||!Array.isArray(v.mappings)||v.mappings.length>1000||!Array.isArray(v.candidates)||v.candidates.length>20)throw Error('REPORT_RESPONSE');
 for(const m of v.mappings)if(!object(m)||typeof m.code!=='string'||!isUuid(m.personId)||typeof m.name!=='string')throw Error('REPORT_RESPONSE');
 for(const p of v.candidates)if(!object(p)||!isUuid(p.id)||typeof p.name!=='string'||(p.city!==null&&typeof p.city!=='string'))throw Error('REPORT_RESPONSE');
 if(new Set(v.mappings.map(m=>m.code)).size!==v.mappings.length||new Set(v.candidates.map(p=>p.id)).size!==v.candidates.length)throw Error('REPORT_RESPONSE');
 return v as ImportPeople;
}
export function importError(e:unknown){
 const moduleMessage=moduleAccessMessage(e);if(moduleMessage)return moduleMessage;
 const message=object(e)&&typeof e.message==='string'?e.message:String(e);
 const labels:Record<string,string>={REPORT_PERSON_CODE_PRIVATE:PERSON_CODE_MESSAGE,REPORT_PERSON_UNMAPPED:'Personel kodlarından en az biri eşlenmemiş. Kişi eşlemelerini kontrol edin.',REPORT_LOCATION_UNMAPPED:'Şube kodu bulunamadı veya çalışma tarihinde bu projeye bağlı değil. Proje şubelerini kontrol edin.',REPORT_MAPPING_USED:'Bu eşleme bir aktarımda kullanılıyor. Bekleyen aktarımı iptal edin; onaylı kayıtta kullanılan eşleme değiştirilemez.',REPORT_PERIOD_CLOSED:'Seçilen ay için açık rapor dönemi yok. Proje ekranından dönemi kontrol edin.',REPORT_WORK_DUPLICATE:'Aynı çalışma birden fazla satırda veya başka bir kayıt koduyla bulunuyor.',REPORT_SOURCE_ID_CHANGED:'Kayıt kodu başka kişi, şube veya güne ait. Kaynak dosyayı kontrol edin.',REPORT_CONFLICT:'Proje veya eşlemeler değişti. Bekleyen aktarımı iptal edip yeniden önizleyin.',REPORT_FORBIDDEN:'Bu aktarım için yetkiniz yok.',REPORT_SCOPE:'Çalışma alanınız değişmiş. Sayfayı yenileyin.',REPORT_COMMAND_MISMATCH:'Bu işlem farklı bilgilerle yeniden gönderildi. Mevcut aktarımı kontrol edin.',REPORT_IMPORT_STATE:'Aktarımın durumu değişmiş. Listeyi yenileyin.',REPORT_IMPORT_INPUT:'Dosya değerlerini kontrol edin. En fazla 1.000 satır desteklenir.'};
 for(const [key,label]of Object.entries(labels))if(message.includes(key))return label;
 return 'İşlem doğrulanamadı. Aynı işlemle tekrar deneyin.';
}
