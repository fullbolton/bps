"use client";
import { useCallback,useEffect,useRef,useState,type RefObject,type MouseEvent } from "react";
import Link from "next/link";
import RequestConversation from "@/components/communication/RequestConversation";
import AttendancePanel from "./AttendancePanel";
import RequestBatch from "./RequestBatch";
import PendingOperations from "./PendingOperations";
import LocationImport from "./LocationImport";
import CancelRequestDialog from "./CancelRequestDialog";
import { useSearchParams,useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { PageHeader,EmptyState } from "@/components/ui";
import AsyncSection from "@/components/ui/AsyncSection";
import ConfirmActionDialog from "@/components/ui/ConfirmActionDialog";
import { useScopedResource } from "@/components/ui/useScopedResource";
import { isWorkDate,deriveDailyCoverage } from "@/lib/operations/daily-demand";
import type { PilotBoard,PilotCompany,PilotKind } from "@/lib/operations/pilot-types";
import { pilotBoardAction,pilotCommandAction,pilotCompaniesAction,pilotScopeAction } from "./actions";

import { isUuid,validatePilotPayload } from "@/lib/operations/pilot-validation";
import { taskPrefillHref } from "@/lib/operations/task-prefill";
import { reserveCommand,acknowledgeCommand,commandDigest,pendingCount,type DraftRecovery,type DraftCheck,type CommandScope } from "@/lib/operations/pending-commands";

const inputClass="w-full min-w-0 min-h-11 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm";
const buttonClass="min-h-11 rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-40";
const emptyBoard:PilotBoard={locations:[],workers:[],requests:[]};
const today=()=>new Intl.DateTimeFormat("sv-SE",{timeZone:"Europe/Istanbul"}).format(new Date());
type SelectionChange = {companyId?:string;date?:string};
type DailyWorkspaceProps = {
  companies:PilotCompany[];companyId:string;date:string;onSelect:(change:SelectionChange)=>void;
  companyInput:RefObject<HTMLSelectElement|null>;dateInput:RefObject<HTMLInputElement|null>;
};

export default function DailyOperations() {
  const {user,role,loading:authLoading}=useAuth();
  const search=useSearchParams();
  const companyInput=useRef<HTMLSelectElement>(null),dateInput=useRef<HTMLInputElement>(null);
  const focusAfterSelection=useRef<keyof SelectionChange|null>(null);
  const allowed=role==="yonetici"||role==="operasyon";
  const context=!authLoading&&allowed&&user ? JSON.stringify([user.id,user.app_metadata?.active_tenant??null,role]) : null;
  const readCompanies=useCallback(async()=>{
    const result=await pilotCompaniesAction();
    if(!result.ok)throw new Error(result.message);
    return result.data;
  },[]);
  const directory=useScopedResource(context,readCompanies);
  const companies=directory.data??[];
  const rawCompany=search.get("firma");
  const requestedCompany=isUuid(rawCompany)?rawCompany.toLowerCase():rawCompany;
  const companyId=rawCompany===null ? companies[0]?.id??"" : companies.find(c=>c.id===requestedCompany)?.id??"";
  const unknownCompany=!!rawCompany&&!companyId;
  const rawDate=search.get("gun");
  const date=isWorkDate(rawDate)&&rawDate>="2000-01-01"&&rawDate<="2100-12-31"?rawDate:today();
  useEffect(()=>{
    if(focusAfterSelection.current==="companyId")companyInput.current?.focus();
    if(focusAfterSelection.current==="date")dateInput.current?.focus();
    focusAfterSelection.current=null;
  },[companyId,date]);

  useEffect(()=>{
    if(!directory.data||unknownCompany)return;
    const params=new URLSearchParams(search.toString());
    params.set("firma",companyId);params.set("gun",date);
    if(rawCompany!==companyId||rawDate!==date||!isUuid(params.get("talep")))params.delete("talep");
    if(params.toString()!==search.toString())window.history.replaceState(null,"",`?${params}`);
  },[directory.data,unknownCompany,companyId,date,rawCompany,rawDate,search]);

  const select=(change:SelectionChange)=>{
    // Read the latest URL so rapid field changes cannot overwrite one another.
    const params=new URLSearchParams(window.location.search);
    const priorDate=params.get("gun");
    const nextDate=change.date??(isWorkDate(priorDate)&&priorDate>="2000-01-01"&&priorDate<="2100-12-31"?priorDate:date);
    const nextCompany=change.companyId??params.get("firma")??companyId;
    if(!isWorkDate(nextDate)||nextDate<"2000-01-01"||nextDate>"2100-12-31")return;
    params.set("firma",nextCompany);params.set("gun",nextDate);params.delete("talep");
    if(params.toString()!==window.location.search.slice(1)){
      focusAfterSelection.current=change.companyId!==undefined?"companyId":"date";
      window.history.pushState(null,"",`?${params}`);
    }
  };
  if(authLoading)return <p role="status">Oturum yükleniyor…</p>;
  if(!allowed)return <EmptyState title="Bu çalışma alanına erişiminiz yok" />;
  return <AsyncSection isLoading={directory.loading} hasError={directory.error} onRetry={()=>{void directory.reload();}}>
    {unknownCompany&&<p role="alert" className="mb-4 rounded-lg bg-amber-50 p-3 text-amber-900">Bağlantıdaki firma bulunamadı veya erişiminiz yok. Listeden bir firma seçin.</p>}
    <DailyOperationsWorkspace key={`${context}:${companyId}:${date}`} companies={companies} companyId={companyId} date={date} onSelect={select} companyInput={companyInput} dateInput={dateInput}/>
  </AsyncSection>;
}

function DailyOperationsWorkspace({companies,companyId,date,onSelect,companyInput,dateInput}:DailyWorkspaceProps) {
  const {user,role,loading:authLoading}=useAuth(); const search=useSearchParams(); const router=useRouter();
  const [board,setBoard]=useState<PilotBoard>(emptyBoard);
  const [boardReady,setBoardReady]=useState(false);
  const [loading,setLoading]=useState(true); const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState(""); const [error,setError]=useState("");
  // Keep card drafts across board refresh/unmounts; successful writes clear only their own field.
  const [assignmentDrafts,setAssignmentDrafts]=useState<Record<string,{workerId:string;label:string}>>({});
  const [countDrafts,setCountDrafts]=useState<Record<string,{value:string;initial:number;label:string}>>({});
  const [cancelTarget,setCancelTarget]=useState<{id:string;label:string}|null>(null);
  const requestSequence=useRef(0); const submitting=useRef(false);
  const forms=useRef<HTMLDivElement>(null);
  const requestForm=useRef<HTMLFormElement>(null);
  const locationForm=useRef<HTMLFormElement>(null),workerForm=useRef<HTMLFormElement>(null);
  const [pendingSelection,setPendingSelection]=useState<{action:{type:"selection";change:SelectionChange}|{type:"link";href:string};labels:string[]}|null>(null);
  const [formEpoch,setFormEpoch]=useState(0);
  const batchRecovery=useRef<DraftRecovery|null>(null),importRecovery=useRef<DraftRecovery|null>(null);
  const batchDirty=useRef<DraftCheck|null>(null),importDirty=useRef<DraftCheck|null>(null);
  const [scope,setScope]=useState<CommandScope|null>(null);
  const [pending,setPending]=useState(0);
  const [recoveryError,setRecoveryError]=useState("");
  const writeReady=!!scope&&scope.actorId===user?.id&&!recoveryError;
  const syncPending=useCallback(()=>{
    if(!scope)return;
    try{setPending(pendingCount(scope,localStorage));}
    catch{setRecoveryError("İşlem kurtarma kaydı okunamadı. Kayıt göndermeden önce tarayıcı depolamasını kontrol edin.");}
  },[scope]);
  const allowed=role==="yonetici"||role==="operasyon";
  const manager=role==="yonetici";
  const refresh=useCallback(async()=>{
    const sequence=++requestSequence.current;
    setBoardReady(false);
    if(!companyId){setBoard(emptyBoard);setLoading(false);return;}
    setLoading(true); setError("");
    try {
      const result=await pilotBoardAction(companyId,date);
      if(sequence!==requestSequence.current)return;
      if(result.ok){setBoard(result.data);setBoardReady(true);}else{setBoard(emptyBoard);setError(result.message);}
    } catch {if(sequence===requestSequence.current){setBoard(emptyBoard);setError("Plan yüklenemedi. Yeniden deneyin.");}}
    finally{if(sequence===requestSequence.current)setLoading(false);}
  },[companyId,date]);
  useEffect(()=>{
    setScope(null);setPending(0);setRecoveryError("");
    if(authLoading||!allowed||!user?.id)return;
    let current=true;
    pilotScopeAction().then(result=>{
      if(!current)return;
      if(!result.ok){setRecoveryError(result.message);return;}
      if(result.data.actorId!==user.id){setRecoveryError("Hesap değişti. Sayfayı yenileyin.");return;}
      const count=pendingCount(result.data,localStorage);
      if(!navigator.locks?.request)throw new Error("unsupported");
      setPending(count);setScope(result.data);
    }).catch(()=>{if(current)setRecoveryError("İşlem kurtarma hazırlanamadı. Tarayıcı depolamasını ve bağlantıyı kontrol edip sayfayı yenileyin.");});
    return()=>{current=false;};
  },[authLoading,allowed,user?.id]);
  useEffect(()=>{window.addEventListener("storage",syncPending);return()=>window.removeEventListener("storage",syncPending);},[syncPending]);
  useEffect(()=>{if(!authLoading&&allowed)void refresh();return()=>{requestSequence.current++;};},[refresh,authLoading,allowed]);

  useEffect(()=>{
    const target=search.get("talep");
    if(boardReady&&isUuid(target))document.getElementById(`talep-${target}`)?.scrollIntoView({block:"center"});
  },[boardReady,search]);

  async function submit(kind:PilotKind,payload:Record<string,string|number>,form?:HTMLFormElement) {
    if(busy||submitting.current)return;
    if(!writeReady||!scope){setError("İşlem kapsamı doğrulanamadı. Sayfayı yenileyin.");return;}
    submitting.current=true;setBusy(true);setError("");setMessage("");
    let sent=false;
    try{
      const clean=validatePilotPayload(kind,payload);
      const id=await reserveCommand(scope,kind,clean,localStorage,navigator.locks);
      syncPending();sent=true;
      const result=await pilotCommandAction(id,kind,clean,scope);
      if(!result.ok){setError(result.message);return;}
      let saved="İşlem kaydedildi.";
      try{await acknowledgeCommand(scope,id,localStorage,navigator.locks);syncPending();}
      catch{saved+=" Tarayıcıdaki bekleyen işaret kaldırılamadı; aynı işlem tekrar gönderilirse ikinci kayıt oluşmaz.";}
      if(kind==="assign")setAssignmentDrafts(previous=>{const next={...previous};delete next[String(payload.requestId)];return next;});
      if(kind==="resize")setCountDrafts(previous=>{const next={...previous};delete next[String(payload.requestId)];return next;});
      if(kind==="cancel")setCancelTarget(null);form?.reset();setMessage(saved);await refresh();
    }catch(e){setError(sent?"İşlemin sonucu alınamadı. Bu tarayıcıda aynı formu tekrar göndererek kontrol edebilirsiniz.":e instanceof Error?e.message:"İşlem kurtarma kaydı oluşturulamadı; kayıt gönderilmedi.");}
    finally{submitting.current=false;setBusy(false);}
  }

  function draftLabels() {
    // Inspect each mounted form independently, including closed details and disabled fields.
    // A successful form.reset() cleans only that form; other drafts remain protected.
    const drafts:{form:HTMLFormElement|null;label:string;initial:Record<string,string>}[]=[
      {form:requestForm.current,label:"Günlük talep",initial:{locationId:"",serviceLine:"Temizlik",position:"Temizlik görevlisi",requiredCount:"1"}},
      {form:locationForm.current,label:"Lokasyon",initial:{name:"",city:""}},
      {form:workerForm.current,label:"Personel",initial:{name:"",code:"",kind:"idp"}},
    ];
    const labels=drafts.filter(({form,initial})=>Object.entries(initial).some(([name,value])=>{
      const field=form?.querySelector<HTMLInputElement|HTMLSelectElement>(`[name="${name}"]`);
      return !!field&&field.value!==value;
    })).map(draft=>draft.label);
    labels.push(...Object.values(assignmentDrafts).map(draft=>`Personel atama · ${draft.label}`));
    labels.push(...Object.values(countDrafts).map(draft=>`Kişi sayısı · ${draft.label}`));
    if(batchDirty.current?.())labels.push("Toplu talep");
    if(importDirty.current?.())labels.push("Şube aktarımı");
    return labels;
  }

  // Uncontrolled form values are read at unload time, including fields inside closed details.
  // Rebind on render so the handler also sees the current child-operation busy state.
  useEffect(()=>{
    const beforeUnload=(event:BeforeUnloadEvent)=>{
      if(!busy&&!submitting.current&&!draftLabels().length)return;
      event.preventDefault();event.returnValue="";
    };
    window.addEventListener("beforeunload",beforeUnload);
    return()=>window.removeEventListener("beforeunload",beforeUnload);
  });

  function selectWithDraftCheck(change:SelectionChange) {
    if(busy||submitting.current)return;
    if(change.companyId===companyId||change.date===date)return;
    if(change.date!==undefined&&(!isWorkDate(change.date)||change.date<"2000-01-01"||change.date>"2100-12-31"))return;
    const labels=draftLabels();
    if(!labels.length){onSelect(change);return;}
    (change.companyId!==undefined?companyInput.current:dateInput.current)?.focus();
    setPendingSelection({action:{type:"selection",change},labels});
  }

  function navigateWithDraftCheck(event:MouseEvent<HTMLAnchorElement>) {
    const link=event.currentTarget;
    if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey||link.hasAttribute("download")||(link.target&&link.target!=="_self"))return;
    if(busy||submitting.current){event.preventDefault();setMessage("İşlem sürüyor. Sayfadan ayrılmadan önce sonucu bekleyin.");return;}
    const labels=draftLabels();
    if(!labels.length)return;
    event.preventDefault();link.focus();
    setPendingSelection({action:{type:"link",href:link.getAttribute("href")!},labels});
  }

  const company=companies.find(c=>c.id===companyId);
  if(authLoading)return <p role="status">Oturum yükleniyor…</p>;
  if(!allowed)return <EmptyState title="Bu çalışma alanına erişiminiz yok" />;
  return <>
    {pendingSelection&&<ConfirmActionDialog title="Kaydedilmemiş değişiklikler"
      recordName={`${company?.name??"Firma"} · ${date}`}
      description={`${pendingSelection.labels.join(", ")} formundaki kaydedilmemiş bilgiler bırakılacak. ${pendingSelection.action.type==="selection"?"Seçtiğiniz firma ve gün için plan açılacak.":"Seçtiğiniz sayfa açılacak."}`}
      confirmLabel="Değişiklikleri bırak" destructive onClose={()=>setPendingSelection(null)}
      onConfirm={async()=>{if(busy||submitting.current)return;const action=pendingSelection.action;if(action.type==="selection")onSelect(action.change);else router.push(action.href);}} />}
    <CancelRequestDialog target={cancelTarget} busy={busy} error={error} onClose={()=>{if(!busy)setCancelTarget(null);}} onConfirm={()=>{if(cancelTarget)void submit("cancel",{requestId:cancelTarget.id});}} />
    <PageHeader title="Günlük personel planı" subtitle="Şube ihtiyacını kaydedin, personeli atayın ve açıkları takip edin." />
    <nav aria-label="Operasyon ekranları" className="mb-5 flex gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1">
    <Link onClick={navigateWithDraftCheck} aria-disabled={busy||undefined} className="inline-flex min-h-11 shrink-0 items-center rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-blue-50 hover:text-blue-800" href={`/talepler/dizin?firma=${companyId}`}>Şube ve personel dizini</Link>
    <Link onClick={navigateWithDraftCheck} aria-disabled={busy||undefined} className="inline-flex min-h-11 shrink-0 items-center rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-blue-50 hover:text-blue-800" href={`/talepler/ise-baslama?gun=${date}`}>İşe Başlama Takibi</Link>
    <Link onClick={navigateWithDraftCheck} aria-disabled={busy||undefined} className="inline-flex min-h-11 shrink-0 items-center rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-blue-50 hover:text-blue-800" href={`/talepler/kontrol?firma=${companyId}&gun=${date}`}>Operasyon kontrol listesi</Link>
    <Link onClick={navigateWithDraftCheck} aria-disabled={busy||undefined} className="inline-flex min-h-11 shrink-0 items-center rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-blue-50 hover:text-blue-800" href={`/talepler/haftalik?firma=${companyId}&gun=${date}`}>Haftalık plan ve çıktı</Link>
    <Link onClick={navigateWithDraftCheck} aria-disabled={busy||undefined} className="inline-flex min-h-11 shrink-0 items-center rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-blue-50 hover:text-blue-800" href={companyId?`/firmalar/${companyId}`:"/firmalar"}>Firma detayına dön</Link>
    </nav>
    <fieldset disabled={busy} className="mb-5 grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto]">
      <label className="text-sm">Firma<select ref={companyInput} aria-label="Firma" className={inputClass} value={companyId} onChange={e=>selectWithDraftCheck({companyId:e.target.value})}><option value="">Firma seçin</option>{companies.map(c=><option key={c.id} value={c.id}>{c.name}{c.active?"":" (operasyona kapalı)"}</option>)}</select></label>
      <label className="text-sm">İş günü<input ref={dateInput} className={inputClass} type="date" min="2000-01-01" max="2100-12-31" value={date} onChange={e=>selectWithDraftCheck({date:e.target.value})} /></label>
      <div className="flex items-end"><button className={buttonClass} onClick={()=>void refresh()} disabled={loading}>Yenile</button></div>
    </fieldset>
    {recoveryError&&<p role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-red-800">{recoveryError}</p>}
    {scope&&<PendingOperations key={`${scope.actorId}:${scope.tenantId}`} scope={scope} count={pending} disabled={busy||!writeReady} onBusy={setBusy} onComplete={async (settled,settledDigests)=>{
      syncPending();
      if(settled){
        const protectedForms=[requestForm.current,locationForm.current,workerForm.current];
        const candidates:{form:HTMLFormElement|null;kind:PilotKind;fixed:Record<string,string>}[]=[
          {form:requestForm.current,kind:"request",fixed:{companyId,workDate:date}},
          {form:locationForm.current,kind:"location",fixed:{companyId}},
          {form:workerForm.current,kind:"worker",fixed:{}},
        ];
        // Only clear a draft whose normalized payload is the terminal command itself.
        // A changed draft, another form, or a command from another day/company stays intact.
        for(const {form,kind,fixed} of candidates){
          if(!form)continue;
          const payload:Record<string,string|number>={...fixed};
          form.querySelectorAll<HTMLInputElement|HTMLSelectElement>("input[name],select[name]").forEach(field=>{
            payload[field.name]=field.name==="requiredCount"?Number(field.value):field.value;
          });
          let digest:string;
          try{digest=await commandDigest(kind,validatePilotPayload(kind,payload));}
          catch{continue;} // Incomplete/edited drafts cannot match a valid sent command.
          if(form.isConnected&&settledDigests.includes(digest))form.reset();
        }
        // Compare the exact captured draft object again when the asynchronous hash returns.
        // Even an A→B→A edit creates a new object and must not be cleared by the old check.
        for(const [requestId,draft] of Object.entries(assignmentDrafts)){
          const digest=await commandDigest("assign",validatePilotPayload("assign",{requestId,workerId:draft.workerId}));
          if(settledDigests.includes(digest))setAssignmentDrafts(current=>{
            if(current[requestId]!==draft)return current;
            const next={...current};delete next[requestId];return next;
          });
        }
        for(const [requestId,draft] of Object.entries(countDrafts)){
          let digest:string;
          try{digest=await commandDigest("resize",validatePilotPayload("resize",{requestId,expectedCount:draft.initial,requiredCount:Number(draft.value)}));}
          catch{continue;} // An incomplete edited count is not a valid sent command.
          if(settledDigests.includes(digest))setCountDrafts(current=>{
            if(current[requestId]!==draft)return current;
            const next={...current};delete next[requestId];return next;
          });
        }
        await batchRecovery.current?.(settledDigests);
        await importRecovery.current?.(settledDigests);
        forms.current?.querySelectorAll("form").forEach(form=>{if(!protectedForms.includes(form)&&form.dataset.recoveryDraft!=="batch"&&form.dataset.recoveryDraft!=="card")form.reset();});
        setFormEpoch(n=>n+1);setCancelTarget(null);setError("");
        setMessage("Sonuçlar kontrol edildi. Sonucu kesinleşen formlar temizlendi; diğer talep, lokasyon, personel ve kart taslakları korundu.");
        await refresh();
      }
    }} />}
    {error&&<p role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-red-800">{error}</p>}
    {message&&<p role="status" className="mb-4 rounded-lg bg-emerald-50 p-3 text-emerald-800">{message}</p>}
    <div ref={forms}>
    {!companyId?<EmptyState title={companies.length?"Planını görmek istediğiniz firmayı seçin":"Önce firma ekleyin"} description="Günlük plan firma altında tutulur." />:<>
      {!company?.active&&<p className="mb-4 text-amber-800">Bu firma yeni operasyona uygun değil. Firma durumunu kontrol edin. Mevcut atamalar kaldırılabilir.</p>}
      {boardReady&&!loading&&<section aria-label="Seçili firma ve gün özeti" className="mb-5">
        <dl className="grid grid-cols-2 xl:grid-cols-4 gap-3">{[
          ['Aktif talep',board.requests.filter(r=>r.lifecycle==='active').length],
          ['İstenen kişi',board.requests.filter(r=>r.lifecycle==='active').reduce((n,r)=>n+r.requiredCount,0)],
          ['Atanan kişi',board.requests.filter(r=>r.lifecycle==='active').reduce((n,r)=>n+r.assignments.length,0)],
          ['Açık kişi',board.requests.filter(r=>r.lifecycle==='active').reduce((n,r)=>n+deriveDailyCoverage(r.requiredCount,r.assignments.length,r.lifecycle).open,0)],
        ].map(([label,value])=><div key={label} className="rounded-2xl border border-slate-200 bg-white p-4"><dt className="text-xs text-slate-500">{label}</dt><dd className="mt-2 text-2xl font-semibold tabular-nums text-slate-900">{value}</dd></div>)}</dl>
        <p className="mt-2 text-xs text-slate-500">Seçili firma ve günün aktif talepleri. Atanmış olmak, işe başlamanın teyit edildiği anlamına gelmez.</p>
      </section>}
      {manager&&<details className="mb-5 rounded-2xl border border-slate-200 bg-white p-5"><summary className="cursor-pointer text-sm font-semibold text-slate-700">Şube ve personel hazırlığı</summary><div className="mt-4">
      {manager&&<LocationImport dirtyRef={importDirty} reconcileRef={importRecovery} key={`${scope?.actorId}:${scope?.tenantId}:${companyId}`} scope={scope} companyId={companyId} disabled={busy||!writeReady||!company?.active} onBusy={setBusy} onComplete={refresh} onPendingChange={syncPending} />}
      {manager&&<div className="mb-5 grid gap-4 lg:grid-cols-2">
        <details className="rounded-xl border bg-white p-4"><summary className="cursor-pointer font-medium">Lokasyon ekle</summary><form ref={locationForm} aria-label="Lokasyon hazırlık formu" className="mt-3 space-y-3" onSubmit={e=>{e.preventDefault();const f=e.currentTarget,d=new FormData(f);void submit("location",{companyId,name:String(d.get("name")),city:String(d.get("city"))},f);}}><fieldset disabled={busy||!writeReady||!company?.active} className="space-y-3"><label className="block text-sm">Şube / bina adı<input name="name" className={inputClass} maxLength={160} required /></label><label className="block text-sm">İl<input name="city" className={inputClass} maxLength={80} required /></label><button className={buttonClass}>Lokasyonu kaydet</button></fieldset></form></details>
        <details className="rounded-xl border bg-white p-4"><summary className="cursor-pointer font-medium">Personel ekle</summary><form ref={workerForm} aria-label="Personel hazırlık formu" className="mt-3 space-y-3" onSubmit={e=>{e.preventDefault();const f=e.currentTarget,d=new FormData(f);void submit("worker",{name:String(d.get("name")),code:String(d.get("code")),kind:String(d.get("kind"))},f);}}><fieldset disabled={busy||!writeReady} className="space-y-3"><label className="block text-sm">Ad soyad<input name="name" className={inputClass} maxLength={160} required /></label><label className="block text-sm">Personel kodu<input name="code" className={inputClass} maxLength={40} required /></label><label className="block text-sm">Tür<select name="kind" className={inputClass}><option value="idp">İDP</option><option value="sabit">Sabit</option></select></label><button className={buttonClass}>Personeli kaydet</button></fieldset></form></details>
      </div>}
      </div></details>}
      <RequestBatch dirtyRef={batchDirty} reconcileRef={batchRecovery} key={`${scope?.actorId}:${scope?.tenantId}:${companyId}:${date}`} companyId={companyId} date={date} locations={board.locations} scope={scope} disabled={busy||!writeReady||loading||!boardReady||!company?.active} onBusy={setBusy} onComplete={refresh} onPendingChange={syncPending} />
      <section className="mb-5 rounded-2xl border border-slate-200 bg-white p-5"><h2 className="font-semibold">Günlük talep aç</h2><form ref={requestForm} aria-label="Günlük talep formu" onSubmit={e=>{e.preventDefault();const f=e.currentTarget,d=new FormData(f);void submit("request",{companyId,locationId:String(d.get("locationId")),workDate:date,serviceLine:String(d.get("serviceLine")),position:String(d.get("position")),requiredCount:Number(d.get("requiredCount"))},f);}}><fieldset disabled={busy||!writeReady||loading||!boardReady||!company?.active} className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><label className="text-sm">Lokasyon<select className={inputClass} name="locationId" required defaultValue=""><option value="" disabled>Lokasyon seçin</option>{board.locations.filter(l=>l.active).map(l=><option key={l.id} value={l.id}>{l.name} · {l.city}</option>)}</select></label><label className="text-sm">Hizmet hattı<input name="serviceLine" className={inputClass} defaultValue="Temizlik" maxLength={80} required /></label><label className="text-sm">Pozisyon<input name="position" className={inputClass} defaultValue="Temizlik görevlisi" maxLength={80} required /></label><label className="text-sm">Kişi sayısı<input name="requiredCount" className={inputClass} type="number" defaultValue={1} min={1} max={100} required /></label><button className={buttonClass}>Talebi kaydet</button></fieldset></form></section>
      <section aria-busy={loading} className="space-y-3"><h2 className="font-semibold">{date} · Talepler</h2>{loading?<p role="status">Plan yükleniyor…</p>:!boardReady?<p role="status">Plan doğrulanamadı. Bağlantı düzeldikten sonra Yenile düğmesini kullanın.</p>:!board.requests.length?<EmptyState title="Bu gün için talep yok" size="tab" />:board.requests.map(r=>{
        const coverage=deriveDailyCoverage(r.requiredCount,r.assignments.length,r.lifecycle);
        const location=board.locations.find(l=>l.id===r.locationId);
        const cardLabel=`${location?.name??"Lokasyon"} · ${r.position}`;
        return <article id={`talep-${r.id}`} key={r.id} className={`scroll-mt-24 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ${search.get("talep")===r.id?"ring-2 ring-slate-700":""}`}><div className="flex flex-wrap justify-between gap-2"><div><h3 className="font-semibold">{location?.name??"Lokasyon"} · {r.position}</h3><p className="text-sm text-slate-600">{r.serviceLine} · {r.assignments.length}/{r.requiredCount} kişi</p></div><span className="text-sm font-medium">{r.lifecycle==="cancelled"?"İptal":coverage.open?`${coverage.open} kişi açık`:"Atandı"}</span></div>
          {r.lifecycle==="active"&&<form data-recovery-draft="card" aria-label={`Kişi sayısı · ${cardLabel}`} key={`${r.id}:${r.requiredCount}:${formEpoch}`} className="mt-3 flex flex-wrap items-end gap-2" onSubmit={e=>{e.preventDefault();const d=new FormData(e.currentTarget);void submit("resize",{requestId:r.id,expectedCount:countDrafts[r.id]?.initial??r.requiredCount,requiredCount:Number(d.get("requiredCount"))});}}><label className="text-sm">Yeni kişi sayısı<input className={inputClass} name="requiredCount" type="number" min={Math.max(1,r.assignments.length)} max={100} value={countDrafts[r.id]?.value??String(r.requiredCount)} onChange={e=>{const value=e.target.value;setCountDrafts(previous=>{const next={...previous},initial=previous[r.id]?.initial??r.requiredCount;if(value===String(initial)&&initial===r.requiredCount)delete next[r.id];else next[r.id]={value,initial,label:cardLabel};return next;});}} required disabled={busy||!writeReady||!company?.active} /></label><button className={buttonClass} disabled={busy||!writeReady||!company?.active}>İhtiyacı güncelle</button>{countDrafts[r.id]&&countDrafts[r.id].initial!==r.requiredCount&&<p className="basis-full text-sm text-amber-800">Güncel ihtiyaç {r.requiredCount} kişi. Taslağınız korunuyor. <button type="button" className="underline disabled:opacity-40" disabled={busy} onClick={()=>setCountDrafts(previous=>{const next={...previous};delete next[r.id];return next;})}>Güncel sayıya dön</button></p>}</form>}
          {r.lifecycle==="active"&&company?.active&&<Link className="mt-3 inline-block text-sm underline" href={taskPrefillHref({companyId,requestId:r.id,date:r.workDate})}>Takip görevi hazırla</Link>}
          <ul className="my-3 space-y-3">{r.assignments.map(a=>{
            const report=r.attendance.find(x=>x.id===a.id)!;
            return <li className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 text-sm" key={a.id}>
              <div className="flex flex-wrap items-center justify-between gap-2"><span>{board.workers.find(w=>w.id===a.workerId)?.name??"Personel"}</span><button disabled={busy||!writeReady} className="underline disabled:opacity-40" onClick={()=>void submit("remove",{requestId:r.id,assignmentId:a.id})}>Atamayı kaldır</button></div>
              <details className="mt-2"><summary className="cursor-pointer text-xs underline">Personeli değiştir</summary>
                {report.status==="present"?<p className="mt-2 text-xs">Geldi bildirimi var. Bildirim hatalıysa önce düzeltin.</p>:<form className="mt-2 flex flex-wrap items-end gap-2" onSubmit={e=>{e.preventDefault();const d=new FormData(e.currentTarget);void submit("replace",{assignmentId:a.id,workerId:String(d.get("workerId")),expectedRevision:report.revision});}}>
                  <label>Yerine atanacak personel<select className={inputClass} name="workerId" required defaultValue="" disabled={busy||!writeReady||!company?.active}><option value="" disabled>Personel seçin</option>{board.workers.filter(w=>w.active&&!w.booked&&w.id!==a.workerId).map(w=><option key={w.id} value={w.id}>{w.name} · {w.code}</option>)}</select></label>
                  <button className={buttonClass} disabled={busy||!writeReady||!company?.active}>Değişimi kaydet</button><p className="basis-full text-xs text-slate-600">Yeni atama kurulamazsa mevcut atama korunur. Eski bildirim tarihçede kalır.</p>
                </form>}
              </details>
            </li>;
          })}</ul>
          {process.env.NEXT_PUBLIC_BPS_CONVERSATION_ENABLED==="true"&&<RequestConversation requestId={r.id} />}
          <AttendancePanel records={r.attendance} workers={board.workers} future={r.workDate>today()} disabled={busy||!writeReady} onRecord={(a,status)=>void submit("attendance",{assignmentId:a.id,expectedRevision:a.revision,status})} />
          {r.lifecycle==="active"&&<div className="flex flex-wrap items-end gap-3"><form data-recovery-draft="card" aria-label={`Personel atama · ${cardLabel}`} className="flex flex-wrap items-end gap-2" onSubmit={e=>{e.preventDefault();const d=new FormData(e.currentTarget);void submit("assign",{requestId:r.id,workerId:String(d.get("workerId"))});}}><label className="text-sm">Personel<select className={inputClass} name="workerId" required disabled={busy||!writeReady||!company?.active||coverage.open===0} value={assignmentDrafts[r.id]?.workerId??""} onChange={e=>{const workerId=e.target.value;setAssignmentDrafts(previous=>{const next={...previous};if(workerId)next[r.id]={workerId,label:cardLabel};else delete next[r.id];return next;});}}><option value="" disabled>Personel seçin</option>{board.workers.filter(w=>w.active).map(w=><option disabled={w.booked} key={w.id} value={w.id}>{w.name} · {w.code}{w.booked?" (bu gün atanmış)":""}</option>)}</select></label><button className={buttonClass} disabled={busy||!writeReady||!company?.active||coverage.open===0}>Ata</button>{assignmentDrafts[r.id]&&<button type="button" className="px-3 py-2 text-sm underline disabled:opacity-40" disabled={busy} onClick={()=>setAssignmentDrafts(previous=>{const next={...previous};delete next[r.id];return next;})}>Seçimi temizle</button>}</form><button className="px-3 py-2 text-sm text-red-700 underline disabled:opacity-40" disabled={busy||!writeReady} onClick={()=>{setError("");setCancelTarget({id:r.id,label:`${location?.name??"Lokasyon"} · ${r.position} · ${r.workDate}`});}}>Talebi iptal et</button></div>}
        </article>;
      })}</section>
    </>}
    </div>
  </>;
}
