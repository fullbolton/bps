'use client';
import {differenceLabels} from '@/lib/talent/import-fields';
import {useEffect,useMemo,useRef,useState} from 'react';
import {talentMatchSourceAction} from '../actions';
import {loadTargetedComparison} from '@/lib/talent/targeted-compare';
import {compareLabels,type CompareSnapshot,type SourcePerson,type ComparedRow} from '@/lib/talent/import-compare';
import {useNavigationGuard} from '@/context/NavigationGuardContext';
import {reviewImportDecisions,type DecisionMap,type ImportDecision} from '@/lib/talent/import-decisions';
import {buildImportRequests} from '@/lib/talent/import-request';
import type {ImportRequest} from '@/lib/talent/import-batches';
import RowDecision from './RowDecision';
import type {TalentScope} from '@/lib/talent/people';
class MatchRequestError extends Error {}
const button='min-h-11 rounded-xl border px-4 text-sm font-medium disabled:opacity-40';
export default function PoolComparison({rows,scope,onDirtyChange,onStart}:{rows:SourcePerson[];scope:TalentScope;onDirtyChange:(dirty:boolean)=>void;onStart:(request:ImportRequest[])=>void}){
 const [snapshot,setSnapshot]=useState<CompareSnapshot|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [compared,setCompared]=useState<ComparedRow[]|null>(null),[progress,setProgress]=useState({done:0,total:0});
 const [filter,setFilter]=useState<'all'|ComparedRow['status']>('all'),[page,setPage]=useState(0);
 const generation=useRef(0),guard=useNavigationGuard();
 const [decisions,setDecisions]=useState<DecisionMap>({}),[resetIntent,setResetIntent]=useState<'refresh'|'discard'|null>(null),[notice,setNotice]=useState('');
 const compareRef=useRef<HTMLButtonElement>(null),restoreFocus=useRef(false);
 useEffect(()=>{if(!busy&&!resetIntent&&restoreFocus.current){restoreFocus.current=false;compareRef.current?.focus();}},[busy,resetIntent]);
 const [preparing,setPreparing]=useState(false);const starting=useRef(false);
 async function start(){if(!snapshot||starting.current)return;starting.current=true;setPreparing(true);setNotice('');try{onStart(await buildImportRequests(rows,snapshot,decisions,compared??undefined));}catch(e){setNotice(e instanceof Error?e.message:'Aktarım hazırlanamadı.');}finally{starting.current=false;setPreparing(false);}}
 const dirty=Object.keys(decisions).length>0;
 useEffect(()=>{if(!dirty)return;const stop=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue='';};window.addEventListener('beforeunload',stop);return()=>window.removeEventListener('beforeunload',stop);},[dirty]);
 useEffect(()=>{if(!dirty)return;return guard.register(e=>{if(e.button!==0||e.ctrlKey||e.metaKey||e.shiftKey||e.altKey)return;e.preventDefault();setNotice('Kararlar yalnız bu ekranda. Ayrılmak için önce Kararları bırak düğmesini kullanın.');});},[dirty,guard]);
 function choose(number:number,d:ImportDecision|undefined){const next={...decisions};if(d)next[number]=d;else delete next[number];setDecisions(next);onDirtyChange(Object.keys(next).length>0);setNotice('');}
 function reset(){restoreFocus.current=true;setDecisions({});onDirtyChange(false);setNotice('');setResetIntent(null);}

 useEffect(()=>()=>{generation.current++;},[]);
 async function compare(){
  reset();const version=++generation.current;setBusy(true);setError('');setSnapshot(null);setCompared(null);setProgress({done:0,total:0});setPage(0);
  try{const result=await loadTargetedComparison(rows,scope,async queries=>{const r=await talentMatchSourceAction(scope,queries);if(!r.ok)throw new MatchRequestError(r.message);return r.data;},(done,total)=>{if(version===generation.current)setProgress({done,total});},()=>version===generation.current);
   if(version!==generation.current)return;setSnapshot(result.snapshot);setCompared(result.compared);
  }catch(e){if(version===generation.current){const code=e instanceof Error?e.message:'';setError(e instanceof MatchRequestError?e.message:code==='TALENT_MATCH_CHANGED'?'Karşılaştırma sırasında bir kişi değişti. Dosyanız korunuyor; güncel bilgilerle yeniden karşılaştırın.':code==='TALENT_MATCH_REVIEW_LIMIT'?'Olası eşleşmeler bu inceleme ekranının sınırını aşıyor. Dosyayı daha küçük parçalara ayırın; kısmi sonuç kullanılmadı.':'Karşılaştırma tamamlanamadı. Dosyanız korunuyor; yeniden deneyin.');}}

  finally{if(version===generation.current)setBusy(false);}
 }
 const review=useMemo(()=>snapshot&&compared?reviewImportDecisions(rows,snapshot,decisions,compared):null,[rows,snapshot,decisions,compared]);
 const reviewed=useMemo(()=>new Map(review?.rows.map(r=>[r.number,r])??[]),[review]);
 const visible=compared?.filter(r=>filter==='all'||r.status===filter)??[],sources=useMemo(()=>new Map(rows.map(r=>[r.number,r])),[rows]);
 return <section aria-label="Mevcut havuzla karşılaştırma" className="space-y-4 rounded-2xl border border-blue-200 bg-blue-50/40 p-4 sm:p-5">
  <fieldset disabled={preparing} className="space-y-4">
  <h2 className="text-lg font-semibold">5. Mevcut havuzla karşılaştır</h2>
  <p className="text-sm text-slate-700">Dosyadaki kişileri havuzdaki kayıtlarla karşılaştırın. Arama için ad, telefon, e-posta ve varsa BPS kişi kimliği gönderilir; dosya kaydedilmez. Eşleşmeleri siz seçersiniz, kişiler otomatik birleştirilmez.</p>
  <button ref={compareRef} type="button" className={`${button} bg-blue-600 text-white`} disabled={busy||!rows.length} onClick={()=>dirty?setResetIntent('refresh'):void compare()}>{busy?'Eşleşmeler aranıyor…':snapshot?'Güncel havuzla yeniden karşılaştır':'Havuzla karşılaştır'}</button>
  {dirty&&<button type="button" className={`${button} ml-2 bg-white`} onClick={()=>setResetIntent('discard')}>Kararları bırak</button>}
  {notice&&<p role="status" className="text-sm text-amber-900">{notice}</p>}
  {resetIntent&&<div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm"><p>Bu ekrandaki tüm satır ve alan kararları bırakılsın mı? Dosya korunur; hiçbir kayıt yazılmadı.</p><div className="mt-3 flex flex-wrap gap-2"><button autoFocus className={button} onClick={()=>{restoreFocus.current=true;setResetIntent(null);}}>Kararları koru</button><button className={button} onClick={()=>{if(resetIntent==='refresh')void compare();else reset();}}>Bırak ve devam et</button></div></div>}
  {busy&&<div><p role="status" className="text-sm">{progress.done} / {progress.total||rows.length} satır karşılaştırıldı. Tüm parçalar tamamlanmadan sonuç gösterilmez.</p><button type="button" className={button} onClick={()=>{generation.current++;setBusy(false);setError('Karşılaştırma durduruldu. Kayıt yapılmadı; yeniden başlatabilirsiniz.');}}>Karşılaştırmayı durdur</button></div>}
  {error&&<p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{error} Karşılaştırma yapılamadı; dosyadaki kişiler yeni kayıt sayılmadı.</p>}
  {snapshot&&compared&&<>
   <p role="status" className="text-sm">{rows.every(r=>r.issues.length||(r.tenantId&&r.tenantId!==scope.tenantId))?<>Kaynak satırları düzeltme gerektirdiği için havuz sorgulanmadı. Satırları düzeltin veya bekletin.</>:<>Dosyayla eşleşebilen <strong>{snapshot.total}</strong> farklı kişi okundu · {new Date(snapshot.generatedAt).toLocaleString('tr-TR',{timeZone:'Europe/Istanbul'})} (İstanbul saati, karşılaştırmanın tamamlandığı an). Yalnız olası eşleşmeler sayılır. Havuzda değişiklik yaptıysanız yeniden karşılaştırın.</>}</p>
   <div role="group" aria-label="Karşılaştırma görünümü" className="flex flex-wrap gap-2">{(['all','new','match','review']as const).map(k=><button key={k} className={`${button} bg-white aria-pressed:border-blue-600 aria-pressed:bg-blue-100`} aria-pressed={filter===k} onClick={()=>{setFilter(k);setPage(0);}}>{k==='all'?'Tümü':compareLabels[k]} · {k==='all'?compared.length:compared.filter(r=>r.status===k).length}</button>)}</div>
   {review&&<div role="status" className="rounded-xl border bg-white p-4 text-sm"><h3 className="font-semibold">6. Aktarım kararları</h3><p className="mt-2">{review.counts.new} yeni · {review.counts.update} güncelleme · {review.counts.unchanged} bilgileri aynı · {review.counts.hold} bekletilen · {review.counts.unresolved} karar bekleyen veya hatalı</p><p className="mt-2">{review.conflicts?`${review.conflicts} satırda çözülmesi gereken sorun var.`:review.ready?'Tüm satırlar değerlendirildi. Başlattığınızda seçilen bilgiler bu şirkete kaydedilecek.':'Her satır için ne yapılacağını seçin. Şimdi aktarmak istemediğiniz satırları bekletebilirsiniz.'}</p></div>}
   <p className="text-xs text-slate-600">“Yeni kayıt adayı”, ad veya iletişim bilgisiyle eşleşme bulunamadığını gösterir. Yeni kişi eklemeden önce kontrol edin. Boş hücreler mevcut bilgileri silmez; dosyada olmayan kişiler havuzda kalır.</p>
   {!visible.length&&<p className="rounded-xl bg-white p-4 text-sm">Seçtiğiniz filtreye uyan satır yok.</p>}
   <ul className="space-y-3">{visible.slice(page*50,(page+1)*50).map(r=><li key={r.number} className="rounded-xl border bg-white p-4 text-sm">
    <div className="flex flex-wrap justify-between gap-2"><h3 className="font-semibold">Satır {r.number} · {sources.get(r.number)?.name||'İsim eksik'}</h3><span className="rounded-lg bg-slate-100 px-2 py-1 text-xs">{compareLabels[r.status]}</span></div>
    <p className="mt-2 break-words text-slate-600">{[sources.get(r.number)?.city,sources.get(r.number)?.district,sources.get(r.number)?.skills&&`Meslek: ${sources.get(r.number)?.skills}`,sources.get(r.number)?.regions&&`Bölgeler: ${sources.get(r.number)?.regions}`].filter(Boolean).join(' · ')}</p>
    {!!r.issues.length&&<ul className="mt-2 space-y-1 text-amber-900">{r.issues.map((v,i)=><li key={i}>{v}</li>)}</ul>}
    {!r.candidates.length&&!r.issues.length&&<p className="mt-2 text-slate-600">Mevcut havuzda isim veya iletişim eşleşmesi bulunmadı.</p>}
    {r.candidates.map((c,index)=><details key={c.person.id} className="mt-3 rounded-xl border p-3"><summary className="min-h-11 cursor-pointer"><strong>Olası eşleşme {index+1}: {c.person.name}</strong> · {c.reasons.join(' · ')}</summary>
     <p className="mt-2 break-words text-xs text-slate-600">{c.person.city||'İl belirtilmemiş'} · {c.person.contacts.map(v=>v.value).join(' · ')||'İletişim yok'}</p>
     {!c.differences.length?<p className="mt-3 text-sm text-emerald-800">Dosyadaki dolu alanlar kayıtlı bilgilerle aynı. Yine de aynı kişi olduğunu kontrol edip eşleşmeyi seçin.</p>:<ul className="mt-3 space-y-3">{c.differences.map((d,i)=><li key={i} className="rounded-lg bg-slate-50 p-3"><p className="font-medium">{d.contactKind==='phone'?'Telefon ekle':d.contactKind==='email'?'E-posta ekle':differenceLabels[d.field]} · {d.kind==='add'?'Ekleme önerisi':'Değişiklik önerisi'}</p><p className="mt-1 break-words">BPS: {d.before}</p><p className="mt-1 break-words">Dosya: {d.after}</p>{d.field==='contacts'&&<p className="mt-1 text-xs">Mevcut iletişim bilgileri korunur; bu değer ekleme önerisidir.</p>}</li>)}</ul>}
     <p className="mt-3 text-xs text-slate-500">Bu aşamada bilgiler değişmez. Dosyadaki bilginin güncel olduğunu kontrol ederek hangi alanların güncelleneceğini seçin.</p>
    </details>)}
    {reviewed.get(r.number)&&<RowDecision row={r} value={decisions[r.number]} review={reviewed.get(r.number)!} onChange={d=>choose(r.number,d)}/>}
    {r.moreCandidates&&<p className="mt-2 text-amber-900">20'den fazla olası eşleşme var; yalnız ilk 20 gösteriliyor. Dosyaya telefon veya e-posta gibi ayırt edici bilgiler ekleyip yeniden karşılaştırın.</p>}
   </li>)}</ul>
   <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm">{visible.length?`${page*50+1}–${Math.min((page+1)*50,visible.length)} / ${visible.length}`:'0 satır'}</p><div className="flex gap-2"><button className={button} disabled={!page} onClick={()=>setPage(n=>n-1)}>Önceki sonuçlar</button><button className={button} disabled={(page+1)*50>=visible.length} onClick={()=>setPage(n=>n+1)}>Sonraki sonuçlar</button></div></div>
  </>}
  {review&&<div className="rounded-xl border bg-white p-4"><p className="mb-3 text-sm">Aktarım satır satır kaydedilir. Bir satırda sorun olursa tamamlanan kayıtlar korunur. Bekletilen satırlar işlenmez. Büyük dosyalar en fazla 500 satırlık güvenli parçalara otomatik ayrılır.</p><button type="button" className={`${button} bg-blue-600 text-white`} disabled={!review.ready||busy||preparing} onClick={()=>void start()}>{preparing?'Aktarım hazırlanıyor…':'Seçilen bilgileri aktar'}</button></div>}
  <p className="text-xs text-slate-600">“Seçilen bilgileri aktar” düğmesine basana kadar kişiler kaydedilmez. Karşılaştırma için gönderilen bilgiler yalnız eşleşme bulmakta kullanılır. Aktarımı başlatınca seçtiğiniz kişi bilgileri kaydedilir; dosyanın tamamı gönderilmez.</p>
  </fieldset>
 </section>;
}
