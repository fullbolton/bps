"use client";
import {privateTextError} from "@/lib/privacy/operational-text";
import {useCallback,useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {Button} from '@/components/ui/button';
import {useScopedResource} from '@/components/ui/useScopedResource';
import {useNavigationGuard} from '@/context/NavigationGuardContext';
import {conversationChannels,conversationOutcomes,validateConversation,type ConversationInput} from '@/lib/talent/conversations';
import type {TalentScope} from '@/lib/talent/people';
import {talentConversationListAction,talentConversationSaveAction} from './actions';

const field='mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm';
export default function PersonConversations({scope,personId,canWrite,onDirty,onSaved,request=null}:{scope:TalentScope;personId:string;canWrite:boolean;onDirty:(dirty:boolean)=>void;onSaved?:()=>void;request?:{id:string;label:string}|null}){
 const [offset,setOffset]=useState(0),[open,setOpen]=useState(false),[channel,setChannel]=useState<ConversationInput['channel']>('phone'),[outcome,setOutcome]=useState<ConversationInput['outcome']>('reached'),[note,setNote]=useState('');
 const [pending,setPending]=useState<ConversationInput|null>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const flight=useRef(false),alive=useRef(true),guard=useNavigationGuard();
 const dirty=open||!!pending;
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
 useEffect(()=>{onDirty(dirty);return()=>onDirty(false);},[dirty,onDirty]);
 useEffect(()=>{if(!dirty)return;const unload=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue='';};window.addEventListener('beforeunload',unload);const off=guard.register(e=>{e.preventDefault();setMessage('Önce görüşmeyi kaydedin veya taslaktan vazgeçin.');});return()=>{off();window.removeEventListener('beforeunload',unload);};},[dirty,guard]);
 const read=useCallback(async()=>{const r=await talentConversationListAction(scope,personId,offset);if(!r.ok)throw Error(r.message);return r.data;},[scope,personId,offset]);
 const data=useScopedResource(`${scope.actorId}:${scope.tenantId}:${personId}`,read);
 async function save(){
  if(flight.current||!canWrite)return;flight.current=true;setBusy(true);setMessage('');
  let command:ConversationInput;
  try{command=validateConversation(pending??{commandId:crypto.randomUUID(),personId,requestId:request?.id??null,channel,outcome,note});}
  catch(error){flight.current=false;setBusy(false);setMessage(privateTextError(error)??'Görüşme notunun biçimini ve uzunluğunu kontrol edin.');return;}
  try{
   // Keep the exact command after an uncertain response. Retry cannot duplicate the conversation.
   setPending(command);
   const r=await talentConversationSaveAction(scope,command);if(!alive.current)return;
   if(!r.ok){setMessage(r.message);return;}
   setPending(null);setOpen(false);setNote('');setChannel('phone');setOutcome('reached');setMessage('Görüşme kaydedildi.');onSaved?.();
   if(offset===0)await data.reload();else setOffset(0);
  }catch{if(alive.current)setMessage('Yanıt alınamadı. Aynı kaydı yeniden göndererek sonucu doğrulayın.');}
  finally{flight.current=false;if(alive.current)setBusy(false);}
 }
 return <section className="space-y-3 rounded-xl border p-4" aria-label="Görüşmeler">
  <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">Görüşmeler</h3>{!open&&<Button variant="outline" disabled={!canWrite} onClick={()=>{setOpen(true);setMessage('');}}>Görüşme ekle</Button>}</div>
  <p className="text-xs text-slate-500">İletişim geçmişidir. Görüşme kaydı kişiyi müsait saymaz veya bir işe atamaz.</p>
  {request&&<p className="rounded-lg bg-blue-50 p-3 text-sm break-words"><strong>Bu talep için görüşme:</strong> {request.label}. Yeni kayıt bu işe bağlanır. “İlgili işi istemiyor” diğer işlere uygunluğu değiştirmez.</p>}
  <p className="text-xs text-slate-500">Geçmişte genel görüşmeler ve işe özel görüşmeler birlikte gösterilir.</p>
  {message&&<p role="status" className="rounded-xl bg-blue-50 p-3 text-sm">{message}</p>}
  {open&&<form onSubmit={e=>{e.preventDefault();void save();}} className="space-y-3">
   <fieldset disabled={busy||!!pending||!canWrite} className="space-y-3 disabled:opacity-60">
    <label className="block text-sm">Kanal<select className={field} value={channel} onChange={e=>setChannel(e.target.value as ConversationInput['channel'])}>{Object.entries(conversationChannels).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>
    <label className="block text-sm">Sonuç<select className={field} value={outcome} onChange={e=>setOutcome(e.target.value as ConversationInput['outcome'])}>{Object.entries(conversationOutcomes).filter(([k])=>k!=='declined'||!!request).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>
    <label className="block text-sm">Görüşme notu<textarea className={field} rows={3} maxLength={2000} value={note} onChange={e=>setNote(e.target.value)}/></label>
   </fieldset>
   {pending&&<p className="text-xs text-amber-800">Sonuç doğrulanana kadar içerik değiştirilemez. Yeniden deneme aynı işlem numarasını kullanır.</p>}
   <div className="flex flex-wrap gap-2"><Button disabled={busy||!canWrite} type="submit">{busy?'Kaydediliyor…':pending?'Sonucu doğrula / yeniden dene':'Görüşmeyi kaydet'}</Button><Button type="button" variant="outline" disabled={busy||!!pending} onClick={()=>{setOpen(false);setNote('');setChannel('phone');setOutcome('reached');setMessage('');}}>Vazgeç</Button></div>
  </form>}
  {data.loading?<p role="status">Görüşmeler okunuyor…</p>:data.error?<div role="alert"><p>Görüşme geçmişi okunamadı.</p><Button variant="outline" onClick={()=>void data.reload()}>Yeniden dene</Button></div>:!data.data?.length?<p className="text-sm text-slate-500">Bu sayfada görüşme yok.</p>:<ul className="divide-y">{data.data.slice(0,20).map(row=><li key={row.id} className="space-y-1 py-3 text-sm"><p className="text-xs text-slate-600">{row.requestId===null?'Genel görüşme':row.requestId===request?.id?`Bu talep · ${request?.label}`:request?'Başka bir talebe ait görüşme':'İşe özel görüşme'}</p>{row.requestContext&&<Link onClick={guard.handle} className="inline-flex min-h-11 max-w-full items-center break-words text-blue-700 underline" href={`/talepler/gunluk?${new URLSearchParams({sirket:scope.tenantId,firma:row.requestContext.companyId,gun:row.requestContext.workDate,talep:row.requestId!})}#talep-${row.requestId}`}>{row.requestContext.companyName} · {row.requestContext.locationName} · {row.requestContext.workDate.split('-').reverse().join('.')} · {row.requestContext.position}</Link>}<p className="font-medium">{conversationOutcomes[row.outcome]} · {conversationChannels[row.channel]}</p><p className="text-xs text-slate-500">{new Intl.DateTimeFormat('tr-TR',{dateStyle:'short',timeStyle:'short',timeZone:'Europe/Istanbul'}).format(new Date(row.recordedAt))}{row.actorId===scope.actorId?' · Siz':''}</p>{row.sourcePersonId&&row.sourcePersonId!==personId&&<p className="text-xs text-slate-500">Birleşen karttan gelen görüşme</p>}{row.note&&<p className="whitespace-pre-wrap break-words">{row.note}</p>}</li>)}</ul>}
  <div className="flex justify-between gap-2"><Button variant="outline" disabled={dirty||data.loading||offset===0} onClick={()=>setOffset(n=>n-20)}>Önceki</Button><Button variant="outline" disabled={dirty||data.loading||!!data.error||(data.data?.length??0)<=20||offset>=100000} onClick={()=>setOffset(n=>n+20)}>Sonraki</Button></div>
 </section>;
}
