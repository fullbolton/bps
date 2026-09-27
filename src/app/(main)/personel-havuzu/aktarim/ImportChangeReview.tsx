'use client';
import {useEffect,useRef,useState} from 'react';
import type {TalentScope} from '@/lib/talent/people';
import {importChangeLabels,formatImportChange,type ImportChangeReview as Review} from '@/lib/talent/import-undo';
import {talentImportChangeAction} from '../actions';
const button='min-h-11 rounded-xl border bg-white px-4 text-sm disabled:opacity-40';
export default function ImportChangeReview({scope,batchId,number,enabled,onBusy,onClose,onUndone}:{scope:TalentScope;batchId:string;number:number;enabled:boolean;onBusy:(busy:boolean)=>void;onClose:()=>void;onUndone:()=>void}){
 const [data,setData]=useState<Review|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[confirm,setConfirm]=useState(false);
 const alive=useRef(true),flight=useRef(false),allowed=useRef(enabled);allowed.current=enabled;
 async function load(undo=false){
  if(flight.current||!allowed.current)return;flight.current=true;setBusy(true);onBusy(true);setError('');setConfirm(false);
  try{const r=await talentImportChangeAction(scope,batchId,number,undo);if(!r.ok)throw Error(r.message);if(alive.current){setData(r.data);if(r.data.state==='undone')onUndone();}}
  catch{if(alive.current){setData(null);setError(undo?'Geri alma sonucu doğrulanamadı. Sonucu kontrol edin; aynı satır ikinci kez geri alınmaz.':'Değişiklikler okunamadı. Yeniden deneyin.');}}
  finally{flight.current=false;if(alive.current){setBusy(false);onBusy(false);}}
 }
 useEffect(()=>{alive.current=true;void load();return()=>{alive.current=false;};},[]);
 return <section aria-label={`Satır ${number} değişiklikleri`} className="space-y-3 rounded-xl border border-blue-300 bg-white p-4">
  <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">Satır {number} · Aktarılan değişiklikler</h3><button className={button} disabled={busy} onClick={onClose}>İncelemeyi kapat</button></div>
  {busy&&<p role="status">İşlem sürüyor…</p>}{error&&<p role="alert">{error}</p>}
  {data&&<>
   {data.state==='legacy'&&<p>Bu aktarımda eski bilgiler saklanmamış. Güvenli biçimde geri alınamaz; kişi kartından kontrol ederek düzenleyin.</p>}
   {data.state==='not_updated'&&<p>Bu satır mevcut bir kişinin bilgilerini değiştirmedi. Yeni kişi kayıtları bu işlemle silinmez.</p>}
   {data.state==='changed'&&<p role="status">Kişi veya bağlı operasyon kaydı daha sonra değişmiş. Yeni bilgileri korumak için geri alma kapalı.</p>}
   {data.state==='undone'&&<p role="status" className="text-emerald-800">Bu aktarımın güncellemesi {new Date(data.undoneAt!).toLocaleString('tr-TR',{timeZone:'Europe/Istanbul'})} tarihinde geri alındı. Daha sonraki işlemler korunur.</p>}
   {!!data.changes.length&&<ul className="space-y-2">{data.changes.map(c=><li key={c.field} className="rounded-lg bg-slate-50 p-3 text-sm"><strong>{importChangeLabels[c.field]}</strong><p className="mt-1 break-words">Aktarımdan önce: {formatImportChange(c.before)}</p><p className="mt-1 break-words">Aktarımla kaydedilen: {formatImportChange(c.after)}</p></li>)}</ul>}
   {data.state==='ready'&&<><p className="text-sm">Geri alırken kişi yeniden kontrol edilir. Daha sonra değişmişse işlem yapılmaz. Görüşmeler, ekler ve görevlendirmeler silinmez.</p><button className={button} disabled={busy||!enabled} onClick={()=>setConfirm(true)}>Bu güncellemeyi geri al</button></>}
  </>}
  {confirm&&!busy&&<div className="rounded-lg bg-amber-50 p-3"><p>Yukarıdaki alanlar aktarım öncesindeki değerlerine dönecek. Onaylıyor musunuz?</p><div className="mt-2 flex flex-wrap gap-2"><button autoFocus className={button} onClick={()=>setConfirm(false)}>Vazgeç</button><button className={button} disabled={!enabled} onClick={()=>void load(true)}>Onayla ve geri al</button></div></div>}
  <button className={button} disabled={busy||!enabled} onClick={()=>void load()}>Sonucu kontrol et</button>
 </section>;
}
