import {transferId} from '@/lib/task-transfer';
export const MAX_PDF_BYTES=10*1024*1024;
export interface PdfUploadCommand {commandId:string;contractId:string;expectedDocumentId:string|null;expectedRevision:number|null;filename:string;byteSize:number;sha256:string;targetRole?:'main'|'appendix';appendixTitle?:string|null}
export interface PdfUploadReceipt extends PdfUploadCommand {path:string;state:'pending'|'published'|'cancelled';documentId:string|null;versionId:string|null}
export function parseUploadCommand(value:unknown):PdfUploadCommand {
 if(!value||typeof value!=='object')throw Error('PDF_UPLOAD_VALIDATION');
 const v=value as Record<string,unknown>;
 const isAppendix=v.targetRole==='appendix';
 if(v.targetRole!==undefined&&v.targetRole!=='main'&&!isAppendix)throw Error('PDF_UPLOAD_VALIDATION');
 if(isAppendix?(typeof v.appendixTitle!=='string'||v.appendixTitle!==v.appendixTitle.trim()||!v.appendixTitle||v.appendixTitle.length>160||/[\x00-\x1f\x7f]/.test(v.appendixTitle)):v.appendixTitle!==undefined&&v.appendixTitle!==null)throw Error('PDF_UPLOAD_VALIDATION');
 const target=isAppendix?{targetRole:'appendix' as const,appendixTitle:v.appendixTitle as string}:{};
 const commandId=transferId(v.commandId),contractId=transferId(v.contractId);
 const expectedDocumentId=v.expectedDocumentId===null?null:transferId(v.expectedDocumentId);
 const revision=v.expectedRevision;
 if((expectedDocumentId===null?revision!==null:typeof revision!=='number'||!Number.isSafeInteger(revision)||revision<0||revision>=Number.MAX_SAFE_INTEGER)
 ||typeof v.filename!=='string'||!v.filename.trim()||v.filename!==v.filename.trim()||v.filename.length>255||/[\/\\\x00-\x1f\x7f]/.test(v.filename)
 ||typeof v.byteSize!=='number'||!Number.isInteger(v.byteSize)||v.byteSize<5||v.byteSize>MAX_PDF_BYTES
 ||typeof v.sha256!=='string'||! /^[0-9a-f]{64}$/.test(v.sha256))throw Error('PDF_UPLOAD_VALIDATION');
 return {commandId,contractId,expectedDocumentId,expectedRevision:revision as number|null,filename:v.filename,byteSize:v.byteSize,sha256:v.sha256,...target};
}
export function parseUploadReceipt(value:unknown,expected:PdfUploadCommand):PdfUploadReceipt {
 try {
 const command=parseUploadCommand(value);expected=parseUploadCommand(expected);
 if((command.targetRole??'main')!==(expected.targetRole??'main'))throw Error('PDF_UPLOAD_RESPONSE');for(const k of Object.keys(command) as (keyof PdfUploadCommand)[])if(command[k]!==expected[k])throw Error('PDF_UPLOAD_RESPONSE');
 const v=value as Record<string,unknown>;
 if(typeof v.path!=='string'||! /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.pdf$/.test(v.path))throw Error('PDF_UPLOAD_RESPONSE');
 transferId(v.path.split('/')[0]);transferId(v.path.split('/')[1].slice(0,-4));
 if(!['pending','published','cancelled'].includes(String(v.state)))throw Error('PDF_UPLOAD_RESPONSE');
 const documentId=v.documentId===null?null:transferId(v.documentId),versionId=v.versionId===null?null:transferId(v.versionId);
 if(v.state==='published'?documentId===null||versionId===null:documentId!==null||versionId!==null)throw Error('PDF_UPLOAD_RESPONSE');
 if(v.targetDocumentId!==undefined){const targetId=transferId(v.targetDocumentId);if((expected.expectedDocumentId!==null&&targetId!==expected.expectedDocumentId)||(v.state==='published'&&targetId!==documentId))throw Error('PDF_UPLOAD_RESPONSE');}
 return {...command,path:v.path,state:v.state as PdfUploadReceipt['state'],documentId,versionId};
 }catch{throw Error('PDF_UPLOAD_RESPONSE');}
}
export async function pdfDigest(bytes:ArrayBuffer):Promise<string>{
 if(bytes.byteLength<5||bytes.byteLength>MAX_PDF_BYTES||new TextDecoder().decode(bytes.slice(0,5))!=='%PDF-')throw Error('PDF_UPLOAD_CONTENT');
 return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
}
export async function verifyPdfBytes(command:PdfUploadCommand,bytes:ArrayBuffer){
 if(bytes.byteLength!==command.byteSize||await pdfDigest(bytes)!==command.sha256)throw Error('PDF_UPLOAD_CONTENT');
}
export function uploadStorageKey(actorId:string,tenantId:string,contractId:string,target='main'){const suffix=target==='main'?'':target==='new-appendix'?':new-appendix':':appendix:'+transferId(target);return `bps:pdf-upload:v1:${transferId(actorId)}:${transferId(tenantId)}:${transferId(contractId)}${suffix}`;}
const messages:Record<string,string>={
 PDF_UPLOAD_OTHER_TAB:'Başka bir sekmede yükleme başlatılmış. Bu sayfayı yenileyerek o yüklemeye devam edin.',
 PDF_UPLOAD_VALIDATION:'Dosya veya yükleme bilgileri geçersiz.',PDF_UPLOAD_CONTENT:'Aynı PDF dosyasını seçin. İçerik veya boyut eşleşmiyor.',
 PDF_UPLOAD_CONFLICT:'PDF kaydı değişmiş. Bu yüklemeden vazgeçip güncel kaydı yükleyin.',PDF_UPLOAD_COMMAND:'Bu yükleme kimliği başka bilgilerle kullanılmış.',
 PDF_UPLOAD_SCOPE:'Hesap veya çalışma alanı değişti. Erişiminizi kontrol edin.',PDF_UPLOAD_FORBIDDEN:'PDF yüklemek için yönetici yetkisi gerekiyor.',
 PDF_UPLOAD_PASSIVE:'Pasif firmaya PDF yayımlanamaz.',PDF_UPLOAD_CANCELLED:'Bu yüklemeden vazgeçilmiş.',PDF_UPLOAD_OBJECT:'Yüklenen dosya henüz doğrulanamadı. Aynı işlemle tekrar deneyin.'
};
export function uploadFailure(error:unknown){
 const e=error as {message?:unknown;code?:unknown};const message=typeof e?.message==='string'?e.message:'';
 const key=Object.keys(messages).find(k=>message===k);
 if(key)return {ok:false as const,error:messages[key],uncertain:false};
 return {ok:false as const,error:'Yüklemenin sonucu doğrulanamadı. Sonucu kontrol edin veya aynı dosyayla tekrar deneyin.',uncertain:true};
}
