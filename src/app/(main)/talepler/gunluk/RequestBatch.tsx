"use client";
import {useEffect,useRef,useState,type RefObject,type MouseEventHandler} from 'react';
import Link from 'next/link';
import {addDays} from '@/lib/operations/weekly-plan';
import {buildRequestDates,validateRequestBatch,type RequestBatch as Batch} from '@/lib/operations/request-batch';
import {reserveCommand,acknowledgeCommand,commandDigest,type DraftRecovery,type DraftCheck,type CommandScope} from '@/lib/operations/pending-commands';
import type {PilotBoard} from '@/lib/operations/pilot-types';
import {pilotRequestBatchAction,pilotTimedRequestsAction} from './actions';
import {validateTimedRequests} from '@/lib/operations/timed-requests';
import {shiftDuration,type ShiftClock} from '@/lib/operations/shift-window';
type BatchDraft=Batch&{clock?:ShiftClock;meetingNote?:string};
function command(batch:BatchDraft){const clean=validateRequestBatch(batch);return batch.clock?{kind:'timed_requests',payload:validateTimedRequests({companyId:clean.companyId,locationId:clean.locationId,serviceLine:clean.serviceLine,position:clean.position,requiredCount:clean.requiredCount,meetingNote:batch.meetingNote??'',shifts:clean.dates.map(workDate=>({workDate,...batch.clock!}))})}:{kind:clean.idp?'idp_period':'request_batch',payload:clean};}
const field='mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm';
export default function RequestBatch({onNavigate,navigationBusy,companyId,date,locations,scope,disabled,onBusy,onComplete,onPendingChange,reconcileRef,dirtyRef}:{
  onNavigate:MouseEventHandler<HTMLAnchorElement>;navigationBusy:boolean;dirtyRef:RefObject<DraftCheck|null>;reconcileRef:RefObject<DraftRecovery|null>;companyId:string;date:string;locations:PilotBoard['locations'];scope:CommandScope|null;disabled:boolean;onBusy:(v:boolean)=>void;onComplete:()=>Promise<void>;onPendingChange:()=>void;
}){
  const [isIdp,setIsIdp]=useState(false),[timed,setTimed]=useState(false);
  const [batch,setBatch]=useState<BatchDraft|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState(''),[resultDay,setResultDay]=useState('');
  const form=useRef<HTMLFormElement>(null),sending=useRef(false),revision=useRef(0);
  useEffect(()=>{
    let current=true;
    reconcileRef.current=async digests=>{
      const ticket=revision.current;
      if(!batch?.dates.length)return;
      const c=command(batch);const digest=await commandDigest(c.kind,c.payload);
      if(current&&ticket===revision.current&&digests.includes(digest)){
        revision.current++;form.current?.reset();setIsIdp(false);setTimed(false);setBatch(null);setError('');setResultDay('');
        setMessage('Bu toplu işlemin sonucu kesinleşti. Aynı önizleme temizlendi.');
      }
    };
    return()=>{current=false;reconcileRef.current=null;};
  },[batch,reconcileRef]);
  useEffect(()=>{
    dirtyRef.current=()=>!!batch||Array.from(form.current?.querySelectorAll<HTMLInputElement|HTMLSelectElement>('input,select')??[]).some(input=>{
      if(input instanceof HTMLSelectElement)return input.value!=='';
      return input.type==='checkbox'?input.checked!==input.defaultChecked:input.value!==input.defaultValue;
    });
    return()=>{dirtyRef.current=null;};
  },[batch,dirtyRef]);
  function preview(node:HTMLFormElement){
    revision.current++;
    setError('');setMessage('');setResultDay('');
    try{const d=new FormData(node);const dates=buildRequestDates(String(d.get('start')),String(d.get('end')),d.getAll('weekday').map(Number));
      const clean=validateRequestBatch({companyId,locationId:String(d.get('location')),serviceLine:String(d.get('service')),position:String(d.get('position')),requiredCount:Number(d.get('count')),dates,...(d.get('idp')?{idp:{originalName:String(d.get('originalName')),leaveStart:String(d.get('start')),leaveEnd:String(d.get('end'))}}:{})});
      const clock=timed?{startTime:String(d.get('shiftStart')),endTime:String(d.get('shiftEnd')),nextDay:d.get('nextDay')==='on'}:undefined;
      if(clock)shiftDuration(clock);const draft={...clean,...(clock?{clock,meetingNote:String(d.get('meetingNote'))}:{})};command(draft);setBatch(draft);
    }catch(e){setBatch(null);setError(e instanceof Error?e.message:'Önizleme oluşturulamadı.');}
  }
  async function save(){
    if(!scope||!batch||!batch.dates.length||disabled||sending.current)return;
    sending.current=true;setBusy(true);onBusy(true);setError('');setMessage('');
    try{
      const clean=validateRequestBatch(batch),c=command(batch),id=await reserveCommand(scope,c.kind,c.payload,localStorage,navigator.locks);onPendingChange();
      const r=await (batch.clock?pilotTimedRequestsAction(scope,id,c.payload):pilotRequestBatchAction(scope,id,clean));
      if(!r.ok){setError(r.message);return;}
      let msg=batch.clock?`${r.data.created} vardiya oluşturuldu · toplam ${r.data.created*clean.requiredCount} personel ihtiyacı.`:`${clean.idp?'İDP dönemi kaydedildi. ':''}${r.data.created} günlük talep oluşturuldu · ${r.data.created*clean.requiredCount} kişi-gün ihtiyaç.`;
      try{await acknowledgeCommand(scope,id,localStorage,navigator.locks);onPendingChange();}catch{msg+=' Bekleyen işareti kaldırılamadı; sonuçlar panelinden kontrol edin.';}
      revision.current++;setMessage(msg);setResultDay(clean.dates[0]);setBatch(null);form.current?.reset();setIsIdp(false);setTimed(false);await onComplete();
    }catch{setError('Toplu işlemin sonucu doğrulanamadı. Aynı önizlemeyi tekrar gönderin veya bekleyen sonuçlarını kontrol edin.');}
    finally{sending.current=false;setBusy(false);onBusy(false);}
  }
  return <details className="mb-5 rounded-xl border bg-white p-4">
    <summary className="cursor-pointer font-semibold">{process.env.NEXT_PUBLIC_BPS_SHIFT_SCHEDULING_ENABLED==='true'?'Gün veya vardiya planla':'Birden fazla gün için talep aç'}</summary>
    <p className="mt-3 text-sm text-slate-600">Aynı şube ve pozisyon için en fazla 31 günlük aralık seçin. Resmî tatiller otomatik çıkarılmaz; önizlemeden gün çıkarabilirsiniz. Personel ataması daha sonra yapılır.</p>
    <form ref={form} data-recovery-draft="batch" aria-label="Toplu talep formu" onChange={()=>{revision.current++;setBatch(null);setError('');setMessage('');setResultDay('');}} onSubmit={e=>{e.preventDefault();preview(e.currentTarget);}}>
      <fieldset disabled={disabled||busy} className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="sm:col-span-2 lg:col-span-3 rounded-xl bg-violet-50 p-3"><label className="flex min-h-11 items-center gap-2 text-sm font-medium"><input name="idp" type="checkbox" disabled={timed} checked={isIdp} onChange={e=>setIsIdp(e.target.checked)}/>İzin yerine görevlendirme (İDP dönemi)</label>{isIdp&&<><label className="block text-sm">İzne çıkan personel<input name="originalName" className={field} maxLength={160} required /></label><p className="mt-2 text-sm">Başlangıç ve bitiş izin dönemidir. Her gün için bir kişi gerekir; çalışılmayacak günleri önizlemeden çıkarın. Kayıttan sonra dönem panelinden bilgileri düzeltebilir ve yeni gün ekleyebilirsiniz; günlük atamalar ayrı yönetilir.</p></>}</div>
        {process.env.NEXT_PUBLIC_BPS_SHIFT_SCHEDULING_ENABLED==='true'&&<div className="sm:col-span-2 lg:col-span-3 rounded-xl border p-3">
          <label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={timed} disabled={isIdp} onChange={e=>setTimed(e.target.checked)}/>Vardiya saatlerini belirt</label>
          {timed&&<div className="grid gap-3 sm:grid-cols-2"><label>Başlangıç saati<input name="shiftStart" type="time" required className={field}/></label><label>Bitiş saati<input name="shiftEnd" type="time" required className={field}/></label><label className="flex min-h-11 items-center gap-2"><input name="nextDay" type="checkbox"/>Bitiş ertesi gün</label><label>Servis / buluşma notu (isteğe bağlı)<input name="meetingNote" maxLength={500} className={field}/></label></div>}
        </div>}
        <label className="text-sm">Toplu talep lokasyonu<select name="location" className={field} required defaultValue=""><option value="" disabled>Lokasyon seçin</option>{locations.filter(l=>l.active).map(l=><option key={l.id} value={l.id}>{l.name} · {l.city}</option>)}</select></label>
        <label className="text-sm">Başlangıç günü<input name="start" className={field} type="date" defaultValue={date} min="2000-01-01" max="2100-12-31" required /></label>
        <label className="text-sm">Bitiş günü<input name="end" className={field} type="date" defaultValue={addDays(date,6)>'2100-12-31'?'2100-12-31':addDays(date,6)} min="2000-01-01" max="2100-12-31" required /></label>
        <label className="text-sm">Toplu hizmet hattı<input name="service" className={field} defaultValue="Temizlik" maxLength={80} required /></label>
        <label className="text-sm">Toplu pozisyon<input name="position" className={field} defaultValue="Temizlik görevlisi" maxLength={80} required /></label>
        <label className="text-sm">Her gün kişi sayısı<input key={isIdp?"idp":"normal"} readOnly={isIdp} name="count" className={field} type="number" defaultValue={1} min={1} max={100} required /></label>
        <div className="sm:col-span-2 lg:col-span-3"><p className="mb-2 text-sm font-medium">Çalışma günleri</p><div className="flex flex-wrap gap-3">{['Pazartesi','Salı','Çarşamba','Perşembe','Cuma','Cumartesi','Pazar'].map((day,i)=><label key={day} className="flex items-center gap-1 text-sm"><input type="checkbox" name="weekday" value={i+1} defaultChecked={i<5} />{day}</label>)}</div></div>
        <button className="rounded-lg border px-3 py-2 text-sm">Günleri önizle</button>
      </fieldset>
    </form>
    {error&&<p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    {message&&<p role="status" className="mt-3 rounded-lg bg-emerald-50 p-3 text-sm">{message}</p>}
    {resultDay&&<Link onClick={onNavigate} aria-disabled={navigationBusy||undefined} className="mt-3 inline-flex min-h-11 items-center text-sm underline" href={`/talepler/haftalik?firma=${companyId}&gun=${resultDay}`}>Oluşan talepleri haftalık planda gör</Link>}
    {batch&&<div className="mt-4 rounded-lg border bg-slate-50 p-3">
      <h3 className="font-semibold">Önizleme · {batch.dates.length} {batch.clock?'vardiya':'gün'} / {batch.dates.length*batch.requiredCount} {batch.clock?'personel ihtiyacı':'kişi-gün'}</h3>
      <p className="mt-1 text-sm">{locations.find(l=>l.id===batch.locationId)?.name} · {batch.serviceLine} · {batch.position} · günlük {batch.requiredCount} kişi</p>
      <p className="mt-2 text-sm text-slate-600">{batch.idp&&`İDP · ${batch.idp.originalName} yerine · ${batch.idp.leaveStart} – ${batch.idp.leaveEnd}. `}Mevcut aktif talepler kayıt sırasında kontrol edilir. Bir gün çakışırsa bütün parti durur.</p>
      <ul className="my-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{batch.dates.map(day=><li key={day} className="flex items-center justify-between rounded border bg-white p-2 text-sm"><span>{day}{batch.clock&&<span className="block font-medium">{batch.clock.startTime} – {batch.clock.endTime}{batch.clock.nextDay?' (ertesi gün)':''}</span>}</span><button disabled={disabled||busy} type="button" className="underline" aria-label={`${day} gününü çıkar`} onClick={()=>{revision.current++;setBatch({...batch,dates:batch.dates.filter(d=>d!==day)});}}>Çıkar</button></li>)}</ul>
      <button disabled={disabled||busy||!batch.dates.length} onClick={()=>void save()} className="rounded-lg bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-40">{busy?'Kaydediliyor…':`${batch.dates.length} ${batch.clock?"vardiyayı":"günlük talebi"} oluştur`}</button>
    </div>}
  </details>;
}
