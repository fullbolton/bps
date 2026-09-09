"use client";
import { useEffect, useRef } from "react";

export default function CancelRequestDialog({target,busy,error,onClose,onConfirm}:{
  target:{id:string;label:string}|null;busy:boolean;error:string;onClose:()=>void;onConfirm:()=>void;
}) {
  const dialog=useRef<HTMLDialogElement>(null);
  useEffect(()=>{
    const node=dialog.current;
    if(target && node && !node.open)node.showModal();
    if(!target && node?.open)node.close();
  },[target]);
  return <dialog ref={dialog} aria-labelledby="cancel-request-title" aria-describedby="cancel-request-description"
    className="m-auto w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl backdrop:bg-black/40"
    onCancel={e=>{e.preventDefault();if(!busy)onClose();}}>
    <h2 id="cancel-request-title" className="text-lg font-semibold">Talebi iptal et</h2>
    <p className="mt-3 font-medium">{target?.label}</p>
    <p id="cancel-request-description" className="mt-2 text-sm text-slate-600">Bu talep atama kabul etmeyecek ve mevcut atamaları kaldırılacak. Gerçekleşme bildirimleri korunacak. Devam edilsin mi?</p>
    {error&&<p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
    <div className="mt-5 flex justify-end gap-3">
      <button autoFocus disabled={busy} className="rounded-lg border px-4 py-2 disabled:opacity-40" onClick={onClose}>Vazgeç</button>
      <button disabled={busy} className="rounded-lg bg-red-700 px-4 py-2 text-white disabled:opacity-40" onClick={onConfirm}>{busy?"İptal ediliyor…":"Evet, talebi iptal et"}</button>
    </div>
  </dialog>;
}
