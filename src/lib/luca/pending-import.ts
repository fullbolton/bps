import {isUuid} from '@/lib/operations/pilot-validation';
type Scope={actorId:string;tenantId:string};
type Storage=Pick<globalThis.Storage,'getItem'|'setItem'|'removeItem'>;
type Locks={request<T>(name:string,callback:()=>Promise<T>|T):Promise<T>};
type Pending={id:string;fileDigest:string;payloadDigest:string};
const hex=/^[a-f0-9]{64}$/;
const key=(scope:Scope)=>{if(!isUuid(scope.actorId)||!isUuid(scope.tenantId))throw Error('Aktarım kapsamı doğrulanamadı.');return `bps:luca:pending:v1:${scope.actorId}:${scope.tenantId}`;};
function canonical(value:unknown):unknown{
 if(Array.isArray(value))return value.map(canonical);
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).sort(([a],[b])=>a<b?-1:a>b?1:0).map(([k,v])=>[k,canonical(v)]));
 return value;
}
export async function digestMizan(bytes:ArrayBuffer):Promise<string>{return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),n=>n.toString(16).padStart(2,'0')).join('');}
function read(storage:Storage,k:string):Pending|null{
 const raw=storage.getItem(k);if(raw===null)return null;
 if(raw.length>512)throw Error('Bekleyen aktarım kaydı bozuk. Yeni aktarım başlatılmadı.');
 let v:Pending;try{v=JSON.parse(raw);}catch{throw Error('Bekleyen aktarım kaydı okunamadı.');}
 if(!v||!isUuid(v.id)||!hex.test(v.fileDigest)||!hex.test(v.payloadDigest))throw Error('Bekleyen aktarım kaydı bozuk.');return v;
}
export async function reserveMizan(scope:Scope,fileDigest:string,payload:unknown,storage:Storage,locks:Locks):Promise<string>{
 const k=key(scope);if(!hex.test(fileDigest)||!locks?.request)throw Error('Güvenli aktarım kurtarma kullanılamıyor.');
 const payloadDigest=await digestMizan(new TextEncoder().encode(JSON.stringify(canonical(payload))).buffer);
 return locks.request(k,()=>{
  const old=read(storage,k);
  if(old){
   if(old.fileDigest!==fileDigest)throw Error('Önce bekleyen aktarımın aynı Excel dosyasını seçip onayını tamamlayın.');
   if(old.payloadDigest!==payloadDigest)throw Error('Bekleyen dosyanın eşlemesi veya adı değişti. Yeni kayıt açılmadı; önceki aktarımın durumu kontrol edilmeli.');
   return old.id;
  }
  const value:Pending={id:crypto.randomUUID(),fileDigest,payloadDigest};storage.setItem(k,JSON.stringify(value));return value.id;
 });
}
export async function settleMizan(scope:Scope,id:string,storage:Storage,locks:Locks):Promise<void>{
 const k=key(scope);if(!locks?.request)throw Error('Kurtarma kaydı güncellenemedi.');
 await locks.request(k,()=>{if(read(storage,k)?.id===id)storage.removeItem(k);});
}

export function isRejectedMizanInput(error:{code?:string;message?:string}):boolean{
 return error.code==='P0001'&&['MIZAN_INPUT','MIZAN_AMOUNT','MIZAN_DUPLICATE_ACCOUNT','MIZAN_COMPANY_SCOPE'].includes(error.message??'');
}
