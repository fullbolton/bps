import {transferId} from '@/lib/task-transfer';
export interface PdfVersion {id:string;documentId:string;revision:number;name:string;actorName:string|null;recordedAt:string;origin:'baseline'|'upload';current:boolean}
export function parsePdfVersions(value:unknown,contractId:string):{versions:PdfVersion[];hasMore:boolean}{
  if(!value||typeof value!=='object'||Array.isArray(value))throw Error('PDF geçmişi doğrulanamadı.');
  const v=value as Record<string,unknown>;
  if(v.contractId!==transferId(contractId)||!Array.isArray(v.versions)||v.versions.length>51)throw Error('PDF geçmişi doğrulanamadı.');
  const versions=v.versions.map((x:unknown):PdfVersion=>{
    if(!x||typeof x!=='object')throw Error('PDF sürümü doğrulanamadı.');const r=x as Record<string,unknown>;
    if(typeof r.revision!=='number'||!Number.isSafeInteger(r.revision)||r.revision<0||typeof r.name!=='string'||(r.actorName!==null&&typeof r.actorName!=='string')||typeof r.recordedAt!=='string'||!Number.isFinite(Date.parse(r.recordedAt))||!['baseline','upload'].includes(String(r.origin))||typeof r.current!=='boolean')throw Error('PDF sürümü doğrulanamadı.');
    return {id:transferId(r.id),documentId:transferId(r.documentId),revision:r.revision,name:r.name,actorName:r.actorName as string|null,recordedAt:r.recordedAt,origin:r.origin as PdfVersion['origin'],current:r.current};
  });
  if(new Set(versions.map(v=>v.id)).size!==versions.length||versions.filter(v=>v.current).length>1||versions.some((v,i)=>i>0&&versions[i-1].revision<=v.revision))throw Error('PDF geçmişi tutarsız.');
  return {versions:versions.slice(0,50),hasMore:versions.length>50};
}
