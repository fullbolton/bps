'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {useScopedResource} from '@/components/ui/useScopedResource';
import {useNavigationGuard} from '@/context/NavigationGuardContext';
import {useAuth} from '@/context/AuthContext';
import {useWorkspace} from '@/context/WorkspaceContext';
import {matchesWorkspace} from '@/lib/workspace-context';
import {attachmentCategories,parseAttachmentRows,canAccessAttachment,ATTACHMENT_MAX_BYTES,type AttachmentCategory} from '@/lib/talent/attachments';
import {reserveAttachmentCommand,settleAttachmentCommand,settleCancelledAttachment} from '@/lib/talent/attachment-command';
import type {TalentScope} from '@/lib/talent/people';
import {talentAttachmentListAction,talentAttachmentUploadAction,talentAttachmentLinkAction,talentAttachmentPendingAction,talentAttachmentFinishAction,talentAttachmentCancelAction} from './actions';
export default function PersonAttachments({scope,personId,onDirty}:{scope:TalentScope;personId:string;onDirty?:(dirty:boolean)=>void}){
 const {role}=useAuth(),{workspace}=useWorkspace();const allowed=matchesWorkspace(workspace,scope);
 const [category,setCategory]=useState<AttachmentCategory>('cv'),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[prepared,setPrepared]=useState<{id:string;url:string;expiresAt:number}|null>(null);
 const guard=useNavigationGuard();
 const [fileSelected,setFileSelected]=useState(false);
 const dirty=busy||fileSelected;
 useEffect(()=>{onDirty?.(dirty);return()=>onDirty?.(false);},[dirty,onDirty]);
 useEffect(()=>{if(!dirty)return;const unload=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue='';};window.addEventListener('beforeunload',unload);const off=guard.register(e=>{e.preventDefault();setMessage('Önce dosyayı yükleyin veya dosya seçiminden vazgeçin.');});return()=>{off();window.removeEventListener('beforeunload',unload);};},[dirty,guard]);
 const [cancelId,setCancelId]=useState<string|null>(null);
 const [photo,setPhoto]=useState<string|null>(null);
 const [preparingId,setPreparingId]=useState<string|null>(null),linkRequest=useRef(0),linkFlight=useRef(false);
 const flight=useRef(false),form=useRef<HTMLFormElement>(null);
 const read=useCallback(async()=>{const r=await talentAttachmentListAction(scope,personId);if(!r.ok)throw Error('read');return parseAttachmentRows(r.data,personId);},[scope,personId]);
 const data=useScopedResource(allowed?`${scope.actorId}:${scope.tenantId}:${personId}`:null,read);
 const readPending=useCallback(async()=>{const r=await talentAttachmentPendingAction(scope,personId);if(!r.ok)throw Error(r.message);return r.data;},[scope,personId]);
 const pending=useScopedResource(allowed?`${scope.actorId}:${scope.tenantId}:${personId}`:null,readPending);
 async function finishPending(id:string){
  if(flight.current||!allowed)return;flight.current=true;setBusy(true);setMessage('');
  try{const r=await talentAttachmentFinishAction(scope,id);setMessage(r.ok?'Dosya doğrulandı ve eklere alındı.':r.message);await Promise.all([pending.reload(),data.reload()]);}
  catch{setMessage('Yükleme sonucu alınamadı. Yeniden doğrulayabilirsiniz.');}
  finally{flight.current=false;setBusy(false);}
 }
 async function cancelPending(id:string){
  if(flight.current||!allowed)return;flight.current=true;setBusy(true);setMessage('');
  try{const r=await talentAttachmentCancelAction(scope,id);if(!r.ok){setMessage(r.message);return;}
   try{await settleCancelledAttachment(localStorage,navigator.locks,scope,personId,id);setMessage('Bekleyen yükleme iptal edildi ve dosyası temizlendi.');}catch{setMessage('Yükleme iptal edildi; tarayıcı işlem referansı temizlenemedi. Aynı dosyayı yeniden yüklemeden önce tarayıcı depolamasını kontrol edin.');}
   setCancelId(null);await Promise.all([pending.reload(),data.reload()]);
  }catch{setMessage('İptal sonucu alınamadı. Listeyi yenileyip tekrar deneyin.');}
  finally{flight.current=false;setBusy(false);}
 }
 const photoId=data.data?.find(row=>row.category==='photo')?.id;
 useEffect(()=>{let current=true;setPhoto(null);if(allowed&&photoId)void talentAttachmentLinkAction(scope,photoId).then(r=>{if(current&&r.ok)setPhoto(r.url);}).catch(()=>{});return()=>{current=false;};},[allowed,photoId,scope]);

 useEffect(()=>{if(!prepared)return;const t=setTimeout(()=>setPrepared(null),Math.max(0,prepared.expiresAt-Date.now()));return()=>clearTimeout(t);},[prepared]);
 useEffect(()=>{
  ++linkRequest.current;linkFlight.current=false;setPrepared(null);setPreparingId(null);
  return()=>{++linkRequest.current;linkFlight.current=false;};
 },[allowed,scope.actorId,scope.tenantId,personId]);
 async function prepareLink(id:string){
  if(!allowed||flight.current||linkFlight.current)return;
  linkFlight.current=true;const request=++linkRequest.current;
  setPrepared(null);setPreparingId(id);setMessage('');
  try{
   const r=await talentAttachmentLinkAction(scope,id);
   if(request!==linkRequest.current)return;
   if(r.ok)setPrepared({id,url:r.url,expiresAt:r.expiresAt});else setMessage(r.message);
  }catch{if(request===linkRequest.current)setMessage('Dosya bağlantısı hazırlanamadı. Yeniden deneyin.');}
  finally{if(request===linkRequest.current){linkFlight.current=false;setPreparingId(null);}}
 }

 async function upload(){
  if(flight.current||!allowed||!form.current)return;
  const f=new FormData(form.current),file=f.get('file');
  if(!(file instanceof File)||!file.size||file.size>ATTACHMENT_MAX_BYTES){setMessage('JPEG, PNG veya PDF seçin; en fazla 10 MB.');return;}
  flight.current=true;setBusy(true);setMessage('');
  let started=false;
  try{
   // Include the filename: the server treats a renamed file as a different command payload.
   const bytes=await file.arrayBuffer();
   const contentHash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),n=>n.toString(16).padStart(2,'0')).join('');
   const fingerprint=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify([file.name,contentHash])))),n=>n.toString(16).padStart(2,'0')).join('');
   const command=await reserveAttachmentCommand(localStorage,navigator.locks,scope,personId,category,fingerprint,()=>crypto.randomUUID());
   f.set('id',command.id);f.set('personId',personId);started=true;
   const r=await talentAttachmentUploadAction(scope,f);
   if(!r.ok){setMessage(r.message);return;}
   let cleared=false;try{cleared=await settleAttachmentCommand(localStorage,navigator.locks,command);}catch{/* Confirmed upload stays successful even if browser storage is unavailable. */}
   form.current?.reset();setFileSelected(false);setCategory('cv');
   setMessage(cleared?'Dosya kişinin eklerine kaydedildi.':'Dosya kaydedildi. Tarayıcıdaki işlem referansı temizlenemedi; aynı dosya yeniden seçilirse mevcut kayıt doğrulanır.');
   await Promise.all([data.reload(),pending.reload()]);
  }catch{setMessage(started?'Yanıt alınamadı. Sayfayı yenileseniz de aynı dosya ve belge grubuyla yeniden deneyebilirsiniz.':'Güvenli yükleme referansı oluşturulamadı. Güncel bir tarayıcı kullanıp depolama iznini kontrol edin; yükleme başlatılmadı.');}
  finally{flight.current=false;setBusy(false);}
 }

 return <section className="space-y-3"><h3 className="font-semibold">Fotoğraf ve ekler</h3>
 {photo&&allowed&&<img src={photo} alt="Profil fotoğrafı" className="h-24 w-24 rounded-2xl border object-cover" onError={()=>setPhoto(null)}/>}
 <p className="text-xs text-slate-500">JPEG, PNG veya PDF · 10 MB. Kesilen yüklemeye aynı dosya ve belge grubunu seçerek devam edebilirsiniz. İşe giriş evraklarını yalnız yönetici ve İK görebilir.</p>
 {message&&<p role="status" className="rounded-lg bg-blue-50 p-3 text-sm">{message}</p>}
 <form ref={form} onSubmit={e=>{e.preventDefault();void upload();}}><fieldset disabled={busy||!allowed} className="space-y-2 disabled:opacity-50">
 <label className="block text-sm">Belge grubu<select name="category" value={category} onChange={e=>{setCategory(e.target.value as AttachmentCategory);}} className="mt-1 min-h-11 w-full rounded-lg border px-3">{Object.entries(attachmentCategories).filter(([k])=>canAccessAttachment(role,k as AttachmentCategory)).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>
 <label className="block text-sm">Dosya<input name="file" type="file" accept={category==='photo'?'image/jpeg,image/png':'image/jpeg,image/png,application/pdf'} onChange={e=>{setFileSelected(!!e.target.files?.length);setMessage('');}} className="mt-1 block min-h-11 w-full text-sm"/></label>
 <button className="min-h-11 rounded-lg bg-blue-700 px-4 text-sm text-white">{busy?'Yükleniyor…':'Dosyayı yükle'}</button>
 {fileSelected&&<button type="button" className="min-h-11 px-3 text-sm underline" onClick={()=>{form.current?.reset();setFileSelected(false);setMessage('');}}>Dosya seçiminden vazgeç</button>}
 </fieldset></form>
 <details className="rounded-xl border p-3"><summary className="min-h-11 cursor-pointer text-sm font-medium">Bekleyen yüklemelerim{pending.data?.length?` · ${Math.min(50,pending.data.length)}`:''}</summary>
 {pending.loading?<p role="status">Bekleyen yüklemeler okunuyor…</p>:pending.error?<div role="alert"><p>Bekleyen yüklemeler okunamadı.</p><button className="min-h-11 underline" onClick={()=>void pending.reload()}>Yeniden dene</button></div>:!pending.data?.length?<p className="text-sm text-slate-500">Bekleyen yüklemeniz yok.</p>:<><p className="text-xs text-slate-500">Bağlantı kesilmiş olabilir. Önce yüklemeyi doğrulayın; dosya sunucuya ulaşmadıysa aynı dosya ve belge grubuyla yeniden yükleyin.</p><ul className="divide-y">{pending.data.slice(0,50).map(row=><li key={row.id} className="py-2 text-sm"><p className="break-all">{row.filename} · {attachmentCategories[row.category]}</p><button disabled={busy||!allowed} className="min-h-11 text-blue-700 underline disabled:opacity-50" onClick={()=>void finishPending(row.id)}>Yüklemeyi doğrula</button>{cancelId===row.id?<div role="alert" className="rounded-lg bg-amber-50 p-3"><p>Bu bekleyen yükleme iptal edilecek; varsa tamamlanmamış dosyası silinecek. Tamamlanmış dosyalara dokunulmaz.</p><button disabled={busy||!allowed} className="min-h-11 text-red-700 underline" onClick={()=>void cancelPending(row.id)}>İptali ve temizliği onayla</button><button disabled={busy} className="min-h-11 px-3 underline" onClick={()=>setCancelId(null)}>Vazgeç</button></div>:<button disabled={busy||!allowed} className="min-h-11 px-3 text-red-700 underline disabled:opacity-50" onClick={()=>setCancelId(row.id)}>Yüklemeyi iptal et</button>}</li>)}</ul>{pending.data.length>50&&<p className="text-xs">En yeni 50 bekleyen yükleme gösteriliyor.</p>}</>}
 </details>
 {data.loading?<p role="status">Ekler okunuyor…</p>:data.error?<div role="alert"><p>Ekler okunamadı.</p><button className="min-h-11 text-blue-700 underline" onClick={()=>void data.reload()}>Yeniden dene</button></div>:!data.data?.length?<p className="text-sm text-slate-500">Henüz ek yok.</p>:<ul className="divide-y">{data.data.slice(0,50).map(row=><li key={row.id} className="py-3"><p className="break-all text-sm font-medium">{row.filename}</p><p className="text-xs text-slate-500">{attachmentCategories[row.category]} · {Math.ceil(row.size/1024)} KB</p>{row.source_person_id&&row.source_person_id!==personId&&<p className="text-xs text-slate-500">Birleşen karttan gelen ek</p>}{prepared?.id===row.id?<a href={prepared.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center text-sm text-blue-700 underline" onClick={e=>{if(Date.now()>=prepared.expiresAt){e.preventDefault();setPrepared(null);}}}>Dosyayı aç · bağlantı 1 dakika geçerli</a>:<button disabled={busy||preparingId!==null||!allowed} aria-busy={preparingId===row.id} className="min-h-11 text-sm text-blue-700 underline disabled:opacity-50" onClick={()=>void prepareLink(row.id)}>{preparingId===row.id?'Bağlantı hazırlanıyor…':'Açmak için hazırla'}</button>}</li>)}</ul>}
 {(data.data?.length??0)>50&&<p className="text-xs">En yeni 50 ek gösteriliyor.</p>}
 </section>;
}
