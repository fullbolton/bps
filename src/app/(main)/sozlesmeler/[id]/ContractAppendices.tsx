'use client';
import {useEffect,useRef,useState} from 'react';
import {appendicesAction} from './pdf-actions';
import type {ContractAppendix} from '@/lib/contract-appendices';
import PdfUploadPanel from './PdfUploadPanel';
import PdfVersionHistory from './PdfVersionHistory';
export default function ContractAppendices({actorId,tenantId,contractId,canUpload}:{actorId:string;tenantId:string;contractId:string;canUpload:boolean}){
 const [rows,setRows]=useState<ContractAppendix[]|null>(null),[cursor,setCursor]=useState<string|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[revision,setRevision]=useState(0),[open,setOpen]=useState<string|null>(null);
 const generation=useRef(0),pending=useRef(false);
 useEffect(()=>{const g=++generation.current;pending.current=true;setBusy(true);setRows(null);setError('');setCursor(null);
  void appendicesAction(actorId,contractId).then(r=>{if(g!==generation.current)return;if(!r.ok)setError(r.error);else{setRows(r.documents);setCursor(r.nextCursor);}}).catch(()=>{if(g===generation.current)setError('Ek protokoller yüklenemedi.');}).finally(()=>{if(g===generation.current){pending.current=false;setBusy(false);}});
  return()=>{generation.current++;};
 },[actorId,tenantId,contractId,revision]);
 async function more(){if(!cursor||pending.current)return;const g=generation.current;pending.current=true;setBusy(true);setError('');try{const r=await appendicesAction(actorId,contractId,cursor);if(g!==generation.current)return;if(!r.ok)setError(r.error);else{setRows(old=>[...(old??[]),...r.documents.filter(d=>!old?.some(x=>x.id===d.id))]);setCursor(r.nextCursor);}}catch{if(g===generation.current)setError('Sonraki ek protokoller yüklenemedi.');}finally{if(g===generation.current){pending.current=false;setBusy(false);}}}
 const refresh=()=>{setOpen(null);setRevision(v=>v+1);};
 return <section aria-label="Ek protokoller" className="rounded-lg border border-slate-200 bg-white p-5 space-y-4">
  <div className="flex items-center justify-between"><h2 className="font-semibold">Ek protokoller</h2><button onClick={refresh} disabled={busy} className="text-sm text-blue-700">Listeyi yenile</button></div>
  <p className="text-sm text-slate-600">Her protokolün kendi PDF’si ve sürüm geçmişi bulunur. Eklemek ana PDF’yi veya sözleşme durumunu değiştirmez.</p>
  {error&&<p role="alert" className="text-sm text-red-700">{error}</p>}
  {busy&&!rows&&<p>Ek protokoller yükleniyor…</p>}
  {rows?.length===0&&<p className="text-sm text-slate-500">Ek protokol kaydı yok.</p>}
  {rows?.map(row=><section key={row.id} aria-label={`${row.title} · ${row.id.slice(0,8)}`} className="rounded border border-slate-200 p-3">
   <h3 className="font-medium">{row.title}</h3><p className="text-sm text-slate-600">{row.name}</p>
   <button className="mt-2 text-sm text-blue-700" onClick={()=>setOpen(open===row.id?null:row.id)} aria-expanded={open===row.id}>{open===row.id?'Ayrıntıları kapat':'Dosya ve sürüm geçmişi'}</button>
   {open===row.id&&<><PdfVersionHistory actorId={actorId} contractId={contractId} documentId={row.id}/>{canUpload&&<PdfUploadPanel actorId={actorId} tenantId={tenantId} contractId={contractId} targetRole="appendix" document={row} onPublished={refresh}/>}</>}
  </section>)}
  {cursor&&<button disabled={busy} onClick={()=>void more()} className="text-sm text-blue-700">Sonraki ek protokoller</button>}
  {rows&&canUpload&&<section aria-label="Yeni ek protokol" className="border-t border-slate-200 pt-3"><h3 className="font-medium">Yeni ek protokol</h3><PdfUploadPanel key={revision} actorId={actorId} tenantId={tenantId} contractId={contractId} targetRole="appendix" document={null} onPublished={refresh}/></section>}
 </section>;
}
