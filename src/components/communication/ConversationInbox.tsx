'use client';
import {useState,useRef,useEffect} from 'react';
import Link from 'next/link';
import {useAuth} from '@/context/AuthContext';
import {conversationInbox,conversationRead} from '@/app/(main)/iletisim/actions';
import type {InboxItem} from '@/lib/operations/conversation-read';
export default function ConversationInbox(){
 const {user,role}=useAuth();const [open,setOpen]=useState(false),[items,setItems]=useState<InboxItem[]>([]),[unread,setUnread]=useState<number|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[more,setMore]=useState(false);const seq=useRef(0);
 useEffect(()=>{seq.current++;setItems([]);setUnread(null);setOpen(false);},[user?.id,role]);
 async function load(older=false){const ticket=++seq.current;setBusy(true);setError('');try{const r=await conversationInbox(older?items.at(-1)?.message_id??null:null);if(ticket!==seq.current)return;if(!r.ok)throw Error(r.message);setItems(old=>older?[...old,...r.items.filter(i=>!old.some(o=>o.message_id===i.message_id))]:r.items);setUnread(r.unread);setMore(r.items.length===30);}catch(e){if(ticket===seq.current){setItems([]);setUnread(null);setError(e instanceof Error?e.message:'Bildirimler yüklenemedi.');}}finally{if(ticket===seq.current)setBusy(false);}}
 if(role!=='yonetici'&&role!=='operasyon')return null;
 return <div className="relative"><button aria-expanded={open} onClick={()=>{setOpen(!open);if(!open)void load();}} className="rounded border px-2 py-1 text-sm">Bildirimler{unread!==null?` (${unread})`:''}</button>
 {open&&<section aria-label="Bildirim kutusu" className="absolute right-0 top-full z-50 mt-2 max-h-[75vh] w-[min(340px,90vw)] overflow-y-auto rounded-lg border bg-white p-3 shadow-lg">
 <div className="flex justify-between"><h2 className="font-semibold">İş konuşmaları</h2><button onClick={()=>setOpen(false)} aria-label="Bildirimleri kapat">×</button></div>
 <button className="my-2 text-sm underline" disabled={busy} onClick={()=>void load()}>Bildirimleri yenile</button>
 {error&&<p role="alert" className="text-sm text-red-700">{error}</p>}{busy&&<p role="status">Yükleniyor…</p>}
 {!busy&&!error&&items.length===0&&<p className="text-sm">Henüz bildirim yok.</p>}
 <ul className="space-y-3">{items.map(i=><li key={i.message_id} className="rounded border p-2 text-sm"><p className="font-medium">{i.company_name} · {i.work_date}</p><p className="whitespace-pre-wrap break-words">{i.body}</p><Link onClick={()=>setOpen(false)} className="mr-3 underline" href={`/talepler/gunluk?${new URLSearchParams({firma:i.company_id,gun:i.work_date,talep:i.request_id})}#talep-${i.request_id}`}>Talebe git</Link>{i.read_at?<span className="text-slate-500">Okundu</span>:<button disabled={busy} className="underline" onClick={async()=>{setBusy(true);try{const r=await conversationRead(i.message_id);if(!r.ok)throw Error(r.message);await load();}catch(e){setError(e instanceof Error?e.message:'Okundu kaydedilemedi.');}finally{setBusy(false);}}}>Okundu işaretle</button>}</li>)}</ul>
 {more&&<button disabled={busy} className="mt-3 underline" onClick={()=>void load(true)}>Önceki bildirimler</button>}
 </section>}
 </div>;
}
