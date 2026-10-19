'use client';
import {useEffect,useRef,useState} from 'react';
import type {SourceBook} from '@/lib/talent/import-preview';
import {prepareHrImportRows,type HrImportMapping} from '@/lib/hr/import-preview';
import {compareHrImport,hrImportLabels} from '@/lib/services/hr-import';
import {createClient} from '@/lib/supabase/client';
const button='min-h-11 rounded-lg border px-4 py-2 disabled:opacity-50';
export default function HrImportPreview({actor,tenant,onClose}:{actor:string;tenant:string;onClose:()=>void}){
 const [book,setBook]=useState<SourceBook|null>(null),[sheetIndex,setSheet]=useState(0),[mapping,setMapping]=useState<HrImportMapping>({code:0,name:1,startsOn:2}),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const [results,setResults]=useState<Awaited<ReturnType<typeof compareHrImport>>|null>(null);
 const worker=useRef<Worker|null>(null),timer=useRef<ReturnType<typeof setTimeout>|null>(null),generation=useRef(0);
 const stop=()=>{worker.current?.terminate();worker.current=null;if(timer.current)clearTimeout(timer.current);};
 useEffect(()=>()=>{generation.current++;stop();},[]);
 async function read(file:File){stop();const run=++generation.current;setBook(null);setResults(null);setMessage('');
  if(!/\.(xlsx|csv)$/i.test(file.name)||file.size===0||file.size>10*1024*1024){setMessage('Boş olmayan XLSX veya UTF-8 CSV seçin; en fazla 10 MB.');return;}
  setBusy(true);try{const bytes=await file.arrayBuffer();if(run!==generation.current)return;
   const w=new Worker(new URL('../../../lib/talent/import-reader.worker.ts',import.meta.url));worker.current=w;
   timer.current=setTimeout(()=>{if(run===generation.current){stop();setBusy(false);setMessage('Dosya zamanında okunamadı. Daha küçük bir dosya deneyin.');}},15000);
   w.onerror=()=>{if(run===generation.current){stop();setBusy(false);setMessage('Dosya okunamadı.');}};
   w.onmessage=e=>{if(run!==generation.current)return;stop();setBusy(false);if(!e.data.ok){setMessage('Dosya okunamadı. XLSX / UTF-8 CSV biçimini ve dosya sınırlarını kontrol edin.');return;}setBook(e.data.book);setSheet(0);setMapping({code:0,name:1,startsOn:2});};w.postMessage({bytes,name:file.name},[bytes]);
  }catch{if(run===generation.current){stop();setBusy(false);setMessage('Dosya okunamadı.');}}
 }
 const sheet=book?.sheets[sheetIndex];let preview:ReturnType<typeof prepareHrImportRows>|null=null,issue='';
 if(sheet)try{preview=prepareHrImportRows(sheet,sheet.rows[0]?.number??0,mapping);}catch(e){issue=e instanceof Error?e.message:'Sayfa okunamadı.';}
 async function compare(){if(busy||!preview?.canCompare)return;const run=++generation.current;setBusy(true);setResults(null);setMessage('');try{const result=await compareHrImport(createClient(),actor,tenant,preview.rows);if(run===generation.current)setResults(result);}catch{if(run===generation.current)setMessage('Karşılaştırma alınamadı. Yetkinizi ve dosyadaki tekrarlanan kodları kontrol edip yeniden deneyin.');}finally{if(run===generation.current)setBusy(false);}}
 return <section className="space-y-3 rounded-xl border p-5" aria-label="Excel ön kontrolü"><h2 className="font-semibold">Excel ön kontrolü</h2><p className="text-sm">Bu adım kayıt oluşturmaz veya değiştirmez. Personel koduna göre karşılaştırır; boş hücre mevcut bilgiyi silmez. İlk dolu satır başlık olmalı. Sayfada en fazla 200 veri satırı kullanın.</p>
 <input aria-label="Çalışan dosyası" type="file" accept=".xlsx,.csv" disabled={busy} className="block min-h-11 w-full min-w-0" onChange={e=>{const f=e.target.files?.[0];if(f)void read(f);}}/>
 {busy&&<p role="status">Kontrol ediliyor…</p>}{message&&<p role="alert">{message}</p>}
 {book&&<fieldset disabled={busy} className="grid gap-3 sm:grid-cols-2"><label>Sayfa<select className="block min-h-11 w-full rounded-lg border" value={sheetIndex} onChange={e=>{setSheet(Number(e.target.value));setResults(null);}}>{book.sheets.map((s,i)=><option key={i} value={i} disabled={s.hidden}>{s.name}{s.hidden?' (gizli)':''}</option>)}</select></label>{(['code','name','startsOn'] as const).map(key=><label key={key}>{{code:'Personel kodu sütunu',name:'Ad soyad sütunu',startsOn:'İşe giriş sütunu'}[key]}<select className="block min-h-11 w-full rounded-lg border" value={mapping[key]} onChange={e=>{setMapping({...mapping,[key]:Number(e.target.value)});setResults(null);}}>{sheet?.rows[0]?.cells.map((c,i)=><option key={i} value={i}>{i+1}. {c.value||'Başlıksız'}</option>)}</select></label>)}</fieldset>}
 {issue&&<p role="alert">{issue}</p>}{preview?.errors.length? <ul className="list-disc pl-5">{preview.errors.map(e=><li key={e.row}>{e.row}. satır: {e.message}</li>)}</ul>:null}
 {results&&<><p role="status">{results.length} satır karşılaştırıldı. Henüz kayıt aktarılmadı.</p><ul className="max-h-96 space-y-2 overflow-y-auto">{results.map(r=><li key={r.row} className="break-words rounded-lg border p-2">{r.row}. satır · {r.code} · {hrImportLabels[r.status]}</li>)}</ul><p className="text-sm">Elle inceleyin: işe giriş/ayrılış dönemi veya bağlı kişi bilgisi farklı olabilir. Yeniden işe alma ayrı bir işlemdir.</p></>}
 <div className="flex flex-wrap gap-2"><button className={button} disabled={busy||!preview?.canCompare} onClick={()=>void compare()}>Kayıtlarla karşılaştır</button><button className={button} disabled={busy} onClick={onClose}>Ön kontrolü kapat</button></div></section>;
}
