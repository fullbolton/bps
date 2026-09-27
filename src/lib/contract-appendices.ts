import {transferId} from '@/lib/task-transfer';
import {parsePdfVersions} from '@/lib/contract-pdf';
export interface ContractAppendix {id:string;title:string;name:string;revision:number}
export function parseAppendices(value:unknown,contractId:string,afterId:string|null=null){
 if(!value||typeof value!=='object')throw Error('Ek protokol listesi doğrulanamadı.');
 const v=value as Record<string,unknown>;
 if(v.contractId!==transferId(contractId)||!Array.isArray(v.documents)||v.documents.length>21)throw Error('Ek protokol listesi doğrulanamadı.');
 const documents=v.documents.map((r:Record<string,unknown>):ContractAppendix=>{
  if(!r||typeof r!=='object'||typeof r.title!=='string'||!r.title.trim()||r.title.length>160||typeof r.name!=='string'||!r.name||typeof r.revision!=='number'||!Number.isSafeInteger(r.revision)||r.revision<0)throw Error('Ek protokol bilgisi doğrulanamadı.');
  return {id:transferId(r.id),title:r.title,name:r.name,revision:r.revision};
 });
 if(documents.some((d,i)=>d.id<=(i?documents[i-1].id:afterId??'')))throw Error('Ek protokol sırası doğrulanamadı.');
 return {documents:documents.slice(0,20),nextCursor:documents.length>20?documents[19].id:null};
}
export function parseDocumentHistory(value:unknown,contractId:string,documentId:string){
 if(!value||typeof value!=='object'||(value as Record<string,unknown>).documentId!==transferId(documentId))throw Error('Belge geçmişi doğrulanamadı.');
 const result=parsePdfVersions(value,contractId);if(result.versions.some(v=>v.documentId!==documentId))throw Error('Başka belgeye ait sürüm reddedildi.');return result;
}
