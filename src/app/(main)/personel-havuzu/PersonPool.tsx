"use client";
import type {PoolPlacementContext} from '@/lib/operations/pool-placement-context';
import SharedViews from './SharedViews';
import CallListCreate from './CallListCreate';
import Link from 'next/link';
import WorkCopyExport from './WorkCopyExport';
import {placementReturnHref} from '@/lib/operations/pool-placement-link';
import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {Plus,Search,RefreshCw,X,SlidersHorizontal,Upload} from 'lucide-react';
import {PageHeader,EmptyState} from '@/components/ui';
import {Button} from '@/components/ui/button';
import {useScopedResource} from '@/components/ui/useScopedResource';
import {useAuth} from '@/context/AuthContext';
import {useNavigationGuard} from '@/context/NavigationGuardContext';
import {useWorkspace} from '@/context/WorkspaceContext';
import {matchesWorkspace} from '@/lib/workspace-context';
import {initialQuery,validatePeopleQuery,validatePersonInput,parsePendingPerson,workTypeLabels,type TalentScope,type Person,type PeopleQuery,type PersonInput,type PendingPerson} from '@/lib/talent/people';
import {talentContactSummariesAction,talentPeopleAction,talentSaveAction,talentResolveAction} from './actions';
import PersonEditor from './PersonEditor';
import {usePersonMerge} from './usePersonMerge';
import PersonCard from './PersonCard';
import {readLocalReference,clearResolvedLocalReference} from '@/lib/talent/local-reference';
import PersonList,{type QuickPersonDraft} from './PersonList';
import SavedSearches from './SavedSearches';
const time=(v:string)=>new Intl.DateTimeFormat('tr-TR',{dateStyle:'short',timeStyle:'short',timeZone:'Europe/Istanbul'}).format(new Date(v));
const field='min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100';
const filterValue=(value:string|undefined)=>({female:'Kadın',male:'Erkek',other:'Diğer',unknown:'Bilgisi olmayanlar',...workTypeLabels} as Record<string,string>)[value??'']??value;
export default function PersonPool({scope,initialId,placement=null}:{scope:TalentScope;initialId:string|null;placement?:PoolPlacementContext|null}){
 const {user,role,loading:authLoading}=useAuth(),guard=useNavigationGuard();
 const {workspace,loading:workspaceLoading,reload:reloadWorkspace}=useWorkspace();
 const workspaceConfirmed=matchesWorkspace(workspace,scope);
 const allowed=!authLoading&&user?.id===scope.actorId&&user.app_metadata.active_tenant===scope.tenantId&&['yonetici','operasyon','ik'].includes(role);
 const startingQuery:PeopleQuery=placement?{...initialQuery,skill:placement.skill,availabilityDay:placement.day,availabilityState:'available'}:initialQuery;
 const [query,setQuery]=useState<PeopleQuery>(startingQuery),[draft,setDraft]=useState(startingQuery);
 const [callListBusy,setCallListBusy]=useState(false);
 const [filtersOpen,setFiltersOpen]=useState(false);
 const [filterError,setFilterError]=useState('');
 const hasActiveFilters=!!(query.search||query.city||query.district||query.skill||query.gender||query.ageMin||query.ageMax||query.workType||query.availabilityState||query.view!=='all');
 const hasFilterDraft=!!(draft.search||draft.city||draft.district||draft.skill||draft.gender||draft.ageMin||draft.ageMax||draft.workType||draft.availabilityDay||draft.availabilityState);
 function resetFilters(){setFilterError('');setDraft(initialQuery);setQuery(initialQuery);}
 const [quickEdit,setQuickEdit]=useState<QuickPersonDraft|null>(null);
 const focusQuick=useRef<string|null>(null);
 const [detailDirty,setDetailDirty]=useState(false),[cardSection,setCardSection]=useState("summary");
 const [selected,setSelected]=useState(initialId),[editing,setEditing]=useState<Person|'new'|null>(null),[message,setMessage]=useState('');
 const [pending,setPending]=useState<PendingPerson|null>(null),[storageReady,setStorageReady]=useState(false),[storageError,setStorageError]=useState<'invalid'|'unavailable'|'write'|null>(null),[busy,setBusy]=useState(false);
 const flight=useRef(false),alive=useRef(true),key=`bps:talent-person:${scope.actorId}:${scope.tenantId}`;
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
 const restoreLocalReference=useCallback(()=>{
  const result=readLocalReference(()=>sessionStorage.getItem(key),parsePendingPerson);
  setStorageReady(true);
  if(result.kind==='invalid'||result.kind==='unavailable'){setStorageError(result.kind);return;}
  setStorageError(null);
  if(result.kind==='valid')setPending(result.value);
 },[key]);
 useEffect(()=>{restoreLocalReference();},[restoreLocalReference]);
 useEffect(()=>{if(!pending)return;return guard.register(e=>{if(e.button!==0||e.ctrlKey||e.metaKey||e.shiftKey||e.altKey)return;e.preventDefault();setMessage('Ayrılmadan önce bekleyen kayıt işleminin sonucunu kontrol edin.');});},[guard,pending]);
 useEffect(()=>{if(!pending)return;const block=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue='';};window.addEventListener('beforeunload',block);return()=>window.removeEventListener('beforeunload',block);},[pending]);
 const reader=useCallback(async()=>{const r=await talentPeopleAction(scope,query);if(!r.ok)throw Error(r.message);return r.data;},[scope,query]);
 const resource=useScopedResource(allowed?`${scope.actorId}:${scope.tenantId}`:null,reader);
 // A selection belongs to one exact loaded page; no hidden cross-page selection.
 const selectionKey=JSON.stringify([scope.actorId,scope.tenantId,query,resource.data?.generatedAt]);
 const [listSelection,setListSelection]=useState<{key:string;ids:string[]}>({key:'',ids:[]});
 const listIds=listSelection.key===selectionKey?listSelection.ids.filter(id=>resource.data?.rows.some(p=>p.id===id)):[];
 const [mergeVersion,setMergeVersion]=useState(0);
 const merge=usePersonMerge(scope,()=>setSelected(null),receipt=>{setSelected(receipt.primaryId);setCardSection('summary');setMergeVersion(v=>v+1);setMessage('Kişi kartları birleştirildi. Geçmiş ana kartta korunuyor.');void resource.reload();});

 const summaryIds=useMemo(()=>resource.data?.rows.map(p=>p.id)??[],[resource.data]);
 const [contactVersion,setContactVersion]=useState(0);
 const summaryReader=useCallback(async()=>{const r=await talentContactSummariesAction(scope,summaryIds);if(!r.ok)throw Error(r.message);return r.data;},[scope,summaryIds]);
 const summaries=useScopedResource(allowed&&resource.data?`${scope.actorId}:${scope.tenantId}:${contactVersion}:${summaryIds.join(',')}`:null,summaryReader);

 useEffect(()=>{if(resource.loading||quickEdit||!focusQuick.current)return;document.getElementById(`person-edit-${focusQuick.current}`)?.focus({preventScroll:true});focusQuick.current=null;},[resource.loading,resource.data,quickEdit]);
 function clearPending(){if(!clearResolvedLocalReference(()=>sessionStorage.removeItem(key)))return false;setPending(null);return true;}
 function saved(id:string,text:string){if(!clearPending()){setMessage(text+' Ancak tarayıcıdaki işlem referansı temizlenemedi. Depolama izinlerini kontrol edip İşlem sonucunu kontrol et düğmesiyle tekrar deneyin; yeni kayıt göndermeyin.');void resource.reload();return;}if(quickEdit)focusQuick.current=quickEdit.person.id;setEditing(null);setSelected(quickEdit?null:id);setQuickEdit(null);setMessage(text);void resource.reload();}
 async function save(input:PersonInput,target:Person|'new'|null=editing){
  if(flight.current||pending||!!storageError||!storageReady||!allowed||!workspaceConfirmed||!target)return;
  try{input=validatePersonInput(input);}catch{setMessage('Ad soyad boş olamaz. Alanların biçimini ve uzunluğunu kontrol edin.');return;}
  flight.current=true;setBusy(true);setMessage('');
  const cmd={commandId:crypto.randomUUID(),personId:target==='new'?null:target.id,expectedRevision:target==='new'?null:target.revision};
  try{
   // Persist only a receipt reference, never names, phone numbers or form content.
   try{sessionStorage.setItem(key,JSON.stringify(cmd));}catch{setStorageError('write');setMessage('Tarayıcı bekleyen işlem bilgisini saklayamadı. Kayıt gönderilmedi. Formu kapatıp tarayıcı kaydını yeniden kontrol edebilirsiniz.');return;}
   setPending(cmd);
   const result=await talentSaveAction(scope,{...cmd,input});if(!alive.current)return;
   if(result.ok)saved(result.data.id,cmd.personId?'Kişi bilgileri güncellendi.':'Kişi personel havuzuna eklendi.');
   else setMessage(result.message+' İşlem sonucunu kontrol ederek devam edebilirsiniz.');
  }catch{if(alive.current)setMessage('Kayıt sonucu alınamadı. Yeni kayıt açmadan önce işlem sonucunu kontrol edin.');}
  finally{flight.current=false;if(alive.current)setBusy(false);}
 }
 async function resolve(){
  if(!pending||flight.current||!allowed||!workspaceConfirmed)return;flight.current=true;setBusy(true);setMessage('');
  try{const r=await talentResolveAction(scope,pending);if(!alive.current)return;
   if(!r.ok){setMessage(r.message);return;}
   if(r.data.status==='confirmed')saved(r.data.receipt.id,'Önceki işlemin kaydedildiği doğrulandı.');
   else{const cleared=clearPending();setMessage(cleared?'Bu işlem kayıt oluşturmadı. Bilgilerinizi kontrol edip yeniden kaydedebilirsiniz.':'Sunucu bu işlemin kayıt oluşturmadığını doğruladı; tarayıcı referansı temizlenemedi. Depolama izinlerini kontrol edip işlem sonucunu yeniden kontrol edin.');}
  }catch{if(alive.current)setMessage('Sonuç henüz doğrulanamadı. Tekrar kontrol edin.');}
  finally{flight.current=false;if(alive.current)setBusy(false);}
 }
 useEffect(()=>{if(!quickEdit)return;const stop=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue='';};window.addEventListener('beforeunload',stop);const off=guard.register(e=>{if(e.button!==0||e.ctrlKey||e.metaKey||e.shiftKey||e.altKey)return;e.preventDefault();setMessage('Önce düzenlediğiniz satırı kaydedin veya vazgeçin.');});return()=>{off();window.removeEventListener('beforeunload',stop);};},[guard,quickEdit]);
 if(authLoading)return <p role="status">Oturum doğrulanıyor…</p>;
 const canAddPerson=!callListBusy&&!merge.locked&&!detailDirty&&!quickEdit&&workspaceConfirmed&&storageReady&&!storageError&&!pending&&!busy;
 if(!allowed)return <EmptyState title="Çalışma alanı değişti" description="Personel havuzunu güncel yetkinizle açmak için sayfayı yenileyin."/>;
 return <>
 <div className={selected&&!editing?"2xl:pr-[31rem]":""}>
  <PageHeader title="Personel havuzu" subtitle="Kişiyi bul, iletişime geç, bilgilerini güncelle.">
    <WorkCopyExport scope={scope} disabled={!canAddPerson}/><Link href="/personel-havuzu/aktarim" onClick={guard.handle} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"><Upload size={16} aria-hidden="true"/>Excel’den aktar</Link>
    <Button disabled={!canAddPerson} onClick={()=>{setMessage('');setSelected(null);setEditing('new');}}><Plus size={17}/> Kişi ekle</Button>
  </PageHeader>
  {placement&&<section className="mb-4 space-y-2 rounded-xl border border-blue-200 bg-blue-50 p-4"><h2 className="font-semibold">Talep için personel seçimi</h2><p className="break-words font-medium">{placement.companyName} · {placement.locationName}</p><p className="text-sm">{placement.day.split('-').reverse().join('.')} · {placement.hours} · {placement.skill}</p><p className="text-sm">Şube ili: {placement.city||'Belirtilmedi'}</p>{placement.meetingNote&&<p className="break-words text-sm">Servis / buluşma: {placement.meetingNote}</p>}<p className="text-sm">İlk arama, bu gün için müsaitliğini teyit eden ve mesleği eşleşen kişileri gösterir. Saat uygunluğunu kişiyle ayrıca teyit edin; mevcut atamalar talebe döndüğünüzde kontrol edilir.</p><div className="flex flex-wrap gap-2">{placement.city&&<Button variant="outline" disabled={busy||callListBusy||detailDirty||!!editing||!!quickEdit||merge.locked} onClick={()=>{const next={...query,city:placement.city,offset:0};setQuery(next);setDraft(next);}}>İkamet ili: {placement.city} ile daralt</Button>}<Link className="inline-flex min-h-11 items-center underline" href={placementReturnHref(placement)} onClick={guard.handle}>Talebe dön</Link></div><p className="text-xs text-slate-600">İl filtresi kişinin ikametini kullanır; başka ilden gelebilecek kişileri de görmek için filtreyi kaldırın.</p></section>}
  <div className="mb-4 text-sm" aria-label="Havuzun şirketi">
   {workspaceConfirmed?<p className="text-slate-500">Şirket: <strong className="font-medium text-slate-700">{workspace?.name}</strong></p>:workspaceLoading?<p role="status">Şirket bilgisi doğrulanıyor…</p>:<div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4"><p>Şirket bilgisi doğrulanamadı. Kayıt ekleme ve düzenleme için yeniden deneyin.</p><Button variant="outline" className="mt-2" onClick={()=>void reloadWorkspace()}>Şirket bilgisini yeniden yükle</Button></div>}
  </div>
  {merge.message&&merge.message!==message&&<p role="status" className="mb-3 rounded-xl bg-blue-50 p-3 text-sm">{merge.message}</p>}
  {merge.storageError&&<p role="alert" className="mb-3 rounded-xl bg-amber-50 p-3 text-sm">Birleştirme işlem referansı okunamıyor veya temizlenemiyor. Yeni yazma işlemleri kapalı; mevcut referansı silmeyin. Tarayıcı depolamasını kontrol edin.</p>}
  {merge.pending&&<section aria-label="Bekleyen birleştirme" className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4"><p className="text-sm">Birleştirme sonucunu doğrulayın. Kontrol, tamamlanan işlemi bulur; henüz uygulanmamışsa bu işlem numarasını kapatır.</p><Button variant="outline" disabled={merge.busy} onClick={()=>void merge.resolve()}>{merge.busy?'Sonuç bekleniyor…':'Birleştirme sonucunu kontrol et'}</Button></section>}
  {message&&!editing&&<p role="status" className="mb-4 rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-950">{message}</p>}
  {storageError&&<div role="alert" className="mb-4 rounded-xl bg-amber-50 p-4 text-sm"><p>{storageError==='invalid'?'Bekleyen işlem referansı bozuk veya eski biçimde. Sayfayı yenilemek bu kaydı düzeltmez; işlem sonucu bilinmediği için yeni kayıt ve düzenleme kapalı.':storageError==='unavailable'?'Tarayıcının yerel kaydına erişilemiyor. Bu site için depolama izinlerini kontrol edin; kişi listesi okunabilir, kayıt ve düzenleme kapalı.':'İşlem referansı tarayıcıya kaydedilemedi; yeni kayıt isteği gönderilmedi. Depolama izinlerini kontrol edin.'}</p><Button variant="outline" className="mt-3" disabled={busy||!!pending||!!editing} onClick={restoreLocalReference}>Tarayıcı kaydını yeniden kontrol et</Button></div>}
  {pending&&!editing&&<div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4"><p className="text-sm">{busy?'İşlem sürüyor. Sonuç bekleniyor…':'Kaydın sonucu henüz doğrulanmadı. Yeniden kaydetmeden önce kontrol edin.'}</p><Button variant="outline" disabled={busy||!workspaceConfirmed} onClick={()=>void resolve()}>{busy?'Bekleyin…':'İşlem sonucunu kontrol et'}</Button></div>}
  <fieldset disabled={callListBusy||!!quickEdit||detailDirty} aria-label="Havuz arama" className="mb-4 min-w-0 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
   <div className="mb-4 flex flex-wrap gap-2 border-b border-slate-100 pb-4">{([{value:'all',label:'Tüm kişiler'},{value:'call_back',label:'Tekrar aranacaklar'},{value:'contact_missing',label:'İletişim bilgisi eksik'},{value:'linked',label:'Operasyona bağlı'}] as const).map(v=><button key={v.value} aria-pressed={query.view===v.value} className="min-h-11 rounded-xl border px-4 text-sm aria-pressed:border-blue-500 aria-pressed:bg-blue-50 aria-pressed:text-blue-800" onClick={()=>setQuery({...query,view:v.value,offset:0})}>{v.label}</button>)}</div>
   <form onSubmit={e=>{e.preventDefault();try{const next=validatePeopleQuery({...draft,view:query.view,offset:0});setFilterError('');if(JSON.stringify(next)===JSON.stringify(query))void resource.reload();else setQuery(next);}catch{setFiltersOpen(true);setFilterError('Yaş aralığını kontrol edin. Müsaitlik araması için hem çalışma günü hem teyit durumu seçilmelidir.');}}} className="flex flex-wrap items-end gap-3">
    <label className="min-w-0 flex-[1_1_240px] text-sm font-medium">Kişi ara<input type="search" className={`${field} mt-1`} maxLength={160} placeholder="Ad, iletişim veya personel kodu" value={draft.search} onChange={e=>setDraft({...draft,search:e.target.value})}/></label>
    <div className="flex flex-wrap gap-2">
     <Button type="submit" disabled={resource.loading}><Search size={16}/>Ara</Button>
     <Button type="button" variant="outline" aria-expanded={filtersOpen} aria-controls="person-pool-filters" onClick={()=>setFiltersOpen(v=>!v)}><SlidersHorizontal size={16}/>Filtreler{[query.city,query.district,query.skill,query.gender,query.ageMin,query.ageMax,query.workType,query.availabilityState].filter(Boolean).length?` (${[query.city,query.district,query.skill,query.gender,query.ageMin,query.ageMax,query.workType,query.availabilityState].filter(Boolean).length})`:''}</Button>
     <Button type="button" variant="outline" size="icon" aria-label="Havuzu yenile" onClick={()=>void resource.reload()} disabled={resource.loading}><RefreshCw size={16}/></Button>
    </div>
    <div id="person-pool-filters" hidden={!filtersOpen} className="w-full">
     <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3 sm:grid-cols-2 sm:p-4">
      <h2 className="text-sm font-semibold text-slate-900 sm:col-span-2">Konum ve meslek</h2>
      <label className="text-sm font-medium">İl<input className={`${field} mt-1`} maxLength={80} placeholder="Tüm iller" value={draft.city} onChange={e=>setDraft({...draft,city:e.target.value})}/></label>
      <label className="text-sm font-medium">İlçe<input className={`${field} mt-1`} maxLength={80} placeholder="Tüm ilçeler" value={draft.district??''} onChange={e=>setDraft({...draft,district:e.target.value})}/></label>
      <label className="text-sm font-medium">Meslek / yapabileceği iş<input className={`${field} mt-1`} maxLength={80} placeholder="Örn. Temizlik" value={draft.skill} onChange={e=>setDraft({...draft,skill:e.target.value})}/></label>
      <h2 className="mt-2 border-t border-slate-200 pt-4 text-sm font-semibold text-slate-900 sm:col-span-2">Kişi bilgileri ve çalışma tercihi</h2>
      <label className="text-sm font-medium">Cinsiyet<select className={`${field} mt-1`} value={draft.gender??''} onChange={e=>setDraft({...draft,gender:e.target.value})}><option value="">Tümü</option><option value="female">Kadın</option><option value="male">Erkek</option><option value="other">Diğer</option><option value="unknown">Bilgisi olmayanlar</option></select></label>
      <label className="text-sm font-medium">En az yaş<input type="number" min={0} max={120} step={1} aria-invalid={!!filterError} aria-describedby={filterError?'person-pool-filter-error':undefined} className={`${field} mt-1`} placeholder="Sınır yok" value={draft.ageMin??''} onChange={e=>{setFilterError('');setDraft({...draft,ageMin:e.target.value});}}/></label>
      <label className="text-sm font-medium">En çok yaş<input type="number" min={0} max={120} step={1} aria-invalid={!!filterError} aria-describedby={filterError?'person-pool-filter-error':undefined} className={`${field} mt-1`} placeholder="Sınır yok" value={draft.ageMax??''} onChange={e=>{setFilterError('');setDraft({...draft,ageMax:e.target.value});}}/></label>
      <label className="text-sm font-medium">Çalışma tercihi<select className={`${field} mt-1`} value={draft.workType??''} onChange={e=>setDraft({...draft,workType:e.target.value})}><option value="">Tüm tercihler</option>{Object.entries(workTypeLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
      <p className="self-end text-xs leading-5 text-slate-500">Yaş filtresi yalnız doğum tarihi bilinen kişileri gösterir. Meslekten yapabileceği işi, çalışma tercihinden istediği çalışma türünü seçin. Günlük müsaitlik için tarih filtresini kullanın.</p>
      <h2 className="mt-2 border-t border-slate-200 pt-4 text-sm font-semibold text-slate-900 sm:col-span-2">Günlük müsaitlik</h2>
      <label className="text-sm font-medium">Çalışma günü<input type="date" min="2000-01-01" max="2100-12-31" className={`${field} mt-1`} value={draft.availabilityDay??''} onChange={e=>{setFilterError('');setDraft({...draft,availabilityDay:e.target.value,availabilityState:e.target.value?(draft.availabilityState||'available'):''});}}/></label>
      <label className="text-sm font-medium">Müsaitlik teyidi<select className={`${field} mt-1`} value={draft.availabilityState??''} onChange={e=>{setFilterError('');setDraft({...draft,availabilityState:e.target.value,...(!e.target.value?{availabilityDay:''}:{})});}}><option value="">Müsaitliğe göre filtreleme</option><option value="available">Seçilen gün için müsait</option><option value="unavailable">Seçilen gün için müsait değil</option><option value="unknown">Seçilen gün için teyit gerekli</option></select></label>
      <p className="text-xs text-slate-500 sm:col-span-2">“Teyit gerekli”, seçtiğiniz gün için müsaitliği netleşmemiş kişileri gösterir. Müsait görünen kişinin o gün başka bir görevi olup olmadığını da kontrol edin.</p>
      {filterError&&<p id="person-pool-filter-error" role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700 sm:col-span-2">{filterError}</p>}
      <div className="flex flex-wrap gap-2 sm:col-span-2"><Button type="submit" disabled={resource.loading}>Filtreleri uygula</Button><Button type="button" variant="outline" disabled={!hasFilterDraft&&query.view==='all'&&!filterError} onClick={resetFilters}>Seçimleri temizle</Button></div>
     </div>
    </div>
   </form>
   {(query.search||query.city||query.district||query.skill||query.gender||query.ageMin||query.ageMax||query.workType||query.availabilityState||query.view!=='all')&&<div aria-label="Uygulanan filtreler" className="mt-3 flex flex-wrap items-center gap-2">
    {([{key:'search',label:'Arama'},{key:'city',label:'İl'},{key:'skill',label:'Meslek'},{key:'district',label:'İlçe'},{key:'gender',label:'Cinsiyet'},{key:'ageMin',label:'En az yaş'},{key:'ageMax',label:'En çok yaş'},{key:'workType',label:'Çalışma tercihi'}] as const).filter(f=>query[f.key]).map(f=><button key={f.key} type="button" aria-label={`${f.label} filtresini kaldır: ${filterValue(query[f.key])}`} className="flex min-h-11 max-w-full items-center gap-2 rounded-xl bg-blue-50 px-3 text-sm text-blue-800" onClick={()=>{setFilterError('');setDraft(d=>({...d,[f.key]:''}));setQuery(q=>({...q,[f.key]:'',offset:0}));}}><span className="min-w-0 break-words">{f.label}: {filterValue(query[f.key])}</span><X size={15} aria-hidden="true" className="shrink-0"/></button>)}
    <button type="button" className="min-h-11 px-2 text-sm text-blue-700 underline" onClick={resetFilters}>Tüm filtreleri temizle</button>
   </div>}
   {(draft.search.trim()!==query.search||draft.city.trim()!==query.city||draft.skill.trim()!==query.skill||(['district','gender','ageMin','ageMax','workType','availabilityDay','availabilityState'] as const).some(k=>(draft[k]??'')!==(query[k]??'')))&&<p role="status" className="mt-3 text-xs text-slate-500">Arama veya filtreler değişti. Sonuçları güncellemek için Ara veya Filtreleri uygula düğmesine basın.</p>}
  {query.availabilityState&&<p className="mt-3 text-sm text-blue-800">{query.availabilityDay} · {query.availabilityState==='available'?'Teyitli müsait':query.availabilityState==='unavailable'?'Müsait değil':'Teyit gerekli'} <button type="button" className="ml-2 min-h-11 underline" onClick={()=>{setQuery({...query,availabilityDay:'',availabilityState:'',offset:0});setDraft({...draft,availabilityDay:'',availabilityState:''});}}>Müsaitlik filtresini kaldır</button></p>}
  <div className="mt-4 flex flex-wrap items-start gap-x-4 gap-y-2 border-t border-slate-100 pt-3" aria-label="Kayıtlı filtreler">
  <SharedViews key={`${scope.actorId}:${scope.tenantId}`} scope={scope} query={query} onApply={next=>{setFilterError('');setQuery(next);setDraft(next);}}/>
  <SavedSearches scope={scope} query={query} onApply={next=>{setFilterError('');setQuery(next);setDraft(next);}}/>
  </div>
  </fieldset>
  <CallListCreate pageCount={resource.data?.rows.length??0} onSelectPage={()=>setListSelection({key:selectionKey,ids:resource.data?.rows.map(p=>p.id)??[]})} onBusy={setCallListBusy} key={`${scope.actorId}:${scope.tenantId}`} scope={scope} ids={listIds} disabled={!workspaceConfirmed||busy||!!pending||!!quickEdit||detailDirty||merge.locked} onClear={()=>setListSelection({key:selectionKey,ids:[]})}/>
  {detailDirty&&<p role="status" className="mb-3 rounded-lg bg-amber-50 p-3 text-sm">Açık kişi kartındaki işlemi tamamladıktan sonra başka kişi seçebilirsiniz.</p>}
  {quickEdit&&<p role="status" className="mb-3 rounded-lg bg-blue-50 p-3 text-sm">Bir satırı düzenliyorsunuz. Kayıt tamamlanana kadar filtre ve sayfa değişimi kapalı.</p>}
  {query.view==='call_back'&&<p className="mb-3 text-sm text-slate-600">Son genel görüşmesinde tekrar aranacağı kaydedilen kişiler. Yeni görüşme sonucu kaydedildiğinde liste güncellenir.</p>}
  {summaries.error&&<div role="alert" className="mb-3 rounded-xl bg-amber-50 p-3 text-sm">Son genel görüşmeler okunamadı. Kişi bilgileri kullanılabilir. <button type="button" className="min-h-11 underline" onClick={()=>void summaries.reload()}>Görüşme özetlerini yeniden dene</button></div>}
  {resource.loading?<p role="status" className="p-6 text-slate-600">Personel havuzu yükleniyor…</p>:resource.error?<div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-5"><p>Personel havuzu yüklenemedi. Bağlantıyı kontrol edip yeniden deneyin.</p><Button variant="outline" className="mt-3" onClick={()=>void resource.reload()}>Yeniden dene</Button></div>:resource.data&&<>
   <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-slate-600"><strong className="text-slate-900">{resource.data.total}</strong> kişi{query.search?` · “${query.search}”`:''}</p><span className="text-xs text-slate-500">Son okuma: {time(resource.data.generatedAt)}</span></div>
   {resource.data.total===0?<EmptyState title={hasActiveFilters?'Bu aramaya uygun kişi bulunamadı':'Personel havuzunuz henüz boş'} description={hasActiveFilters?'Seçili filtreleri kaldırarak tüm kişilere dönebilirsiniz.':'Tek kişi ekleyebilir veya üstteki Excel’den aktar düğmesiyle mevcut listenizi yükleyebilirsiniz.'} action={hasActiveFilters&&!quickEdit&&!detailDirty?{label:'Tüm kişileri göster',onClick:resetFilters}:canAddPerson?{label:'İlk kişiyi ekle',onClick:()=>{setMessage('');setSelected(null);setEditing('new');}}:undefined}/>:<>
    {!resource.data.rows.length?<div className="rounded-xl border bg-white p-5"><p>Liste değişti; bu sayfada kayıt kalmadı.</p><Button variant="outline" className="mt-3" onClick={()=>setQuery({...query,offset:0})}>İlk sayfaya dön</Button></div>:<PersonList checkedIds={listIds} onCheck={(id,checked)=>setListSelection({key:selectionKey,ids:checked?[...new Set([...listIds,id])]:listIds.filter(x=>x!==id)})} summaries={summaries.data} summaryError={!!summaries.error} onConversations={id=>{if(!detailDirty){setCardSection("conversations");setSelected(id);setMessage('');}}} selectedId={selected} selectionDisabled={callListBusy||detailDirty||merge.locked} people={resource.data.rows} offset={query.offset} edit={quickEdit} canEdit={!callListBusy&&!merge.locked&&!detailDirty&&workspaceConfirmed&&storageReady&&!storageError&&!pending} busy={busy||!!pending} onSelect={id=>{if(!detailDirty){setSelected(id);setMessage('');}}} onEdit={person=>{if(detailDirty)return;setSelected(null);setMessage('');setQuickEdit({person,input:{gender:person.gender,birthDate:person.birthDate,name:person.name,city:person.city,district:person.district,contacts:person.contacts,skills:person.skills,regions:person.regions,workTypes:person.workTypes}});}} onChange={(field,value)=>setQuickEdit(d=>d?{...d,input:{...d.input,[field]:field==='name'?value:value||null}}:null)} onCancel={()=>{focusQuick.current=quickEdit?.person.id??null;setQuickEdit(null);setMessage('Satır değişikliklerinden vazgeçildi.');}} onSave={()=>{if(quickEdit)void save(quickEdit.input,quickEdit.person);}}/>}
    <div className="mt-5 flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-slate-500">{resource.data.rows.length?`${query.offset+1}–${query.offset+resource.data.rows.length} / ${resource.data.total}`:'Bu sayfada kayıt yok'}</p><div className="flex gap-2"><Button variant="outline" disabled={callListBusy||!!quickEdit||detailDirty||query.offset===0} onClick={()=>setQuery({...query,offset:query.offset-50})}>Önceki</Button><Button variant="outline" disabled={callListBusy||!!quickEdit||detailDirty||query.offset+50>=resource.data.total} onClick={()=>setQuery({...query,offset:query.offset+50})}>Sonraki</Button></div></div>
   </>}
  </>}
 </div>
  {selected&&!editing&&!merge.locked&&<PersonCard onMerge={merge.apply} onConversationSaved={()=>{setContactVersion(v=>v+1);if(query.view==='call_back')void resource.reload();}} section={cardSection} onSectionChange={setCardSection} onDirty={setDetailDirty} pageIds={resource.data?.rows.map(p=>p.id)??[]} onSelect={setSelected} onPrepared={()=>{setMessage('Personel operasyona hazırlandı. Henüz işe atanmadı.');void resource.reload();}} canPrepare={role==='yonetici'} placement={['yonetici','operasyon'].includes(role)?placement:null} key={`${selected}:${mergeVersion}`} id={selected} scope={scope} notice={message} canEdit={workspaceConfirmed&&storageReady&&!storageError&&!pending} onClose={()=>setSelected(null)} onEdit={p=>{setSelected(null);setMessage('');setEditing(p);}}/>}
  {editing&&<PersonEditor key={editing==='new'?'new':`${editing.id}:${editing.revision}`} person={editing==='new'?null:editing} workspaceName={workspaceConfirmed?workspace!.name:null} writeDisabled={!workspaceConfirmed} busy={busy} pending={!!pending} message={message} onClose={()=>setEditing(null)} onSave={input=>void save(input)} onResolve={()=>void resolve()} onReloadWorkspace={()=>void reloadWorkspace()}/>}
 </>;
}
