import { parseCommandResolutions } from './command-reconciliation';
import { isUuid } from './pilot-validation';
export type CommandScope = { actorId:string; tenantId:string };
type Entry = { digest:string; id:string };
type Storage = Pick<globalThis.Storage,'getItem'|'setItem'>;
type Locks = { request<T>(name:string, callback:()=>Promise<T>|T):Promise<T> };
const prefix='bps:pending:v1:';
const keyFor=(s:CommandScope)=>{
  if(!isUuid(s.actorId)||!isUuid(s.tenantId))throw new Error('İşlem kapsamı doğrulanamadı.');
  return prefix+s.actorId+':'+s.tenantId;
};
function entries(storage:Storage,key:string):Entry[]{
  const raw=storage.getItem(key);
  if(raw===null)return [];
  if(raw.length>16000)throw new Error('İşlem kurtarma kaydı okunamadı.');
  const data:unknown=JSON.parse(raw);
  if(!Array.isArray(data)||data.length>50||data.some(e=>!e||typeof e!=='object'||!isUuid(e.id)||typeof e.digest!=='string'||!/^[a-f0-9]{64}$/.test(e.digest))||new Set(data.map(e=>e.digest)).size!==data.length||new Set(data.map(e=>e.id)).size!==data.length)throw new Error('İşlem kurtarma kaydı okunamadı.');
  return data;
}
function canonical(v:unknown):unknown{
  if(Array.isArray(v))return v.map(canonical);
  if(v&&typeof v==='object')return Object.fromEntries(Object.entries(v).sort(([a],[b])=>a<b?-1:a>b?1:0).map(([k,x])=>[k,canonical(x)]));
  return v;
}
export function pendingCount(scope:CommandScope,storage:Storage):number{return entries(storage,keyFor(scope)).length;}
export async function reserveCommand(scope:CommandScope,kind:string,payload:unknown,storage:Storage,locks:Locks):Promise<string>{
  const key=keyFor(scope);
  const bytes=new TextEncoder().encode(JSON.stringify({kind,payload:canonical(payload)}));
  const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),n=>n.toString(16).padStart(2,'0')).join('');
  if(!locks?.request)throw new Error('Bu tarayıcı güvenli işlem kurtarmayı desteklemiyor.');
  return locks.request(key,()=>{
    const list=entries(storage,key),existing=list.find(e=>e.digest===digest);
    if(existing)return existing.id;
    if(list.length>=50)throw new Error('Doğrulanmamış işlem sınırına ulaşıldı; önce önceki işlemleri kontrol edin.');
    const id=crypto.randomUUID();list.push({digest,id});storage.setItem(key,JSON.stringify(list));return id;
  });
}
export async function acknowledgeCommand(scope:CommandScope,id:string,storage:Storage,locks:Locks):Promise<void>{
  const key=keyFor(scope);
  if(!locks?.request)throw new Error('İşlem kurtarma kaydı güncellenemedi.');
  await locks.request(key,()=>{storage.setItem(key,JSON.stringify(entries(storage,key).filter(e=>e.id!==id)));});
}

export function pendingCommandIds(scope:CommandScope,storage:Storage):string[]{return entries(storage,keyFor(scope)).map(e=>e.id);}
export async function reconcilePending(scope:CommandScope,requestedIds:string[],response:unknown,storage:Storage,locks:Locks):Promise<{confirmed:number;closed:number;unknown:number}>{
  const rows=parseCommandResolutions(requestedIds,response);
  if(!locks?.request)throw new Error('İşlem kurtarma kaydı güncellenemedi.');
  const settled=new Set(rows.filter(r=>r.status!=='unknown').map(r=>r.id));
  const key=keyFor(scope);
  await locks.request(key,()=>{storage.setItem(key,JSON.stringify(entries(storage,key).filter(e=>!settled.has(e.id))));});
  return {confirmed:rows.filter(r=>r.status==='confirmed').length,closed:rows.filter(r=>r.status==='closed').length,unknown:rows.filter(r=>r.status==='unknown').length};
}
