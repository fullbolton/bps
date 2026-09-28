import {blockedPersonCode,PERSON_CODE_MESSAGE} from './person-code';
import {decodeCSV,parseCSV} from '@/lib/import/csv-parser';
import {sourceDate,type SourceSheet} from '@/lib/talent/import-preview';
import type {ActualRow} from './actual-preview';
export const actualFields={sourceId:'Kayıt kodu',locationCode:'Şube kodu',personCode:'Personel kodu',day:'Çalışma tarihi',slotCode:'Vardiya kodu',minutes:'Çalışma süresi'} as const;
export type ActualMapping=Record<keyof typeof actualFields,number>;
export type SourceActual={number:number;value:ActualRow|null;issues:string[]};
// Explicit unit only: a day is never assumed to be eight hours.
export function normalizeActualSheet(sheet:SourceSheet,headerRow:number,mapping:ActualMapping,unit:'minutes'|'hours',month:string):SourceActual[]{
 const keys=Object.keys(actualFields) as (keyof ActualMapping)[];
 const header=sheet.rows.find(r=>r.number===headerRow);
 if(!header||sheet.hidden||!/^20\d{2}-(0[1-9]|1[0-2])$/.test(month)||!['minutes','hours'].includes(unit)||!mapping||keys.some(k=>!Number.isInteger(mapping[k])||mapping[k]<0||mapping[k]>=header.cells.length)||new Set(keys.map(k=>mapping[k])).size!==keys.length)throw Error('Sütunları, dönem ve süre birimini kontrol edin.');
 const rows=sheet.rows.filter(r=>r.number>headerRow);if(rows.length<1||rows.length>1000)throw Error('Bu aktarımda 1–1.000 satır olmalı.');
 return rows.map(r=>{
  const issues:string[]=[];const values=Object.fromEntries(keys.map(k=>[k,r.cells[mapping[k]]?.value.trim()??''])) as Record<keyof ActualMapping,string>;
  if(keys.some(k=>r.cells[mapping[k]]?.issue))issues.push('Eşlenen hücrelerde formül veya Excel hatası var. Değer olarak kaydedin.');
  for(const key of ['sourceId','locationCode','personCode','slotCode'] as const)if(!values[key]||values[key].length>160||/[\u0000-\u001f\u007f]/.test(values[key]))issues.push(actualFields[key]+' eksik veya geçersiz.');
  if(blockedPersonCode(values.personCode))issues.push(PERSON_CODE_MESSAGE);
  const day=sourceDate(values.day);if(!day||!day.startsWith(month+'-'))issues.push('Çalışma tarihi seçilen ayda olmalı.');
  let minutes:number|null=null;
  // At most two decimal digits for hours, no thousands separators or time-of-day inference.
  if(!(unit==='minutes'?/^\d{1,4}$/:/^\d{1,2}([.,]\d{1,2})?$/).test(values.minutes))issues.push('Süre sayısal olmalı; gün veya saat aralığı yazmayın.');
  else{
   const parts=values.minutes.replace(',','.').split('.');
   const hundredths=Number(parts[0])*100+Number((parts[1]??'').padEnd(2,'0'));
   minutes=unit==='minutes'?Number(values.minutes):hundredths*60/100;
   if(!Number.isInteger(minutes)||minutes<0||minutes>1440){issues.push('Süre tam dakika olmalı ve 24 saati aşmamalı.');minutes=null;}
  }
  return {number:r.number,value:issues.length?null:{sourceId:values.sourceId,locationCode:values.locationCode,personCode:values.personCode,day:day!,slotCode:values.slotCode,minutes},issues};
 });
}
export function actualCSVSheet(bytes:ArrayBuffer):SourceSheet{
 const {headers,rows}=parseCSV(decodeCSV(bytes));
 if(rows.length>1000)throw Error('Bu aktarımda en fazla 1.000 satır olabilir.');
 return {name:'CSV',hidden:false,rows:[{number:1,cells:headers.map(value=>({value}))},...rows.map((r,index)=>({number:index+2,cells:headers.map(h=>({value:r[h],...(/^[=+@]/.test(r[h])?{issue:'formula' as const}:{})}))}))]};
}
