import {isUuid} from '@/lib/operations/pilot-validation';
const labels={not_queued:'Tarama kuyruğuna alınmayı bekliyor',queued:'Tarama bekliyor',scanning:'Güvenlik taraması sürüyor',ready:'Tarama tamamlandı, kayıt bekliyor',blocked:'Dosya güvenlik kontrolünden geçemedi',failed:'Tarama tamamlanamadı',expired:'Tarama sonucu güncelliğini kaybetti',published:'Evrak kaydedildi',cancelled:'Yükleme iptal edildi',cancelling:'İptal işlemi sürüyor'} as const;
export type HrScanStatus=keyof typeof labels;
export function parseHrScanStatus(raw:unknown,expected:{actor:string;tenant:string;employee:string;upload:string}){
 if(!Object.values(expected).every(isUuid)||!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('HR_SCAN_STATUS_RESPONSE');
 const r=raw as Record<string,unknown>;
 if(r.schemaVersion!==1||r.actorId!==expected.actor||r.tenantId!==expected.tenant||r.employeeId!==expected.employee||r.uploadId!==expected.upload
 ||typeof r.status!=='string'||!Object.hasOwn(labels,r.status)||!Number.isSafeInteger(r.attempts)||Number(r.attempts)<0||Number(r.attempts)>3)throw Error('HR_SCAN_STATUS_RESPONSE');
 const status=r.status as HrScanStatus;
 return {status,label:labels[status],attempts:r.attempts as number,canFinalize:status==='ready',canRescan:status==='expired'&&Number(r.attempts)>0&&Number(r.attempts)<3,terminal:['published','cancelled','blocked','failed'].includes(status)};
}
