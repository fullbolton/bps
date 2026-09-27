'use client';
import {useEffect,useRef,useState} from 'react';
import type {TalentScope} from '@/lib/talent/people';
import type {ImportHistory as History,ImportHistoryItem} from '@/lib/talent/import-history';
import {talentImportHistoryAction} from '../actions';
const button='min-h-11 rounded-xl border bg-white px-4 text-sm disabled:opacity-40';
export default function ImportHistory({scope,onChoose,readOnly=false}:{readOnly?:boolean;scope:TalentScope;onChoose:(item:ImportHistoryItem)=>void}){
 const [data,setData]=useState<History|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[selected,setSelected]=useState<ImportHistoryItem|null>(null);
 const alive=useRef(true),flight=useRef(false);useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
 async function load(offset=0){if(flight.current)return;flight.current=true;setBusy(true);setError('');setSelected(null);try{const r=await talentImportHistoryAction(scope,offset);if(!r.ok)throw Error(r.message);if(alive.current)setData(r.data);}catch(e){if(alive.current){setData(null);setError(e instanceof Error?e.message:'Geçmiş okunamadı.');}}finally{flight.current=false;if(alive.current)setBusy(false);}}
 return <section aria-label="Aktarım geçmişim" className="space-y-3 rounded-2xl border bg-white p-4">
  <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold">Aktarım geçmişim</h2><button className={button} disabled={busy} onClick={()=>void load()}>{busy?'Geçmiş okunuyor…':data?'Geçmişi yenile':'Aktarım geçmişini göster'}</button></div>
  <p className="text-sm text-slate-600">Bu şirkette kendi hesabınızla başlattığınız aktarımlar. {readOnly?'Şu anda yalnız geçmişi inceleyebilirsiniz; aktarım açma ve sürdürme kapalı.':'Sonucu açmak yeni kayıt oluşturmaz; bekleyen satırları ayrıca sürdürebilirsiniz.'}</p>
  {error&&<p role="alert">{error} Yeniden deneyin.</p>}
  {data&&<><p role="status" className="text-sm">{data.total} aktarım{!data.total?' · Henüz kayıtlı aktarım yok.':''}</p><ul className="space-y-2">{data.rows.map(item=><li key={item.batchId} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3 text-sm"><div><p>{new Date(item.createdAt).toLocaleString('tr-TR',{timeZone:'Europe/Istanbul'})} · İstanbul</p><p>{item.total} satır · {item.pending?`${item.pending} işlenmemiş`:'İşlenecek satır kalmadı'}</p><p className="break-all text-xs text-slate-500">Aktarım: {item.batchId}</p></div><button className={button} disabled={busy||readOnly} onClick={()=>setSelected(item)}>Sonucu aç</button></li>)}</ul>
   {data.total>20&&<div className="flex flex-wrap items-center gap-2"><button className={button} disabled={busy||!data.offset} onClick={()=>void load(data.offset-20)}>Önceki aktarımlar</button><span className="text-sm">Sayfa {data.offset/20+1}</span><button className={button} disabled={busy||data.offset+20>=data.total||data.offset>=1000000} onClick={()=>void load(data.offset+20)}>Sonraki aktarımlar</button></div>}
  </>}
  {selected&&!busy&&!readOnly&&<div className="rounded-xl bg-blue-50 p-3"><p className="text-sm">{selected.total} satırlık aktarımın sonucu açılacak. Bu ekranda seçtiğiniz dosya ve henüz kaydetmediğiniz seçimler kapanacak. Daha önce sisteme kaydedilen bilgiler değişmeyecek.</p><div className="mt-2 flex flex-wrap gap-2"><button autoFocus className={button} onClick={()=>setSelected(null)}>Vazgeç</button><button className={button} onClick={()=>onChoose(selected)}>Geçmiş aktarımı aç</button></div></div>}
 </section>;
}
