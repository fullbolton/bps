"use client";
import {useCallback,useEffect,useRef,useState} from 'react';
import {useAuth} from '@/context/AuthContext';
import type {DirectoryQuery,DirectoryRow} from '@/lib/operations/operations-directory';
import {validateDirectoryActivation} from '@/lib/operations/operations-directory';
import {reserveCommand,acknowledgeCommand,pendingCount,type CommandScope} from '@/lib/operations/pending-commands';
import {pilotScopeAction,pilotDirectoryActivationAction} from '../gunluk/actions';
import PendingOperations from '../gunluk/PendingOperations';
export type ActivationTarget={kind:DirectoryQuery['kind'];row:DirectoryRow};
export default function DirectoryActivation({target,onClose,onBusy,onChanged}:{target:ActivationTarget|null;onClose:()=>void;onBusy:(b:boolean)=>void;onChanged:()=>Promise<void>}){
  const {user}=useAuth();
  const [scope,setScope]=useState<CommandScope|null>(null),[count,setCount]=useState(0),[recoveryError,setRecoveryError]=useState('');
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
  const inFlight=useRef(false),dialog=useRef<HTMLDialogElement>(null);
  const sync=useCallback(()=>{if(!scope)return;try{setCount(pendingCount(scope,localStorage));}catch{setRecoveryError('Bekleyen işlem kaydı okunamadı. Tarayıcı depolamasını kontrol edin.');}},[scope]);
  useEffect(()=>{
    let current=true;setScope(null);setRecoveryError('');
    pilotScopeAction().then(r=>{if(!current)return;if(!r.ok){setRecoveryError(r.message);return;}if(r.data.actorId!==user?.id||!navigator.locks?.request)throw new Error('scope');setCount(pendingCount(r.data,localStorage));setScope(r.data);}).catch(()=>{if(current)setRecoveryError('İşlem kurtarma hazırlanamadı. Bağlantı ve tarayıcı depolamasını kontrol edin.');});
    return()=>{current=false;};
  },[user?.id]);
  useEffect(()=>{window.addEventListener('storage',sync);return()=>window.removeEventListener('storage',sync);},[sync]);
  useEffect(()=>{setError('');if(target)dialog.current?.showModal();else dialog.current?.close();},[target]);
  const ready=!!scope&&scope.actorId===user?.id&&!recoveryError;
  async function submit(){
    if(!target||!scope||!ready||inFlight.current)return;
    inFlight.current=true;setBusy(true);onBusy(true);setError('');setMessage('');let sent=false;
    try{
      const payload=validateDirectoryActivation({kind:target.kind,id:target.row.id,expectedRevision:target.row.revision,active:!target.row.active});
      const id=await reserveCommand(scope,'directory_active',payload,localStorage,navigator.locks);sync();sent=true;
      const r=await pilotDirectoryActivationAction(scope,id,payload);
      if(!r.ok){setError(r.message);return;}
      let saved='Aktiflik durumu kaydedildi. Mevcut atamalar ve bildirimler korundu.';
      try{await acknowledgeCommand(scope,id,localStorage,navigator.locks);sync();}catch{saved+=' Tarayıcıdaki bekleyen kaydı kontrol edin.';}
      setMessage(saved);onClose();await onChanged();
    }catch{setError(sent?'Sonuç doğrulanamadı. Aynı seçimi tekrar gönderin veya bekleyen işlemlerden kontrol edin.':'İşlem kimliği oluşturulamadı; kayıt gönderilmedi.');}
    finally{inFlight.current=false;setBusy(false);onBusy(false);}
  }
  return <>
    {recoveryError&&<p role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">{recoveryError}</p>}
    {message&&<p role="status" className="mb-4 rounded-lg bg-emerald-50 p-3 text-sm">{message}</p>}
    {scope&&<PendingOperations scope={scope} count={count} disabled={busy||!ready} onBusy={onBusy} onComplete={async settled=>{sync();if(settled){onClose();await onChanged();}}} />}
    <dialog ref={dialog} aria-labelledby="activation-title" className="m-auto w-full max-w-md rounded-xl border bg-white p-6 shadow-xl backdrop:bg-black/40" onCancel={e=>{if(busy)e.preventDefault();else onClose();}}>
      <h2 id="activation-title" className="text-lg font-semibold">{target?.row.active?'Pasife al':'Aktifleştir'}</h2>
      <p className="mt-3 break-words font-medium">{target?.row.name}</p>
      <p className="mt-2 text-sm">{target?.row.active?(target.kind==='locations'?'Şubeye yeni talep veya atama yapılamayacak.':'Personele yeni atama yapılamayacak.'):'Kayıt yeni işlemlerde yeniden seçilebilir olacak.'} Mevcut talepler, atamalar ve gerçekleşme bildirimleri korunacak.</p>
      {error&&<p role="alert" className="mt-3 text-sm text-red-800">{error}</p>}
      {!ready&&<p className="mt-3 text-sm">{recoveryError||'İşlem kapsamı hazırlanıyor; doğrulanmadan kayıt gönderilmez.'}</p>}
      <div className="mt-5 flex flex-wrap justify-end gap-3"><button autoFocus className="rounded-lg border px-3 py-2 text-sm" disabled={busy} onClick={onClose}>Vazgeç</button><button className="rounded-lg bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-40" disabled={busy||!ready} onClick={()=>void submit()}>{busy?'Kaydediliyor…':target?.row.active?'Evet, pasife al':'Evet, aktifleştir'}</button></div>
    </dialog>
  </>;
}
