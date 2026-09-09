"use client";
import {useRef,useState} from 'react';
import {pendingCommandIds,reconcilePending,type CommandScope} from '@/lib/operations/pending-commands';
import {pilotReconcileAction} from './actions';

export default function PendingOperations({scope,count,disabled,onBusy,onComplete}:{
  scope:CommandScope;count:number;disabled:boolean;onBusy:(v:boolean)=>void;onComplete:(settled:boolean)=>Promise<void>;
}){
  const dialog=useRef<HTMLDialogElement>(null),inFlight=useRef(false),closingIds=useRef<string[]>([]);
  const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
  async function run(close:boolean){
    if(disabled||inFlight.current)return;
    inFlight.current=true;setBusy(true);onBusy(true);setError('');setMessage('');
    try{
      const ids=close?closingIds.current:pendingCommandIds(scope,localStorage);
      const result=await pilotReconcileAction(scope,ids,close);
      if(!result.ok){setError(result.message);return;}
      const totals=await reconcilePending(scope,ids,result.data,localStorage,navigator.locks);
      setMessage(`${totals.confirmed} işlem tamamlanmış, ${totals.closed} işlem kapatılmış olarak doğrulandı.${totals.unknown?` ${totals.unknown} işlemin sonucu henüz kesin değil; bekleyen kimlikleri korundu.`:''}`);
      if(close)dialog.current?.close();
      await onComplete(totals.confirmed+totals.closed>0);
    }catch{setError('Sonuçlar veya tarayıcı kaydı doğrulanamadı. Bekleyen işlemleri yeniden kontrol edin.');}
    finally{inFlight.current=false;setBusy(false);onBusy(false);}
  }
  function askToClose(){
    try{closingIds.current=pendingCommandIds(scope,localStorage);setError('');dialog.current?.showModal();}
    catch{setError('Bekleyen işlem listesi okunamadı.');}
  }
  return <section aria-label="Bekleyen işlemler" className="mb-4">
    {count>0&&<div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-950">
      <p>Bu hesap ve çalışma alanında {count} bekleyen işlem var. Önce sunucudaki sonuçlarını kontrol edin. Form içeriği saklanmaz.</p>
      <p className="mt-1">Sonucu kesinleşmeyen işlemi aynı form veya CSV ile tekrar gönderebilir ya da aşağıdan kapatabilirsiniz.</p>
      <div className="mt-3 flex flex-wrap gap-3">
        <button disabled={disabled||busy} className="rounded-lg border px-3 py-2 disabled:opacity-40" onClick={()=>void run(false)}>Sonuçları kontrol et</button>
        <button disabled={disabled||busy} className="rounded-lg border px-3 py-2 disabled:opacity-40" onClick={askToClose}>Bekleyenlerden vazgeç…</button>
      </div>
    </div>}
    {message&&<p role="status" className="mt-2 rounded-lg bg-emerald-50 p-3 text-sm">{message}</p>}
    {error&&!dialog.current?.open&&<p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
    <dialog ref={dialog} aria-labelledby="close-pending-title" aria-describedby="close-pending-description"
      className="m-auto w-full max-w-md rounded-xl border bg-white p-6 shadow-xl backdrop:bg-black/40"
      onCancel={e=>{if(busy)e.preventDefault();}}>
      <h2 id="close-pending-title" className="text-lg font-semibold">Bekleyen işlemlerden vazgeç</h2>
      <p id="close-pending-description" className="mt-3 text-sm">Henüz tamamlanmamış işlemler kapatılacak; gecikmiş gönderimleri kayıt oluşturamayacak. Sunucuda zaten tamamlanan işlemler korunur ve sonuçları doğrulanır. Mevcut talep veya atamalar iptal edilmez.</p>
      {error&&<p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
      <div className="mt-5 flex justify-end gap-3">
        <button autoFocus disabled={busy} className="rounded-lg border px-3 py-2" onClick={()=>dialog.current?.close()}>Geri dön</button>
        <button disabled={busy||disabled} className="rounded-lg bg-slate-900 px-3 py-2 text-white disabled:opacity-40" onClick={()=>void run(true)}>{busy?'Kontrol ediliyor…':'Evet, bekleyenleri kapat'}</button>
      </div>
    </dialog>
  </section>;
}
