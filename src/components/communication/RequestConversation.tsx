'use client';
import {useState,useEffect,useRef} from 'react';
import {useAuth} from '@/context/AuthContext';
import {conversationLoad,conversationSend,conversationResolve} from '@/app/(main)/iletisim/actions';
import {validateCommentCommand,type CommentCommand} from '@/lib/operations/conversation-command';
import type {ConversationMessage,ConversationPerson} from '@/lib/operations/conversation-read';
export type ConversationDraftState={dirty:boolean;busy:boolean;body:string;mentionIds:string[];parentId:string|null;pending:boolean;command:CommentCommand|null};
export default function RequestConversation({requestId,onDraftStateChange,initialDraft}:{requestId:string;initialDraft?:ConversationDraftState;onDraftStateChange?:(requestId:string,state:ConversationDraftState|null)=>void}){
 const {user}=useAuth();const [open,setOpen]=useState(false),[rows,setRows]=useState<ConversationMessage[]>([]),[people,setPeople]=useState<ConversationPerson[]>([]),[scope,setScope]=useState<{actorId:string;tenantId:string}|null>(null);
 const [personSearch,setPersonSearch]=useState('');
 const [body,setBody]=useState(''),[mentions,setMentions]=useState<string[]>([]),[parent,setParent]=useState<string|null>(null),[pending,setPending]=useState<CommentCommand|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[more,setMore]=useState(false);
 const sequence=useRef(0);const locked=useRef(false);
 // Parent keeps an in-memory copy across card removal; no pre-send browser storage writes.
 useEffect(()=>{onDraftStateChange?.(requestId,{dirty:!!body.trim()||mentions.length>0||parent!==null||pending!==null,busy,body,mentionIds:mentions,parentId:parent,pending:pending!==null,command:pending});},[requestId,body,mentions,parent,pending,busy,onDraftStateChange]);
 useEffect(()=>()=>onDraftStateChange?.(requestId,null),[requestId,onDraftStateChange]);
 const key=(s:{actorId:string;tenantId:string})=>`bps:comment:${s.actorId}:${s.tenantId}:${requestId}`;
 async function load(older=false){
  const ticket=++sequence.current;setBusy(true);setError('');
  try{const r=await conversationLoad(requestId,older?rows.at(-1)?.id??null:null);if(ticket!==sequence.current)return;
   if(!r.ok)throw Error(r.message);if(r.actorId!==user?.id)throw Error('Oturum değişti. Sayfayı yenileyin.');
   const s={actorId:r.actorId,tenantId:r.tenantId};setScope(s);setPeople(r.people);setRows(old=>older?[...old,...r.messages.filter(m=>!old.some(o=>o.id===m.id))]:r.messages);setMore(r.messages.length===30);
   const saved=localStorage.getItem(key(s));if(saved){const c=validateCommentCommand(JSON.parse(saved));if(c.actorId!==s.actorId||c.tenantId!==s.tenantId||c.requestId!==requestId)throw Error('Bekleyen mesajın kapsamı doğrulanamadı.');setPending(c);setBody(c.body);setMentions(c.mentionIds);setParent(c.parentId);}
  }catch(e){if(ticket===sequence.current){setError(e instanceof Error?e.message:'Konuşma yüklenemedi.');if(!older){setRows([]);setScope(null);}}}finally{if(ticket===sequence.current)setBusy(false);}
 }
 useEffect(()=>{setRows([]);setPeople([]);setScope(null);setPending(initialDraft?.command??null);setBody(initialDraft?.body??'');setMentions(initialDraft?.mentionIds??[]);setParent(initialDraft?.parentId??null);},[requestId,user?.id]); // Restore only on identity change; typing must not reset the draft.
 useEffect(()=>{if(open)void load();return()=>{sequence.current++;};},[open,requestId,user?.id]); // eslint-disable-line react-hooks/exhaustive-deps
 async function send(){
  if(locked.current||!scope)return;locked.current=true;setBusy(true);setError('');
  try{
   if(!navigator.locks?.request)throw Error('Bu tarayıcı güvenli mesaj göndermeyi desteklemiyor.');
   await navigator.locks.request(key(scope),async()=>{
    const saved=localStorage.getItem(key(scope));const c=saved?validateCommentCommand(JSON.parse(saved)):pending??validateCommentCommand({commandId:crypto.randomUUID(),...scope,requestId,body,parentId:parent,mentionIds:mentions});
    if(saved&&(!pending||pending.commandId!==c.commandId)){setPending(c);setBody(c.body);setMentions(c.mentionIds);setParent(c.parentId);throw Error('Başka sekmeden bekleyen mesaj bulundu. İçeriği kontrol edip yeniden deneyin.');}
    if(c.actorId!==scope.actorId||c.tenantId!==scope.tenantId||c.requestId!==requestId)throw Error('Mesaj kapsamı değişti.');
    localStorage.setItem(key(scope),JSON.stringify(c));setPending(c);
    const r=await conversationSend(c);if(!r.ok)throw Error(r.message);
    localStorage.removeItem(key(scope));setPending(null);setBody('');setMentions([]);setParent(null);
   });await load();
  }catch(e){setError(e instanceof Error?e.message:'Gönderim doğrulanamadı. Aynı mesajı yeniden deneyin.');}finally{locked.current=false;setBusy(false);}
 }
 async function resolve(){
  if(locked.current||!scope||!pending)return;locked.current=true;setBusy(true);setError('');setNotice('');
  try{
   if(!navigator.locks?.request)throw Error('Tarayıcı işlem kilidi kullanılamıyor.');
   await navigator.locks.request(key(scope),async()=>{
    const saved=localStorage.getItem(key(scope));
    const c=saved?validateCommentCommand(JSON.parse(saved)):validateCommentCommand(pending);if(c.commandId!==pending.commandId||c.actorId!==scope.actorId||c.tenantId!==scope.tenantId||c.requestId!==requestId)throw Error('Bekleyen kayıt değişti.');
    const r=await conversationResolve(c);if(!r.ok)throw Error(r.message);
    localStorage.removeItem(key(scope));setPending(null);
    if(r.status==='sent'){setBody('');setMentions([]);setParent(null);setNotice('Mesaj daha önce gönderilmiş. Kaydı doğruladık.');}
    else{setBody(c.body);setMentions(c.mentionIds);setParent(c.parentId);setNotice('Mesaj gönderilmemiş. Eski gönderimi kapattık; metni düzenleyip gönderebilirsiniz.');}
   });await load();
  }catch(e){setError(e instanceof Error?e.message:'Gönderim kontrol edilemedi.');}finally{locked.current=false;setBusy(false);}
 }
 return <section className="my-3 rounded-lg border p-3" aria-label="Talep konuşması">
  <button type="button" disabled={busy} aria-expanded={open} className="font-medium underline disabled:opacity-50" onClick={()=>setOpen(!open)}>Notlar ve konuşma</button>
  {open&&<div className="mt-3 space-y-3">
   <button type="button" disabled={busy} onClick={()=>void load()} className="text-sm underline">Konuşmayı yenile</button>
   {notice&&<p role="status" className="text-sm text-emerald-800">{notice}</p>}
   {error&&<p role="alert" className="text-sm text-red-700">{error}</p>}
   {busy&&<p role="status" className="text-sm">İşlem sürüyor…</p>}
   {!busy&&scope&&rows.length===0&&<p className="text-sm text-slate-500">Henüz not yok.</p>}
   <ul className="space-y-3">{rows.map(m=><li key={m.id} className="rounded border bg-slate-50 p-3 text-sm">
    <p className="font-medium">{people.find(p=>p.id===m.author_id)?.name??'Önceki ekip üyesi'} <time className="font-normal text-slate-500">{new Date(m.created_at).toLocaleString('tr-TR')}</time></p>
    {m.parent_id&&<p className="text-xs text-slate-500">Bir nota cevap</p>}<p className="whitespace-pre-wrap break-words">{m.body}</p>
    {m.mention_ids.length>0&&<p className="text-xs">Etiket: {m.mention_ids.map(id=>people.find(p=>p.id===id)?.name??'Önceki ekip üyesi').join(', ')}</p>}
    <button disabled={busy||!!pending} onClick={()=>setParent(m.id)} className="mt-2 underline">Yanıtla</button>
   </li>)}</ul>
   {more&&<button disabled={busy} onClick={()=>void load(true)} className="underline">Önceki notlar</button>}
   {pending&&<div className="text-sm text-amber-800"><p>Gönderimi doğrulanacak mesaj var. Yeniden deneme aynı mesajı kullanır.</p><button type="button" disabled={busy||!scope} className="underline" onClick={()=>void resolve()}>Gönderimi kontrol et</button></div>}
   <form onSubmit={e=>{e.preventDefault();void send();}} className="space-y-2">
    {parent&&<p className="text-sm">Bir nota yanıt yazıyorsunuz. <button type="button" disabled={busy||!!pending} className="underline" onClick={()=>setParent(null)}>Yanıttan vazgeç</button></p>}
    <label className="block text-sm">Notunuz<textarea className="mt-1 w-full rounded border p-2" rows={3} value={body} disabled={busy||!!pending||!scope} onChange={e=>setBody(e.target.value)} required /></label>
    <label className="block text-sm">Etiketlenecek kişiyi ara<input className="mt-1 w-full rounded border p-2" value={personSearch} disabled={busy||!!pending||!scope} onChange={e=>setPersonSearch(e.target.value)} placeholder="Ad yazın" /></label><p className="text-xs text-slate-500">{mentions.length}/10 kişi seçili · {[...body].length}/4000 karakter</p><div className="flex flex-wrap gap-2" aria-label="Seçilen etiketler">{mentions.map(id=><button key={id} type="button" disabled={busy||!!pending} className="rounded border px-2 py-1 text-xs" onClick={()=>setMentions(old=>old.filter(x=>x!==id))}>{people.find(p=>p.id===id)?.name??"Artık erişemeyen kişi"} · etiketi kaldır</button>)}</div><fieldset disabled={busy||!!pending||!scope} className="flex max-h-40 flex-col gap-2 overflow-y-auto rounded border p-2"><legend className="text-sm">Kişi etiketle (isteğe bağlı)</legend>{people.filter(p=>p.id!==scope?.actorId&&(mentions.includes(p.id)||p.name.toLocaleLowerCase("tr-TR").includes(personSearch.toLocaleLowerCase("tr-TR")))).map(p=><label key={p.id} className="text-sm"><input type="checkbox" disabled={!mentions.includes(p.id)&&mentions.length>=10} checked={mentions.includes(p.id)} onChange={e=>setMentions(old=>e.target.checked?[...old,p.id]:old.filter(id=>id!==p.id))}/> {p.name}</label>)}</fieldset>
    <button disabled={busy||!scope} className="rounded bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-40">{pending?'Gönderimi yeniden dene':'Notu gönder'}</button>
   </form>
  </div>}
 </section>;
}
