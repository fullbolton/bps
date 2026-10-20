'use client';
import {useEffect,useRef,useState} from 'react';
import {createClient} from '@/lib/supabase/client';
import {loadHrEmployment} from '@/lib/services/hr-employment';
import {pdfDigest} from '@/lib/pdf-upload';
import {parseHrUploadReceipt,type HrUploadInput} from '@/lib/services/hr-document-upload';
import {useNavigationGuard} from '@/context/NavigationGuardContext';
import type {parseHrScanStatus} from '@/lib/services/hr-scan-status';
const button='min-h-11 rounded-lg border px-4 py-2 disabled:opacity-50';
export default function HrDocumentUpload({actor,tenant,employee,recovery,onClose,onSaved}:{actor:string;tenant:string;employee:string;recovery?:HrUploadInput;onClose:()=>void;onSaved:()=>Promise<void>}){
 const [period,setPeriod]=useState<Awaited<ReturnType<typeof loadHrEmployment>>|null>(null),[periodError,setPeriodError]=useState(false);
 const [title,setTitle]=useState(recovery?.title??''),[validity,setValidity]=useState(recovery?.validityDate??'');
 const [file,setFile]=useState<File|null>(null),[intent,setIntent]=useState<HrUploadInput|null>(recovery??null);
 const [scan,setScan]=useState<ReturnType<typeof parseHrScanStatus>|null>(null);
 const retryRequest=useRef<string|null>(null);
 const [cancelled,setCancelled]=useState(false),[done,setDone]=useState(false);
 const [busy,setBusy]=useState(false),[uncertain,setUncertain]=useState(false),[message,setMessage]=useState('');
 const flight=useRef(false),alive=useRef(true);const guard=useNavigationGuard();
 useEffect(()=>{alive.current=true;if(!recovery)void loadHrEmployment(createClient(),actor,tenant,employee).then(r=>{if(alive.current)setPeriod(r);}).catch(()=>{if(alive.current){setPeriodError(true);setMessage('İstihdam dönemi alınamadı. Bilgilerinizi koruyarak yeniden deneyebilirsiniz.');}});return()=>{alive.current=false;};},[actor,tenant,employee,recovery]);
 useEffect(()=>{if(done)return;const off=guard.register(e=>{e.preventDefault();setMessage('Önce evrak formunu tamamlayın veya kapatın.');});const stop=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue='';};window.addEventListener('beforeunload',stop);return()=>{off();window.removeEventListener('beforeunload',stop);};},[guard,done]);
 async function retryPeriod(){
  if(flight.current||intent||done||recovery)return;
  flight.current=true;setBusy(true);setMessage('İstihdam dönemi kontrol ediliyor…');
  try{const next=await loadHrEmployment(createClient(),actor,tenant,employee);if(alive.current){setPeriod(next);setPeriodError(false);setMessage('İstihdam dönemi alındı. Dosyanız ve yazdıklarınız korundu.');}}
  catch{if(alive.current){setPeriodError(true);setMessage('İstihdam dönemi alınamadı. Erişiminizi kontrol edip yeniden deneyin.');}}
  finally{flight.current=false;if(alive.current)setBusy(false);}
 }
 async function completed(){
  setDone(true);setUncertain(false);setScan(null);setMessage('Evrak kaydedildi.');
  try{await onSaved();}catch{if(alive.current)setMessage('Evrak kaydedildi; liste yenilenemedi. Formu kapatıp evrak listesini yenileyin.');}
 }
 async function save(){
  if(done||flight.current||!file||(!intent&&!period))return;
  flight.current=true;setBusy(true);setScan(null);setMessage('');let submitted=false;
  try{
   if(file.size<5||file.size>10*1024*1024)throw Error('HR_UPLOAD_SIZE');
   const bytes=await file.arrayBuffer(),sha256=await pdfDigest(bytes);
   const command=intent??{id:crypto.randomUUID(),employmentId:period!.periodId,title:title.trim(),size:file.size,sha256,validityDate:validity||null};
   // Shared parser validates title, hash, calendar date and exact recovery bytes before transmission.
   parseHrUploadReceipt({schemaVersion:1,actorId:actor,tenantId:tenant,employeeId:employee,...command,state:'pending'},{actor,tenant,employee},command);
   if(command.size!==file.size||command.sha256!==sha256)throw Error('HR_FILE_MISMATCH');
   setIntent(command);const form=new FormData();form.set('actorId',actor);form.set('tenantId',tenant);form.set('employeeId',employee);form.set('command',JSON.stringify(command));form.set('file',file);
   submitted=true;setUncertain(true);
   const response=await fetch('/api/hr/documents/upload',{method:'POST',body:form,signal:AbortSignal.timeout(60000)});
   const result=await response.json();if(result.code==='HR_UPLOAD_CANCELLED'&&result.uncertain===false){if(alive.current){setUncertain(false);setCancelled(true);setMessage('Bu yükleme için iptal başlatılmış. Formu kapatıp bekleyen yüklemelerden iptal işlemini tamamlayın.');}return;}if(!response.ok||!result.ok)throw Error('HR_UPLOAD_UNCERTAIN');
   const receipt=parseHrUploadReceipt(result.receipt,{actor,tenant,employee},command);if(receipt.state==='pending'){if(alive.current){setUncertain(false);setMessage('Dosya alındı. Güvenlik taraması tamamlanana kadar evrak kullanılamaz. Durumu kontrol edin.');}return;}if(receipt.state!=='published')throw Error('HR_UPLOAD_UNCERTAIN');
   if(alive.current)await completed();
  }catch(error){if(alive.current)setMessage(submitted?'Sonuç doğrulanamadı. Aynı dosyayla yeniden deneyin. Sayfayı yeniden açarsanız bekleyen yüklemelerden devam edebilirsiniz.':(error as Error).message==='HR_FILE_MISMATCH'?'İlk yüklemede seçtiğiniz PDF dosyasını seçin. Dosya içeriği eşleşmiyor.':'PDF dosyasını, başlığı ve geçerlilik tarihini kontrol edin. En fazla 10 MB yükleyebilirsiniz.');}
  finally{flight.current=false;if(alive.current)setBusy(false);}
 }
 async function checkScan(action:'status'|'finalize'|'rescan'){
  if(done||flight.current||!intent)return;
  flight.current=true;setBusy(true);setScan(null);setMessage('');
  if(action==='rescan'&&!retryRequest.current)retryRequest.current=crypto.randomUUID();
  try{
   const response=await fetch('/api/hr/documents/scan',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({actorId:actor,tenantId:tenant,employeeId:employee,command:intent,action,requestId:retryRequest.current}),signal:AbortSignal.timeout(45000)});
   const result=await response.json();if(!response.ok||!result.ok)throw Error('HR_SCAN_UNCERTAIN');
   if(!alive.current)return;
   if(result.receipt){const receipt=parseHrUploadReceipt({schemaVersion:1,actorId:actor,tenantId:tenant,employeeId:employee,...result.receipt},{actor,tenant,employee},intent);if(receipt.state!=='published')throw Error('HR_SCAN_UNCERTAIN');await completed();return;}
   // Server response is scoped and validated by actOnHrDocumentScan.
   if(!result.scan||typeof result.scan.label!=='string'||typeof result.scan.canFinalize!=='boolean'||typeof result.scan.canRescan!=='boolean')throw Error('HR_SCAN_UNCERTAIN');
   setScan(result.scan);setUncertain(false);setMessage(result.scan.label);
   if(action==='rescan'||result.scan.status!=='expired')retryRequest.current=null;
  }catch{if(alive.current)setMessage('Tarama durumu doğrulanamadı. Yeniden kontrol edin. Dosya tamamlanmış sayılmadı.');}
  finally{flight.current=false;if(alive.current)setBusy(false);}
 }
 return <form className="space-y-3 rounded-xl border p-4" onSubmit={e=>{e.preventDefault();void save();}}>
  <h3 className="font-semibold">{recovery?'Yarım kalan yüklemeyi tamamla':'Özel evrak yükle'}</h3>
  {period&&<p className="text-sm">İstihdam dönemi: {period.startsOn} — {period.endsOn??'Devam ediyor'}</p>}
  {!recovery&&!period&&!message&&<p role="status">İstihdam dönemi kontrol ediliyor…</p>}
  {message&&<p role="status">{message}</p>}
  {!recovery&&!period&&periodError&&<button type="button" className={button} disabled={busy} onClick={()=>void retryPeriod()}>İstihdam dönemini yeniden getir</button>}
  {intent&&!done&&<div className="flex flex-wrap gap-2"><button type="button" className={button} disabled={busy} onClick={()=>void checkScan('status')}>Tarama durumunu kontrol et</button>{scan?.canFinalize&&<button type="button" className={button} disabled={busy} onClick={()=>void checkScan('finalize')}>Evrakı kaydet</button>}{scan?.canRescan&&<button type="button" className={button} disabled={busy} onClick={()=>void checkScan('rescan')}>Yeniden tara</button>}</div>}
  <label className="block">Belge başlığı<input required maxLength={160} className="mt-1 min-h-11 w-full rounded-lg border px-3" disabled={busy||!!intent} value={title} onChange={e=>setTitle(e.target.value)}/></label>
  <label className="block">Geçerlilik tarihi (isteğe bağlı)<input type="date" min="1900-01-01" max="2199-12-31" className="mt-1 min-h-11 w-full rounded-lg border px-3" disabled={busy||!!intent} value={validity} onChange={e=>setValidity(e.target.value)}/></label>
  <label className="block">PDF dosyası · en fazla 10 MB<input type="file" accept="application/pdf,.pdf" className="mt-2 block w-full min-w-0 text-sm" disabled={busy||done} onChange={e=>setFile(e.target.files?.[0]??null)}/></label>
  <div className="flex flex-wrap gap-2"><button className={button} disabled={done||busy||cancelled||!file||(!intent&&!period)}>{done?'Kaydedildi':busy?'Dosya doğrulanıyor…':intent?'Aynı yüklemeyi tamamla':'Yükle'}</button><button type="button" className={button} disabled={busy||uncertain} onClick={onClose}>Formu kapat</button></div>
 </form>;
}
