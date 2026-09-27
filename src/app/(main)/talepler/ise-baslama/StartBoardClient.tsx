'use client';
import {useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {RefreshCw} from 'lucide-react';
import {PageHeader} from '@/components/ui';
import {useSearchParams} from 'next/navigation';
import {useAuth} from '@/context/AuthContext';
import {useNavigationGuard} from '@/context/NavigationGuardContext';
import CollapsibleFilters from '@/components/ui/CollapsibleFilters';
import {useVerifiedTenant} from '@/hooks/useVerifiedTenant';
import {createClient} from '@/lib/supabase/client';
import type {Json} from '@/types/database.types';
import {parseFilteredStartBoard,startRowState,nextStartCallOffset,startStatusLabels,startOutcomes,startError,type FilteredStartBoard,type StartRow} from '@/lib/operations/start-board';
import {reserveCommand,acknowledgeCommand,pendingCommandIds,reconcilePending} from '@/lib/operations/pending-commands';
import {dailyPlanReturnHref} from '@/lib/operations/start-tracking-link';
import {isUuid} from '@/lib/operations/pilot-validation';
import {settleStartFailure} from '@/lib/operations/start-failure';
const input='block w-full min-w-0 min-h-11 rounded-lg border border-slate-300 bg-white px-3 py-2 mt-1 text-base sm:text-sm';
const button='inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed';
const dayNow=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Istanbul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const time=(v:string|number)=>new Date(v).toLocaleTimeString('tr-TR',{timeZone:'Europe/Istanbul',hour:'2-digit',minute:'2-digit'});
const localTime=(v:number)=>new Date(v+3*3600000).toISOString().slice(0,19);
export default function StartBoardClient(){
 const navigationGuard=useNavigationGuard(),editForm=useRef<HTMLFormElement>(null);
 const query=useSearchParams(),{user,role,loading:authLoading}=useAuth(),[refresh,setRefresh]=useState(0),{tenantId,loading}=useVerifiedTenant();
 const [day,setDay]=useState(()=>/^\d{4}-\d{2}-\d{2}$/.test(query.get('gun')??'')?query.get('gun')!:dayNow()),[offset,setOffset]=useState(0),[search,setSearch]=useState(()=>(query.get('ara')??'').trim().slice(0,200)),[appliedSearch,setAppliedSearch]=useState(()=>(query.get('ara')??'').trim().slice(0,200)),[onlyUrgent,setOnlyUrgent]=useState(()=>query.get('aksiyon')==='1'),[onlyMine,setOnlyMine]=useState(false);
 const [result,setResult]=useState<{scope:string;data:FilteredStartBoard;received:number}|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[fetching,setFetching]=useState(false),[tick,setTick]=useState(Date.now()),[pending,setPending]=useState(0);
 const [edit,setEdit]=useState<{row:StartRow;action:string;check?:number;occurred:string}|null>(null),[notice,setNotice]=useState('');
 const actorId=user?.id,allowed=role==='yonetici'||role==='operasyon',scope=JSON.stringify([actorId,tenantId,role,day,offset,appliedSearch,onlyMine,onlyUrgent]),scopeRef=useRef(scope);scopeRef.current=scope;
 const data=result?.scope===scope?result.data:null;
 const now=result?Date.parse(result.data.serverNow)+(tick-result.received):Date.now();
 useEffect(()=>{const t=setInterval(()=>setTick(Date.now()),15000);return()=>clearInterval(t);},[]);
 useEffect(()=>{setEdit(null);setNotice('');},[scope]);
 useEffect(()=>navigationGuard.register(event=>{
  if(event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
  if(edit||busy||pending){event.preventDefault();setError(edit?'Önce açık formu kaydedin veya Vazgeç ile kapatın.':'Ayrılmadan önce bekleyen işlemin sonucunu kontrol edin.');}
 }),[navigationGuard,edit,busy,pending]);
 useEffect(()=>{
  const block=(event:BeforeUnloadEvent)=>{if(edit||busy||pending){event.preventDefault();event.returnValue='';}};
  window.addEventListener('beforeunload',block);return()=>window.removeEventListener('beforeunload',block);
 },[edit,busy,pending]);
 useEffect(()=>{if(edit){editForm.current?.scrollIntoView({block:'start',behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});editForm.current?.querySelector<HTMLInputElement>('input')?.focus({preventScroll:true});}},[edit]);
 useEffect(()=>{let cancelled=false;setError('');setResult(null);if(loading||!allowed||!actorId||!tenantId)return;setFetching(true);
  void(async()=>{try{const r=await createClient().rpc('ops_start_board_filtered',{p_actor_id:actorId,p_tenant_id:tenantId,p_day:day,p_offset:offset,p_search:appliedSearch,p_only_mine:onlyMine,p_only_urgent:onlyUrgent});if(r.error)throw r.error;const value=parseFilteredStartBoard(r.data);if(!cancelled){const received=Date.now();setResult({scope,data:value,received});setTick(received);setPending(pendingCommandIds({actorId,tenantId},localStorage).length);}}catch{if(!cancelled)setError('Takip listesi yüklenemedi. Bağlantıyı kontrol edip yenileyin.');}finally{if(!cancelled)setFetching(false);}})();return()=>{cancelled=true;};
 },[actorId,tenantId,allowed,loading,day,offset,appliedSearch,onlyMine,onlyUrgent,refresh,scope]);
 // Refresh between actions; never discard an open form or an uncertain command.
 useEffect(()=>{const t=setInterval(()=>{if(!edit&&!busy)setRefresh(n=>n+1);},60000);return()=>clearInterval(t);},[edit,busy]);
 async function save(row:StartRow,action:string,payload:Json){
  if(!actorId||!tenantId||busy||!data)return;const captured=scope;setBusy(true);setError('');
  const identity={actorId,tenantId};let id:string|undefined;
  try{
   id=await reserveCommand(identity,'start',{assignmentId:row.id,expectedRevision:row.revision,action,data:payload},localStorage,navigator.locks);
   const r=await createClient().rpc('ops_start_execute',{p_actor_id:actorId,p_tenant_id:tenantId,p_command_id:id,p_assignment_id:row.id,p_expected_revision:row.revision,p_action:action,p_payload:payload});
   if(r.error)throw r.error;
   const receipt=r.data as {id?:string;commandId?:string;revision?:number}|null;
   if(receipt?.id!==row.id||receipt.commandId!==id||!Number.isInteger(receipt.revision))throw Error('receipt');
   await acknowledgeCommand(identity,id,localStorage,navigator.locks);
   if(scopeRef.current===captured){setEdit(null);setNotice('Kaydedildi.');setRefresh(n=>n+1);}
  }catch(e){if(scopeRef.current===captured){
   if(!id)setError(startError(e));
   else{
    const outcome=await settleStartFailure(e,id,identity,localStorage,navigator.locks,async ids=>{
     const r=await createClient().rpc('ops_reconcile_commands',{p_actor_id:actorId,p_tenant_id:tenantId,p_command_ids:ids,p_close:true});
     if(r.error)throw r.error;return r.data;
    });
    if(scopeRef.current===captured){
     if(outcome.state==='confirmed'){setError('');setEdit(null);setNotice(outcome.message);setRefresh(n=>n+1);}
     else setError(outcome.message);
    }
   }
  }}
  finally{if(scopeRef.current===captured){try{setPending(pendingCommandIds(identity,localStorage).length);}catch{setError('Kurtarma kaydı okunamadı.');}}setBusy(false);}
 }
 async function recover(){if(!actorId||!tenantId||busy)return;setBusy(true);setError('');const captured=scope;
  try{const identity={actorId,tenantId},ids=pendingCommandIds(identity,localStorage);const r=await createClient().rpc('ops_reconcile_commands',{p_actor_id:actorId,p_tenant_id:tenantId,p_command_ids:ids,p_close:true});if(r.error)throw r.error;
   const summary=await reconcilePending(identity,ids,r.data,localStorage,navigator.locks);if(scopeRef.current===captured){setNotice(`${summary.confirmed} işlem kaydedilmiş, ${summary.closed} uygulanmamış işlem kapatıldı. Liste güncellendi.`);setEdit(null);setRefresh(n=>n+1);}
  }catch{if(scopeRef.current===captured)setError('Bekleyen işlemler doğrulanamadı; tekrar deneyin.');}finally{setBusy(false);}
 }
 function open(row:StartRow,action:string,check?:number){if(edit||busy)return;setEdit({row,action,check,occurred:localTime(Math.min(now,Date.now()))});setError('');setNotice('');}
 if(authLoading||loading)return <p role="status">Çalışma alanı doğrulanıyor…</p>;
 if(!allowed)return <p>Bu ekran yönetici ve operasyon ekibi içindir.</p>;
 if(!actorId||!tenantId)return <p role="alert">Çalışma alanı doğrulanamadı. Oturumunuzu yenileyin.</p>;
 const rows=data?.rows??[];
 const returnCompanyId=isUuid(query.get('donusFirma'))?query.get('donusFirma'):null;
 return <section className="space-y-3 md:space-y-5"><PageHeader title="İşe Başlama Takibi" subtitle="Aramaları takip edin. Şube veya saha teyidiyle işe başlamayı doğrulayın."/>
 <div className="flex flex-wrap items-center justify-between gap-3"><Link className="inline-flex min-h-11 items-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-blue-700 hover:bg-blue-50" onClick={navigationGuard.handle} href={dailyPlanReturnHref(day,returnCompanyId)}>← {returnCompanyId?'Geldiğiniz firmanın günlük planı':'Günlük personel planı'}</Link><div className="hidden md:block"><button className={`${button} bg-white`} disabled={busy||fetching||!!edit} onClick={()=>{setEdit(null);setRefresh(n=>n+1);}}>Listeyi yenile</button></div></div>
 <p className="text-sm text-slate-600">Seçilen günün erişebildiğiniz tüm firmaları gösterilir.{returnCompanyId&&' “Günlük plana dön” bağlantısı geldiğiniz firmayı açar; bu liste tüm firmaları gösterir.'}</p>
 <fieldset disabled={busy||!!edit} className="space-y-3 md:hidden">
  <div className="flex items-end gap-2"><label className="min-w-0 flex-1 text-xs font-medium text-slate-600">Takip günü<input aria-label="Mobil takip günü" className={input} type="date" value={day} onChange={e=>{if(e.target.value){setDay(e.target.value);setOffset(0);}}}/></label><button type="button" className={`${button} bg-white`} onClick={()=>{setDay(dayNow());setOffset(0);}}>Bugün</button><button type="button" aria-label="Takip listesini yenile" className={`${button} bg-white`} disabled={fetching} onClick={()=>setRefresh(n=>n+1)}><RefreshCw size={18}/></button></div>
  <div role="group" aria-label="Hızlı takip filtreleri" className="flex flex-wrap gap-2"><button type="button" aria-pressed={onlyUrgent} className={`${button} bg-white aria-pressed:border-blue-600 aria-pressed:bg-blue-600 aria-pressed:text-white`} onClick={()=>{setOnlyUrgent(v=>!v);setOffset(0);}}>İşlem bekleyenler</button><button type="button" aria-pressed={onlyMine} className={`${button} bg-white aria-pressed:border-blue-600 aria-pressed:bg-blue-600 aria-pressed:text-white`} onClick={()=>{setOnlyMine(v=>!v);setOffset(0);}}>Bendeki takipler</button></div>
 </fieldset>
 <form className="flex items-end gap-2 md:hidden" onSubmit={event=>{event.preventDefault();setAppliedSearch(search.trim());setOffset(0);setRefresh(n=>n+1);}}><fieldset disabled={busy||!!edit} className="contents"><label className="min-w-0 flex-1 text-sm font-medium">Personel veya şube ara<input type="search" className={input} value={search} maxLength={200} placeholder="Ad, firma veya şube" onChange={event=>setSearch(event.target.value)}/></label><button type="submit" className={`${button} bg-blue-700 text-white`}>Ara</button></fieldset></form>
 {(appliedSearch||onlyMine||onlyUrgent)&&<button type="button" disabled={busy||!!edit} className={`${button} text-blue-700 md:hidden`} onClick={()=>{setSearch('');setAppliedSearch('');setOnlyMine(false);setOnlyUrgent(false);setOffset(0);}}>Arama ve filtreleri temizle</button>}
 <div className="hidden md:block"><CollapsibleFilters activeCount={Number(!!appliedSearch)+Number(onlyMine)+Number(onlyUrgent)}>
 <form onSubmit={e=>{e.preventDefault();setAppliedSearch(search.trim());setOffset(0);setRefresh(n=>n+1);}} className="flex flex-wrap items-end gap-4 rounded-2xl border border-slate-200 bg-white p-5 [&>label]:min-w-0"><fieldset disabled={busy||!!edit} className="contents"><label className="text-sm">İş günü<input aria-label="İş günü" className={input} type="date" value={day} onChange={e=>{if(e.target.value){setDay(e.target.value);setOffset(0);}}}/></label><label className="text-sm flex-1 basis-60">Firma, şube veya personel<input className={input} maxLength={200} value={search} onChange={e=>setSearch(e.target.value)}/></label><button type="submit" className={button} disabled={busy}>Ara</button><label className="text-sm"><input type="checkbox" checked={onlyUrgent} onChange={e=>{setOnlyUrgent(e.target.checked);setOffset(0);}}/> İşlem bekleyenler</label><label className="text-sm"><input type="checkbox" checked={onlyMine} onChange={e=>{setOnlyMine(e.target.checked);setOffset(0);}}/> Bendeki takipler</label>{(appliedSearch||onlyMine||onlyUrgent)&&<button type="button" className={button} onClick={()=>{setSearch('');setAppliedSearch('');setOnlyMine(false);setOnlyUrgent(false);setOffset(0);}}>Filtreleri temizle</button>}</fieldset></form>
 </CollapsibleFilters></div>
 <p className="hidden text-sm text-slate-600 md:block">Seçtiğiniz günün atamalarında arama yapabilirsiniz. Güncel durumu görmek için listeyi yenileyin.{appliedSearch&&` Aranan: “${appliedSearch}”.`}</p>
 {appliedSearch&&<p role="status" className="rounded-lg bg-blue-50 p-3 text-sm text-blue-800">“{appliedSearch}” için takip kayıtları gösteriliyor. Aynı isimde personel olabilir; işlemden önce firma ve şubeyi kontrol edin.</p>}
 {day!==dayNow()&&<p className="text-sm text-amber-800">{day>dayNow()?'Gelecek günün planını inceliyorsunuz.':'Geçmiş günün kayıtlarını inceliyorsunuz.'} Saatler İstanbul saatidir.</p>}
 {pending>0&&<div className="rounded border border-amber-300 p-3 text-sm">{pending} operasyon işleminin sonucu kontrol edilmeli. Kontrol, kaydedilenleri doğrular ve uygulanmamış denemeleri kapatır. <button disabled={busy} className={button} onClick={()=>void recover()}>Bekleyen işlemleri kontrol et</button></div>}
 {error&&!edit&&<p role="alert" className="rounded bg-red-50 p-3 text-red-800">{error}</p>}{notice&&<p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
 {data&&!fetching&&<dl aria-label="Takip kapsamı" className="grid grid-cols-3 gap-2 md:gap-3">{[['Günün atamaları',data.dayTotal],['Filtreye uyan',data.total],['Bu sayfada',rows.length]].map(([label,value])=><div key={label} className="rounded-xl border border-slate-200 bg-white px-3 py-2 md:rounded-2xl md:p-4"><dt className="text-xs text-slate-500">{label}</dt><dd className="mt-1 text-lg font-semibold tabular-nums md:mt-2 md:text-2xl">{value}</dd></div>)}</dl>}
 <details className="text-xs text-slate-600"><summary className="flex min-h-11 cursor-pointer items-center font-medium">Takip renkleri ne anlama geliyor?</summary><div className="flex flex-wrap gap-x-5 gap-y-2 pb-2" aria-label="Takip renkleri"><span>Gri: planlı</span><span className="text-blue-700">Mavi: arama zamanı / kayıtlı görüşme</span><span className="text-red-700">Kırmızı: işlem bekliyor</span><span className="text-emerald-700">Yeşil: şube veya saha teyidi alındı</span></div></details>
 {fetching?<p role="status">Atamalar yükleniyor…</p>:data&&rows.length===0?<div className="rounded border bg-white p-6"><p>{data.dayTotal===0?'Bu gün için personel ataması yok. Günlük plandan personel atayın.':offset>0?'Bu sayfada kayıt kalmadı. İlk sayfaya dönün.':'Bu filtrelerle eşleşen atama yok.'}</p>{offset>0&&<button className={button} onClick={()=>setOffset(0)}>İlk sayfaya dön</button>}</div>:null}
 {rows.map(r=>{const model=startRowState(r,now),nextCall=nextStartCallOffset(r,now),locked=busy||!!edit||r.closed||Boolean(r.confirmedAt),claimActive=r.claimUntil&&Date.parse(r.claimUntil)>now&&r.claimedBy!==actorId;
 return <article key={r.id} className={`rounded-2xl border bg-white p-5 sm:p-6 space-y-4 shadow-sm ${model.status==='confirmed'?'border-emerald-200':model.urgent?'border-red-200':'border-slate-200'}`}><div className="flex flex-wrap justify-between gap-3"><div><h2 className="break-words text-lg font-semibold">{r.worker}</h2><p className="mt-1 break-words text-sm font-medium">{r.location}</p><p className="text-sm text-slate-600">{r.company} · {r.position}</p><p className="text-sm">Başlangıç: {r.startAt?time(r.startAt):(r.scheduledTime??'Belirlenmedi')} · Sorumlu: {r.responsible??'Belirlenmedi'}</p></div><strong className={`self-start rounded-lg px-3 py-1.5 text-xs ${model.status==='confirmed'?'bg-emerald-50 text-emerald-800':model.urgent?'bg-red-50 text-red-800':'bg-slate-100 text-slate-700'}`}>{startStatusLabels[model.status]}</strong></div>
 {r.startAt&&!r.ownerAvailable&&!r.closed&&!r.confirmedAt&&<p className="text-sm text-amber-800">Takip sorumlusu artık yetkili değil. Planı düzenleyip sorumlu atayın.</p>}
 {r.startAt&&<details className="rounded-xl border border-slate-200 bg-slate-50 px-3"><summary className="flex min-h-11 cursor-pointer items-center text-sm font-medium">Arama saatleri · {model.steps.filter(step=>step.state==='recorded').length}/{model.steps.length} kayıtlı</summary><div className="flex flex-wrap gap-2 pb-3">{model.steps.map(s=><button className={`${button} ${s.state==='overdue'?'border-red-400 bg-red-50 text-red-800':s.state==='due'||s.state==='recorded'?'border-blue-300 bg-blue-50 text-blue-800':'bg-slate-50 text-slate-600'}`} key={s.offset} disabled={locked||Boolean(claimActive)||['upcoming','not_applicable','not_required'].includes(s.state)} onClick={()=>open(r,'call',s.offset)}>{time(s.dueAt)} · {s.event?startOutcomes[s.event.payload.outcome as keyof typeof startOutcomes]:({upcoming:'Planlı',due:'Şimdi ara',overdue:'Arama gecikti',not_required:'Kapandı',not_applicable:'Takip başlamadan önceki arama'}[s.state]??s.state)}</button>)}</div></details>}
 {model.latest&&<p className="text-sm text-slate-600">Son görüşme {time(model.latest.occurredAt)} · {startOutcomes[model.latest.payload.outcome as keyof typeof startOutcomes]}{typeof model.latest.payload.eta==='string'?` · Beklenen varış ${time(model.latest.payload.eta)}`:''}</p>}
 {claimActive&&<p className="text-sm text-blue-700">Bir ekip arkadaşınız aramayı üstlendi · {time(r.claimUntil!)} saatine kadar.</p>}
 <div className="grid gap-2 sm:grid-cols-2">
 {!r.closed&&!r.confirmedAt&&!r.startAt&&<button className={`${button} bg-blue-700 text-white`} disabled={busy||!!edit} onClick={()=>open(r,'plan')}>Saat ve sorumlu belirle</button>}
 {nextCall!==null&&<button className={`${button} border-blue-700 bg-blue-700 text-white`} disabled={locked||Boolean(claimActive)} onClick={()=>open(r,'call',nextCall)}>Sıradaki görüşmeyi kaydet</button>}
 {!r.closed&&!r.confirmedAt&&r.startAt&&<button className={`${button} border-emerald-700 bg-emerald-700 text-white`} disabled={locked||day>dayNow()} onClick={()=>open(r,'confirm')}>İşe başlamayı teyit et</button>}
 <Link className={`${button} ${model.status==='replacement'?'border-red-300 bg-red-50 font-semibold text-red-800':'bg-white text-blue-700'}`} onClick={navigationGuard.handle} href={`/talepler/gunluk?firma=${r.companyId}&gun=${day}&talep=${r.requestId}#talep-${r.requestId}`}>{model.status==='replacement'?'Yedek personel seç':'Günlük atamayı aç'}</Link>
 </div>
 {!r.closed&&(r.startAt||r.confirmedAt)&&<details className="rounded-xl border border-slate-200 px-3"><summary className="flex min-h-11 cursor-pointer items-center text-sm font-medium text-slate-600">Diğer işlemler</summary><div className="flex flex-wrap gap-2 pb-3">
 {!r.confirmedAt&&r.startAt&&<><button className={button} disabled={busy||!!edit} onClick={()=>open(r,'plan')}>Saat / sorumluyu düzenle</button><button className={button} disabled={locked||Boolean(claimActive)} onClick={()=>void save(r,r.claimedBy===actorId&&r.claimUntil&&Date.parse(r.claimUntil)>now?'release':'claim',{})}>{r.claimedBy===actorId&&r.claimUntil&&Date.parse(r.claimUntil)>now?'Aramayı bırak':'Aramayı üstlen · 3 dk'}</button><button className={button} disabled={locked||Boolean(claimActive)} onClick={()=>open(r,'call',0)}>Ek görüşme kaydet</button></>}
 {r.confirmedAt&&<button className={button} disabled={busy||!!edit} onClick={()=>open(r,'reopen')}>Teyidi gerekçeyle geri al</button>}
 </div></details>}
 {r.confirmedAt&&<p className="text-sm text-green-800">{time(r.confirmedAt)} · {r.witness} ({r.source==='branch'?'şube yetkilisi':'saha sorumlusu'}) teyidi kaydedildi.</p>}
 {edit?.row.id===r.id&&<form ref={editForm} key={`${r.id}:${edit.action}:${edit.check}`} onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);let payload:Json;
 if(edit.action==='plan')payload={time:String(f.get('time')),responsibleId:String(f.get('responsible')),offsets:String(f.get('offsets')).split(',').map(s=>-Math.abs(Number(s.trim()))),reason:String(f.get('reason')??'')};
 else if(edit.action==='reopen')payload={reason:String(f.get('reason'))};
 else{const occurredAt=new Date(String(f.get('occurred'))+'+03:00').toISOString();payload=edit.action==='call'?{offset:edit.check!,outcome:String(f.get('outcome')),note:String(f.get('note')??''),reason:String(f.get('reason')??''),occurredAt,eta:f.get('eta')?new Date(String(f.get('eta'))+'+03:00').toISOString():null}:{source:String(f.get('source')),witness:String(f.get('witness')),occurredAt};}
 void save(edit.row,edit.action,payload);
 }} className="scroll-mt-20 rounded-xl border border-blue-200 bg-blue-50/60 p-4 sm:p-5"><fieldset disabled={busy} className="grid gap-3 sm:grid-cols-2"><legend className="font-semibold mb-3">{edit.action==='plan'?'Takip planı':edit.action==='call'?'Görüşme sonucu':edit.action==='confirm'?'Şube veya sahadan işe başlama teyidi':'Teyidi geri alma'}</legend>{error&&<p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800 sm:col-span-2">{error}</p>}
 {edit.action==='plan'?<><label>Başlangıç saati<input className={input} name="time" type="time" readOnly={!!r.scheduledTime} defaultValue={r.scheduledTime??(r.startAt?time(r.startAt):'')} required/></label><label>Takip sorumlusu<select name="responsible" className={input} defaultValue={r.responsibleId??actorId} required>{data?.members.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select></label><label className="sm:col-span-2">Başlangıçtan kaç dakika önce aransın? (virgülle ayırın)<input className={input} name="offsets" defaultValue={r.offsets.length?r.offsets.map(Math.abs).join(', '):'60, 30, 15'} pattern="\s*\d+\s*(,\s*\d+\s*)*" required/></label></>:null}
 {['call','confirm'].includes(edit.action)&&<label>Görüşme / teyit zamanı<input className={input} name="occurred" type="datetime-local" step="1" defaultValue={edit.occurred} max={localTime(now)} required/></label>}
 {edit.action==='call'&&<><label>Sonuç<select className={input} name="outcome" defaultValue="" required><option value="" disabled>Görüşme sonucunu seçin</option>{Object.entries(startOutcomes).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label><label>Beklenen varış (isteğe bağlı)<input className={input} type="datetime-local" name="eta"/></label><label>Not<input className={input} name="note" maxLength={1000}/></label></>}
 {edit.action==='confirm'&&<><p className="text-sm sm:col-span-2">Personelin işe başladığını şube yetkilisinden veya saha sorumlusundan teyit edin. Kaydettiğinizde günlük yoklaması da “Geldi” olacak.</p><label>Teyit nereden alındı?<select name="source" className={input}><option value="branch">Şube yetkilisi</option><option value="field">Saha sorumlusu</option></select></label><label>Teyit eden kişi<input name="witness" className={input} maxLength={160} required/></label></>}
 {((edit.action==='plan'&&r.startAt)||edit.action==='reopen'||edit.action==='call')&&<label className="sm:col-span-2">{edit.action==='call'?'Düzeltme / tekrar arama gerekçesi (aynı adım daha önce kaydedildiyse zorunlu)':'Değişiklik gerekçesi'}<input className={input} name="reason" minLength={3} maxLength={1000} required={edit.action!=='call'||r.events.some(e=>e.kind==='call'&&e.planVersion===r.planVersion&&e.payload.offset===edit.check)}/></label>}
 <div className="grid grid-cols-2 gap-2 sm:col-span-2"><button className={`${button} bg-blue-700 text-white`}>{busy?'Kaydediliyor…':'Kaydet'}</button><button type="button" className={button} onClick={()=>{setEdit(null);setError('');}}>Vazgeç</button></div></fieldset></form>}
 <details className="border-t border-slate-100 pt-3 text-sm"><summary className="flex min-h-11 cursor-pointer items-center text-slate-600">Takip geçmişi · {r.events.length} kayıt</summary><ol className="mt-2 space-y-2">{r.events.map(e=><li key={e.id} className="border-l-2 pl-3">{({plan:'Plan kaydedildi',inherited:'Yedek atama planı devraldı',call:'Arama',confirm:'Teyit',reopen:'Teyit geri alındı',claim:'Arama üstlenildi',release:'Arama bırakıldı'}[e.kind]??e.kind)} · {e.actor} · {new Date(e.recordedAt).toLocaleString('tr-TR',{timeZone:'Europe/Istanbul'})}{e.kind==='call'&&` · ${startOutcomes[e.payload.outcome as keyof typeof startOutcomes]}`}{typeof e.payload.reason==='string'&&e.payload.reason&&<span className="block">Gerekçe: {e.payload.reason}</span>}{typeof e.payload.note==='string'&&e.payload.note&&<span className="block">Not: {e.payload.note}</span>}</li>)}</ol></details>
 </article>;})}
 {data&&<footer className="flex flex-wrap justify-between gap-3 text-sm"><span>{data.total} eşleşen / {data.dayTotal} atama · Sayfa {Math.floor(offset/50)+1}.</span><div className="flex gap-2"><button className={button} disabled={offset===0||busy||!!edit} onClick={()=>setOffset(n=>Math.max(0,n-50))}>Önceki</button><button className={button} disabled={offset+50>=data.total||busy||!!edit} onClick={()=>setOffset(n=>n+50)}>Sonraki</button></div></footer>}
 </section>;
}
