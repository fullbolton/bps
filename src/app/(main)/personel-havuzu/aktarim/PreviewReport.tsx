'use client';
import {useEffect,useRef,useState} from 'react';
import type {SourcePerson} from '@/lib/talent/import-compare';
import {importReportRows} from '@/lib/talent/preview-report';
import {writeWorkCopy,downloadWorkbook} from '@/lib/talent/work-copy-writer';
export default function PreviewReport({rows,enabled}:{rows:SourcePerson[];enabled:boolean}){
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),flight=useRef(false),controller=useRef<AbortController|null>(null);
 const current=useRef<{rows:SourcePerson[];enabled:boolean}|null>({rows,enabled});current.current={rows,enabled};
 useEffect(()=>{controller.current?.abort();setMessage('');return()=>{controller.current?.abort();};},[rows,enabled]);
 useEffect(()=>()=>{current.current=null;},[]);
 const count=rows.filter(r=>r.issues.length||r.warnings?.length).length;
 async function download(){
  if(!enabled||!count||flight.current)return;
  flight.current=true;setBusy(true);setMessage('Kontrol raporu hazırlanıyor…');
  const abort=new AbortController();controller.current=abort;
  const sameSource=()=>current.current?.rows===rows&&current.current.enabled;
  try{
   const bytes=await writeWorkCopy(importReportRows(rows),abort.signal,()=>new Worker(new URL('../../../../lib/talent/work-copy-writer.worker.ts',import.meta.url)),'preview');
   if(!sameSource()||abort.signal.aborted)return;
   downloadWorkbook(bytes,'BPS-onizleme-kontrol.xlsx');
   setMessage(`${count} satırlık kontrol raporu hazırlandı.`);
  }catch(error){if(sameSource())setMessage(abort.signal.aborted?'Hazırlama iptal edildi. Dosya oluşturulmadı.':error instanceof Error?error.message:'Kontrol raporu hazırlanamadı.');}
  finally{flight.current=false;if(current.current)setBusy(false);if(controller.current===abort)controller.current=null;}
 }
 return <div className="rounded-xl border bg-white p-3 text-sm"><button disabled={!enabled||busy||!count} type="button" onClick={()=>void download()} className="min-h-11 text-blue-700 underline disabled:opacity-40">{busy?'Hazırlanıyor…':`Önizleme kontrol raporunu indir (${count} satır)`}</button>{busy&&<button type="button" className="ml-3 min-h-11 underline" onClick={()=>controller.current?.abort()}>İptal et</button>}<p className="text-xs text-slate-500">Kontrol etmeniz gereken satırları ve açıklamalarını Excel’e indirin. İlçe, meslek ve bölge bilgileri korunur. Dosyayı düzeltip yeniden yükleyebilirsiniz. Rapor indirmek kişileri sisteme kaydetmez. En fazla 10 MB.</p>{message&&<p role="status">{message}</p>}</div>;
}
