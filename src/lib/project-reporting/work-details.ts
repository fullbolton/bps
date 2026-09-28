import {isUuid} from '@/lib/operations/pilot-validation';
export type WorkDetails={total:number;rows:{day:string;personId:string;personName:string;locationId:string;locationName:string;slot:string;minutes:number;source:string;sourceId:string;batchId:string}[]};
export function parseWorkDetails(v:unknown,tenant:string,project:string,month:string,location:string|null,offset:number):WorkDetails{
 if(!v||typeof v!=='object')throw Error('REPORT_RESPONSE');const r=v as Record<string,unknown>;
 if(r.tenantId!==tenant||r.projectId!==project||r.month!==month||r.locationId!==location||r.offset!==offset||!Number.isSafeInteger(r.total)||Number(r.total)<0||!Array.isArray(r.rows)||r.rows.length!==Math.min(50,Math.max(0,Number(r.total)-offset)))throw Error('REPORT_RESPONSE');
 const keys=new Set<string>();for(const a of r.rows){if(!a||!isUuid(a.personId)||!isUuid(a.locationId)||!isUuid(a.batchId)||!['personName','locationName','slot','source','sourceId','day'].every(k=>typeof a[k]==='string'&&a[k].length>0)||!new RegExp('^'+month+'-\\d{2}$').test(a.day)||!Number.isInteger(a.minutes)||a.minutes<0||a.minutes>1440||(location&&a.locationId!==location))throw Error('REPORT_RESPONSE');const key=JSON.stringify([a.source,a.sourceId]);if(keys.has(key))throw Error('REPORT_RESPONSE');keys.add(key);}
 return {total:Number(r.total),rows:r.rows};
}
