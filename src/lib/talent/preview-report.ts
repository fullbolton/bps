import type {SourcePerson} from './import-compare';
import {workCopyHeaders} from './work-copy';
/** Preview diagnostics only: not a receipt or a claim that any row was saved. */
export function importReportRows(rows:SourcePerson[]):string[][]{
 return [[...workCopyHeaders,'Kaynak satırı','Önizleme hataları','Bilgi notları'],...rows.filter(r=>r.issues.length||r.warnings?.length).map(r=>[r.personId??'',r.tenantId??'',r.name,r.city,r.phone,r.email,r.district??'',r.skills??'',r.regions??'',String(r.number),r.issues.join(' · '),(r.warnings??[]).join(' · ')])];
}
