/** Strict boundary for the bounded transfer command and its measured preview. */
export interface TransferTask { id: string; revision: number; title: string; companyName: string | null }
export interface TransferPreview { sourceId: string; total: number; tasks: TransferTask[] }
export interface TransferMember { id: string; name: string | null }
export interface TransferDirectory { sources: (TransferMember & { count: number })[]; targets: TransferMember[] }
export interface TransferCommand { commandId: string; sourceId: string; targetId: string; tasks: {id:string;revision:number}[] }
export interface TransferResult { commandId:string; sourceId:string; targetId:string; moved:number }
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const record = (v: unknown): Record<string,unknown> => {
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error('Devir verisi doğrulanamadı.');
  return v as Record<string,unknown>;
};
export function transferId(v: unknown): string {
  if (typeof v !== 'string' || !uuid.test(v)) throw new Error('Devir kimliği geçersiz.');
  return v.toLowerCase();
}
function integer(v:unknown,min=0,max=Number.MAX_SAFE_INTEGER): number {
  if(typeof v!=='number'||!Number.isSafeInteger(v)||v<min||v>max)throw new Error('Devir sayısı doğrulanamadı.');
  return v;
}
function nullableName(v:unknown):string|null {
  if(v!==null&&typeof v!=='string')throw new Error('Devir adı doğrulanamadı.');
  return v;
}
export function parseTransferDirectory(value:unknown):TransferDirectory {
  const v=record(value);
  if(!Array.isArray(v.sources)||!Array.isArray(v.targets))throw new Error('Devir listesi doğrulanamadı.');
  const member=(value:unknown)=>{const p=record(value);return {id:transferId(p.id),name:nullableName(p.name)};};
  const sources=v.sources.map(value=>({...member(value),count:integer(record(value).count,1)}));
  const targets=v.targets.map(member);
  if(new Set(sources.map(p=>p.id)).size!==sources.length||new Set(targets.map(p=>p.id)).size!==targets.length)throw new Error('Devir listesi tekrar içeriyor.');
  return {sources,targets};
}
export function parseTransferPreview(value:unknown,sourceId:string):TransferPreview {
  const p=record(value),source=transferId(p.sourceId),total=integer(p.total);
  if(source!==transferId(sourceId)||!Array.isArray(p.tasks)||p.tasks.length!==Math.min(total,100))throw new Error('Devir önizlemesi eksik veya değişmiş.');
  const tasks=p.tasks.map(value=>{const t=record(value);if(typeof t.title!=='string')throw new Error('Görev başlığı doğrulanamadı.');
    return {id:transferId(t.id),revision:integer(t.revision),title:t.title,companyName:nullableName(t.companyName)};});
  if(new Set(tasks.map(t=>t.id)).size!==tasks.length)throw new Error('Önizleme tekrar içeriyor.');
  return {sourceId:source,total,tasks};
}
export function validateTransferCommand(value:unknown):TransferCommand {
  const c=record(value),commandId=transferId(c.commandId),sourceId=transferId(c.sourceId),targetId=transferId(c.targetId);
  if(sourceId===targetId||!Array.isArray(c.tasks)||c.tasks.length<1||c.tasks.length>100)throw new Error('Farklı iki kişi ve en fazla 100 görev seçin.');
  const tasks=c.tasks.map(value=>{const t=record(value);return {id:transferId(t.id),revision:integer(t.revision,0,Number.MAX_SAFE_INTEGER-1)};}).sort((a,b)=>a.id.localeCompare(b.id));
  if(new Set(tasks.map(t=>t.id)).size!==tasks.length)throw new Error('Aynı görev iki kez devredilemez.');
  return {commandId,sourceId,targetId,tasks};
}
export function parseTransferResult(value:unknown,command:TransferCommand):TransferResult {
  const r=record(value);
  if(r.commandId!==command.commandId||r.sourceId!==command.sourceId||r.targetId!==command.targetId||r.moved!==command.tasks.length)throw new Error('Devir sonucu doğrulanamadı. Aynı işlemi tekrar deneyin.');
  return {commandId:command.commandId,sourceId:command.sourceId,targetId:command.targetId,moved:command.tasks.length};
}
export function transferFailure(error:unknown):{error:string;uncertain:boolean} {
  const message=error instanceof Error?error.message:typeof error==='object'&&error!==null&&'message' in error?String(error.message):'';
  const known:Record<string,string>={TRANSFER_SCOPE:'Hesap veya çalışma alanı değişti. Sayfayı yenileyin.',TRANSFER_FORBIDDEN:'Görev devri için yönetici yetkisi gerekiyor.',TRANSFER_TARGET_ROLE:'Hedef kişinin görev erişimi yok. Başka bir üye seçin.',TRANSFER_TARGET:'Hedef kişi artık bu çalışma alanının üyesi değil.',TRANSFER_VALIDATION:'Devir bilgileri geçersiz. Önizlemeyi yenileyin.',TRANSFER_COMMAND:'Bu işlem kimliği farklı bir devir için kullanılmış. Önizlemeyi yenileyin.',TRANSFER_CONFLICT:'Görevlerden biri değişti. Hiçbiri devredilmedi; önizlemeyi yenileyin.'};
  for(const [code,text] of Object.entries(known))if(message===code)return {error:text,uncertain:false};
  return {error:'İşlemin sonucu doğrulanamadı. Aynı işlemi tekrar deneyin; aynı komut ikinci kez uygulanmaz.',uncertain:true};
}
