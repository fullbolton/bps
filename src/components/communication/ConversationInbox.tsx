'use client';
import {useState,useRef,useEffect,useCallback,useId} from 'react';
import Link from 'next/link';
import {Bell,Volume2,VolumeX,X,RefreshCw} from 'lucide-react';
import {useAuth} from '@/context/AuthContext';
import {useNavigationGuard} from '@/context/NavigationGuardContext';
import {workspaceScope} from '@/lib/workspace-context';
import {conversationInbox,conversationRead} from '@/app/(main)/iletisim/actions';
import type {InboxItem} from '@/lib/operations/conversation-read';
import {assertInboxScope,inboxHref,inboxScopeKey,observeInbox,playInboxSoundOnce,type InboxScope} from '@/lib/notifications/inbox-state';
import {createInboxTone} from '@/lib/notifications/sound';

const control='inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border px-3 text-sm disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-blue-600';
export default function ConversationInbox(){
 const {user,role,loading}=useAuth();
 const scope=workspaceScope(user);
 if(loading||!scope||(role!=='yonetici'&&role!=='operasyon'))return null;
 return <ScopedInbox key={`${inboxScopeKey(scope)}:${role}`} actorId={scope.actorId} tenantId={scope.tenantId}/>;
}
function ScopedInbox({actorId,tenantId}:InboxScope){
 const [open,setOpen]=useState(false),[items,setItems]=useState<InboxItem[]>([]);
 const [unread,setUnread]=useState<number|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [more,setMore]=useState(false),[expanded,setExpanded]=useState(false),[checkedAt,setCheckedAt]=useState<string|null>(null);
 const [online,setOnline]=useState(true);
 const [sound,setSound]=useState(false),[soundBusy,setSoundBusy]=useState(false),[notice,setNotice]=useState('');
 const alive=useRef(true),flight=useRef(false),reading=useRef(false),soundFlight=useRef(false);
 const currentItems=useRef(items),seen=useRef<string[]|null>(null),soundOn=useRef(false);
 const tone=useRef<ReturnType<typeof createInboxTone>|null>(null);
 const openRef=useRef(open),expandedRef=useRef(expanded);
 currentItems.current=items;openRef.current=open;expandedRef.current=expanded;
 const container=useRef<HTMLDivElement>(null),button=useRef<HTMLButtonElement>(null),panelId=useId();
 const navigationGuard=useNavigationGuard();

 const load=useCallback(async(mode:'latest'|'older'='latest',afterRead=false)=>{
  if(!alive.current||flight.current||(reading.current&&!afterRead))return;
  flight.current=true;setBusy(true);setError('');
  try {
   const before=mode==='older'?currentItems.current.at(-1)?.message_id??null:null;
   const result=await conversationInbox(before);
   if(!alive.current)return;
   if(!result.ok)throw Error(result.message);
   assertInboxScope(result,{actorId,tenantId});
   if(mode==='older'){
    setItems(old=>[...old,...result.items.filter(item=>!old.some(row=>row.message_id===item.message_id))]);setExpanded(true);
   }else{
    setItems(result.items);setExpanded(false);
    const observation=observeInbox(seen.current,result.items);seen.current=observation.seen;
    if(soundOn.current&&observation.fresh.length){
     try {
      await playInboxSoundOnce({actorId,tenantId},observation.fresh,localStorage,navigator.locks,()=>{
       if(!alive.current||!soundOn.current||document.visibilityState!=='visible')return false;
       const played=tone.current?.play()??false;
       if(!played){soundOn.current=false;setSound(false);setNotice('Tarayıcı sesi durdurdu. Sesi yeniden açabilirsiniz.');}
       return played;
      });
     }catch{if(alive.current){soundOn.current=false;setSound(false);setNotice('Bildirim sesi kullanılamıyor. Görsel bildirimler devam ediyor.');}}
    }
   }
   if(!alive.current)return;
   setUnread(result.unread);setMore(result.items.length===30);
   setCheckedAt(new Intl.DateTimeFormat('tr-TR',{hour:'2-digit',minute:'2-digit',timeZone:'Europe/Istanbul'}).format(new Date()));
  }catch(e){if(alive.current){setItems([]);setUnread(null);setMore(false);setExpanded(false);setError(e instanceof Error?e.message:'Bildirimler yüklenemedi.');}}
  finally{flight.current=false;if(alive.current)setBusy(false);}
 },[actorId,tenantId]);

 useEffect(()=>{
  alive.current=true;
  const offline=()=>setOnline(false);
  const refresh=()=>{setOnline(navigator.onLine);if(document.visibilityState==='visible'&&navigator.onLine&&!(openRef.current&&expandedRef.current))void load();};
  refresh();const timer=window.setInterval(refresh,30000);
  document.addEventListener('visibilitychange',refresh);window.addEventListener('online',refresh);window.addEventListener('offline',offline);
  return ()=>{alive.current=false;clearInterval(timer);document.removeEventListener('visibilitychange',refresh);window.removeEventListener('online',refresh);window.removeEventListener('offline',offline);soundOn.current=false;tone.current?.close();};
 },[load]);
 useEffect(()=>{
  const outside=(event:PointerEvent)=>{if(!container.current?.contains(event.target as Node))setOpen(false);};
  document.addEventListener('pointerdown',outside);return()=>document.removeEventListener('pointerdown',outside);
 },[]);
 async function toggleSound(){
  if(soundFlight.current)return;
  if(soundOn.current){soundOn.current=false;setSound(false);tone.current?.close();setNotice('Bildirim sesi kapalı.');return;}
  soundFlight.current=true;setSoundBusy(true);setNotice('');
  try{
   if(!navigator.locks?.request)throw Error('SOUND_UNAVAILABLE');
   // Check storage before enabling; no message body or company name is persisted.
   localStorage.getItem('bps:inbox-sound:v1:'+inboxScopeKey({actorId,tenantId}));
   tone.current??=createInboxTone();await tone.current.enable();
   if(!alive.current){tone.current.close();return;}
   soundOn.current=true;setSound(true);setNotice('Ses açık. Bu sekmede yeni etiket ve yanıtlar için kısa bir ses duyarsınız.');
  }catch{if(alive.current)setNotice('Ses açılamadı. Tarayıcı ses izinlerini kontrol edin; görsel bildirimler çalışmaya devam eder.');}
  finally{soundFlight.current=false;if(alive.current)setSoundBusy(false);}
 }
 async function markRead(id:string){
  if(flight.current||reading.current)return;
  reading.current=true;setBusy(true);setError('');setNotice('');
  try{
   const result=await conversationRead(id);if(!alive.current)return;if(!result.ok)throw Error(result.message);
   setNotice('Okundu olarak kaydedildi.');await load('latest',true);
  }catch(e){if(alive.current)setError(e instanceof Error?e.message:'Okundu bilgisi kaydedilemedi.');}
  finally{reading.current=false;if(alive.current)setBusy(false);}
 }
 const countLabel=!online?'Bağlantı yok':unread===null?(error?'Kontrol edilemedi':'Kontrol ediliyor'):`${unread} okunmamış`;
 return <div ref={container} className="relative" onKeyDown={event=>{if(event.key==='Escape'&&open){event.preventDefault();event.stopPropagation();setOpen(false);button.current?.focus();}}}>
  <button ref={button} type="button" aria-label={`Bildirimler · ${countLabel}`} aria-expanded={open} aria-controls={open?panelId:undefined}
   onClick={()=>{setOpen(!open);if(!open)void load();}} className={`${control} relative border-slate-200 bg-white text-slate-700`}>
   <Bell size={18}/><span className="hidden lg:inline">Bildirimler</span>
   {online&&unread!==null&&unread>0&&<span className="rounded-full bg-blue-700 px-1.5 text-xs font-semibold text-white">{unread>99?'99+':unread}</span>}
   {(error||!online)&&<span className="text-amber-700" aria-hidden="true">!</span>}
  </button>
  {open&&<section id={panelId} aria-label="Bana gelenler" className="fixed left-3 right-3 top-[4.5rem] z-50 max-h-[80dvh] overflow-y-auto rounded-xl border border-slate-200 bg-white p-4 shadow-xl sm:absolute sm:left-auto sm:right-0 sm:top-full sm:mt-2 sm:w-96">
   <div className="flex items-center justify-between gap-2"><div><h2 className="font-semibold text-slate-900">Bana gelenler</h2><p className="text-xs text-slate-500">Talep konuşmalarındaki etiket ve yanıtlar</p></div><button type="button" className="min-h-11 min-w-11 rounded-lg hover:bg-slate-100" onClick={()=>{setOpen(false);button.current?.focus();}} aria-label="Bildirimleri kapat"><X className="mx-auto" size={18}/></button></div>
   <div className="my-3 flex flex-wrap gap-2"><button type="button" className={control} disabled={busy} onClick={()=>void load()}><RefreshCw size={15}/>{expanded?'En yeniye dön':'Yenile'}</button><button type="button" className={control} aria-pressed={sound} disabled={soundBusy} onClick={()=>void toggleSound()}>{sound?<Volume2 size={15}/>:<VolumeX size={15}/>} {sound?'Sesi kapat':'Sesi aç'}</button></div>
   <p className="mb-3 text-xs text-slate-500">{expanded?'Önceki bildirimleri inceliyorsunuz.': 'Sayfa açıkken 30 saniyede bir kontrol edilir.'}{checkedAt?` Son kontrol: ${checkedAt}.`:''}</p>
   {!online&&<p role="status" className="mb-3 rounded-lg bg-amber-50 p-3 text-sm">İnternet bağlantısı yok. Bağlantı geldiğinde bildirimler yeniden kontrol edilecek.</p>}
   {notice&&<p role="status" className="mb-3 rounded-lg bg-blue-50 p-3 text-sm text-blue-900">{notice}</p>}
   {error&&<p role="alert" className="mb-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{error}</p>}
   {busy&&<p role="status" className="mb-2 text-sm text-slate-500">Kontrol ediliyor…</p>}
   {online&&!busy&&!error&&items.length===0&&<div className="py-6 text-center text-sm text-slate-600"><p className="font-medium">Henüz size gelen bir bildirim yok.</p><p className="mt-1">Bir talepte etiketlendiğinizde veya mesajınıza yanıt geldiğinde burada görünür.</p></div>}
   <ul className="space-y-3">{(online?items:[]).map(item=><li key={item.message_id} className={`rounded-lg border p-3 text-sm ${item.read_at?'border-slate-200':'border-blue-200 bg-blue-50/50'}`}>
    <div className="flex justify-between gap-2"><p className="font-medium text-slate-900">{item.company_name}</p>{!item.read_at&&<span className="text-xs font-semibold text-blue-700">Yeni</span>}</div>
    <p className="mt-1 text-xs text-slate-500">İş günü: {new Intl.DateTimeFormat('tr-TR',{timeZone:'Europe/Istanbul'}).format(new Date(item.work_date+'T12:00:00Z'))}</p>
    <p className="my-2 line-clamp-3 whitespace-pre-wrap break-words text-slate-700">{item.body}</p>
    <div className="flex flex-wrap items-center gap-2"><Link onClick={event=>{navigationGuard.handle(event);if(!event.defaultPrevented)setOpen(false);}} className={`${control} border-blue-200 text-blue-700`} href={inboxHref(item)}>Talebi aç</Link>{item.read_at?<span className="text-xs text-slate-500">Okundu</span>:<button type="button" disabled={busy} className={control} onClick={()=>void markRead(item.message_id)}>Okundu işaretle</button>}</div>
   </li>)}</ul>
   {online&&more&&<button type="button" disabled={busy} className={`${control} mt-3 w-full`} onClick={()=>void load('older')}>Önceki bildirimler</button>}
  </section>}
 </div>;
}
