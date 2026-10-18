'use client';
import {useState,useRef,useEffect,useCallback,useId} from 'react';
import Link from 'next/link';
import {Bell,X,RefreshCw} from 'lucide-react';
import {useAuth} from '@/context/AuthContext';
import {useNavigationGuard} from '@/context/NavigationGuardContext';
import {workspaceScope} from '@/lib/workspace-context';
import {conversationInbox,conversationRead} from '@/app/(main)/iletisim/actions';
import {workspaceInbox,workspaceInboxRead} from '@/app/(main)/bildirimler/actions';
import {inboxEventKey,observeWorkspaceInbox,playWorkspaceInboxSoundOnce,type WorkspaceInboxItem,type InboxCursor} from '@/lib/notifications/workspace-inbox';
import {inboxPresentation,canUseInbox} from '@/lib/notifications/inbox-presentation';
import {assertInboxScope,inboxScopeKey,playInboxSoundOnce,type InboxScope} from '@/lib/notifications/inbox-state';
import {useNotificationSound} from '@/context/NotificationSoundContext';
import NotificationSoundControls from './NotificationSoundControls';

const unified=process.env.NEXT_PUBLIC_BPS_WORKSPACE_INBOX_ENABLED==='true';
const control='inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border px-3 text-sm disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-blue-600';
export default function ConversationInbox(){
 const {user,role,loading}=useAuth();
 const scope=workspaceScope(user);
 if(loading||!scope||!canUseInbox(role,unified,process.env.NEXT_PUBLIC_BPS_CONVERSATION_ENABLED==='true'))return null;
 return <ScopedInbox key={`${inboxScopeKey(scope)}:${role}`} actorId={scope.actorId} tenantId={scope.tenantId}/>;
}
function ScopedInbox({actorId,tenantId}:InboxScope){
 const [open,setOpen]=useState(false),[items,setItems]=useState<WorkspaceInboxItem[]>([]);
 const [unread,setUnread]=useState<number|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [more,setMore]=useState(false),[expanded,setExpanded]=useState(false),[checkedAt,setCheckedAt]=useState<string|null>(null);
 const [online,setOnline]=useState(true);
 const [notice,setNotice]=useState('');
 const sound=useNotificationSound();
 const soundRef=useRef(sound);soundRef.current=sound;
 const alive=useRef(true),flight=useRef(false),reading=useRef(false);
 const cursor=useRef<InboxCursor|null>(null);
 const seen=useRef<string[]|null>(null);
 const openRef=useRef(open),expandedRef=useRef(expanded);
 openRef.current=open;expandedRef.current=expanded;
 const container=useRef<HTMLDivElement>(null),button=useRef<HTMLButtonElement>(null),panelId=useId();
 const navigationGuard=useNavigationGuard();

 const load=useCallback(async(mode:'latest'|'older'='latest',afterRead=false)=>{
  if(!alive.current||flight.current||(reading.current&&!afterRead))return;
  flight.current=true;setBusy(true);setError('');
  try {
   const before=mode==='older'?cursor.current:null;
   const raw=unified?await workspaceInbox({actorId,tenantId},before):await conversationInbox(before?.id??null);
   if(!raw.ok)throw Error(raw.message);
   const result='nextCursor' in raw?raw:{...raw,items:raw.items.map(item=>({kind:'conversation' as const,id:item.message_id,createdAt:item.created_at,readAt:item.read_at,payload:{requestId:item.request_id,companyId:item.company_id,companyName:item.company_name,workDate:item.work_date,body:item.body}})),nextCursor:raw.items.length===30?{kind:'conversation' as const,id:raw.items[29].message_id}:null};
   if(!alive.current)return;
   assertInboxScope(result,{actorId,tenantId});
   if(mode==='older'){
    setItems(old=>[...old,...result.items.filter(item=>!old.some(row=>inboxEventKey(row)===inboxEventKey(item)))]);setExpanded(true);
   }else{
    setItems(result.items);setExpanded(false);
    const observation=observeWorkspaceInbox(seen.current,result.items);seen.current=observation.seen;
    if(soundRef.current.active&&observation.fresh.length){
     try {
      await (unified?playWorkspaceInboxSoundOnce:playInboxSoundOnce)({actorId,tenantId},unified?observation.fresh:observation.fresh.map(key=>key.split(':')[1]),localStorage,navigator.locks,()=>{
       return alive.current && soundRef.current.play();
      });
     }catch{if(alive.current)soundRef.current.fail();}
    }
   }
   if(!alive.current)return;
   setUnread(result.unread);cursor.current=result.nextCursor;setMore(result.nextCursor!==null);
   setCheckedAt(new Intl.DateTimeFormat('tr-TR',{hour:'2-digit',minute:'2-digit',timeZone:'Europe/Istanbul'}).format(new Date()));
  }catch(e){if(alive.current){cursor.current=null;setItems([]);setUnread(null);setMore(false);setExpanded(false);setError(e instanceof Error?e.message:'Bildirimler yüklenemedi.');}}
  finally{flight.current=false;if(alive.current)setBusy(false);}
 },[actorId,tenantId]);

 useEffect(()=>{
  alive.current=true;
  const offline=()=>setOnline(false);
  const refresh=()=>{setOnline(navigator.onLine);if(document.visibilityState==='visible'&&navigator.onLine&&!(openRef.current&&expandedRef.current))void load();};
  refresh();const timer=window.setInterval(refresh,30000);
  document.addEventListener('visibilitychange',refresh);window.addEventListener('online',refresh);window.addEventListener('offline',offline);
  return ()=>{alive.current=false;clearInterval(timer);document.removeEventListener('visibilitychange',refresh);window.removeEventListener('online',refresh);window.removeEventListener('offline',offline);};
 },[load]);
 useEffect(()=>{
  const outside=(event:PointerEvent)=>{if(!container.current?.contains(event.target as Node))setOpen(false);};
  document.addEventListener('pointerdown',outside);return()=>document.removeEventListener('pointerdown',outside);
 },[]);
 async function markRead(item:WorkspaceInboxItem){
  if(flight.current||reading.current)return;
  reading.current=true;setBusy(true);setError('');setNotice('');
  try{
   const result=unified?await workspaceInboxRead({actorId,tenantId},{kind:item.kind,id:item.id}):await conversationRead(item.id);if(!alive.current)return;if(!result.ok)throw Error(result.message);
   if('actorId' in result)assertInboxScope(result,{actorId,tenantId});
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
   <div className="flex items-center justify-between gap-2"><div><h2 className="font-semibold text-slate-900">Bana gelenler</h2><p className="text-xs text-slate-500">{unified?'Görevleriniz, şirket duyuruları ve talep mesajları':'Talep konuşmalarındaki etiket ve yanıtlar'}</p></div><button type="button" className="min-h-11 min-w-11 rounded-lg hover:bg-slate-100" onClick={()=>{setOpen(false);button.current?.focus();}} aria-label="Bildirimleri kapat"><X className="mx-auto" size={18}/></button></div>
   <div className="my-3 flex flex-wrap gap-2"><button type="button" className={control} disabled={busy} onClick={()=>void load()}><RefreshCw size={15}/>{expanded?'En yeniye dön':'Yenile'}</button></div><NotificationSoundControls compact />
   <p className="mb-3 text-xs text-slate-500">{expanded?'Önceki bildirimleri inceliyorsunuz.': 'Sayfa açıkken 30 saniyede bir kontrol edilir.'}{checkedAt?` Son kontrol: ${checkedAt}.`:''}</p>
   {!online&&<p role="status" className="mb-3 rounded-lg bg-amber-50 p-3 text-sm">İnternet bağlantısı yok. Bağlantı geldiğinde bildirimler yeniden kontrol edilecek.</p>}
   {notice&&<p role="status" className="mb-3 rounded-lg bg-blue-50 p-3 text-sm text-blue-900">{notice}</p>}
   {error&&<p role="alert" className="mb-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{error}</p>}
   {busy&&<p role="status" className="mb-2 text-sm text-slate-500">Kontrol ediliyor…</p>}
   {online&&!busy&&!error&&items.length===0&&<div className="py-6 text-center text-sm text-slate-600"><p className="font-medium">Henüz size gelen bir bildirim yok.</p><p className="mt-1">{unified?'Size bir görev atandığında, duyuru paylaşıldığında veya bir talepte size yazıldığında burada görünür.':'Bir talepte etiketlendiğinizde veya mesajınıza yanıt geldiğinde burada görünür.'}</p></div>}
   <ul className="space-y-3">{(online?items:[]).map(item=>{
    const view=inboxPresentation(item);
    return <li key={inboxEventKey(item)} className={`rounded-lg border p-3 text-sm ${item.readAt?'border-slate-200':'border-blue-200 bg-blue-50/50'}`}>
     <div className="flex justify-between gap-2"><p className="font-medium text-slate-900">{view.title}</p>{!item.readAt&&<span className="text-xs font-semibold text-blue-700">Yeni</span>}</div>
     <p className="mt-1 text-xs text-slate-500">{new Intl.DateTimeFormat('tr-TR',{dateStyle:'short',timeStyle:'short',timeZone:'Europe/Istanbul'}).format(new Date(item.createdAt))}</p>
     {item.kind==='conversation'&&<p className="mt-1 text-xs text-slate-500">İş günü: {new Intl.DateTimeFormat('tr-TR',{timeZone:'Europe/Istanbul'}).format(new Date(item.payload.workDate+'T12:00:00Z'))}</p>}
     {item.kind==='announcement'&&<p className="my-2 line-clamp-2 whitespace-pre-wrap break-words text-slate-700">{view.body}</p>}
     {item.kind==='announcement'?<details className="my-2"><summary className="min-h-11 cursor-pointer py-2 text-blue-700">Duyurunun tamamını oku</summary><p className="whitespace-pre-wrap break-words text-slate-700">{view.body}</p></details>:<p className="my-2 line-clamp-3 whitespace-pre-wrap break-words text-slate-700">{view.body}</p>}
     <div className="flex flex-wrap items-center gap-2">{view.href&&<Link onClick={event=>{navigationGuard.handle(event);if(!event.defaultPrevented)setOpen(false);}} className={`${control} border-blue-200 text-blue-700`} href={view.href}>{view.action}</Link>}{item.readAt?<span className="text-xs text-slate-500">Okundu</span>:<button type="button" disabled={busy} className={control} onClick={()=>void markRead(item)}>Okundu işaretle</button>}</div>
    </li>;
   })}</ul>
   {online&&more&&<button type="button" disabled={busy} className={`${control} mt-3 w-full`} onClick={()=>void load('older')}>Önceki bildirimler</button>}
  </section>}
 </div>;
}
