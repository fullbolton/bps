'use client';
import {useEffect,useRef,useState} from 'react';
import {pdfHistoryAction,pdfVersionDownloadAction} from './pdf-actions';
import type {PdfVersion} from '@/lib/contract-pdf';
import {formatDateTR} from '@/lib/format-date';
export default function PdfVersionHistory({actorId,contractId,documentId}:{actorId:string;contractId:string;documentId?:string}){
 const [versions,setVersions]=useState<PdfVersion[]|null>(null),[error,setError]=useState<string|null>(null),[hasMore,setHasMore]=useState(false),[attempt,setAttempt]=useState(0),[busy,setBusy]=useState(false),[download,setDownload]=useState<{url:string;name:string}|null>(null);
 const generation=useRef(0);
 useEffect(()=>{const gen=++generation.current;setVersions(null);setError(null);setDownload(null);setBusy(false);
  void pdfHistoryAction(actorId,contractId,documentId).then(r=>{if(gen!==generation.current)return;if(!r.ok){setError(r.error);return;}setVersions(r.versions);setHasMore(r.hasMore);}).catch(()=>{if(gen===generation.current)setError('PDF geçmişi yüklenemedi.');});
  return()=>{generation.current++;};
 },[actorId,contractId,documentId,attempt]);
 async function prepare(version:PdfVersion){if(busy)return;setBusy(true);setError(null);setDownload(null);const gen=generation.current;
  try{const r=await pdfVersionDownloadAction(actorId,version.id,contractId,documentId);if(gen!==generation.current)return;if(!r.ok){setError(r.error);return;}setDownload({url:r.url,name:version.name});}
  catch{if(gen===generation.current)setError('İndirme bağlantısı alınamadı.');}finally{if(gen===generation.current)setBusy(false);}
 }
 return <section aria-label="PDF sürüm geçmişi" className="mt-4 border-t border-slate-200 pt-3 space-y-2">
  <h3 className="text-sm font-medium">PDF sürüm geçmişi</h3>
  {error&&<p role="alert" className="text-sm text-red-700">{error} <button onClick={()=>setAttempt(x=>x+1)} className="underline">Yeniden yükle</button></p>}
  {!versions&&!error&&<p className="text-sm text-slate-500">Sürümler yükleniyor…</p>}
  {versions?.length===0&&<p className="text-sm text-slate-500">Kayıtlı PDF sürümü yok.</p>}
  {versions&&versions.length>0&&<ol className="space-y-3">{versions.map(v=><li key={v.id} className="text-sm flex flex-wrap justify-between gap-2"><div><p>{v.name} {v.current&&<span className="text-green-700">· Güncel</span>}</p><p className="text-xs text-slate-500">{formatDateTR(v.recordedAt.slice(0,10))} · {v.actorName??'Yükleyen bilgisi yok'}{v.origin==='baseline'?' · Önceki kayıt':''}</p></div><button disabled={busy} className="text-blue-700 disabled:opacity-50" onClick={()=>void prepare(v)}>{v.name} için indirme bağlantısı</button></li>)}</ol>}
  {hasMore&&<p className="text-xs text-slate-500">Son 50 sürüm gösteriliyor. Daha eski kayıtlar korunuyor.</p>}
  {download&&<p role="status" className="text-sm"><a href={download.url} target="_blank" rel="noopener noreferrer" className="text-blue-700 underline">{download.name} dosyasını aç</a> · Bağlantı 60 saniye geçerlidir.</p>}
 </section>;
}
