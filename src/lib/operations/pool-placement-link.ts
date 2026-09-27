import {isUuid} from './pilot-validation';
import {isWorkDate} from './daily-demand';
export type PoolPlacement={tenantId:string;companyId:string;requestId:string;day:string;skill:string};
/** Navigation hints only. The daily board and assignment RPC revalidate availability and scope. */
export function parsePoolPlacement(p:Record<string,unknown>):PoolPlacement|null{
 if(!isUuid(p.sirket)||!isUuid(p.firma)||!isUuid(p.talep)||typeof p.gun!=='string'||!isWorkDate(p.gun)||p.gun<'2000-01-01'||p.gun>'2100-12-31'||typeof p.meslek!=='string'||!p.meslek.trim()||p.meslek.length>80||/[\u0000-\u001f\u007f]/.test(p.meslek))return null;
 return {tenantId:p.sirket,companyId:p.firma,requestId:p.talep,day:p.gun,skill:p.meslek.trim()};
}
export function poolPlacementHref(c:PoolPlacement){
 return '/personel-havuzu?'+new URLSearchParams({sirket:c.tenantId,firma:c.companyId,talep:c.requestId,gun:c.day,meslek:c.skill});
}
export function placementReturnHref(c:PoolPlacement,workerId?:string|null){
 const p=new URLSearchParams({sirket:c.tenantId,firma:c.companyId,talep:c.requestId,gun:c.day});
 if(isUuid(workerId))p.set('personel',workerId);
 return `/talepler/gunluk?${p}#talep-${c.requestId}`;
}
