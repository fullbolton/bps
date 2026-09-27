'use client';
import {useEffect,useRef,useState} from 'react';
import {useNavigationGuard} from '@/context/NavigationGuardContext';
import type {CommandScope} from '@/lib/operations/pending-commands';
import {validateFixedRosterInput,validateRosterLeave} from '@/lib/operations/fixed-roster';
import {parseRosterPending,type RosterPending} from '@/lib/operations/roster-pending';
import {buildRequestDates} from '@/lib/operations/request-batch';
import {rosterSaveAction,rosterLeaveAction} from './actions';
import WorkerPicker from './WorkerPicker';
import type {RosterRow} from './Roster';
const field='mt-1 min-h-11 w-full rounded-lg border p-3';
export default function RosterEditor({scope,companyId,locationId,storageKey,mode,row,day,onClose,onSaved}:{scope:CommandScope;companyId:string;locationId:string;storageKey:string;mode:'save'|'cancel'|'idp';row:RosterRow|null;day:string;onClose:()=>void;onSaved:(message:string)=>void}){
 const guard=useNavigationGuard(),flight=useRef(false),[id]=useState(()=>row?.id??crypto.randomUUID());
 const [worker,setWorker]=useState({id:row?.worker_id??'',name:row?.workerName??''}),[service,setService]=useState(row?.service_line??''),[position,setPosition]=useState(row?.position??'');
 const [start,setStart]=useState(mode==='idp'?day:row?.starts_on??day),[end,setEnd]=useState(mode==='idp'?day:row?.ends_on??''),[reason,setReason]=useState(''),[weekdays,setWeekdays]=useState([1,2,3,4,5,6,7]);
 const [pending,setPending]=useState<RosterPending|null>(null),[ready,setReady]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[corrupt,setCorrupt]=useState(false),[abandon,setAbandon]=useState(false),[recovered,setRecovered]=useState(false),[rejectedRecovery,setRejectedRecovery]=useState(false);
 useEffect(()=>{try{const raw=sessionStorage.getItem(storageKey);if(raw){setPending(parseRosterPending(raw));setRecovered(true);}setReady(true);}catch{setCorrupt(true);setError('Bekleyen işlem okunamadı. Yeni işlem göndermeden önce kadro ve İDP geçmişini kontrol edin.');}},[storageKey]);
 useEffect(()=>{const unregister=guard.register(e=>{e.preventDefault();setError('Önce kadro formunu kaydedin veya kapatın.');});const block=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue='';};window.addEventListener('beforeunload',block);return()=>{unregister();window.removeEventListener('beforeunload',block);};},[guard]);
 let dates:string[]=[];try{if(mode==='idp')dates=buildRequestDates(start,end,weekdays);}catch{/* Form validation gives the actionable error on submit. */}
 async function submit(){if(flight.current||!ready||corrupt)return;flight.current=true;setBusy(true);setError('');try{
  let command=pending;
  if(!command){
   if(mode==='idp'){
    if(!row)throw Error('Kadro seçimi eksik.');
    const input=validateRosterLeave({rosterId:row.id,expectedRevision:row.revision,start,end,dates:buildRequestDates(start,end,weekdays)});
    if(start<row.starts_on||(row.ends_on&&end>row.ends_on))throw Error('İzin, personelin şubedeki görev tarihleri içinde olmalı.');
    command={commandId:crypto.randomUUID(),kind:'idp',input};
   }else command={commandId:crypto.randomUUID(),kind:'save',input:validateFixedRosterInput({id,expectedRevision:row?.revision??0,companyId,locationId,workerId:worker.id,serviceLine:service,position,startsOn:start,endsOn:end||null,reason,cancelled:mode==='cancel'})};
   sessionStorage.setItem(storageKey,JSON.stringify(command));setPending(command);
  }
  const result=command.kind==='save'?await rosterSaveAction(scope,command.commandId,command.input):await rosterLeaveAction(scope,command.commandId,command.input);
  if(!result.ok){if(result.rejected){sessionStorage.removeItem(storageKey);setPending(null);if(recovered)setRejectedRecovery(true);}setError(result.message);return;}
  sessionStorage.removeItem(storageKey);
  onSaved(command.kind==='idp'?`${command.input.dates.length} gün için İDP talebi oluşturuldu. Günlük plandan yedek personeli atayabilirsiniz.`:command.input.cancelled?'Kadro kaydı iptal edildi; geçmişi korunuyor.':'Kadro kaydı kaydedildi.');
 }catch(e){setError(e instanceof Error?e.message:'İşlem sonucu doğrulanamadı. Aynı işlemi tekrar kontrol edin.');}finally{flight.current=false;setBusy(false);}}
 function close(){if(!flight.current)onClose();}
 function clearPending(){try{sessionStorage.removeItem(storageKey);setPending(null);setCorrupt(false);onClose();}catch{setError('Bekleyen işlem işareti kaldırılamadı.');}}
 if(rejectedRecovery)return <section className="space-y-3 rounded-xl border bg-white p-5"><h2 className="font-semibold">İşlem kaydedilmedi</h2><p role="alert">{error}</p><p className="text-sm">Formu kapatıp güncel kadro kaydını açın.</p><button className="min-h-11 rounded-lg border px-4" onClick={onClose}>Formu kapat</button></section>;
 return <section className="space-y-4 rounded-xl border bg-white p-5" aria-label="Kadro işlemi"><h2 className="text-lg font-semibold">{pending?'Gönderilen işlemi kontrol et':mode==='idp'?'İzin / İDP talebi aç':mode==='cancel'?'Hatalı kadro kaydını iptal et':row?'Kadro bilgisini düzenle':'Kadroya personel ekle'}</h2>
 {pending?<div className="rounded-lg bg-amber-50 p-3 text-sm"><p>{pending.kind==='idp'?`İDP: ${pending.input.start} – ${pending.input.end} · ${pending.input.dates.length} çalışma günü`:`Kadro: ${pending.input.startsOn} – ${pending.input.endsOn??'Devam ediyor'} · ${pending.input.cancelled?'İptal':'Kayıt / düzenleme'}`}</p><p className="mt-2">Aynı işlemi tekrar kontrol etmek ikinci kayıt oluşturmaz. Kapatmak sunucuya gönderilen işlemi geri almaz.</p></div>:<form id="roster-form" className="space-y-4" onSubmit={e=>{e.preventDefault();void submit();}}><fieldset disabled={busy||!ready||corrupt} className="space-y-4">
 {row?<p className="rounded-lg bg-slate-50 p-3">{row.workerName} · {row.position}</p>:worker.id?<div className="flex items-center justify-between rounded-lg bg-slate-50 p-3"><p>{worker.name}</p><button type="button" className="min-h-11 underline" onClick={()=>setWorker({id:'',name:''})}>Değiştir</button></div>:<WorkerPicker onSelect={(id,name)=>setWorker({id,name})}/>}
 {mode!=='idp'&&mode!=='cancel'&&<div className="grid gap-3 sm:grid-cols-2"><label className="text-sm">Hizmet<input required maxLength={80} value={service} onChange={e=>setService(e.target.value)} className={field}/></label><label className="text-sm">Görev / pozisyon<input required maxLength={80} value={position} onChange={e=>setPosition(e.target.value)} className={field}/></label></div>}
 {mode==='cancel'?<p className="text-sm">Bu kayıt kadrodan çıkarılacak. Geçmişi silinmez. Görevi biten personel için iptal yerine “Düzenle / bitir” üzerinden son çalışma tarihini girin.</p>:<div className="grid gap-3 sm:grid-cols-2"><label className="text-sm">{mode==='idp'?'İzin başlangıcı':'Göreve başlangıç'}<input required type="date" min="2000-01-01" max="2100-12-31" value={start} onChange={e=>setStart(e.target.value)} className={field}/></label><label className="text-sm">{mode==='idp'?'İzin bitişi':'Son görev günü (devam ediyorsa boş bırakın)'}<input required={mode==='idp'} type="date" min={start} max="2100-12-31" value={end} onChange={e=>setEnd(e.target.value)} className={field}/></label></div>}
 {mode==='idp'?<fieldset><legend className="text-sm font-medium">Yerine personel gereken günler</legend><div className="mt-2 flex flex-wrap gap-3">{['Pzt','Sal','Çar','Per','Cum','Cmt','Paz'].map((name,i)=><label key={name} className="flex min-h-11 items-center gap-2 rounded-lg border px-3"><input type="checkbox" checked={weekdays.includes(i+1)} onChange={e=>setWeekdays(current=>e.target.checked?[...current,i+1]:current.filter(d=>d!==i+1))}/>{name}</label>)}</div><p className="mt-3 text-sm">{dates.length?`${dates.length} günlük talep açılacak: ${dates.join(', ')}`:'En fazla 31 günlük izin aralığı ve çalışma günlerini seçin.'}</p><p className="mt-2 text-sm text-slate-600">Personel, şube ve görev bilgileri kadrodan alınır. Yedek personel daha sonra günlük plandan atanır.</p></fieldset>:<label className="block text-sm">{row?'Değişiklik gerekçesi':'Kayıt notu'}<input required minLength={3} maxLength={500} value={reason} onChange={e=>setReason(e.target.value)} className={field}/></label>}
 </fieldset></form>}
 {error&&<p role="alert" className="rounded-lg bg-red-50 p-3 text-red-800">{error}</p>}
 <div className="flex flex-wrap gap-3"><button type={pending?'button':'submit'} form={pending?undefined:'roster-form'} disabled={busy||!ready||corrupt} onClick={pending?()=>void submit():undefined} className="min-h-11 rounded-lg bg-blue-700 px-4 text-white disabled:opacity-40">{busy?'Kontrol ediliyor…':pending?'Aynı işlemin sonucunu kontrol et':mode==='idp'?'İDP taleplerini oluştur':mode==='cancel'?'İptali onayla':'Kaydet'}</button><button disabled={busy} onClick={close} className="min-h-11 rounded-lg border px-4">Formu kapat</button></div>
 {(pending||corrupt)&&<div className="border-t pt-3"><label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={abandon} onChange={e=>setAbandon(e.target.checked)} className="mt-1"/>Kadro ve İDP geçmişini kontrol ettim. Bu formu bırakmak istiyorum; kaydedilmiş işlem varsa geri alınmayacağını biliyorum.</label><button disabled={busy||!abandon} onClick={clearPending} className="mt-2 min-h-11 underline disabled:opacity-40">Bekleyen formu bırak</button></div>}
 </section>;
}
