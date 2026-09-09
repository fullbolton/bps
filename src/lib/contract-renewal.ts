import {transferId} from '@/lib/task-transfer';
export interface RenewalCommand {commandId:string;contractId:string;revision:number;assigneeId:string;dueDate:string;basis:string}
export interface RenewalSnapshot {
  contractId:string;revision:number;companyStatus:'aday'|'aktif'|'pasif';suggestedDate:string|null;
  task:null|{id:string;title:string;status:string;dueDate:string|null;assigneeId:string|null;assigneeName:string|null;basis:string};
}
function object(v:unknown):Record<string,unknown>{if(!v||typeof v!=='object'||Array.isArray(v))throw Error('Yenileme verisi doğrulanamadı.');return v as Record<string,unknown>;}
function revision(v:unknown):number{if(typeof v!=='number'||!Number.isSafeInteger(v)||v<0||v>=Number.MAX_SAFE_INTEGER)throw Error('Sözleşme sürümü doğrulanamadı.');return v;}
function string(v:unknown):string{if(typeof v!=='string')throw Error('Yenileme metni doğrulanamadı.');return v;}
function nullable(v:unknown){return v===null?null:string(v);}
export function renewalDate(v:unknown):string{
  const s=string(v);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(s)||s<'1900-01-01'||s>'9999-12-31')throw Error('Geçerli bir takip tarihi seçin.');
  const d=new Date(s+'T00:00:00Z');if(!Number.isFinite(d.getTime())||d.toISOString().slice(0,10)!==s)throw Error('Geçerli bir takip tarihi seçin.');return s;
}
export function validateRenewalCommand(input:unknown):RenewalCommand{
  const c=object(input),basis=string(c.basis).trim();if(!basis||Array.from(basis).length>2000)throw Error('1–2000 karakterlik dayanak açıklaması girin.');
  return {commandId:transferId(c.commandId),contractId:transferId(c.contractId),revision:revision(c.revision),assigneeId:transferId(c.assigneeId),dueDate:renewalDate(c.dueDate),basis};
}
export function parseRenewalSnapshot(input:unknown,contractId:string):RenewalSnapshot{
  const s=object(input);if(s.contractId!==transferId(contractId)||!['aday','aktif','pasif'].includes(String(s.companyStatus)))throw Error('Sözleşme kapsamı doğrulanamadı.');
  let task:RenewalSnapshot['task']=null;
  if(s.task!==null){const t=object(s.task);if(!['acik','devam_ediyor','gecikti','tamamlandi','iptal'].includes(String(t.status)))throw Error('Görev durumu doğrulanamadı.');
    task={id:transferId(t.id),title:string(t.title),status:string(t.status),dueDate:nullable(t.dueDate),assigneeId:t.assigneeId===null?null:transferId(t.assigneeId),assigneeName:nullable(t.assigneeName),basis:string(t.basis)};}
  return {contractId:transferId(s.contractId),revision:revision(s.revision),companyStatus:s.companyStatus as RenewalSnapshot['companyStatus'],suggestedDate:s.suggestedDate===null?null:renewalDate(s.suggestedDate),task};
}
export function parseRenewalResult(input:unknown,command:RenewalCommand){const r=object(input);
  if(r.commandId!==command.commandId||r.contractId!==command.contractId)throw Error('Yenileme sonucu doğrulanamadı.');
  return {commandId:command.commandId,contractId:command.contractId,taskId:transferId(r.taskId)};
}
export function renewalFailure(error:unknown):{error:string;uncertain:boolean}{
  const message=error instanceof Error?error.message:typeof error==='object'&&error!==null&&'message'in error?String(error.message):'';
  const messages:Record<string,string>={RENEWAL_SCOPE:'Hesap veya çalışma alanı değişti. Sayfayı yenileyin.',RENEWAL_FORBIDDEN:'Yenileme görevi için yönetici yetkisi gerekiyor.',RENEWAL_VALIDATION:'Görev bilgilerini kontrol edin.',RENEWAL_CONFLICT:'Sözleşme değişti. Güncel bilgileri yükleyip yeniden değerlendirin.',RENEWAL_EXISTS:'Bu sözleşmenin yenileme görevi zaten var. Güncel kaydı yükleyin.',RENEWAL_PASSIVE:'Pasif firma için yeni yenileme görevi oluşturulamaz.',RENEWAL_TARGET:'Sorumlunun aktif üyeliği veya görev erişimi yok.',RENEWAL_ISOLATION:'İşlem ortamı doğrulanamadı. Yeniden deneyin.'};
  return messages[message]?{error:messages[message],uncertain:false}:{error:'İşlemin sonucu doğrulanamadı. Aynı işlemi tekrar deneyin; ikinci görev oluşturulmaz.',uncertain:true};
}
