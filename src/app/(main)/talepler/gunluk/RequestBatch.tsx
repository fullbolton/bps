"use client";
import {useRef,useState} from 'react';
import Link from 'next/link';
import {addDays} from '@/lib/operations/weekly-plan';
import {buildRequestDates,validateRequestBatch,type RequestBatch as Batch} from '@/lib/operations/request-batch';
import {reserveCommand,acknowledgeCommand,type CommandScope} from '@/lib/operations/pending-commands';
import type {PilotBoard} from '@/lib/operations/pilot-types';
import {pilotRequestBatchAction} from './actions';
const field='mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm';
export default function RequestBatch({companyId,date,locations,scope,disabled,onBusy,onComplete,onPendingChange}:{
  companyId:string;date:string;locations:PilotBoard['locations'];scope:CommandScope|null;disabled:boolean;onBusy:(v:boolean)=>void;onComplete:()=>Promise<void>;onPendingChange:()=>void;
}){
  const [batch,setBatch]=useState<Batch|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState(''),[resultDay,setResultDay]=useState('');
  const form=useRef<HTMLFormElement>(null),sending=useRef(false);
  function preview(node:HTMLFormElement){
    setError('');setMessage('');setResultDay('');
    try{const d=new FormData(node);const dates=buildRequestDates(String(d.get('start')),String(d.get('end')),d.getAll('weekday').map(Number));
      setBatch(validateRequestBatch({companyId,locationId:String(d.get('location')),serviceLine:String(d.get('service')),position:String(d.get('position')),requiredCount:Number(d.get('count')),dates}));
    }catch(e){setBatch(null);setError(e instanceof Error?e.message:'Önizleme oluşturulamadı.');}
  }
  async function save(){
    if(!scope||!batch||!batch.dates.length||disabled||sending.current)return;
    sending.current=true;setBusy(true);onBusy(true);setError('');setMessage('');
    try{
      const clean=validateRequestBatch(batch),id=await reserveCommand(scope,'request_batch',clean,localStorage,navigator.locks);onPendingChange();
      const r=await pilotRequestBatchAction(scope,id,clean);
      if(!r.ok){setError(r.message);return;}
      let msg=`${r.data.created} günlük talep oluşturuldu · ${r.data.created*clean.requiredCount} kişi-gün ihtiyaç.`;
      try{await acknowledgeCommand(scope,id,localStorage,navigator.locks);onPendingChange();}catch{msg+=' Bekleyen işareti kaldırılamadı; sonuçlar panelinden kontrol edin.';}
      setMessage(msg);setResultDay(clean.dates[0]);setBatch(null);form.current?.reset();await onComplete();
    }catch{setError('Toplu işlemin sonucu doğrulanamadı. Aynı önizlemeyi tekrar gönderin veya bekleyen sonuçlarını kontrol edin.');}
    finally{sending.current=false;setBusy(false);onBusy(false);}
  }
  return <details className="mb-5 rounded-xl border bg-white p-4">
    <summary className="cursor-pointer font-semibold">Birden fazla gün için talep aç</summary>
    <p className="mt-3 text-sm text-slate-600">Aynı şube ve pozisyon için en fazla 31 günlük aralık seçin. Resmî tatiller otomatik çıkarılmaz; önizlemeden gün çıkarabilirsiniz. Personel ataması daha sonra yapılır.</p>
    <form ref={form} onChange={()=>{setBatch(null);setError('');setMessage('');setResultDay('');}} onSubmit={e=>{e.preventDefault();preview(e.currentTarget);}}>
      <fieldset disabled={disabled||busy} className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <label className="text-sm">Toplu talep lokasyonu<select name="location" className={field} required defaultValue=""><option value="" disabled>Lokasyon seçin</option>{locations.filter(l=>l.active).map(l=><option key={l.id} value={l.id}>{l.name} · {l.city}</option>)}</select></label>
        <label className="text-sm">Başlangıç günü<input name="start" className={field} type="date" defaultValue={date} min="2000-01-01" max="2100-12-31" required /></label>
        <label className="text-sm">Bitiş günü<input name="end" className={field} type="date" defaultValue={addDays(date,6)>'2100-12-31'?'2100-12-31':addDays(date,6)} min="2000-01-01" max="2100-12-31" required /></label>
        <label className="text-sm">Toplu hizmet hattı<input name="service" className={field} defaultValue="Temizlik" maxLength={80} required /></label>
        <label className="text-sm">Toplu pozisyon<input name="position" className={field} defaultValue="Temizlik görevlisi" maxLength={80} required /></label>
        <label className="text-sm">Her gün kişi sayısı<input name="count" className={field} type="number" defaultValue={1} min={1} max={100} required /></label>
        <div className="sm:col-span-2 lg:col-span-3"><p className="mb-2 text-sm font-medium">Çalışma günleri</p><div className="flex flex-wrap gap-3">{['Pazartesi','Salı','Çarşamba','Perşembe','Cuma','Cumartesi','Pazar'].map((day,i)=><label key={day} className="flex items-center gap-1 text-sm"><input type="checkbox" name="weekday" value={i+1} defaultChecked={i<5} />{day}</label>)}</div></div>
        <button className="rounded-lg border px-3 py-2 text-sm">Günleri önizle</button>
      </fieldset>
    </form>
    {error&&<p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    {message&&<p role="status" className="mt-3 rounded-lg bg-emerald-50 p-3 text-sm">{message}</p>}
    {resultDay&&<Link className="mt-3 inline-block text-sm underline" href={`/talepler/haftalik?firma=${companyId}&gun=${resultDay}`}>Oluşan talepleri haftalık planda gör</Link>}
    {batch&&<div className="mt-4 rounded-lg border bg-slate-50 p-3">
      <h3 className="font-semibold">Önizleme · {batch.dates.length} gün / {batch.dates.length*batch.requiredCount} kişi-gün</h3>
      <p className="mt-1 text-sm">{locations.find(l=>l.id===batch.locationId)?.name} · {batch.serviceLine} · {batch.position} · günlük {batch.requiredCount} kişi</p>
      <p className="mt-2 text-sm text-slate-600">Mevcut aktif talepler kayıt sırasında kontrol edilir. Bir gün çakışırsa bütün parti durur.</p>
      <ul className="my-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{batch.dates.map(day=><li key={day} className="flex items-center justify-between rounded border bg-white p-2 text-sm"><span>{day}</span><button disabled={disabled||busy} type="button" className="underline" aria-label={`${day} gününü çıkar`} onClick={()=>setBatch({...batch,dates:batch.dates.filter(d=>d!==day)})}>Çıkar</button></li>)}</ul>
      <button disabled={disabled||busy||!batch.dates.length} onClick={()=>void save()} className="rounded-lg bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-40">{busy?'Kaydediliyor…':`${batch.dates.length} günlük talebi oluştur`}</button>
    </div>}
  </details>;
}
