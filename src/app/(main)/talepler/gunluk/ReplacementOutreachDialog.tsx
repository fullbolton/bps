"use client";
import {privateTextError} from '@/lib/privacy/operational-text';
import {useEffect,useRef,useState} from 'react';
import {ModalShell} from '@/components/ui';
import {validateOutreachInput,outreachLabels,type OutreachOutcome,type OutreachLatest} from '@/lib/operations/replacement-outreach';
import {reserveCommand,acknowledgeCommand,reconcilePending,pendingCount,type CommandScope} from '@/lib/operations/pending-commands';
import {parseCommandResolutions} from '@/lib/operations/command-reconciliation';
import {outreachLatestAction,outreachRecordAction,pilotReconcileAction} from './actions';

const field='mt-1 block min-h-11 w-full rounded-lg border border-slate-300 bg-white p-2';
const button='min-h-11 rounded-lg border border-slate-300 px-4 py-2 text-sm disabled:opacity-40';
export default function ReplacementOutreachDialog({scope,assignmentId,workerId,workerName,onClose,onLock}:{
 scope:CommandScope;assignmentId:string;workerId:string;workerName:string;onClose:()=>void;onLock:(busy:boolean)=>void;
}){
 const [latest,setLatest]=useState<OutreachLatest|null>(null),[ready,setReady]=useState(false),[loading,setLoading]=useState(false);
 const [outcome,setOutcome]=useState<OutreachOutcome|''>(''),[note,setNote]=useState(''),[error,setError]=useState('');
 const [busy,setBusy]=useState(false),[pending,setPending]=useState<string|null>(null),[saved,setSaved]=useState(false),[discard,setDiscard]=useState(false);
 const active=useRef(true),inFlight=useRef(false);
 useEffect(()=>{active.current=true;onLock(true);return()=>{active.current=false;onLock(false);};},[onLock]);
 async function load(){setLoading(true);setReady(false);setError('');try{
  if(pendingCount(scope,localStorage)>0){setError('Bekleyen işlem var. Pencereyi kapatıp günlük plandaki bekleyen işlemleri kontrol edin.');return;}
  const value=await outreachLatestAction(scope,assignmentId,workerId);
  if(active.current){setLatest(value);setReady(true);}
 }catch{if(active.current)setError('Son görüşme okunamadı. Doğrulanmadan yeni kayıt gönderilemez.');}
 finally{if(active.current)setLoading(false);}}
 // Parent keys this dialog by scope + assignment + worker. No draft carries into another target.
 useEffect(()=>{void load();},[]); // eslint-disable-line react-hooks/exhaustive-deps
 const dirty=!!outcome||!!note;
 function close(){if(busy||pending)return;if(dirty&&!saved){setDiscard(true);return;}onClose();}
 async function save(){
  if(inFlight.current||!ready||!outcome||pending||saved)return;
  inFlight.current=true;setBusy(true);setDiscard(false);setError('');let id:string|undefined;
  try{
   const input=validateOutreachInput({assignmentId,workerId,expectedRevision:latest?.revision??0,outcome,note});
   id=await reserveCommand(scope,'replacement_outreach',input,localStorage,navigator.locks);
   setPending(id);
   await outreachRecordAction(scope,id,input);
   await acknowledgeCommand(scope,id,localStorage,navigator.locks);
   if(active.current){setPending(null);setSaved(true);}
  }catch(error){if(active.current)setError(privateTextError(error)??(id?'Sonuç doğrulanamadı. Yeniden kayıt göndermeden işlemin sonucunu kontrol edin.':'İşlem kurtarma kaydı oluşturulamadı; görüşme gönderilmedi.'));}
  finally{inFlight.current=false;if(active.current)setBusy(false);}
 }
 async function recover(){if(!pending||inFlight.current)return;inFlight.current=true;setBusy(true);setError('');
  try{
   const response=await pilotReconcileAction(scope,[pending],true);
   if(!response.ok)throw Error('reconcile');
   const [result]=parseCommandResolutions([pending],response.data);
   await reconcilePending(scope,[pending],response.data,localStorage,navigator.locks);
   if(active.current){
    if(result.status==='confirmed'){setPending(null);setSaved(true);}
    else if(result.status==='closed'){setPending(null);setReady(false);setError('Görüşme kaydedilmedi. Taslağınız korunuyor. Son görüşmeyi yenileyip yeniden değerlendirin.');}
    else setError('İşlem hâlâ doğrulanamadı. Taslağı değiştirmeden tekrar kontrol edin.');
   }
  }catch{if(active.current)setError('İşlem sonucu alınamadı; bekleyen kayıt korunuyor.');}
  finally{inFlight.current=false;if(active.current)setBusy(false);}
 }
 return <ModalShell open title="Yedek personel görüşmesi" onClose={close} closeDisabled={busy||!!pending}>
  <p className="font-semibold">{workerName}</p><p className="mt-2 text-sm text-slate-600">Kabul, personeli yerleştirmez. Görüşmeden sonra mevcut personel değişimi formundan ayrıca yerleştirin.</p>
  {error&&<p role="alert" className="my-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{error}</p>}
  {saved?<div role="status" className="mt-4 space-y-3"><p>Görüşme kaydedildi. Personel ataması değiştirilmedi.</p><button type="button" className={button} onClick={onClose}>Personel seçimine dön</button></div>:<>
   {loading?<p role="status">Son görüşme yükleniyor…</p>:ready?<div className="my-3 rounded-lg bg-slate-50 p-3 text-sm">{latest?<><p>Son kayıt: {outreachLabels[latest.outcome]}</p><p>{new Date(latest.recordedAt).toLocaleString('tr-TR',{timeZone:'Europe/Istanbul'})}</p><p className="whitespace-pre-wrap break-words">{latest.note}</p></>:<p>Bu aday için görüşme kaydı yok.</p>}</div>:!pending&&<button className={button} type="button" disabled={busy} onClick={()=>void load()}>Son görüşmeyi yenile</button>}
   <form className="mt-4 space-y-3" onSubmit={e=>{e.preventDefault();void save();}}><fieldset disabled={busy||!!pending||!ready} className="space-y-3">
    <label className="block text-sm">Görüşme sonucu<select className={field} value={outcome} required onChange={e=>setOutcome(e.target.value as OutreachOutcome)}><option value="" disabled>Sonuç seçin</option>{Object.entries(outreachLabels).filter(([value])=>value!=='withdrawn'||latest?.outcome==='accepted').map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
    <label className="block text-sm">Görüşme notu<textarea className={field} value={note} maxLength={1000} rows={3} onChange={e=>setNote(e.target.value)}/></label>
    <button className={`${button} bg-blue-700 text-white`} disabled={!outcome}>Görüşmeyi kaydet</button>
   </fieldset></form>
   {pending&&<button type="button" className={`${button} mt-3`} disabled={busy} onClick={()=>void recover()}>İşlemin sonucunu kontrol et</button>}
   {discard&&<div className="mt-3 rounded-lg border border-amber-300 p-3"><p className="text-sm">Kaydedilmemiş görüşme taslağı silinsin mi?</p><button type="button" className={button} onClick={onClose}>Taslağı sil ve kapat</button><button type="button" className={button} onClick={()=>setDiscard(false)}>Düzenlemeye dön</button></div>}
  </>}
 </ModalShell>;
}
