import {isWorkDate} from '@/lib/operations/daily-demand';
import type {InboxItem} from '@/lib/operations/conversation-read';
import {isUuid} from '@/lib/operations/pilot-validation';
export type InboxScope={actorId:string;tenantId:string};
export function inboxScopeKey(scope:InboxScope):string {
 if(!isUuid(scope.actorId)||!isUuid(scope.tenantId))throw Error('INBOX_SCOPE');
 return `${scope.actorId}:${scope.tenantId}`;
}
export function assertInboxScope(actual:InboxScope,expected:InboxScope):void {
 if(actual.actorId!==expected.actorId||actual.tenantId!==expected.tenantId)throw Error('Bildirimlerin şirketi veya oturumu değişti. Sayfayı yenileyin.');
}
/** First successful snapshot is always silent, including after a reload. */
export function observeInbox(previous:readonly string[]|null,items:readonly InboxItem[]) {
 const known=new Set(previous??[]);
 const fresh=previous===null?[]:items.filter(item=>!item.read_at&&!known.has(item.message_id)).map(item=>item.message_id);
 return {fresh,seen:[...new Set([...items.map(item=>item.message_id),...(previous??[])])].slice(0,300)};
}
export function inboxHref(item:InboxItem):string {
 if(!isUuid(item.company_id)||!isUuid(item.request_id)||!isWorkDate(item.work_date))throw Error('INBOX_TARGET');
 return `/talepler/gunluk?${new URLSearchParams({firma:item.company_id,gun:item.work_date,talep:item.request_id})}#talep-${item.request_id}`;
}
type Ledger={ids:string[];lastSoundAt:number};
const EMPTY:Ledger={ids:[],lastSoundAt:0};
export function parseSoundLedger(raw:string|null):Ledger {
 if(raw===null)return {...EMPTY};
 const v:unknown=JSON.parse(raw);
 if(!v||typeof v!=='object'||!('ids' in v)||!Array.isArray(v.ids)||v.ids.length>300||v.ids.some(id=>!isUuid(id))||!('lastSoundAt' in v)||typeof v.lastSoundAt!=='number'||!Number.isFinite(v.lastSoundAt)||v.lastSoundAt<0)throw Error('SOUND_STORAGE');
 return {ids:v.ids,lastSoundAt:v.lastSoundAt};
}
export function planSound(ledger:Ledger,ids:readonly string[],now:number) {
 if(ids.some(id=>!isUuid(id)))throw Error('SOUND_EVENT');
 const fresh=ids.filter(id=>!ledger.ids.includes(id));
 // Consume bursts even when suppressed: no delayed replay after the quiet period.
 return {play:fresh.length>0&&(ledger.lastSoundAt===0||now-ledger.lastSoundAt>=60000),ledger:{ids:[...new Set([...fresh,...ledger.ids])].slice(0,300),lastSoundAt:ledger.lastSoundAt}};
}
type Storage=Pick<globalThis.Storage,'getItem'|'setItem'>;
type Locks={request<T>(name:string,callback:()=>Promise<T>|T):Promise<T>};
/** Only IDs and a timestamp are stored; Web Locks serialize tabs in this browser.
 * Missing locks/storage disable sound instead of risking duplicate playback. */
export async function playInboxSoundOnce(scope:InboxScope,ids:readonly string[],storage:Storage,locks:Locks,play:()=>boolean,now=Date.now()):Promise<boolean> {
 const key='bps:inbox-sound:v1:'+inboxScopeKey(scope);
 if(!locks?.request)throw Error('SOUND_UNAVAILABLE');
 return locks.request(key,()=>{
  const next=planSound(parseSoundLedger(storage.getItem(key)),ids,now);
  // Persist the claim before playing; a crash may miss a sound, never duplicates it.
  if(next.play)next.ledger.lastSoundAt=now;
  storage.setItem(key,JSON.stringify(next.ledger));
  return next.play&&play();
 });
}
