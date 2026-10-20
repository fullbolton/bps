'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {createClient} from '@/lib/supabase/client';
import {loadHrPrivateDocuments} from '@/lib/services/hr-private-documents';
import HrDocumentUpload from './HrDocumentUpload';
import {loadHrPendingUploads,type HrUploadInput} from '@/lib/services/hr-document-upload';
import {cancelHrDocumentUpload} from '@/lib/services/hr-document-verification';
import {useScopedResource} from '@/components/ui/useScopedResource';
import {useNavigationGuard} from '@/context/NavigationGuardContext';
const button='min-h-11 rounded-lg border px-4 py-2 disabled:opacity-50';
export default function EmployeeDocuments({actor,tenant,employee,name,manager,onClose}:{actor:string;tenant:string;employee:string;name:string;manager:boolean;onClose:()=>void}){
 const [upload,setUpload]=useState<{recovery?:HrUploadInput}|null>(null);
 const [after,setAfter]=useState<string>(),[pendingAfter,setPendingAfter]=useState<string>();
 const [intent,setIntent]=useState<string|null>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const alive=useRef(true),flight=useRef(false);const guard=useNavigationGuard();
 const context={actor,tenant,employee};
 const read=useCallback(()=>loadHrPrivateDocuments(createClient(),actor,tenant,employee,after),[actor,tenant,employee,after]);
 const pendingRead=useCallback(()=>manager?loadHrPendingUploads(createClient(),{actor,tenant,employee},pendingAfter):Promise.resolve({uploads:[],hasMore:false}),[actor,tenant,employee,manager,pendingAfter]);
 const documents=useScopedResource(`${actor}:${tenant}:${employee}:${after??''}`,read);
 const pending=useScopedResource(`${actor}:${tenant}:${employee}:${pendingAfter??''}:pending`,pendingRead);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
 useEffect(()=>{if(!intent)return;const off=guard.register(e=>{e.preventDefault();setMessage('İptal işleminin sonucu doğrulanmalı. Aynı işlemi yeniden deneyin.');});const stop=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue='';};window.addEventListener('beforeunload',stop);return()=>{off();window.removeEventListener('beforeunload',stop);};},[intent,guard]);
 async function cancel(id:string){
  if(flight.current||(intent&&intent!==id))return;
  flight.current=true;setBusy(true);setIntent(id);setMessage('');
  try{await cancelHrDocumentUpload(createClient(),context,id);if(!alive.current)return;setIntent(null);setMessage('Yükleme kaydı iptal edildi.');if(pendingAfter)setPendingAfter(undefined);else await pending.reload();}
  catch(error){if(!alive.current)return;const code=(error as {message?:string})?.message;
   if(code==='HR_UPLOAD_CLEANUP_REQUIRED'||code==='HR_UPLOAD_PUBLISHED'){
    setIntent(null);setMessage(code==='HR_UPLOAD_CLEANUP_REQUIRED'?'Bu yüklemenin dosyası mevcut. Dosya temizliği tamamlanmadan iptal edilemez.':'Bu yükleme tamamlanmış. Belge listesini yenileyin.');
   }else setMessage('İptal sonucu doğrulanamadı. Aynı işlemi yeniden deneyin.');
  }finally{flight.current=false;if(alive.current)setBusy(false);}
 }
 async function download(id:string,title:string){
  if(flight.current)return;flight.current=true;setBusy(true);setMessage('');
  try{const {data,error}=await createClient().storage.from('hr-private').download(`${tenant}/${id}.pdf`);if(error||!data)throw Error('HR_DOWNLOAD');if(!alive.current)return;
   const url=URL.createObjectURL(data),link=document.createElement('a');link.href=url;link.download=title.replace(/[\/\\\x00-\x1f]/g,'_')+'.pdf';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }catch{if(alive.current)setMessage('Dosya indirilemedi. Erişiminizi kontrol edip yeniden deneyin.');}finally{flight.current=false;if(alive.current)setBusy(false);}
 }
 return <section aria-label={`${name} evrakları`} className="space-y-4 rounded-xl border p-4 sm:p-5">
  <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="break-words text-lg font-semibold">{name} · Özel evraklar</h2><button className={button} disabled={busy||!!intent||!!upload} onClick={onClose}>Kapat</button></div>
  {manager&&!upload&&<button className={button} disabled={busy||!!intent} onClick={()=>setUpload({})}>PDF yükle</button>}
  {upload&&<HrDocumentUpload key={upload.recovery?.id??'new'} actor={actor} tenant={tenant} employee={employee} recovery={upload.recovery} onClose={()=>setUpload(null)} onSaved={async()=>{setUpload(null);setMessage('Evrak yüklendi ve doğrulandı.');const refreshes:Promise<void>[]=[];if(after)setAfter(undefined);else refreshes.push(documents.reload());if(pendingAfter)setPendingAfter(undefined);else refreshes.push(pending.reload());await Promise.all(refreshes);}}/>}
  {message&&<p role="status" className="rounded-lg bg-blue-50 p-3">{message}</p>}
  {intent&&!busy&&<button className={button} onClick={()=>void cancel(intent)}>Aynı iptal işlemini yeniden dene</button>}
  {documents.loading?<p role="status">Evraklar yükleniyor…</p>:documents.error?<div role="alert">Evraklar alınamadı. Erişiminizi kontrol edin. <button className={button} disabled={busy||!!intent||!!upload} onClick={()=>void documents.reload()}>Yeniden dene</button></div>:<>
   {!documents.data?.documents.length?<p>Kayıtlı özel evrak yok.</p>:<ul className="space-y-2">{documents.data.documents.map(d=><li key={d.id} className="rounded-lg border p-3"><p className="break-words font-medium">{d.title}</p><p className="text-sm">{d.validityDate?`${d.expired?'Süresi doldu':'Geçerlilik tarihi'}: ${d.validityDate}`:'Süre sınırı yok'}</p><button className={button} disabled={busy||!!intent||!!upload} onClick={()=>void download(d.id,d.title)}>PDF indir<span className="sr-only"> · {d.title}</span></button></li>)}</ul>}
   <div className="flex flex-wrap gap-2"><button className={button} disabled={!after||busy||!!intent||!!upload} onClick={()=>setAfter(undefined)}>İlk sayfa</button><button className={button} disabled={!documents.data?.hasMore||busy||!!intent||!!upload} onClick={()=>setAfter(documents.data!.documents.at(-1)!.id)}>Sonraki evraklar</button><button className={button} disabled={busy||!!intent||!!upload} onClick={()=>void documents.reload()}>Evrakları yenile</button></div>
  </>}
  {manager&&<section className="space-y-3 border-t pt-4"><h3 className="font-semibold">Başlattığınız bekleyen yüklemeler</h3><p className="text-sm text-slate-600">Yüklemeden vazgeçtiğinizde varsa dosya da kaldırılır. Tamamlanmış belgeler korunur.</p>
   {pending.loading?<p role="status">Bekleyen yüklemeler alınıyor…</p>:pending.error?<p role="alert">Bekleyen yüklemeler alınamadı.</p>:<ul className="space-y-2">{pending.data?.uploads.map(d=><li key={d.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"><span className="min-w-0 break-words">{d.title}</span><button className={button} disabled={busy||!!intent||!!upload} onClick={()=>setUpload({recovery:d})}>Aynı PDF ile devam et<span className="sr-only"> · {d.title}</span></button><button className={button} disabled={busy||!!intent||!!upload} onClick={()=>void cancel(d.id)}>Yüklemeden vazgeç<span className="sr-only"> · {d.title}</span></button></li>)}</ul>}
   {!pending.loading&&!pending.error&&!pending.data?.uploads.length&&<p>Bekleyen yüklemeniz yok.</p>}
   <div className="flex flex-wrap gap-2"><button className={button} disabled={!pendingAfter||busy||!!intent||!!upload} onClick={()=>setPendingAfter(undefined)}>İlk sayfa</button><button className={button} disabled={!pending.data?.hasMore||busy||!!intent||!!upload} onClick={()=>setPendingAfter(pending.data!.uploads.at(-1)!.id)}>Sonraki yüklemeler</button><button className={button} disabled={busy||!!intent||!!upload} onClick={()=>void pending.reload()}>Bekleyenleri yenile</button></div>
  </section>}
 </section>;
}
