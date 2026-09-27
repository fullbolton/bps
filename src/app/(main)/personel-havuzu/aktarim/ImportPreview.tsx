'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import Link from 'next/link';
import {useNavigationGuard} from '@/context/NavigationGuardContext';
import ImportQueueRunner from './ImportQueueRunner';
import type {ImportRequest} from '@/lib/talent/import-batches';
import PreviewReport from './PreviewReport';
import PoolComparison from './PoolComparison';
import {useAuth} from '@/context/AuthContext';
import {useWorkspace} from '@/context/WorkspaceContext';
import {matchesWorkspace} from '@/lib/workspace-context';
import type {TalentScope} from '@/lib/talent/people';
import {importFields,previewSource,suggestMapping,type ImportField,type ImportKind,type Mapping,type SourceBook} from '@/lib/talent/import-preview';
const field='mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm';
export default function ImportPreview({scope}:{scope:TalentScope}){
 const guard=useNavigationGuard();
 const [decisionsLocked,setDecisionsLocked]=useState(false),[transferActive,setTransferActive]=useState(true),[transferPlan,setTransferPlan]=useState<ImportRequest[]|null>(null);
 const sourceLocked=decisionsLocked||transferActive;
 const {user,role,loading:authLoading}=useAuth(),{workspace,reload:reloadWorkspace}=useWorkspace();
 const sameActor=user?.id===scope.actorId&&user.app_metadata.active_tenant===scope.tenantId;
 const lostScope=(!authLoading&&!sameActor)||(!authLoading&&!['yonetici','operasyon','ik'].includes(role))||!!workspace&&!matchesWorkspace(workspace,scope);
 const allowed=!authLoading&&sameActor&&['yonetici','operasyon','ik'].includes(role)&&matchesWorkspace(workspace,scope);
 const [book,setBook]=useState<SourceBook|null>(null),[fileName,setFileName]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [sheetIndex,setSheetIndex]=useState(0),[header,setHeader]=useState(1),[kind,setKind]=useState<ImportKind>('people'),[mapping,setMapping]=useState<Mapping>({}),[show,setShow]=useState(false),[page,setPage]=useState(0),[issuesOnly,setIssuesOnly]=useState(false);
 const worker=useRef<Worker|null>(null),timer=useRef<ReturnType<typeof setTimeout>|null>(null),generation=useRef(0),input=useRef<HTMLInputElement>(null);
 function stop(){worker.current?.terminate();worker.current=null;if(timer.current)clearTimeout(timer.current);timer.current=null;}
 function clear(){setDecisionsLocked(false);generation.current++;stop();setBook(null);setFileName('');setError('');setBusy(false);setShow(false);if(input.current)input.current.value='';}
 useEffect(()=>()=>{generation.current++;stop();},[]);
 useEffect(()=>{if(lostScope){clear();setTransferPlan(null);}},[lostScope]); // Revalidation hides the draft; a real scope loss clears it.
 const sheet=book?.sheets[sheetIndex],headerCells=sheet?.rows.find(r=>r.number===header)?.cells??[];
 function select(index:number,row:number,nextKind=kind){setSheetIndex(index);setHeader(row);setKind(nextKind);setMapping(suggestMapping(book?.sheets[index]?.rows.find(r=>r.number===row)?.cells.map(c=>c.value)??[],nextKind));setShow(false);setPage(0);}
 async function read(file:File){
  clear();if(!allowed)return;const run=++generation.current;
  if(!/\.(xlsx|csv)$/i.test(file.name)||file.size>10*1024*1024||!file.size){setError('XLSX veya UTF-8 CSV seçin; dosya boş olmamalı ve 10 MB sınırını aşmamalı.');return;}
  setBusy(true);setFileName(file.name);
  try{
   const bytes=await file.arrayBuffer();if(run!==generation.current)return;
   const w=new Worker(new URL('../../../../lib/talent/import-reader.worker.ts',import.meta.url));worker.current=w;
   const fail=(message:string)=>{if(run!==generation.current)return;stop();setBusy(false);setError(message);};
   timer.current=setTimeout(()=>fail('Dosya okuma 15 saniyede tamamlanamadı. Daha küçük bir dosyayla tekrar deneyin.'),15000);
   w.onerror=()=>fail('Dosya okuyucu başlatılamadı. Sayfayı yenileyip tekrar deneyin.');
   w.onmessage=e=>{if(run!==generation.current)return;stop();setBusy(false);if(!e.data.ok){setError(e.data.error);return;}const b=e.data.book as SourceBook;setBook(b);const index=Math.max(0,b.sheets.findIndex(s=>!s.hidden&&s.rows.length)),row=b.sheets[index].rows[0]?.number??1;setSheetIndex(index);setHeader(row);setMapping(suggestMapping(b.sheets[index].rows[0]?.cells.map(c=>c.value)??[],kind));};
   w.postMessage({name:file.name,bytes},[bytes]);
  }catch{if(run===generation.current){stop();setBusy(false);setError('Dosya okunamadı. Yeniden seçin.');}}
 }
 const result=useMemo(()=>{if(!show||!sheet)return null;try{return {data:previewSource(sheet,header,kind,mapping),error:''};}catch(e){return {data:null,error:e instanceof Error?e.message:'Eşlemeyi kontrol edin.'};}},[show,sheet,header,kind,mapping]);
 const visible=result?.data?.rows.filter(r=>!issuesOnly||r.issues.length||r.warnings.length)??[],slice=visible.slice(page*50,page*50+50);
 if(lostScope)return <p role="alert">Çalışma alanı veya yetkiniz değişti. Önceki dosya temizlendi. <Link href="/personel-havuzu" className="underline">Havuza dön</Link></p>;
 return <>
 {!allowed&&<div role="status" className="rounded-xl border bg-white p-4 text-sm"><p>Şirket ve yetki bilgisi doğrulanıyor. Dosyanız ve kararlarınız korunuyor; aktarım doğrulama tamamlanana kadar kapalı.</p><button type="button" className="mt-2 min-h-11 text-blue-700 underline" onClick={()=>void reloadWorkspace()}>Yeniden doğrula</button></div>}
 <section hidden={!allowed} inert={!allowed} className="space-y-5">
  <Link href="/personel-havuzu" onClick={guard.handle} className="inline-flex min-h-11 items-center text-sm text-blue-700">← Personel havuzu</Link>
  <div><h1 className="text-2xl font-semibold">Dosya önizlemesi</h1><p className="mt-2 text-sm text-slate-600">Şirket: <strong>{workspace?.name}</strong>. Dosya önce bu tarayıcıda incelenir. Havuzla karşılaştırırken ad, telefon, e-posta ve varsa BPS kişi kimliği eşleşme aramak için gönderilir. Aktarımı başlattığınızda seçilmiş kişi bilgileri kaydedilir; dosyanın tamamı gönderilmez.</p></div>
  <ImportQueueRunner enabled={allowed} key={`${scope.actorId}:${scope.tenantId}`} scope={scope} request={transferPlan} onActiveChange={setTransferActive} onTaken={()=>{setTransferPlan(null);clear();}}/>
  <div className="rounded-2xl border bg-white p-4">{decisionsLocked&&<p role="status" className="mb-3 text-sm text-amber-900">Satır kararlarını korumak için kaynak ve sütunlar kilitli. Değiştirmek için karşılaştırma bölümündeki Kararları bırak düğmesini kullanın.</p>}<label className="text-sm font-medium">1. Dosya seç<input ref={input} disabled={sourceLocked} type="file" accept=".xlsx,.csv" className={`${field} file:mr-3 file:rounded-lg file:border-0 file:px-3 file:py-2`} onChange={e=>{const f=e.target.files?.[0];if(f)void read(f);}}/></label><p className="mt-2 text-xs text-slate-500">XLSX / UTF-8 CSV · 10 MB · Sayfada en fazla 50.000 veri satırı ve 64 sütun. Formüller çalıştırılmaz. Eski XLS dosyasını XLSX olarak kaydedin.</p><details className="mt-2 text-xs text-slate-500"><summary className="min-h-11 cursor-pointer">Diğer dosya sınırları</summary>En fazla 30 sayfa, toplam 100.000 dolu satır ve 2 milyon taranan hücre; hücrede 3.000 karakter. XLSX açılmış toplam içeriği 128 MB, tek arşiv parçası 64 MB; şifreli ve ZIP64 dosyalar desteklenmez. Başlık ilk 20 dolu satırdan seçilir. Okuma 15 saniyede durdurulur.</details>{fileName&&<div className="mt-3 flex flex-wrap items-center justify-between gap-2"><span className="break-all text-sm">{fileName}</span><button className="min-h-11 text-sm text-blue-700 underline" disabled={sourceLocked} onClick={clear}>Dosyayı kaldır</button></div>}</div>
  {busy&&<p role="status">Dosya okunuyor…</p>}{error&&<p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</p>}
  {book&&sheet&&<>
   <div className="grid gap-4 rounded-2xl border bg-white p-4 sm:grid-cols-3">
    <label className="text-sm font-medium">2. Sayfa<select disabled={sourceLocked} className={field} value={sheetIndex} onChange={e=>{const i=+e.target.value;select(i,book.sheets[i].rows[0]?.number??1);}}>{book.sheets.map((s,i)=><option key={i} value={i}>{s.name}{s.hidden?' (Gizli)':''} · {s.rows.length} dolu satır</option>)}</select></label>
    <label className="text-sm font-medium">Başlık satırı<select disabled={sourceLocked} className={field} value={header} onChange={e=>select(sheetIndex,+e.target.value)}>{sheet.rows.slice(0,20).map(r=><option key={r.number} value={r.number}>Satır {r.number}</option>)}</select></label>
    <label className="text-sm font-medium">3. Dosyanın içeriği<select disabled={sourceLocked} className={field} value={kind} onChange={e=>select(sheetIndex,header,e.target.value as ImportKind)}><option value="people">Sade kişi listesi</option><option value="coverage">İDP / görevlendirme geçmişi</option></select></label>
   </div>
   <p className="text-sm text-slate-600">Yalnız seçilen sayfa incelenir. {book.sheets.filter(s=>s.hidden).length} gizli sayfa var. Başlıktan önceki {sheet.rows.filter(r=>r.number<header).length} dolu satır okunmaz. Verileriniz üstte kalıyorsa başlık satırını değiştirin.</p>
   {kind==='coverage'&&<p className="rounded-xl bg-blue-50 p-4 text-sm text-blue-900">Bu dosyada her satır bir görevlendirmeyi anlatır; aynı kişi birden çok satırda olabilir. HAVUZ ve DEVAM, dosyanın tutulduğu zamanki durumu; OK ise müşteriye personel bilgisinin iletildiğini gösterir. Buradan güncel müsaitlik veya yoklama oluşturulmaz, e-posta gönderilmez. Şubenin ili kişinin ikameti olarak kaydedilmez.</p>}
   <div className="rounded-2xl border bg-white p-4"><h2 className="font-semibold">4. Sütunları eşle</h2><p className="mt-1 text-sm text-slate-600">BPS çalışma kopyasındaki kişi/şirket kimliği sütunlarını koruyun. Yeni kişilerde ikisini de boş bırakın. Boş hücreler mevcut bilgiyi silmez; iletişim değişiklikleri yeni iletişim olarak eklenir. Telefon ve e-postaları da noktalı virgülle ayırabilirsiniz; kişi başına toplam en fazla 10 iletişim kaydedilir. Meslek ve çalışma bölgelerini noktalı virgülle ayırın (Garson; Aşçı). Seçtiğiniz meslek ve bölgeler mevcut listeye eklenir, eskiler silinmez. Önerileri kontrol edin. Bu aktarım TCKN, IBAN ve doğum tarihi sütunlarını kullanmaz.</p><div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{(Object.keys(importFields)as ImportField[]).filter(k=>kind==='coverage'?!['city','district','skills','regions'].includes(k):['personId','tenantId','name','phone','email','city','district','skills','regions'].includes(k)).map(k=><label key={k} className="text-sm">{importFields[k]}<select disabled={sourceLocked} className={field} value={mapping[k]??''} onChange={e=>{setMapping(m=>{const n={...m};if(e.target.value==='')delete n[k];else n[k]=+e.target.value;return n;});setShow(false);setPage(0);}}><option value="">Eşlenmedi</option>{headerCells.map((c,i)=><option key={i} value={i}>{i+1}. {c.value||'Başlıksız'}</option>)}</select></label>)}</div><button type="button" disabled={sourceLocked} className="mt-4 min-h-11 rounded-xl bg-blue-600 disabled:opacity-40 px-4 text-sm font-medium text-white" onClick={()=>{setShow(true);setPage(0);}}>Önizlemeyi oluştur</button></div>
   {result?.error&&<p role="alert" className="rounded-xl bg-red-50 p-4">{result.error}</p>}
   {result?.data&&<>
    {kind==='people'&&<PreviewReport rows={result.data.rows} enabled={allowed}/>}
    <div role="status" className="rounded-2xl border bg-white p-4"><p><strong>{result.data.rows.length}</strong> kaynak satırı · <strong>{result.data.issueCount}</strong> satır düzeltme istiyor · <strong>{result.data.warningCount}</strong> satırda aktarımı engellemeyen bilgi var.</p><p className="mt-2 text-sm">{result.data.repeatedNames} tekrarlayan isim grubu · {result.data.sharedPhones} birden fazla isimde kullanılan telefon grubu. Bu kişiler aynı kişi olabilir; eşleşmeleri inceleyin. Hiçbir kayıt otomatik birleştirilmedi.</p></div>
    <details className="rounded-xl border bg-white p-3"><summary className="min-h-11 cursor-pointer text-sm">Eşlenmeyen sütunlar ({result.data.unmapped.length})</summary><ul className="space-y-2 text-sm">{result.data.unmapped.map(c=><li key={c.index}>{c.index+1}. {c.label}</li>)}</ul><p className="mt-3 text-xs text-slate-500">Bu sütunlar aktarılmış veya gereksiz kabul edilmez. Kalıcı aktarım öncesinde ayrıca ele alınmalıdır.</p></details>
    <details open={kind==='coverage'} className="rounded-xl border bg-white p-4"><summary className="min-h-11 cursor-pointer font-medium">Kaynak satırlarını incele ({result.data.rows.length})</summary>
    <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={issuesOnly} onChange={e=>{setIssuesOnly(e.target.checked);setPage(0);}}/> Yalnız hata veya bilgi içeren satırlar</label>
    {!visible.length&&<p className="rounded-xl border bg-white p-4">Bu görünümde satır yok.</p>}
    <ul className="space-y-3">{slice.map(r=><li key={r.number} className="rounded-xl border bg-white p-4 text-sm"><p className="font-semibold">Satır {r.number} · {r.name||'İsim eksik'}</p><p className="mt-1 break-all text-slate-600">{r.phone||'Telefon yok'} · {r.email||'E-posta yok'}</p>{kind==='people'&&<p className="mt-2 break-words text-slate-600">{[r.city,r.district,r.skills&&`Meslek: ${r.skills}`,r.regions&&`Bölgeler: ${r.regions}`].filter(Boolean).join(' · ')}</p>}{kind==='coverage'&&<div className="mt-2 space-y-1"><p>{r.branch||'Şube eksik'} · {r.start||'?'} — {r.end||'?'}</p><p>Asıl personel / kaynak bağlamı: {r.original||'Belirtilmedi'}</p><p>{r.status} · {r.reply}</p></div>}{r.issues.length>0&&<ul className="mt-2 space-y-1 text-amber-900">{r.issues.map((v,i)=><li key={i}>• {v}</li>)}</ul>}{r.warnings.length>0&&<ul className="mt-2 space-y-1 text-slate-600">{r.warnings.map((v,i)=><li key={i}>Bilgi: {v}</li>)}</ul>}</li>)}</ul>
    <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm">{visible.length?`${page*50+1}–${Math.min((page+1)*50,visible.length)} / ${visible.length}`:'0 satır'}</p><div className="flex gap-2"><button className="min-h-11 rounded-xl border px-4 disabled:opacity-40" disabled={!page} onClick={()=>setPage(p=>p-1)}>Önceki</button><button className="min-h-11 rounded-xl border px-4 disabled:opacity-40" disabled={(page+1)*50>=visible.length} onClick={()=>setPage(p=>p+1)}>Sonraki</button></div></div>
    </details>
    {kind==='people'?<PoolComparison key={JSON.stringify([fileName,sheetIndex,header,mapping])} rows={result.data.rows} scope={scope} onDirtyChange={setDecisionsLocked} onStart={setTransferPlan}/>:<p className="rounded-xl bg-slate-100 p-4 text-sm">İDP geçmişi kişi listesinden farklıdır. Kalıcı aktarım için asıl personel, şube ve dönem eşlemesi ayrıca hazırlanacak. Bu satırlar BPS'ye yazılmadı.</p>}
   </>}
  </>}
 </section></>;
}
