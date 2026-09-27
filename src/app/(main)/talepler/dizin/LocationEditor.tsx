"use client";
import {useEffect,useRef,useState} from 'react';
import type {DirectoryRow} from '@/lib/operations/operations-directory';
import {validateLocationUpdate} from '@/lib/operations/location-update';
import {reserveCommand,acknowledgeCommand,type CommandScope} from '@/lib/operations/pending-commands';
import {useAuth} from '@/context/AuthContext';
import {useNavigationGuard} from '@/context/NavigationGuardContext';
import {pilotScopeAction,pilotLocationUpdateAction} from '../gunluk/actions';
export default function LocationEditor({row,companyId,onClose,onSaved}:{row:DirectoryRow;companyId:string;onClose:()=>void;onSaved:()=>void}){
  const {user}=useAuth(),guard=useNavigationGuard(),dialog=useRef<HTMLDialogElement>(null),sending=useRef(false);
  const [name,setName]=useState(row.name),[city,setCity]=useState(row.city??''),[scope,setScope]=useState<CommandScope|null>(null);
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[attempted,setAttempted]=useState(false),[discard,setDiscard]=useState(false);
  const cancelButton=useRef<HTMLButtonElement>(null),keepEditing=useRef<HTMLButtonElement>(null),nameInput=useRef<HTMLInputElement>(null);
  const dirty=name!==row.name||city!==(row.city??'');
  useEffect(()=>{
    const node=dialog.current,trigger=document.activeElement instanceof HTMLElement?document.activeElement:null;
    node?.showModal();
    return()=>{node?.close();requestAnimationFrame(()=>{if(trigger?.isConnected)trigger.focus();else document.getElementById('main-content')?.focus();});};
  },[]);
  useEffect(()=>{if(discard)keepEditing.current?.focus();},[discard]);
  useEffect(()=>{let current=true;pilotScopeAction().then(r=>{if(!current)return;if(r.ok&&r.data.actorId===user?.id&&typeof navigator.locks?.request==='function')setScope(r.data);else setError('Hesap ve şirket bilgisi doğrulanamadı. Pencereyi kapatıp yeniden açın.');}).catch(()=>{if(current)setError('Hesap ve şirket bilgisi alınamadı. Pencereyi kapatıp yeniden açın.');});return()=>{current=false;};},[user?.id]);
  useEffect(()=>{const block=(e:BeforeUnloadEvent)=>{if(dirty||attempted||sending.current){e.preventDefault();e.returnValue='';}};window.addEventListener('beforeunload',block);return()=>window.removeEventListener('beforeunload',block);},[dirty,attempted]);
  useEffect(()=>guard.register(e=>{if(e.button!==0||e.ctrlKey||e.metaKey||e.shiftKey||e.altKey)return;e.preventDefault();setError('Şube düzenlemesini kaydedin veya kapatın.');}));
  function close(){if(sending.current)return;if(dirty||attempted)setDiscard(true);else onClose();}
  async function save(){
    if(sending.current||discard||(!dirty&&!attempted)||!scope||scope.actorId!==user?.id)return;
    sending.current=true;setBusy(true);setError('');
    try{
      const payload=validateLocationUpdate({companyId,id:row.id,expectedRevision:row.revision,name,city});
      const id=await reserveCommand(scope,'location_update',payload,localStorage,navigator.locks);
      setAttempted(true);
      const r=await pilotLocationUpdateAction(scope,id,payload);
      if(!r.ok){setError(r.message);return;}
      try{await acknowledgeCommand(scope,id,localStorage,navigator.locks);}catch{/* Parent pending panel retains recovery marker. */}
      onSaved();
    }catch{setError('İşlem doğrulanamadı. Bilgiler korundu; aynı bilgilerle tekrar deneyin veya kapatıp bekleyen işlemleri kontrol edin.');}
    finally{sending.current=false;setBusy(false);}
  }
  return <dialog ref={dialog} aria-labelledby="location-edit-title" className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-xl backdrop:bg-black/40" onCancel={e=>{e.preventDefault();close();}}>
    <h2 id="location-edit-title" className="text-lg font-semibold">Şube bilgilerini düzenle</h2>
    <p className="my-3 text-sm text-slate-600">Kod: {row.code??'Kod yok'} · {row.active?'Aktif':'Pasif'}. Şube kodu ve geçmiş atamalar korunur.</p>
    <form onSubmit={e=>{e.preventDefault();void save();}}>
      <fieldset disabled={busy||attempted} className="space-y-3">
        <label className="block text-sm">Şube adı<input ref={nameInput} autoFocus required maxLength={160} value={name} onChange={e=>setName(e.target.value)} className="mt-1 w-full rounded-lg border p-3" /></label>
        <label className="block text-sm">İl<input required maxLength={80} value={city} onChange={e=>setCity(e.target.value)} className="mt-1 w-full rounded-lg border p-3" /></label>
      </fieldset>
      {attempted&&<p className="mt-3 text-sm text-slate-600">Gönderilen bilgiler tekrar denemek için sabitlendi. Yeni bir değişiklik için kapatıp bekleyen işlemi kontrol edin, ardından güncel kaydı açın.</p>}
      {error&&<p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
      {discard?<div className="mt-4 rounded-lg bg-amber-50 p-3 text-sm"><p>Kaydedilmemiş form kapatılacak. Gönderilmiş bir işlem varsa iptal edilmez; sonucu dizindeki bekleyen işlemlerden kontrol edebilirsiniz.</p><div className="mt-3 flex gap-3"><button ref={keepEditing} type="button" className="min-h-11 rounded-lg border px-3" onClick={()=>{setDiscard(false);requestAnimationFrame(()=>{if(attempted)cancelButton.current?.focus();else nameInput.current?.focus();});}}>Düzenlemeye dön</button><button type="button" className="min-h-11 rounded-lg border px-3" onClick={onClose}>Formu kapat</button></div></div>:<div className="mt-5 flex justify-end gap-3"><button ref={cancelButton} type="button" disabled={busy} onClick={close} className="min-h-11 rounded-lg border px-4">Vazgeç</button><button disabled={busy||!scope||(!dirty&&!attempted)||!name.trim()||!city.trim()} className="min-h-11 rounded-lg bg-slate-900 px-4 text-white disabled:opacity-40">{busy?'Kaydediliyor…':attempted?'Aynı işlemi tekrar dene':'Değişiklikleri kaydet'}</button></div>}
    </form>
  </dialog>;
}
