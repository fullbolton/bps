'use client';
import {useEffect,useRef,useState} from 'react';
import {createClient} from '@/lib/supabase/client';
import {useNavigationGuard} from '@/context/NavigationGuardContext';
import {hrEmploymentImpact,loadHrEmployment,prepareHrEmployment,saveHrEmployment} from '@/lib/services/hr-employment';
import {hrWriteFailure} from '@/lib/services/hr-write-failure';
const button='min-h-11 rounded-lg border px-4 py-2 disabled:opacity-50';
export default function EmploymentChange({actor,tenant,employee,onClose,onSaved}:{actor:string;tenant:string;employee:{id:string;name:string};onClose:()=>void;onSaved:()=>Promise<void>}){
 const [context,setContext]=useState<Awaited<ReturnType<typeof loadHrEmployment>>|null>(null),[date,setDate]=useState(''),[confirmed,setConfirmed]=useState(false),[message,setMessage]=useState('');
 const [busy,setBusy]=useState(false),[intent,setIntent]=useState<ReturnType<typeof prepareHrEmployment>|null>(null),[rejected,setRejected]=useState(false),[uncertain,setUncertain]=useState(false);
 const alive=useRef(true),flight=useRef(false);const guard=useNavigationGuard();
 useEffect(()=>{alive.current=true;void loadHrEmployment(createClient(),actor,tenant,employee.id).then(c=>{if(alive.current)setContext(c);}).catch(()=>{if(alive.current)setMessage('İstihdam bilgileri alınamadı veya yönetici yetkiniz doğrulanamadı.');});return()=>{alive.current=false;};},[actor,tenant,employee.id]);
 useEffect(()=>{const off=guard.register(e=>{e.preventDefault();setMessage('Önce işlemi tamamlayın veya formu kapatın.');});const stop=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue='';};window.addEventListener('beforeunload',stop);return()=>{off();window.removeEventListener('beforeunload',stop);};},[guard]);
 const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Istanbul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const impact=context?hrEmploymentImpact(context,date,today):null;
 async function refresh(){if(flight.current)return;flight.current=true;setBusy(true);setConfirmed(false);try{const c=await loadHrEmployment(createClient(),actor,tenant,employee.id);if(alive.current){setContext(c);setIntent(null);setRejected(false);setMessage('Bilgiler yenilendi, seçtiğiniz tarih korundu. Güncel etki özetini kontrol edip yeniden onaylayın.');}}catch{if(alive.current)setMessage('Güncel bilgiler alınamadı. İşlem kapalı; yeniden deneyebilirsiniz.');}finally{flight.current=false;if(alive.current)setBusy(false);}}
 async function save(){if(flight.current||!context||rejected||(!intent&&(!confirmed||!impact||impact.blockers.length)))return;
 let command=intent;try{command??=prepareHrEmployment(context,crypto.randomUUID(),impact!.kind,date);}catch{setMessage('Tarihi kontrol edin.');return;}
 setIntent(command);flight.current=true;setBusy(true);setMessage('');try{await saveHrEmployment(createClient(),command);if(alive.current)await onSaved();}catch(e){if(alive.current){const known=hrWriteFailure(e,uncertain)==='rejected';setRejected(known);setUncertain(!known);setMessage(known?'İşlem yapılmadı. Kayıtlar veya yetkiler değişmiş olabilir. Güncel bilgileri kontrol edin.':'İşlemin sonucu doğrulanamadı. Aynı işlemi yeniden deneyin; ikinci bir kayıt oluşturulmaz.');}}finally{flight.current=false;if(alive.current)setBusy(false);}}
 return <form className="max-w-xl space-y-4 rounded-xl border p-5" onSubmit={e=>{e.preventDefault();void save();}} aria-label="İstihdam işlemi">
 <h2 className="break-words font-semibold">{employee.name} · {!context?'İstihdam işlemi':context.endsOn?'Yeniden işe alma':'İşten ayrılış'}</h2>
 {message&&<p role="status">{message}</p>}{!context&&!message&&<p role="status">İstihdam bilgileri kontrol ediliyor…</p>}
 {context&&impact&&<><p className="text-sm">Mevcut dönem: {context.startsOn} — {context.endsOn??'Devam ediyor'}</p>
 <fieldset disabled={busy||!!intent} className="space-y-4">
 <label className="block">{impact.kind==='end'?'İşten ayrılış tarihi':'Yeni işe giriş tarihi'}<input className="mt-1 min-h-11 w-full min-w-0 rounded-lg border px-3" required type="date" min={context.startsOn} max={impact.kind==='end'?today:'2199-12-31'} value={date} onChange={e=>{setDate(e.target.value);setConfirmed(false);}}/></label>
 {date&&<section aria-label="İşlemin etkisi" className="space-y-2 rounded-lg bg-slate-50 p-3"><h3 className="font-medium">İşlemin etkisi</h3>{impact.kind==='end'?<p>İstihdam dönemi, {impact.departments} departman görevi ve {impact.locations} işyeri görevi seçtiğiniz tarihte sona erecek. Geçmiş kayıtlar korunacak.</p>:<p>Bu çalışan için yeni bir istihdam dönemi açılacak. Önceki dönem korunacak. Departman ve işyeri görevlendirmeleri ayrıca yapılacak; kullanıcı erişimi otomatik açılmayacak.</p>}
 {impact.blockers.length>0&&<ul className="list-disc space-y-2 pl-5" aria-label="İşlemi engelleyen durumlar">{impact.blockers.map(b=><li key={b}>{b}</li>)}</ul>}</section>}
 <label className="flex items-start gap-2"><input type="checkbox" className="mt-1 size-5 shrink-0" checked={confirmed} disabled={impact.blockers.length>0} onChange={e=>setConfirmed(e.target.checked)}/><span>Tarihi ve etkilenen kayıtları kontrol ettim.</span></label>
 </fieldset>
 {rejected&&<button className={button} type="button" disabled={busy} onClick={()=>void refresh()}>Tarihi koruyarak bilgileri yenile</button>}
 <button className={button} disabled={busy||rejected||(!intent&&(!confirmed||impact.blockers.length>0))}>{busy?'İşleniyor…':intent?'Aynı işlemi yeniden dene':impact.kind==='end'?'Ayrılışı kaydet':'Yeniden işe al'}</button></>}
 {!context&&message&&<button className={button} type="button" disabled={busy} onClick={()=>void refresh()}>Bilgileri yeniden getir</button>}
 <button className={button} type="button" disabled={busy||uncertain} onClick={onClose}>Formu kapat</button>
 </form>;
}
