'use client';
import Link from 'next/link';
import ImportHistory from './ImportHistory';
import ImportChangeReview from './ImportChangeReview';
import {readLocalReference,clearResolvedLocalReference} from '@/lib/talent/local-reference';
import {buildImportReport,importStatusLabels as labels,importBlockReasons as reasons,type ImportReportMode} from '@/lib/talent/import-report';
import {useEffect,useRef,useState} from 'react';
import {useNavigationGuard} from '@/context/NavigationGuardContext';
import {importReference,type ImportRequest,type ImportReference,type ImportRecovery,type ImportBatchStatus,type ImportRowStatus} from '@/lib/talent/import-batches';
import type {TalentScope} from '@/lib/talent/people';
import {talentImportPrepareAction,talentImportRecoverAction,talentImportApplyAction} from '../actions';
const button='min-h-11 rounded-xl border bg-white px-4 text-sm disabled:opacity-40';
export default function ImportRunner({scope,request,onTaken,onActiveChange,enabled=true,queuedReference=null,onClosed}:{queuedReference?:ImportReference|null;onClosed?:(id:string)=>void;enabled?:boolean;scope:TalentScope;request:ImportRequest|null;onTaken:()=>void;onActiveChange:(active:boolean)=>void}){
 const [changeRow,setChangeRow]=useState<number|null>(null),[undoBusy,setUndoBusy]=useState(false);
 const [reference,setReference]=useState<ImportReference|null>(null),[recovery,setRecovery]=useState<ImportRecovery|null>(null),[ready,setReady]=useState(false),[storageError,setStorageError]=useState<'invalid'|'unavailable'|'write'|null>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[confirm,setConfirm]=useState(false),[page,setPage]=useState(0);
 const [report,setReport]=useState<ReturnType<typeof buildImportReport>|null>(null),[reportUrl,setReportUrl]=useState('');
 useEffect(()=>{if(!report){setReportUrl('');return;}const url=URL.createObjectURL(new Blob([report.csv],{type:'text/csv;charset=utf-8'}));setReportUrl(url);return()=>URL.revokeObjectURL(url);},[report]);
 const flight=useRef(false),alive=useRef(true),pause=useRef(false),handled=useRef<string|null>(null),guard=useNavigationGuard();
 const enabledNow=useRef(enabled);enabledNow.current=enabled;
 useEffect(()=>{if(!enabled){pause.current=true;setReport(null);}},[enabled]);
 const key=`bps:talent-import:${scope.actorId}:${scope.tenantId}`;
 const batch=recovery?.kind==='batch'?recovery.data:null,terminal=recovery?.kind==='closed'||!!batch&&batch.rows.every(r=>r.status!=='pending');
 function restoreReference(){
  const saved=readLocalReference(()=>sessionStorage.getItem(key),importReference);
  if(saved.kind==='invalid'||saved.kind==='unavailable'){setStorageError(saved.kind);return;}
  setStorageError(null);
  if(saved.kind==='valid'){setReference(saved.value);void operate('check',saved.value);}
 }
 useEffect(()=>{alive.current=true;restoreReference();setReady(true);return()=>{alive.current=false;pause.current=true;};},[key]);
 useEffect(()=>{onActiveChange(!ready||!!storageError||!!reference);},[ready,storageError,reference,onActiveChange]);
 useEffect(()=>{if(!busy&&!undoBusy)return;const stop=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue='';};window.addEventListener('beforeunload',stop);const off=guard.register(e=>{if(e.button!==0||e.ctrlKey||e.metaKey||e.shiftKey||e.altKey)return;e.preventDefault();setMessage('Devam eden işlemin sonucunu bekleyin.');});return()=>{off();window.removeEventListener('beforeunload',stop);};},[busy,undoBusy,guard]);
 useEffect(()=>{if(enabled&&request&&ready&&!storageError&&!reference&&handled.current!==request.batchId){handled.current=request.batchId;void start(request);}},[enabled,request,ready,storageError,reference]);
 useEffect(()=>{
  if(!enabled||!ready||storageError||reference||!queuedReference||flight.current)return;
  const ref=importReference(queuedReference);
  try{sessionStorage.setItem(key,JSON.stringify(ref));}catch{setStorageError('write');return;}
  setReference(ref);setRecovery(null);setPage(0);void operate('resume',ref);
 },[enabled,ready,storageError,reference,queuedReference?.batchId]);
 async function read(ref:ImportReference,close=false){if(!enabledNow.current)throw Error('Şirket doğrulanana kadar işlem duraklatıldı.');if(alive.current)setReport(null);const r=await talentImportRecoverAction(scope,ref,close);if(!r.ok)throw Error(r.message);if(alive.current)setRecovery(r.data);return r.data;}
 async function process(ref:ImportReference,data:ImportBatchStatus){
  let current=data;
  for(const row of data.rows){
   if(pause.current||!alive.current||!enabledNow.current)break;if(row.status!=='pending')continue;
   const result=await talentImportApplyAction(scope,ref,row.number);if(!result.ok)throw Error(result.message);
   current={...current,rows:current.rows.map(r=>r.number===row.number?result.data:r)};
   if(alive.current)setRecovery({kind:'batch',data:current});
   if(result.data.status==='blocked'){pause.current=true;if(alive.current)setMessage(`Satır ${row.number} inceleme istiyor. Diğer bekleyenleri sürdürmeden önce sonucu kontrol edin.`);break;}
  }
  if(alive.current&&enabledNow.current){const final=await read(ref);if(pause.current){const remaining=final.kind==='batch'&&final.data.rows.some(r=>r.status==='pending');setMessage(m=>remaining?(m.includes('inceleme')?m:'Aktarım duraklatıldı. Tamamlanan satırlar korunuyor.'):'İşlenecek satır kalmadı. Gönderilmiş satırların sonuçları alındı.');}}
 }
 async function start(input:ImportRequest){
  if(flight.current||!alive.current||!enabledNow.current)return;flight.current=true;pause.current=false;setBusy(true);setMessage('');
  const ref=importReference(input);
  try{
   try{sessionStorage.setItem(key,JSON.stringify(ref));}catch{setStorageError('write');throw Error('Aktarım referansı saklanamadı. Sunucuya gönderilmedi; sayfayı yenileyin.');}
   setReference(ref);onTaken();
   const prepared=await talentImportPrepareAction(scope,input);if(!prepared.ok)throw Error(prepared.message);
   if(!alive.current)return;setRecovery({kind:'batch',data:prepared.data});await process(ref,prepared.data);
  }catch(e){if(alive.current)setMessage(`${e instanceof Error?e.message:'Yanıt alınamadı.'} Sonucu kontrol edin; yeni bir aktarım başlatmayın.`);}
  finally{flight.current=false;if(alive.current)setBusy(false);}
 }
 async function operate(mode:'check'|'resume'|'close',ref=reference){
  if(!ref||flight.current||!alive.current||!enabledNow.current)return;flight.current=true;pause.current=false;setBusy(true);setMessage('');setConfirm(false);
  try{const result=await read(ref,mode==='close');if(mode==='resume'&&result.kind==='batch'&&alive.current)await process(ref,result.data);}
  catch(e){if(alive.current)setMessage(`${e instanceof Error?e.message:'Sonuç okunamadı.'} Son okunan bilgiler güncel olmayabilir; yeniden kontrol edin.`);}
  finally{flight.current=false;if(alive.current)setBusy(false);}
 }
 async function prepareReport(mode:ImportReportMode){if(!reference||flight.current||!alive.current||!enabledNow.current)return;flight.current=true;setBusy(true);setMessage('');setConfirm(false);try{const result=await read(reference);if(result.kind!=='batch')throw Error('Aktarım bilgileri alınamadığı için rapor hazırlanamadı. Sonucu kontrol edip yeniden deneyin.');const value=buildImportReport(result.data,scope,reference,mode,new Date().toISOString());if(alive.current)setReport(value);}catch(e){if(alive.current)setMessage(e instanceof Error?e.message:'Rapor hazırlanamadı.');}finally{flight.current=false;if(alive.current)setBusy(false);}}
 function finish(){if(!terminal||flight.current||undoBusy)return;setChangeRow(null);if(!clearResolvedLocalReference(()=>sessionStorage.removeItem(key))){setMessage('Aktarım sonucu doğrulandı ancak tarayıcı referansı temizlenemedi. Depolama izinlerini kontrol edip Sonucu kapat düğmesini yeniden deneyin.');return;}const id=reference?.batchId;setReference(null);setRecovery(null);setReport(null);setMessage('');setPage(0);if(id)onClosed?.(id);}
 if(!ready)return <p role="status">Aktarım kaydı kontrol ediliyor…</p>;
 if(storageError)return <div className="space-y-4"><div role="alert" className="rounded-xl bg-amber-50 p-4"><p>{storageError==='invalid'?'Tarayıcıdaki aktarım referansının biçimi geçersiz. Sayfayı yenilemek bu kaydı düzeltmez.':storageError==='unavailable'?'Tarayıcının yerel kayıtlarına erişilemiyor. Depolama izinlerini kontrol edin.':'Aktarım referansı tarayıcıya kaydedilemedi.'} Yeni aktarım kapalı. Önceki işlemleri aşağıdaki sunucu geçmişinden inceleyebilirsiniz; bu durum işlemin başarısız olduğu anlamına gelmez.</p><button type="button" className={`${button} mt-3`} disabled={!enabled||busy} onClick={restoreReference}>Tarayıcı kaydını yeniden kontrol et</button></div><ImportHistory scope={scope} readOnly onChoose={()=>{}}/></div>;
 if(!reference)return <ImportHistory scope={scope} onChoose={item=>{if(flight.current)return;const ref=importReference(item);try{sessionStorage.setItem(key,JSON.stringify(ref));}catch{setStorageError('write');return;}setReference(ref);setRecovery(null);setPage(0);onTaken();void operate('check',ref);}}/>;
 return <section aria-label="Kalıcı aktarım sonucu" className="space-y-4 rounded-2xl border border-blue-200 bg-blue-50/40 p-4">
  <h2 className="text-xl font-semibold">Aktarım durumu</h2><p className="text-sm">{reference.total} dosya satırı · İptal yalnız bekleyen satırları durdurur. Kaydedilmiş güncellemeler için “Değişiklikleri incele”yi açın.</p>
  {message&&<p role="alert" className="rounded-xl bg-amber-50 p-3 text-sm">{message}</p>}
  {busy&&<p role="status" className="text-sm">İşlem sürüyor…</p>}
  {(!recovery||recovery.kind==='unknown')&&<p className="text-sm">Aktarım sonucu henüz alınamadı; bazı satırlar kaydedilmiş olabilir. “Sonucu kontrol et” düğmesini kullanın. Devam etmek istemiyorsanız “İşlenmeyenleri iptal et” düğmesine basın.</p>}
  {recovery?.kind==='closed'&&<p role="status">Aktarımdan vazgeçildi. Bu aktarım için sonradan ulaşan istekler yeni kayıt oluşturmayacak.</p>}
  {batch&&<><div role="status" className="flex flex-wrap gap-2">{(Object.keys(labels) as ImportRowStatus[]).map(status=><span key={status} className="rounded-lg bg-white px-3 py-2 text-sm">{labels[status]}: <strong>{batch.rows.filter(r=>r.status===status).length}</strong></span>)}</div>
   {terminal&&<p className="text-sm font-medium">Bu aktarımda işlenecek satır kalmadı. İnceleme gereken ve beklettiğiniz satırları kontrol edin.</p>}
   <ol className="space-y-2">{batch.rows.slice(page*50,(page+1)*50).map(row=><li key={row.number} className="rounded-xl border bg-white p-3 text-sm"><strong>Satır {row.number} · {labels[row.status]}</strong>{['updated','reverted'].includes(row.status)&&terminal&&<button type="button" className={`${button} ml-2`} disabled={busy||undoBusy||!enabled} onClick={()=>setChangeRow(row.number)}>Değişiklikleri incele</button>}{row.result&&'code' in row.result&&<p className="mt-1">{reasons[row.result.code]}</p>}{row.result&&'personId' in row.result&&<Link href={`/personel-havuzu?kisi=${row.result.personId}`} onClick={guard.handle} className="mt-1 flex min-h-11 items-center text-blue-700 underline">Kişi kartını aç</Link>}</li>)}</ol>
   {batch.rows.length>50&&<div className="flex gap-2"><button className={button} disabled={!page} onClick={()=>setPage(p=>p-1)}>Önceki satırlar</button><button className={button} disabled={(page+1)*50>=batch.rows.length} onClick={()=>setPage(p=>p+1)}>Sonraki satırlar</button></div>}
  </>}
  {changeRow!==null&&<ImportChangeReview key={`${reference.batchId}:${changeRow}`} scope={scope} batchId={reference.batchId} number={changeRow} enabled={enabled&&!busy} onBusy={setUndoBusy} onUndone={()=>void operate('check')} onClose={()=>setChangeRow(null)}/>}
  <fieldset disabled={undoBusy} className="contents"><div className="flex flex-wrap gap-2">{busy?<button className={button} onClick={()=>{pause.current=true;setMessage('Duraklatılıyor; gönderilmiş satırın sonucu bekleniyor.');}}>Duraklat</button>:<>
   <button className={button} onClick={()=>void operate('check')}>Sonucu kontrol et</button>
   {batch&&<><button className={button} onClick={()=>void prepareReport('all')}>Tüm sonuçları raporla</button><button className={button} onClick={()=>void prepareReport('remaining')}>İncelenecek satırları raporla</button></>}
   {batch&&!terminal&&<button className={`${button} border-blue-500 text-blue-800`} onClick={()=>void operate('resume')}>Kalan satırları aktar</button>}
   {!terminal&&<button className={button} onClick={()=>setConfirm(true)}>İşlenmeyenleri iptal et</button>}
   {terminal&&<button className={button} onClick={finish}>Sonucu kapat · devam et</button>}
  </>}</div>
  </fieldset>
  {report&&reportUrl&&!busy&&<div className="rounded-xl border bg-white p-3 text-sm"><p role="status">{report.total} kaynak satırının {report.count} satırı raporda. Rapor, son kontroldeki işlem sonuçlarını gösterir. Kişi bilgilerini düzenleyip yeniden yüklemek için Excel çalışma kopyasını kullanın.</p><a href={reportUrl} download={report.filename} className="mt-2 flex min-h-11 items-center text-blue-700 underline">CSV raporunu indir</a><p className="text-xs text-slate-500">Kaynak satır numarası, işlem sonucu ve varsa kişi kimliği bulunur. İsim ve telefon içermez.</p></div>}
  {confirm&&!busy&&<div role="alert" className="rounded-xl bg-amber-50 p-4 text-sm"><p>Daha önce kaydedilen kişiler ve güncellemeler korunacak. Kalan satırlar aktarılmayacak. İşlenmeyen satırları iptal etmek istiyor musunuz?</p><div className="mt-3 flex flex-wrap gap-2"><button autoFocus className={button} onClick={()=>setConfirm(false)}>Vazgeç</button><button className={button} onClick={()=>void operate('close')}>İşlenmeyenleri iptal et</button></div></div>}
  <p className="text-xs text-slate-600">Dosyanın tamamı yüklenmez. Aktarım kaydı, işlem sırasında gönderilen kişi bilgilerini içerir; mevcut kişi kartlarında yalnız onaylanan alanlar değişir. Bu sekmede, aktarımı yeniden bulmak için kişisel bilgi içermeyen bir takip numarası saklanır.</p>
 </section>;
}
