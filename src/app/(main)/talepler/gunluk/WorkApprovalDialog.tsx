"use client";
import {useEffect,useRef,useState} from 'react';
import {ModalShell} from '@/components/ui';
import {workMinutes,validateWorkAction,workStatusLabels,workActionLabels,type WorkAction,type WorkFields,type WorkRecord} from '@/lib/operations/work-approval';
import {reserveCommand,acknowledgeCommand,reconcilePending,pendingCount,type CommandScope} from '@/lib/operations/pending-commands';
import {parseCommandResolutions} from '@/lib/operations/command-reconciliation';
import {workReadAction,workExecuteAction,pilotReconcileAction} from './actions';

const field='mt-1 block min-h-11 w-full rounded-lg border border-slate-300 bg-white p-2 disabled:bg-slate-100';
const button='min-h-11 rounded-lg border border-slate-300 px-4 py-2 text-sm disabled:opacity-40';
const empty:WorkFields={startTime:'',endTime:'',nextDay:false,breakMinutes:0,note:''};
const fieldsOf=(r:WorkFields):WorkFields=>({startTime:r.startTime,endTime:r.endTime,nextDay:r.nextDay,breakMinutes:r.breakMinutes,note:r.note});
const duration=(n:number)=>`${Math.floor(n/60)} sa ${n%60} dk`;
export default function WorkApprovalDialog({scope,assignmentId,workerName,workDate,manager,closed=false,onClose,onLock}:{
 scope:CommandScope;assignmentId:string;workerName:string;workDate:string;manager:boolean;closed?:boolean;onClose:()=>void;onLock:(busy:boolean)=>void;
}){
 const [record,setRecord]=useState<WorkRecord|null>(null),[fields,setFields]=useState<WorkFields>(empty);
 const [ready,setReady]=useState(false),[busy,setBusy]=useState(false),[loading,setLoading]=useState(false);
 const [error,setError]=useState(''),[message,setMessage]=useState(''),[reason,setReason]=useState('');
 const [pending,setPending]=useState<string|null>(null),[discard,setDiscard]=useState(false);
 const active=useRef(true),inFlight=useRef(false);
 useEffect(()=>{active.current=true;onLock(true);return()=>{active.current=false;onLock(false);};},[onLock]);
 async function load(replaceDraft:boolean){
  setLoading(true);setReady(false);setError('');
  try{
   if(pendingCount(scope,localStorage)>0)throw Error('pending');
   const value=await workReadAction(scope,assignmentId);
   if(active.current){setRecord(value);setReady(true);if(replaceDraft){setFields(value?fieldsOf(value):empty);setReason('');}}
  }catch{if(active.current)setError('Çalışma kaydı yüklenemedi. Günlük plandaki bekleyen işlemleri kontrol edin, ardından bu ekranı yeniden açın.');}
  finally{if(active.current)setLoading(false);}
 }
 // The parent keys the dialog by tenant, actor and assignment; drafts never cross targets.
 useEffect(()=>{void load(true);},[]); // eslint-disable-line react-hooks/exhaustive-deps
 const dirty=JSON.stringify(fields)!==JSON.stringify(record?fieldsOf(record):empty)||!!reason;
 const editable=ready&&!closed&&(!record||record.status==='draft'||record.status==='returned');
 let net:number|null=null;try{net=workMinutes(fields);}catch{/* Incomplete form: no invented total. */}
 function close(){if(busy||pending||loading)return;if(dirty){setDiscard(true);return;}onClose();}
 async function execute(action:WorkAction){
  if(inFlight.current||!ready||pending)return;
  let payload:ReturnType<typeof validateWorkAction>;
  try{payload=validateWorkAction(action,action==='save'?fields:{reason});}
  catch(e){setError(e instanceof Error?e.message:'Alanları kontrol edin.');return;}
  inFlight.current=true;setBusy(true);setDiscard(false);setError('');setMessage('');let id:string|undefined;
  try{
   const revision=record?.revision??0;
   id=await reserveCommand(scope,'work_approval',{assignmentId,revision,action,payload},localStorage,navigator.locks);
   setPending(id);
   const result=await workExecuteAction(scope,id,assignmentId,revision,action,payload);
   if(!result.ok){if(active.current)setError(result.message);return;}
   await acknowledgeCommand(scope,id,localStorage,navigator.locks);
   if(active.current){setPending(null);setMessage(workActionLabels[action]+'.');await load(true);}
  }catch{if(active.current)setError(id?'Sonuç doğrulanamadı. Tekrar göndermeden işlemin sonucunu kontrol edin.':'İşlem kurtarma kaydı oluşturulamadı; çalışma gönderilmedi.');}
  finally{inFlight.current=false;if(active.current)setBusy(false);}
 }
 async function recover(){
  if(!pending||inFlight.current)return;inFlight.current=true;setBusy(true);setError('');
  try{
   const response=await pilotReconcileAction(scope,[pending],true);if(!response.ok)throw Error('reconcile');
   const [result]=parseCommandResolutions([pending],response.data);
   await reconcilePending(scope,[pending],response.data,localStorage,navigator.locks);
   if(active.current){
    if(result.status==='confirmed'){setPending(null);setMessage('İşlem kaydedilmiş. Güncel kayıt yüklendi.');await load(true);}
    else if(result.status==='closed'){setPending(null);setReady(false);setError('İşlem kaydedilmedi. Taslağınız korunuyor. Güncel kaydı yenileyip saatleri karşılaştırın.');}
    else setError('İşlem henüz doğrulanamadı. Tekrar kontrol edin.');
   }
  }catch{if(active.current)setError('Sonuç alınamadı; bekleyen işlem korunuyor.');}
  finally{inFlight.current=false;if(active.current)setBusy(false);}
 }
 return <ModalShell open title="Çalışma kaydı ve onay" onClose={close} closeDisabled={busy||loading||!!pending}>
  <p className="font-semibold">{workerName} · {workDate}</p>
  <p className="mt-2 text-sm text-slate-600">Personelin çalıştığı saatleri girip onaylayın. “Geldi” yoklaması saatleri otomatik onaylamaz. Ücret ve bordro ayrıca hesaplanır.</p>
  {closed&&<p className="my-3 text-sm">Bu geçmiş atamanın çalışma kaydı salt okunur gösteriliyor.</p>}
  {error&&<p role="alert" className="my-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{error}</p>}
  {message&&<p role="status" className="my-3 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900">{message}</p>}
  {loading?<p role="status">Çalışma kaydı yükleniyor…</p>:ready?<div className="my-3 rounded-lg bg-slate-50 p-3 text-sm">
   {record?<><p className="font-semibold">{workStatusLabels[record.status]} · Sürüm {record.revision}</p><p>Kaydedilen: {record.startTime}–{record.endTime}{record.nextDay?' (ertesi gün)':''} · {record.breakMinutes} dk mola · Net {duration(record.netMinutes)}</p></>:<p>Henüz çalışma kaydı yok.</p>}
  </div>:!pending&&<button className={button} type="button" disabled={busy} onClick={()=>void load(false)}>Güncel kaydı yenile · taslağı koru</button>}
  {ready&&record?.status==='returned'&&record.history[0]?.reason&&<p className="my-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm"><strong>Düzeltme gerekçesi:</strong> {record.history[0].reason}</p>}
  {ready&&!editable&&record?.note&&<p className="my-3 whitespace-pre-wrap break-words text-sm">{record.note}</p>}
  {(editable||!ready)&&<form className="mt-4 space-y-3" onSubmit={e=>{e.preventDefault();void execute('save');}}>
   <fieldset disabled={!editable||busy||!!pending} className="space-y-3">
    <div className="grid grid-cols-2 gap-3"><label className="text-sm">Başlangıç<input type="time" required className={field} value={fields.startTime} onChange={e=>setFields({...fields,startTime:e.target.value})}/></label><label className="text-sm">Bitiş<input type="time" required className={field} value={fields.endTime} onChange={e=>setFields({...fields,endTime:e.target.value})}/></label></div>
    <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={fields.nextDay} onChange={e=>setFields({...fields,nextDay:e.target.checked})}/> Bitiş ertesi gün</label>
    <label className="block text-sm">Mola (dakika)<input type="number" min={0} max={1439} step={1} required className={field} value={Number.isFinite(fields.breakMinutes)?fields.breakMinutes:''} onChange={e=>setFields({...fields,breakMinutes:e.target.value===''?NaN:Number(e.target.value)})}/></label>
    <label className="block text-sm">Çalışma notu<textarea rows={2} maxLength={1000} className={field} value={fields.note} onChange={e=>setFields({...fields,note:e.target.value})}/></label>
    <p className="text-sm" aria-live="polite">{net===null?'Geçerli saat ve mola girildiğinde net süre hesaplanır.':`Net çalışma: ${duration(net)}`}</p>
    {editable&&<button className={`${button} bg-blue-700 text-white`} disabled={net===null||!dirty}>Saatleri kaydet</button>}
   </fieldset>
  </form>}
  {ready&&record&&<div className="mt-4 space-y-3">
   {!closed&&(record.status==='draft'||record.status==='returned')&&<><button type="button" className={`${button} bg-blue-700 text-white`} disabled={busy||!!pending||dirty} onClick={()=>void execute('submit')}>Onaya gönder</button><p className="text-xs text-slate-600">Önce değişiklikleri kaydedin. Çalışma bitmiş ve Geldi kaydı bulunmuş olmalı.</p></>}
   {record.status==='submitted'&&!manager&&<p className="text-sm">Yönetici onayı bekleniyor. Saatler onay süresince değiştirilemez.</p>}
   {manager&&!closed&&(record.status==='submitted'||record.status==='approved')&&<>
    {record.status==='submitted'&&<button type="button" className={`${button} bg-emerald-700 text-white`} disabled={busy||!!pending||!!reason} onClick={()=>void execute('approve')}>Çalışmayı onayla</button>}
    <label className="block text-sm">Düzeltme gerekçesi<textarea className={field} rows={2} maxLength={1000} value={reason} disabled={busy||!!pending} onChange={e=>setReason(e.target.value)}/></label>
    <button type="button" className={button} disabled={busy||!!pending||reason.trim().length<3} onClick={()=>void execute(record.status==='approved'?'reopen':'return')}>{record.status==='approved'?'Onayı düzeltmeye aç':'Gerekçeyle geri gönder'}</button>
   </>}
   <details className="rounded-lg border p-3"><summary className="cursor-pointer text-sm">İşlem geçmişi ({Math.min(record.revision,20)} / {record.revision})</summary><ol className="mt-2 space-y-2 text-sm">{record.history.map(event=><li key={event.revision} className="border-t pt-2"><p>{workActionLabels[event.action]} · Sürüm {event.revision} · {duration(event.netMinutes)}</p><p className="text-xs text-slate-500">{new Date(event.recordedAt).toLocaleString('tr-TR',{timeZone:'Europe/Istanbul'})}</p>{event.reason&&<p className="whitespace-pre-wrap break-words">{event.reason}</p>}</li>)}</ol>{record.revision>20&&<p className="mt-2 text-xs">Son 20 işlem gösterilir. Eski kayıtlar veritabanında korunur.</p>}</details>
  </div>}
  {pending&&<button type="button" className={`${button} mt-3`} disabled={busy} onClick={()=>void recover()}>İşlemin sonucunu kontrol et</button>}
  {discard&&<div className="mt-3 rounded-lg border border-amber-300 p-3"><p className="text-sm">Kaydedilmemiş çalışma taslağı silinsin mi?</p><button type="button" className={button} onClick={onClose}>Taslağı sil ve kapat</button><button type="button" className={button} onClick={()=>setDiscard(false)}>Düzenlemeye dön</button></div>}
 </ModalShell>;
}
