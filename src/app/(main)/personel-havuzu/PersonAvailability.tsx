'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {Button} from '@/components/ui/button';
import {useScopedResource} from '@/components/ui/useScopedResource';
import {useNavigationGuard} from '@/context/NavigationGuardContext';
import {istanbulToday} from '@/lib/management-board';
import {availabilityLabels,availabilityOn,validateAvailability,type AvailabilityInput} from '@/lib/talent/availability';
import type {TalentScope} from '@/lib/talent/people';
import {talentAvailabilityReadAction,talentAvailabilitySaveAction} from './actions';
export default function PersonAvailability({scope,personId,canWrite,onDirty}:{scope:TalentScope;personId:string;canWrite:boolean;onDirty:(dirty:boolean)=>void}){
 const [open,setOpen]=useState(false),[state,setState]=useState<AvailabilityInput['state']>('unknown'),[start,setStart]=useState(istanbulToday),[end,setEnd]=useState(istanbulToday),[pending,setPending]=useState<AvailabilityInput|null>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const guard=useNavigationGuard(),flight=useRef(false),alive=useRef(true);
 const read=useCallback(async()=>{const r=await talentAvailabilityReadAction(scope,personId);if(!r.ok)throw Error(r.message);return r.data;},[scope,personId]);
 const data=useScopedResource(`${scope.actorId}:${scope.tenantId}:${personId}`,read),dirty=open||!!pending;
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
 useEffect(()=>{onDirty(dirty);return()=>onDirty(false);},[dirty,onDirty]);
 useEffect(()=>{if(!dirty)return;const stop=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue='';};window.addEventListener('beforeunload',stop);const off=guard.register(e=>{e.preventDefault();setMessage('Önce müsaitlik teyidini kaydedin veya vazgeçin.');});return()=>{window.removeEventListener('beforeunload',stop);off();};},[dirty,guard]);
 async function save(){
  if(flight.current||!canWrite||!data.data||data.loading)return;
  let input:AvailabilityInput;try{input=validateAvailability(pending??{commandId:crypto.randomUUID(),expectedRevision:data.data[0]?.revision??0,state,startsOn:start,endsOn:end});}catch{setMessage('Geçerli bir başlangıç/bitiş tarihi seçin. Aralık en fazla 366 gün olabilir.');return;}
  flight.current=true;setBusy(true);setPending(input);setMessage('');
  try{const r=await talentAvailabilitySaveAction(scope,personId,input);if(!alive.current)return;
   if(r.ok){setPending(null);setOpen(false);setMessage('Müsaitlik kaydedildi. Personeli bir işe göndermek için günlük plandan ayrıca görevlendirin.');await data.reload();}
   else{setMessage(r.message);if(r.conflict){setPending(null);setOpen(false);await data.reload();}}
  }catch{if(alive.current)setMessage('Kaydın sonucu alınamadı. “Kaydı yeniden dene” düğmesiyle aynı işlemi tekrar kontrol edin.');}finally{flight.current=false;if(alive.current)setBusy(false);}
 }
 const latest=data.data?.[0],today=istanbulToday();
 return <section aria-label="Müsaitlik teyidi" className="space-y-3 rounded-xl border p-4">
  <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">Müsaitlik teyidi</h3>{!open&&<Button variant="outline" disabled={!canWrite||data.loading||data.error||!data.data} onClick={()=>{setOpen(true);setState('unknown');setStart(istanbulToday());setEnd(istanbulToday());setMessage('');}}>Müsaitlik kaydet</Button>}</div>
  <p className="text-xs text-slate-500">Personelle görüşüp hangi tarihlerde çalışabileceğini kaydedin. Yeni kayıt öncekinin yerini alır. Görevlendirmeyi ve işe gelişini ayrıca takip edin.</p>
  {data.loading?<p role="status">Müsaitlik bilgisi yükleniyor…</p>:data.error?<div role="alert">Müsaitlik bilgisi yüklenemedi. <Button variant="outline" onClick={()=>void data.reload()}>Yeniden dene</Button></div>:<><p className="text-sm font-medium">Bugün ({today}): {availabilityLabels[availabilityOn(data.data??[],today)]}</p>{latest&&<p className="text-xs text-slate-500">Son teyit: {availabilityLabels[latest.state]} · {latest.starts_on} – {latest.ends_on} · Kayıt: {new Date(latest.recorded_at).toLocaleString('tr-TR',{timeZone:'Europe/Istanbul'})}</p>}</>}
  {message&&<p role="status" className="rounded-lg bg-blue-50 p-3 text-sm">{message}</p>}
  {open&&<form className="space-y-3" onSubmit={e=>{e.preventDefault();void save();}}><fieldset disabled={busy||!!pending||!canWrite} className="grid gap-3 sm:grid-cols-2"><label className="text-sm sm:col-span-2">Çalışabilir mi?<select className="mt-1 min-h-11 w-full rounded-xl border px-3" value={state} onChange={e=>setState(e.target.value as AvailabilityInput['state'])}>{Object.entries(availabilityLabels).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label><label className="text-sm">Hangi tarihten itibaren?<input type="date" required min="2000-01-01" max="2100-12-31" value={start} onChange={e=>setStart(e.target.value)} className="mt-1 min-h-11 w-full rounded-xl border px-3"/></label><label className="text-sm">Hangi tarihe kadar?<input type="date" required min={start} max="2100-12-31" value={end} onChange={e=>setEnd(e.target.value)} className="mt-1 min-h-11 w-full rounded-xl border px-3"/></label></fieldset><div className="flex flex-wrap gap-2"><Button type="submit" disabled={busy||!canWrite||data.loading||data.error}>{busy?'Kaydediliyor…':pending?'Kaydı yeniden dene':'Müsaitliği kaydet'}</Button><Button type="button" variant="outline" disabled={busy||!!pending} onClick={()=>setOpen(false)}>Vazgeç</Button></div></form>}
  {!!data.data?.length&&<details><summary className="cursor-pointer py-2 text-sm">Son 10 müsaitlik kaydı</summary><ul className="space-y-2 text-sm">{data.data.map(r=><li key={r.id}>{r.starts_on} – {r.ends_on}: {availabilityLabels[r.state]}{r.revision===latest?.revision?' · Güncel kayıt':' · Geçmiş kayıt'}</li>)}</ul></details>}
 </section>;
}
