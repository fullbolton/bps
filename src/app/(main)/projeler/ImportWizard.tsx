'use client';
import Link from 'next/link';
import SourceFile from './SourceFile';
import {useRef,useState} from 'react';
import type {ProjectScope} from '@/lib/project-reporting/server';
import type {SourceSheet,SourceBook} from '@/lib/talent/import-preview';
import {actualFields,normalizeActualSheet,type ActualMapping,type SourceActual} from '@/lib/project-reporting/source-rows';
import type {ImportPeople,ImportPreview} from '@/lib/project-reporting/import-view';
import {importPeople,importMapPerson,importPrepare,importFinish} from './import-actions';
const fields=Object.keys(actualFields) as (keyof ActualMapping)[];
export default function ImportWizard({scope,projectId,initial=null,initialMonth='',openMonths=[]}:{scope:ProjectScope;projectId:string;initial?:ImportPreview|null;initialMonth?:string;openMonths?:string[]}){
 const [sourceFile,setSourceFile]=useState<File|null>(null);
 const [book,setBook]=useState<SourceBook|null>(null),[header,setHeader]=useState(1);
 const [sheet,setSheet]=useState<SourceSheet|null>(null),[filename,setFilename]=useState(''),[month,setMonth]=useState(initialMonth),[unit,setUnit]=useState<'minutes'|'hours'>('minutes');
 const [mapping,setMapping]=useState<ActualMapping>({sourceId:-1,locationCode:-1,personCode:-1,day:-1,slotCode:-1,minutes:-1}),[rows,setRows]=useState<SourceActual[]|null>(null),[people,setPeople]=useState<ImportPeople|null>(null);
 const [preview,setPreview]=useState(initial),[code,setCode]=useState(''),[search,setSearch]=useState(''),[selected,setSelected]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[offset,setOffset]=useState(0),[frozen,setFrozen]=useState(false);
 const lock=useRef(false),attempt=useRef<string|null>(null);
 const control='mt-1 block min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm';
 const button='min-h-11 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50';
 const codes=Array.from(new Set((rows??[]).flatMap(r=>r.value?[r.value.personCode]:[]))).sort();
 const missing=codes.filter(c=>!people?.mappings.some(m=>m.code===c));
 async function run(work:()=>Promise<void>){if(lock.current)return;lock.current=true;setBusy(true);setMessage('');try{await work();}catch(e){setMessage(e instanceof Error?e.message:'İşlem tamamlanamadı.');}finally{lock.current=false;setBusy(false);}}
 async function loadPeople(nextCodes=codes,term=''){const r=await importPeople(scope,projectId,nextCodes,term);if(!r.ok)throw Error(r.message);setPeople(r.data);return r.data;}
 async function readFile(file:File){
  if(!/\.(csv|xlsx)$/i.test(file.name)||file.size>2*1024*1024||!file.size)throw Error('En fazla 2 MB boyutunda XLSX veya UTF-8 CSV seçin.');
  const bytes=await file.arrayBuffer();const worker=new Worker(new URL('../../../lib/project-reporting/csv-reader.worker.ts',import.meta.url));
  const result=await new Promise<SourceBook>((resolve,reject)=>{const timer=setTimeout(()=>{worker.terminate();reject(Error('Dosya okuma süresi aşıldı.'));},15000);worker.onerror=()=>{clearTimeout(timer);worker.terminate();reject(Error('Dosya okunamadı.'));};worker.onmessage=e=>{clearTimeout(timer);worker.terminate();if(!e.data.ok)reject(Error(e.data.message));else resolve(e.data.book);};worker.postMessage({bytes,name:file.name},[bytes]);});
  setSourceFile(file);setBook(result);const first=result.sheets.find(s=>!s.hidden&&s.rows.length)!;chooseSheet(first);setFilename(file.name);setRows(null);setPeople(null);setOffset(0);

 }
 function chooseSheet(next:SourceSheet){setSheet(next);chooseHeader(next,next.rows[0]?.number??1);}
 function chooseHeader(next:SourceSheet,n:number){setHeader(n);setMapping(Object.fromEntries(fields.map(k=>[k,next.rows.find(r=>r.number===n)?.cells.findIndex(c=>c.value.trim().toLocaleLowerCase('tr')===actualFields[k].toLocaleLowerCase('tr'))??-1])) as ActualMapping);}
 return <div className="space-y-5">
  <p className="text-sm text-slate-600">Çalışma raporunu XLSX veya UTF-8 CSV olarak yükleyin. Kayıt, şube ve personel kodları; çalışma tarihi, vardiya kodu ve süre gereklidir. En fazla 1.000 satır. Önizlemeden sonra kaynak dosyasının kopyasını da saklayabilirsiniz.</p>
  {message&&<p role="alert" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm">{message}</p>}
  {!preview&&<section className="space-y-4 rounded-xl border bg-white p-4"><h2 className="font-semibold">1. Dosya ve sütunlar</h2>
   <fieldset disabled={busy||frozen||!!rows} className="grid min-w-0 gap-3 sm:grid-cols-2">
    <label className="text-sm">Rapor ayı<select className={control} value={month} onChange={e=>setMonth(e.target.value)}><option value="">Açık dönem seçin</option>{openMonths.map(m=><option key={m} value={m}>{m.slice(5,7)} / {m.slice(0,4)}</option>)}</select><span className="text-xs text-slate-500">Son 50 dönem içindeki açık aylar. Dönem yoksa proje ekranından açın.</span></label>
    <label className="text-sm">Süre birimi<select className={control} value={unit} onChange={e=>setUnit(e.target.value as 'minutes'|'hours')}><option value="minutes">Dakika</option><option value="hours">Saat</option></select></label>
    <label className="text-sm sm:col-span-2">Çalışma dosyası<input className={control} type="file" accept=".csv,.xlsx" onChange={e=>{const f=e.target.files?.[0];if(f){setSourceFile(null);setBook(null);setSheet(null);setFilename('');setRows(null);setPeople(null);void run(()=>readFile(f));}}}/></label>
    {book&&<label className="text-sm">Excel sayfası<select className={control} value={sheet?.name??''} onChange={e=>chooseSheet(book.sheets.find(s=>s.name===e.target.value)!)}>{book.sheets.filter(s=>!s.hidden&&s.rows.length).map(s=><option key={s.name}>{s.name}</option>)}</select></label>}
    {sheet&&<label className="text-sm">Başlık satırı<select className={control} value={header} onChange={e=>chooseHeader(sheet,Number(e.target.value))}>{sheet.rows.slice(0,100).map(r=><option key={r.number} value={r.number}>{r.number}: {r.cells.map(c=>c.value).filter(Boolean).join(' · ').slice(0,100)}</option>)}</select></label>}
    {sheet&&fields.map(k=><label key={k} className="text-sm">{actualFields[k]}<select className={control} value={mapping[k]} onChange={e=>setMapping({...mapping,[k]:Number(e.target.value)})}><option value={-1}>Sütun seçin</option>{sheet.rows.find(r=>r.number===header)!.cells.map((c,i)=><option key={i} value={i}>{c.value||`Sütun ${i+1}`}</option>)}</select></label>)}
   </fieldset>
   {filename&&<p className="break-words text-sm text-slate-600">{filename}</p>}
   {!rows&&<button className={button} disabled={busy||!sheet||frozen} onClick={()=>void run(async()=>{const result=normalizeActualSheet(sheet!,header,mapping,unit,month);setRows(result);if(!result.some(r=>r.issues.length)){const keys=Array.from(new Set(result.map(r=>r.value!.personCode)));setCode(keys[0]??'');const p=await loadPeople(keys);setCode(keys.find(k=>!p.mappings.some(m=>m.code===k))??keys[0]??'');}})}>Satırları kontrol et</button>}
   {rows&&!frozen&&<button className="min-h-11 rounded-lg border px-4 text-sm" disabled={busy} onClick={()=>{setRows(null);setPeople(null);setMessage('');}}>Dosya ve sütunları düzelt</button>}
  </section>}
  {rows?.some(r=>r.issues.length)&&<section className="rounded-xl border bg-white p-4"><h2 className="font-semibold">Düzeltilmesi gereken satırlar</h2><p className="my-2 text-sm">{rows.filter(r=>r.issues.length).length} satırda sorun var. Kaynak dosyayı düzeltip tekrar seçin.</p><ul className="space-y-2 text-sm">{rows.filter(r=>r.issues.length).slice(0,50).map(r=><li key={r.number}>Satır {r.number}: {r.issues.join(' ')}</li>)}</ul><p className="mt-2 text-xs text-slate-500">İlk 50 sorun gösterilir.</p></section>}
  {rows&&!rows.some(r=>r.issues.length)&&!preview&&<section className="space-y-4 rounded-xl border bg-white p-4"><h2 className="font-semibold">2. Personel eşlemeleri</h2><p className="text-sm">{rows.length} çalışma satırı · {people?`${missing.length} personel kodu eşleme bekliyor.`:'Kişi eşlemeleri yükleniyor…'}</p>
   <fieldset disabled={busy||frozen} className="space-y-3"><label className="block text-sm">Personel kodu<select className={control} value={code} onChange={e=>{setCode(e.target.value);setSelected('');}}>{codes.map(c=><option key={c} value={c}>{c} — {people?.mappings.find(m=>m.code===c)?.name??'Eşlenmedi'}</option>)}</select></label>
    <div className="flex flex-wrap items-end gap-2"><label className="min-w-0 flex-1 text-sm">Havuzda kişi ara<input className={control} value={search} onChange={e=>{setSearch(e.target.value);setSelected('');setPeople(p=>p?{...p,candidates:[]}:p);}} placeholder="En az iki harf"/></label><button type="button" className={button} disabled={search.trim().length<2} onClick={()=>void run(async()=>{setSelected('');await loadPeople(codes,search);})}>Ara</button></div>
    {people&&<label className="block text-sm">Havuz kişisi<select className={control} value={selected} onChange={e=>setSelected(e.target.value)}><option value="">Kişiyi seçin</option>{people.candidates.map(p=><option key={p.id} value={p.id}>{p.name}{p.city?' · '+p.city:''}</option>)}</select><span className="text-xs text-slate-500">Aramaya uyan ilk 20 kişi. İsimle otomatik eşleme yapılmaz.</span></label>}
    {selected&&<Link className="inline-flex min-h-11 items-center text-sm underline" href={`/personel-havuzu?kisi=${selected}`} target="_blank" rel="noopener noreferrer">Seçilen kişinin kartını kontrol et</Link>}
    <button className={button} disabled={!selected||!code||!people} onClick={()=>void run(async()=>{const r=await importMapPerson(scope,projectId,people!.revision,code,selected);if(!r.ok)throw Error(r.message);await loadPeople(codes,search);setSelected('');})}>Seçilen kişiyi bu koda bağla</button>
   </fieldset>
   <button className={button} disabled={busy||!people||missing.length>0} onClick={()=>void run(async()=>{attempt.current??=crypto.randomUUID();setFrozen(true);const r=await importPrepare(scope,projectId,attempt.current,month,rows.map(r=>r.value!));if(!r.ok){if(r.rejected){attempt.current=null;setFrozen(false);}throw Error(r.message);}setPreview(r.data);setOffset(0);})}>{frozen?'Aynı önizlemeyi yeniden dene':'3. Önizlemeyi doğrula'}</button>
  </section>}
  {preview&&<section className="space-y-4 rounded-xl border bg-white p-4"><h2 className="font-semibold">{preview.status==='approved'?'Aktarım onaylandı':preview.status==='cancelled'?'Aktarım iptal edildi':'3. Onay öncesi kontrol'}</h2><p className="text-sm">{preview.rows.filter(r=>r.status==='new').length} yeni · {preview.rows.filter(r=>r.status==='changed').length} değişen · {preview.rows.filter(r=>r.status==='unchanged').length} aynı kayıt</p>
   <p className="text-sm text-slate-600">Dosyada bulunmayan eski kayıtlar silinmez. Bu işlem ücret veya ödeme onayı değildir.</p>
   <div className="overflow-x-auto"><table className="w-full text-left text-sm"><caption className="sr-only">Aktarılacak çalışma satırları</caption><thead><tr>{['Kayıt','Şube','Personel','Tarih','Vardiya','Önceki dakika','Yeni dakika'].map(h=><th className="whitespace-nowrap p-2" key={h}>{h}</th>)}</tr></thead><tbody>{preview.rows.slice(offset,offset+50).map(r=><tr key={r.sourceId} className="border-t"><td className="p-2">{r.sourceId}</td><td className="p-2">{r.locationName} ({r.locationCode})</td><td className="p-2">{r.personName} ({r.personCode})</td><td className="whitespace-nowrap p-2">{r.day}</td><td className="p-2">{r.slotCode}</td><td className="p-2">{r.previousMinutes??'—'}</td><td className="p-2">{r.minutes}</td></tr>)}</tbody></table></div>
   <div className="flex flex-wrap gap-2"><button className="min-h-11 rounded border px-3 text-sm" disabled={offset===0} onClick={()=>setOffset(Math.max(0,offset-50))}>Önceki</button><span className="py-3 text-sm">{offset+1}–{Math.min(offset+50,preview.rows.length)} / {preview.rows.length}</span><button className="min-h-11 rounded border px-3 text-sm" disabled={offset+50>=preview.rows.length} onClick={()=>setOffset(offset+50)}>Sonraki</button></div>
   <SourceFile scope={scope} batch={preview.batchId} pending={preview.status==='pending'} file={sourceFile}/>
   {preview.status==='pending'&&<div className="flex flex-wrap gap-2"><button disabled={busy} className={button} onClick={()=>void run(async()=>{const r=await importFinish(scope,preview.batchId,true);if(!r.ok)throw Error(r.message);setPreview({...preview,status:r.status});})}>Kontrol ettim, aktarımı onayla</button><button disabled={busy} className="min-h-11 rounded-lg border px-4 text-sm" onClick={()=>void run(async()=>{const r=await importFinish(scope,preview.batchId,false);if(!r.ok)throw Error(r.message);setPreview({...preview,status:r.status});})}>Aktarımı iptal et</button></div>}
   {preview.status!=='pending'&&<p role="status" className="text-sm">{preview.status==='approved'?'Çalışma kayıtları kaydedildi.':'Bu aktarımdan rapora kayıt yazılmadı.'}</p>}
   <Link className="inline-flex min-h-11 items-center underline" href={`/projeler/${projectId}/aktarim`}>Aktarım listesine dön</Link>
  </section>}
 </div>;
}
