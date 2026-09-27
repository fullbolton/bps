"use client";
import IdpPeriodPanel from './IdpPeriodPanel';
import IdpContextPanel,{type IdpTarget} from './IdpContextPanel';
import {poolPlacementHref} from '@/lib/operations/pool-placement-link';
import { useCallback,useEffect,useRef,useState,type RefObject,type MouseEvent } from "react";
import Link from "next/link";
import RequestConversation,{type ConversationDraftState} from "@/components/communication/RequestConversation";
import { DAILY_FOCUS_LABELS,requestProgress,matchesDailyFocus,dailyRequestSearchText,matchesDailySearch,type DailyFocus } from "@/lib/operations/daily-board-view";
import AttendancePanel from "./AttendancePanel";
import AttendanceControls from "./AttendanceControls";
import ReplacementOutreachDialog from "./ReplacementOutreachDialog";
import WorkApprovalDialog from "./WorkApprovalDialog";
import WorkApprovalQueue,{type WorkTarget} from "./WorkApprovalQueue";
import { replacementOptions,workersForRequest,shiftLabel } from "@/lib/operations/replacement-options";
import { startTrackingHref, startBoardHref } from "@/lib/operations/start-tracking-link";
import RequestBatch from "./RequestBatch";
import PendingOperations from "./PendingOperations";
import LocationImport from "./LocationImport";
import CancelRequestDialog from "./CancelRequestDialog";
import { useSearchParams,useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useNavigationGuard } from "@/context/NavigationGuardContext";
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
  const [focus,setFocus]=useState<DailyFocus>("all");
  const [quickSearch,setQuickSearch]=useState("");
  const [idpPeriod,setIdpPeriod]=useState<string|null>(null);
  const [idpTarget,setIdpTarget]=useState<IdpTarget|null>(null);
  const [workTarget,setWorkTarget]=useState<WorkTarget|null>(null);
  const [workRefresh,setWorkRefresh]=useState(0);
  const [outreachTarget,setOutreachTarget]=useState<{assignmentId:string;workerId:string;workerName:string}|null>(null);
  const [replacementSearch,setReplacementSearch]=useState<Record<string,string>>({});
  const [board,setBoard]=useState<PilotBoard>(emptyBoard);
  const [boardReady,setBoardReady]=useState(false);
  const [loading,setLoading]=useState(true); const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState(""); const [error,setError]=useState("");
  // Keep card drafts across board refresh/unmounts; successful writes clear only their own field.
  const [assignmentDrafts,setAssignmentDrafts]=useState<Record<string,{workerId:string;label:string;workerLabel:string}>>({});
  const [replacementDrafts,setReplacementDrafts]=useState<Record<string,{workerId:string;workerLabel:string;label:string;initialRevision:number}>>({});
  const [countDrafts,setCountDrafts]=useState<Record<string,{value:string;initial:number;label:string}>>({});
  type DetachedDraft={kind:"assign"|"resize"|"replace";id:string;label:string;value:string;draft:object};
  const [discardDraft,setDiscardDraft]=useState<DetachedDraft|null>(null);
  const detachedPanel=useRef<HTMLElement>(null);
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
  const writeReady=boardReady&&!loading&&!!scope&&scope.actorId===user?.id&&!recoveryError;
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
      if(result.ok){setBoard(result.data);setBoardReady(true);}else{setError(result.message);}
    } catch {if(sequence===requestSequence.current){setError("Plan yüklenemedi. Yeniden deneyin.");}}
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
    if(!writeReady||!scope){setError("Hesap ve şirket bilgisi doğrulanamadı. Sayfayı yenileyin.");return;}
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
      if(kind==="replace")setReplacementDrafts(previous=>{const next={...previous};delete next[String(payload.assignmentId)];return next;});
      if(kind==="resize")setCountDrafts(previous=>{const next={...previous};delete next[String(payload.requestId)];return next;});
      if(kind==="cancel")setCancelTarget(null);form?.reset();setMessage(saved);await refresh();
    }catch(e){setError(sent?"İşlemin sonucu alınamadı. Bu tarayıcıda aynı formu tekrar göndererek kontrol edebilirsiniz.":e instanceof Error?e.message:"İşlem kurtarma kaydı oluşturulamadı; kayıt gönderilmedi.");}
    finally{submitting.current=false;setBusy(false);}
  }

  const conversationDrafts=useRef(new Map<string,ConversationDraftState>());
  const onConversationDraft=useCallback((id:string,state:ConversationDraftState|null)=>{
    if(state)conversationDrafts.current.set(id,state);else{const previous=conversationDrafts.current.get(id);if(previous?.dirty)conversationDrafts.current.set(id,{...previous,busy:false});else conversationDrafts.current.delete(id);}
  },[]);
  const conversationBusy=()=>[...conversationDrafts.current.values()].some(state=>state.busy);

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
    labels.push(...Object.values(replacementDrafts).map(draft=>`Personel değişimi · ${draft.label}`));
    labels.push(...Object.values(countDrafts).map(draft=>`Kişi sayısı · ${draft.label}`));
    for(const [id,state] of conversationDrafts.current){
      if(state.dirty){const request=board.requests.find(row=>row.id===id);labels.push(`Talep notu · ${request?.position??id}`);}
    }
    if(batchDirty.current?.())labels.push("Toplu talep");
    if(importDirty.current?.())labels.push("Şube aktarımı");
    return labels;
  }

  // Uncontrolled form values are read at unload time, including fields inside closed details.
  // Rebind on render so the handler also sees the current child-operation busy state.
  useEffect(()=>{
    const beforeUnload=(event:BeforeUnloadEvent)=>{
      if(!busy&&!submitting.current&&!conversationBusy()&&!draftLabels().length)return;
      event.preventDefault();event.returnValue="";
    };
    window.addEventListener("beforeunload",beforeUnload);
    return()=>window.removeEventListener("beforeunload",beforeUnload);
  });

  function selectWithDraftCheck(change:SelectionChange) {
    if(busy||submitting.current||conversationBusy()){setMessage("Konuşma veya kayıt işlemi sürüyor. Sonucu bekleyin.");return;}
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
    if(busy||submitting.current||conversationBusy()){event.preventDefault();setMessage("İşlem sürüyor. Sayfadan ayrılmadan önce sonucu bekleyin.");return;}
    const labels=draftLabels();
    if(!labels.length)return;
    event.preventDefault();link.focus();
    setPendingSelection({action:{type:"link",href:link.getAttribute("href")!},labels});
  }

  const navigationGuard = useNavigationGuard();
  // Read the current DOM-backed forms and latest operation state at click time.
  useEffect(() => navigationGuard.register(navigateWithDraftCheck));

  const activeRequests=new Set(board.requests.filter(request=>request.lifecycle==="active").map(request=>request.id));
  const visibleAssignments=new Set(board.requests.flatMap(request=>request.assignments.map(assignment=>assignment.id)));
  const detachedDrafts:DetachedDraft[]=boardReady&&!loading?[
    ...Object.entries(assignmentDrafts).filter(([id])=>!activeRequests.has(id)).map(([id,draft])=>({kind:"assign" as const,id,label:`Personel atama · ${draft.label}`,value:draft.workerLabel,draft})),
    ...Object.entries(countDrafts).filter(([id])=>!activeRequests.has(id)).map(([id,draft])=>({kind:"resize" as const,id,label:`Kişi sayısı · ${draft.label}`,value:draft.value||"Boş alan",draft})),
    ...Object.entries(replacementDrafts).filter(([id])=>!visibleAssignments.has(id)).map(([id,draft])=>({kind:"replace" as const,id,label:`Personel değişimi · ${draft.label}`,value:draft.workerLabel,draft})),
  ]:[];
  async function discardDetachedDraft(){
    if(busy||submitting.current||loading||!boardReady)throw Error("Plan kontrol ediliyor. Sonucu bekleyin.");
    const target=discardDraft;
    if(!target||!detachedDrafts.some(row=>row.kind===target.kind&&row.id===target.id&&row.draft===target.draft))throw Error("Taslak veya kayıt değişti. Güncel planı kontrol edin; taslak bırakılmadı.");
    if(target.kind==="assign")setAssignmentDrafts(current=>{if(current[target.id]!==target.draft)return current;const next={...current};delete next[target.id];return next;});
    if(target.kind==="resize")setCountDrafts(current=>{if(current[target.id]!==target.draft)return current;const next={...current};delete next[target.id];return next;});
    if(target.kind==="replace")setReplacementDrafts(current=>{if(current[target.id]!==target.draft)return current;const next={...current};delete next[target.id];return next;});
    setMessage("Seçilen taslak bırakıldı. Talep ve atama kayıtları değişmedi.");
    requestAnimationFrame(()=>{(detachedPanel.current??companyInput.current)?.focus();});
  }
  const locationById=new Map(board.locations.map(location=>[location.id,location]));
  const workerNames=new Map(board.workers.map(worker=>[worker.id,worker.name]));
  const visibleRequestIds=new Set(board.requests.filter(request=>matchesDailyFocus(request,focus)&&matchesDailySearch(dailyRequestSearchText(request,locationById.get(request.locationId),workerNames),quickSearch)).map(request=>request.id));
  const hiddenDraftCount=board.requests.filter(request=>!visibleRequestIds.has(request.id)&&(assignmentDrafts[request.id]||countDrafts[request.id]||conversationDrafts.current.get(request.id)?.dirty||request.assignments.some(a=>replacementDrafts[a.id]))).length;
  const missingConversationDrafts=boardReady&&!loading?[...conversationDrafts.current].filter(([id,state])=>state.dirty&&!board.requests.some(request=>request.id===id)):[];
  const company=companies.find(c=>c.id===companyId);
  if(authLoading)return <p role="status">Oturum yükleniyor…</p>;
  if(!allowed)return <EmptyState title="Bu çalışma alanına erişiminiz yok" />;
  return <>
    {idpPeriod&&scope&&<IdpPeriodPanel scope={scope} periodId={idpPeriod} onClose={()=>{setIdpPeriod(null);syncPending();void refresh();}} onChanged={()=>{syncPending();void refresh();}}/>}
    {idpTarget&&scope&&<IdpContextPanel scope={scope} target={idpTarget} onBusy={setBusy} onClose={()=>setIdpTarget(null)} onSaved={()=>{setIdpTarget(null);setMessage('İDP bilgileri kaydedildi.');void refresh();}}/>}
    {workTarget&&scope&&<WorkApprovalDialog key={`${scope.actorId}:${scope.tenantId}:${workTarget.assignmentId}`} scope={scope} {...workTarget} manager={manager} onLock={setBusy} onClose={()=>{setWorkTarget(null);setWorkRefresh(n=>n+1);syncPending();}}/>}
    {outreachTarget&&scope&&<ReplacementOutreachDialog key={`${scope.actorId}:${scope.tenantId}:${outreachTarget.assignmentId}:${outreachTarget.workerId}`} scope={scope} {...outreachTarget} onLock={setBusy} onClose={()=>{setOutreachTarget(null);syncPending();}}/>}
    {discardDraft&&<ConfirmActionDialog title="Taslağı bırak" recordName={discardDraft.label} description={`Taslak değeri: ${discardDraft.value}. Yalnız bu kaydedilmemiş seçim bırakılacak; talep ve atama kayıtları değişmeyecek.`} confirmLabel="Bu taslağı bırak" destructive onClose={()=>setDiscardDraft(null)} onConfirm={discardDetachedDraft} />}
    {pendingSelection&&<ConfirmActionDialog title="Kaydedilmemiş değişiklikler"
      recordName={`${company?.name??"Firma"} · ${date}`}
      description={`${pendingSelection.labels.join(", ")} formundaki kaydedilmemiş bilgiler bırakılacak. ${pendingSelection.action.type==="selection"?"Seçtiğiniz firma ve gün için plan açılacak.":"Seçtiğiniz sayfa açılacak."}`}
      confirmLabel="Değişiklikleri bırak" destructive onClose={()=>setPendingSelection(null)}
      onConfirm={async()=>{if(busy||submitting.current||conversationBusy())throw Error("Konuşma veya kayıt işlemi sürüyor. Sonucu bekleyin.");const action=pendingSelection.action;if(action.type==="selection")onSelect(action.change);else router.push(action.href);}} />}
    <CancelRequestDialog target={cancelTarget} busy={busy} error={error} onClose={()=>{if(!busy)setCancelTarget(null);}} onConfirm={()=>{if(cancelTarget)void submit("cancel",{requestId:cancelTarget.id});}} />
    <PageHeader title="Günün operasyonu" subtitle="Şube ve otel ihtiyaçlarını, görevlendirilen personeli ve yoklamayı birlikte takip edin." />
    <nav aria-label="Operasyon ekranları" className="mb-4 flex flex-wrap items-start gap-2 rounded-xl bg-slate-100/70 p-2">
    <Link onClick={navigateWithDraftCheck} aria-disabled={busy||undefined} className="inline-flex min-h-11 shrink-0 items-center rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-blue-50 hover:text-blue-800" href={startBoardHref(date,companyId)??"/talepler/ise-baslama"}>İşe Başlama Takibi</Link>
      <details className="min-w-0 rounded-xl border border-slate-200 bg-white px-3">
        <summary className="flex min-h-11 cursor-pointer items-center text-sm font-medium text-slate-700 focus-visible:outline-2 focus-visible:outline-blue-600">Hazırlık, kontrol ve çıktılar</summary>
        <div className="flex flex-col border-t border-slate-100 py-1">
    <Link onClick={navigateWithDraftCheck} aria-disabled={busy||undefined} className="inline-flex min-h-11 shrink-0 items-center rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-blue-50 hover:text-blue-800" href={`/talepler/planlar?firma=${companyId}`}>Tekrarlayan haftalık planlar</Link>
    <Link onClick={navigateWithDraftCheck} aria-disabled={busy||undefined} className="inline-flex min-h-11 shrink-0 items-center rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-blue-50 hover:text-blue-800" href={`/talepler/dizin?firma=${companyId}`}>Şube ve personel kayıtları</Link>
    <Link onClick={navigateWithDraftCheck} aria-disabled={busy||undefined} className="inline-flex min-h-11 shrink-0 items-center rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-blue-50 hover:text-blue-800" href={`/talepler/kontrol?firma=${companyId}&gun=${date}`}>Operasyon kontrol listesi</Link>
    <Link onClick={navigateWithDraftCheck} aria-disabled={busy||undefined} className="inline-flex min-h-11 shrink-0 items-center rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-blue-50 hover:text-blue-800" href={`/talepler/haftalik?firma=${companyId}&gun=${date}`}>Haftalık plan ve çıktı</Link>
    <Link onClick={navigateWithDraftCheck} aria-disabled={busy||undefined} className="inline-flex min-h-11 shrink-0 items-center rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-blue-50 hover:text-blue-800" href={companyId?`/firmalar/${companyId}`:"/firmalar"}>{companyId?"Firma detayını aç":"Firmaları aç"}</Link>
        </div>
      </details>
    </nav>
    <fieldset disabled={busy} aria-label="Firma ve gün seçimi" className="mb-5 grid min-w-0 gap-4 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto] sm:p-5">
      <p className="text-sm font-semibold text-slate-900 sm:col-span-3">Çalışma planını seçin</p>
      <label className="min-w-0 text-sm font-medium">Firma<select ref={companyInput} aria-label="Firma" className={inputClass} value={companyId} onChange={e=>selectWithDraftCheck({companyId:e.target.value})}><option value="">Firma seçin</option>{companies.map(c=><option key={c.id} value={c.id}>{c.name}{c.active?"":" (operasyona kapalı)"}</option>)}</select></label>
      <label className="min-w-0 text-sm font-medium">İş günü<input ref={dateInput} className={inputClass} type="date" min="2000-01-01" max="2100-12-31" value={date} onChange={e=>selectWithDraftCheck({date:e.target.value})} /></label>
      <div className="flex items-end"><button className={buttonClass} onClick={()=>void refresh()} disabled={loading}>Yenile</button></div>
    </fieldset>
    {detachedDrafts.length>0&&<section ref={detachedPanel} tabIndex={-1} aria-label="Kaydı değişen taslaklar" className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 p-5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600">
      <h2 className="font-semibold">Kaydı değişen taslaklar</h2><p className="mt-2 text-sm text-slate-700">Bu taslakların düzenlendiği alan artık güncel planda görünmüyor. Taslağı bırakmak talep veya atamayı değiştirmez.</p>
      <ul className="mt-3 space-y-3">{detachedDrafts.map(row=><li key={`${row.kind}:${row.id}`} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-white p-3"><div className="min-w-0 flex-1 break-words"><p className="text-sm font-medium">{row.label}</p><p className="mt-1 text-sm text-slate-600">Taslak: {row.value}</p></div><button type="button" disabled={busy} className="min-h-11 rounded-lg border px-3 py-2 text-sm disabled:opacity-40" onClick={()=>setDiscardDraft(row)}>Taslağı bırak</button></li>)}</ul>
    </section>}
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
        for(const [assignmentId,draft] of Object.entries(replacementDrafts)){
          const digest=await commandDigest("replace",validatePilotPayload("replace",{assignmentId,workerId:draft.workerId,expectedRevision:draft.initialRevision}));
          if(settledDigests.includes(digest))setReplacementDrafts(current=>{
            if(current[assignmentId]!==draft)return current;
            const next={...current};delete next[assignmentId];return next;
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
    {missingConversationDrafts.length>0&&<section aria-label="Listeden çıkan taleplerin not taslakları" className="mb-4 space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-4"><h2 className="font-semibold">Not taslağı olan talep artık bu planda görünmüyor</h2><p className="text-sm">Taslak bu sayfanın belleğinde korunuyor. Metni seçip kopyalayabilirsiniz; bu ekrandan görünmeyen talebe yeni not gönderilmez. Talep yeniden listelenirse taslak geri yüklenir.</p>{missingConversationDrafts.map(([id,state])=><div key={id}><label className="block text-sm">Korunan not · {id}<textarea readOnly value={state.body} rows={3} className="mt-1 w-full rounded border bg-white p-2"/></label><p className="text-xs">{state.mentionIds.length} kişi etiketi{state.parentId?' · Yanıt hedefi korunuyor':''}{state.pending?' · Gönderim sonucu ayrıca doğrulanmalı':''}</p></div>)}</section>}
    <div ref={forms}>
    {!companyId?<EmptyState title={companies.length?"Planını görmek istediğiniz firmayı seçin":"Önce firma ekleyin"} description="Firma ve gün seçtiğinizde o güne ait talepleri ve görevlendirilen personeli görebilirsiniz." action={companies.length&&!busy?{label:"Firma seç",onClick:()=>companyInput.current?.focus()}:undefined} />:<>
      {!company?.active&&<p className="mb-4 text-amber-800">Bu firma yeni operasyona uygun değil. Firma durumunu kontrol edin. Mevcut atamalar kaldırılabilir.</p>}
      {boardReady&&!loading&&<section aria-label="Seçili firma ve gün özeti" className="mb-5">
        <dl className="grid grid-cols-2 xl:grid-cols-4 gap-3">{[
          ['Aktif talep',board.requests.filter(r=>r.lifecycle==='active').length],
          ['İstenen kişi',board.requests.filter(r=>r.lifecycle==='active').reduce((n,r)=>n+r.requiredCount,0)],
          ['Atanan kişi',board.requests.filter(r=>r.lifecycle==='active').reduce((n,r)=>n+r.assignments.length,0)],
          ['Açık kişi',board.requests.filter(r=>r.lifecycle==='active').reduce((n,r)=>n+deriveDailyCoverage(r.requiredCount,r.assignments.length,r.lifecycle).open,0)],
        ].map(([label,value])=><div key={label} className="rounded-2xl border border-slate-200 bg-white p-4"><dt className="text-xs text-slate-500">{label}</dt><dd className="mt-2 text-2xl font-semibold tabular-nums text-slate-900">{value}</dd></div>)}</dl>
        <p className="mt-2 text-xs text-slate-500">Seçili firma ve günün aktif talepleri. Sayılar atama ve ihtiyaç toplamıdır; aynı kişi farklı vardiyalarda ayrı sayılır. Atama, işe başlama teyidi değildir.</p>
      </section>}
      {boardReady&&!loading&&<section aria-label="Operasyon filtreleri" className="mb-4 space-y-3 rounded-2xl border border-slate-200 bg-white p-4"><h2 className="text-sm font-semibold text-slate-900">Taleplerde ara</h2><div className="contents">
        <div className="flex flex-wrap gap-2">{(Object.keys(DAILY_FOCUS_LABELS) as DailyFocus[]).map(value=><button type="button" key={value} aria-pressed={focus===value} onClick={()=>setFocus(value)} className={`min-h-11 rounded-xl border px-3 py-2 text-sm font-medium ${focus===value?'border-blue-700 bg-blue-700 text-white':'border-slate-200 text-slate-700 hover:bg-slate-50'}`}>{DAILY_FOCUS_LABELS[value]} <span className="ml-1 tabular-nums">{board.requests.filter(request=>matchesDailyFocus(request,value)).length}</span></button>)}</div>
        <label className="block text-sm font-medium">Şube, otel veya personel ara<input type="search" value={quickSearch} onChange={e=>setQuickSearch(e.target.value)} className={`${inputClass} mt-1`} placeholder="Şube, il, meslek veya personel adı" /></label>
        <div className="flex flex-wrap items-center justify-between gap-2"><p role="status" className="text-sm text-slate-600">{visibleRequestIds.size} / {board.requests.length} talep gösteriliyor{hiddenDraftCount>0?` · ${hiddenDraftCount} gizli talepte taslağınız korunuyor`:''}</p>{(focus!=='all'||quickSearch)&&<button type="button" className="min-h-11 text-sm font-medium text-blue-700 underline" onClick={()=>{setFocus('all');setQuickSearch('');}}>Filtreleri temizle</button>}</div>
        {visibleRequestIds.size===0&&board.requests.length>0&&<p className="text-sm text-slate-600">Bu seçimle eşleşen talep yok. Diğer talepleri görmek için filtreleri temizleyin.</p>}
      </div></section>}
      {manager&&<details className="mb-5 rounded-2xl border border-slate-200 bg-white p-5"><summary className="cursor-pointer text-sm font-semibold text-slate-700">Şube ve personel hazırlığı</summary><div className="mt-4">
      {manager&&<LocationImport onNavigate={navigateWithDraftCheck} dirtyRef={importDirty} reconcileRef={importRecovery} key={`${scope?.actorId}:${scope?.tenantId}:${companyId}`} scope={scope} companyId={companyId} disabled={busy||!writeReady||!company?.active} onBusy={setBusy} onComplete={refresh} onPendingChange={syncPending} />}
      {manager&&<div className="mb-5 grid gap-4 lg:grid-cols-2">
        <details className="rounded-xl border bg-white p-4"><summary className="cursor-pointer font-medium">Lokasyon ekle</summary><form ref={locationForm} aria-label="Lokasyon hazırlık formu" className="mt-3 space-y-3" onSubmit={e=>{e.preventDefault();const f=e.currentTarget,d=new FormData(f);void submit("location",{companyId,name:String(d.get("name")),city:String(d.get("city"))},f);}}><fieldset disabled={busy||!writeReady||!company?.active} className="space-y-3"><label className="block text-sm">Şube / bina adı<input name="name" className={inputClass} maxLength={160} required /></label><label className="block text-sm">İl<input name="city" className={inputClass} maxLength={80} required /></label><button className={buttonClass}>Lokasyonu kaydet</button></fieldset></form></details>
        <details className="rounded-xl border bg-white p-4"><summary className="cursor-pointer font-medium">Personel ekle</summary><form ref={workerForm} aria-label="Personel hazırlık formu" className="mt-3 space-y-3" onSubmit={e=>{e.preventDefault();const f=e.currentTarget,d=new FormData(f);void submit("worker",{name:String(d.get("name")),code:String(d.get("code")),kind:String(d.get("kind"))},f);}}><fieldset disabled={busy||!writeReady} className="space-y-3"><label className="block text-sm">Ad soyad<input name="name" className={inputClass} maxLength={160} required /></label><label className="block text-sm">Personel kodu<input name="code" className={inputClass} maxLength={40} required /></label><label className="block text-sm">Tür<select name="kind" className={inputClass}><option value="idp">İDP</option><option value="sabit">Sabit</option></select></label><button className={buttonClass}>Personeli kaydet</button></fieldset></form></details>
      </div>}
      </div></details>}
      <RequestBatch onNavigate={navigateWithDraftCheck} navigationBusy={busy} dirtyRef={batchDirty} reconcileRef={batchRecovery} key={`${scope?.actorId}:${scope?.tenantId}:${companyId}:${date}`} companyId={companyId} date={date} locations={board.locations} scope={scope} disabled={busy||!writeReady||loading||!boardReady||!company?.active} onBusy={setBusy} onComplete={refresh} onPendingChange={syncPending} />
      <details className="mb-5 rounded-2xl border border-slate-200 bg-white p-4"><summary className="flex min-h-11 cursor-pointer items-center font-semibold text-blue-700 focus-visible:outline-2 focus-visible:outline-blue-600">Yeni günlük talep oluştur</summary><form ref={requestForm} aria-label="Günlük talep formu" onSubmit={e=>{e.preventDefault();const f=e.currentTarget,d=new FormData(f);void submit("request",{companyId,locationId:String(d.get("locationId")),workDate:date,serviceLine:String(d.get("serviceLine")),position:String(d.get("position")),requiredCount:Number(d.get("requiredCount"))},f);}}><fieldset disabled={busy||!writeReady||loading||!boardReady||!company?.active} className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><label className="text-sm">Lokasyon<select className={inputClass} name="locationId" required defaultValue=""><option value="" disabled>Lokasyon seçin</option>{board.locations.filter(l=>l.active).map(l=><option key={l.id} value={l.id}>{l.name} · {l.city}</option>)}</select></label><label className="text-sm">Hizmet hattı<input name="serviceLine" className={inputClass} defaultValue="Temizlik" maxLength={80} required /></label><label className="text-sm">Pozisyon<input name="position" className={inputClass} defaultValue="Temizlik görevlisi" maxLength={80} required /></label><label className="text-sm">Kişi sayısı<input name="requiredCount" className={inputClass} type="number" defaultValue={1} min={1} max={100} required /></label><button className={buttonClass}>Talebi kaydet</button></fieldset></form></details>
      {process.env.NEXT_PUBLIC_BPS_WORK_APPROVAL_ENABLED==="true"&&scope&&boardReady&&<WorkApprovalQueue refreshToken={workRefresh} scope={scope} companyId={companyId} workDate={date} disabled={busy||!writeReady} onOpen={setWorkTarget}/>}
      <section aria-busy={loading} className="space-y-3"><h2 className="text-lg font-semibold tracking-tight">{date.split("-").reverse().join(".")} · Talepler</h2>{loading?<p role="status">Plan yükleniyor…</p>:!boardReady?<p role="status">Plan doğrulanamadı. Bağlantı düzeldikten sonra Yenile düğmesini kullanın.</p>:!board.requests.length?<EmptyState title="Bu firma için seçilen günde talep yok" description="Başka bir çalışma gününe bakabilir veya bu günün personel ihtiyacını ekleyebilirsiniz." action={!busy&&writeReady&&company?.active?{label:"Günlük talep oluştur",onClick:()=>{const form=requestForm.current;const details=form?.closest('details');if(details)details.open=true;form?.querySelector<HTMLSelectElement>('select[name="locationId"]')?.focus();}}:undefined} size="tab" />:null}<fieldset hidden={loading||!boardReady} disabled={loading||!boardReady} className="min-w-0 space-y-3 border-0 p-0">{board.requests.map(r=>{
        const requestWorkers=workersForRequest(board,r);
        const coverage=deriveDailyCoverage(r.requiredCount,r.assignments.length,r.lifecycle);
        const location=locationById.get(r.locationId);
        const progress=requestProgress(r);
        const cardLabel=`${location?.name??"Lokasyon"} · ${r.position}`;
        const assignmentDraft=assignmentDrafts[r.id],selectedWorker=requestWorkers.find(w=>w.id===assignmentDraft?.workerId);
        const unavailableWorker=assignmentDraft?(!selectedWorker?"Seçilen personel artık listede yok.":!selectedWorker.active?"Seçilen personel pasif durumda.":selectedWorker.booked?"Seçilen personel bu saat aralığında uygun değil.":""):"";
        const returnedWorker=scope?.tenantId===search.get('sirket')&&search.get('talep')===r.id&&search.get('gun')===date&&search.get('firma')===companyId?requestWorkers.find(w=>w.id===search.get('personel')):undefined;
        const canAssign=!!assignmentDraft&&!!selectedWorker?.active&&!selectedWorker.booked;

        return <article hidden={!visibleRequestIds.has(r.id)} id={`talep-${r.id}`} key={r.id} className={`scroll-mt-24 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ${search.get("talep")===r.id?"ring-2 ring-slate-700":""}`}><div className="flex flex-wrap justify-between gap-2"><div><h3 className="font-semibold">{location?.name??"Lokasyon"} · {r.position}</h3><p className="text-sm text-slate-600">{r.serviceLine} · {r.requiredCount} kişi gerekli · {r.assignments.length} atandı</p>{board.shiftVersion===1&&<p className="mt-1 text-sm font-medium">{shiftLabel(r)}</p>}{r.meetingNote&&<p className="mt-1 text-sm text-slate-600">Servis / buluşma: {r.meetingNote}</p>}</div><span className="text-sm font-medium">{r.lifecycle==="cancelled"?"İptal":coverage.open?`${coverage.open} kişi eksik`:"Atamalar tamam"}</span></div>
          {r.lifecycle==="active"&&<div className="mt-3 flex flex-wrap gap-2 text-xs"><span className="rounded-full bg-emerald-50 px-3 py-1.5 text-emerald-800">{progress.present} geldi</span><span className="rounded-full bg-slate-100 px-3 py-1.5 text-slate-700">{progress.unreported} yoklama bekliyor</span>{progress.absent>0&&<span className="rounded-full bg-red-50 px-3 py-1.5 text-red-800">{progress.absent} gelmedi</span>}</div>}
          {r.lifecycle==="active"&&<form data-recovery-draft="card" aria-label={`Kişi sayısı · ${cardLabel}`} key={`${r.id}:${r.requiredCount}:${formEpoch}`} className="mt-3 flex flex-wrap items-end gap-2" onSubmit={e=>{e.preventDefault();const d=new FormData(e.currentTarget);void submit("resize",{requestId:r.id,expectedCount:countDrafts[r.id]?.initial??r.requiredCount,requiredCount:Number(d.get("requiredCount"))});}}><label className="text-sm">Yeni kişi sayısı<input className={inputClass} name="requiredCount" type="number" min={Math.max(1,r.assignments.length)} max={100} value={countDrafts[r.id]?.value??String(r.requiredCount)} onChange={e=>{const value=e.target.value;setCountDrafts(previous=>{const next={...previous},initial=previous[r.id]?.initial??r.requiredCount;if(value===String(initial)&&initial===r.requiredCount)delete next[r.id];else next[r.id]={value,initial,label:cardLabel};return next;});}} required disabled={busy||!writeReady||!company?.active} /></label><button className={buttonClass} disabled={busy||!writeReady||!company?.active}>İhtiyacı güncelle</button>{countDrafts[r.id]&&countDrafts[r.id].initial!==r.requiredCount&&<p className="basis-full text-sm text-amber-800">Güncel ihtiyaç {r.requiredCount} kişi. Taslağınız korunuyor. <button type="button" className="underline disabled:opacity-40" disabled={busy} onClick={()=>setCountDrafts(previous=>{const next={...previous};delete next[r.id];return next;})}>Güncel sayıya dön</button></p>}</form>}
          {r.lifecycle==="active"&&company?.active&&<Link onClick={navigateWithDraftCheck} aria-disabled={busy||undefined} className="mt-3 inline-flex min-h-11 items-center text-sm underline" href={taskPrefillHref({companyId,requestId:r.id,date:r.workDate})}>Takip görevi hazırla</Link>}
          {r.idp&&<div className="mt-3 rounded-xl border border-violet-200 bg-violet-50 p-3 text-sm"><p className="font-semibold">İDP · {r.idp.original_name} yerine</p><p>İzin: {r.idp.leave_start} – {r.idp.leave_end}</p><p className="mt-1">Bugün yerine görevlendirilen: {r.assignments.length?r.assignments.map(a=>workerNames.get(a.workerId)??'Personel').join(', '):'Henüz atanmadı'}</p></div>}
          {r.idp?.period_id&&scope&&<button type="button" disabled={busy} className="mt-2 min-h-11 text-sm text-violet-700 underline" onClick={()=>setIdpPeriod(r.idp!.period_id!)}>İDP dönemini gör</button>}
          {!r.shift&&!r.idp?.period_id&&r.lifecycle==='active'&&r.requiredCount===1&&company?.active&&scope&&<button type="button" className="mt-2 min-h-11 text-sm text-violet-700 underline" disabled={busy||!writeReady} onClick={()=>setIdpTarget({requestId:r.id,day:r.workDate,label:cardLabel,initial:r.idp??null})}>{r.idp?'İDP bilgisini düzenle':'İzin yerine görevlendirme (İDP)'}</button>}
          {r.lifecycle==='active'&&coverage.open>0&&company?.active&&scope&&<div className="mt-3 rounded-xl border border-blue-100 bg-blue-50 p-3"><Link onClick={navigateWithDraftCheck} aria-disabled={busy||undefined} className="inline-flex min-h-11 items-center font-medium text-blue-700 underline" href={poolPlacementHref({tenantId:scope.tenantId,companyId,requestId:r.id,day:r.workDate,skill:r.position})}>Havuzdan personel bul</Link>{returnedWorker&&<div className="mt-2"><p className="text-sm">Havuzdan seçilen: {returnedWorker.name}</p><button type="button" className={buttonClass} disabled={busy||!writeReady||!returnedWorker.active||returnedWorker.booked||!!assignmentDraft} onClick={()=>setAssignmentDrafts(previous=>({...previous,[r.id]:{workerId:returnedWorker.id,workerLabel:returnedWorker.name,label:cardLabel}}))}>Atama formuna al</button>{(!returnedWorker.active||returnedWorker.booked)&&<p className="text-sm text-amber-900">Personel pasif veya seçilen günde atanmış. Başka personel seçin.</p>}<p className="text-xs text-slate-600">Kesin atama için aşağıdaki formu onaylayın.</p></div>}</div>}
          {r.assignments.length>0&&<p className="mt-3 text-xs text-slate-500">Personelin işe gelip gelmediğini kaydedin. Çalıştığı saatleri “Çalışma onayı” bölümünde ayrıca girin.</p>}
          <ul className="my-3 space-y-3">{r.assignments.map(a=>{
            const report=r.attendance.find(x=>x.id===a.id)!;
            const trackingHref=startTrackingHref(r.workDate,workerNames.get(a.workerId)??"",companyId);
            const replacementDraft=replacementDrafts[a.id],candidate=requestWorkers.find(w=>w.id===replacementDraft?.workerId);
            const replacementLabel=`${cardLabel} · ${board.workers.find(w=>w.id===a.workerId)?.name??"Personel"}`;
            const replacements=replacementOptions(requestWorkers,a.workerId,replacementSearch[a.id]??"",replacementDraft?.workerId);
            const candidateAvailable=!!candidate?.active&&!candidate.booked&&candidate.id!==a.workerId;
            const changedRevision=!!replacementDraft&&replacementDraft.initialRevision!==report.revision;
            const replacementIssue=report.status==="present"?"Personelin yoklaması “Geldi” olarak kaydedilmiş. Yanlışsa önce yoklamayı düzeltin.":changedRevision?"Atama bilgisi değişti. Seçimi temizleyip güncel kayıtla yeniden değerlendirin.":replacementDraft&&!candidateAvailable?"Seçilen personel artık bu değişime uygun değil. Başka personel seçin veya seçimi temizleyin.":"";
            const canReplace=!!replacementDraft&&candidateAvailable&&!changedRevision&&report.status!=="present";
            const clearReplacement=()=>setReplacementDrafts(previous=>{const next={...previous};delete next[a.id];return next;});

            return <li className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 text-sm" key={a.id}>
              <p className="mb-3 font-semibold">{workerNames.get(a.workerId)??"Personel"}</p>
              <AttendanceControls record={report} workerName={workerNames.get(a.workerId)??"Personel"} future={r.workDate>today()} disabled={busy||!writeReady} onRecord={(record,status)=>void submit("attendance",{assignmentId:record.id,expectedRevision:record.revision,status})} />
              {process.env.NEXT_PUBLIC_BPS_WORK_APPROVAL_ENABLED==="true"&&scope&&<button type="button" className="mt-2 min-h-11 rounded-lg border border-slate-300 px-3 py-2 text-sm" disabled={busy||!writeReady} onClick={()=>setWorkTarget({assignmentId:a.id,workerName:workerNames.get(a.workerId)??"Personel",workDate:r.workDate})}>Çalışma kaydı ve onay</button>}
              {trackingHref&&<Link onClick={navigateWithDraftCheck} aria-disabled={busy||undefined} className="mt-2 inline-flex min-h-11 items-center rounded-lg px-3 py-2 text-sm font-medium text-blue-700 underline" href={trackingHref}>Arama ve işe başlama teyidi</Link>}
              <details className="mt-2" open={!!replacementDraft}><summary className="min-h-11 cursor-pointer py-3 text-xs text-slate-600 underline">Personeli değiştir / atamayı kaldır</summary>
                {report.status!=="present"&&<form data-recovery-draft="card" aria-label={`Personel değişimi · ${replacementLabel}`} className="mt-2 flex flex-wrap items-end gap-2" onSubmit={e=>{e.preventDefault();if(!canReplace){setError(replacementIssue||"Yerine atanacak personeli seçin.");return;}void submit("replace",{assignmentId:a.id,workerId:replacementDraft.workerId,expectedRevision:replacementDraft.initialRevision});}}>
                  <label className="basis-full">Yedek personel ara<input className={inputClass} type="search" placeholder="Ad veya personel kodu" value={replacementSearch[a.id]??""} onChange={e=>setReplacementSearch(previous=>({...previous,[a.id]:e.target.value}))} disabled={busy||!writeReady}/></label>
                  <p className="basis-full text-xs text-slate-600" role="status">{replacements.availableCount===0?"Bu talep için uygun aktif personel yok.":`${replacements.availableCount} boşta personel · ${replacements.matchCount} arama sonucu. Seçilmiş kişi aramadan bağımsız korunur.`}</p>
                  <label>Yerine atanacak personel<select className={inputClass} name="workerId" required value={replacementDraft?.workerId??""} onChange={e=>{const workerId=e.target.value;setReplacementDrafts(previous=>{const next={...previous};if(workerId)next[a.id]={workerId,workerLabel:board.workers.find(w=>w.id===workerId)?.name??"Seçilen personel",label:replacementLabel,initialRevision:previous[a.id]?.initialRevision??report.revision};else delete next[a.id];return next;});}} disabled={busy||!writeReady||!company?.active}><option value="" disabled>Personel seçin</option>{replacementDraft&&!candidateAvailable&&<option value={replacementDraft.workerId} disabled>{replacementDraft.workerLabel} · seçime uygun değil</option>}{replacements.options.map(w=><option key={w.id} value={w.id}>{w.name} · {w.code}</option>)}</select></label>
                  {process.env.NEXT_PUBLIC_BPS_REPLACEMENT_OUTREACH_ENABLED==="true"&&scope&&<button type="button" className="min-h-11 rounded-lg border border-slate-300 px-3 py-2" disabled={busy||!writeReady||!candidateAvailable} onClick={()=>{if(candidate)setOutreachTarget({assignmentId:a.id,workerId:candidate.id,workerName:candidate.name});}}>Yedek görüşmesini kaydet</button>}
                  <button className={buttonClass} disabled={busy||!writeReady||!company?.active||!canReplace}>Değişimi kaydet</button><p className="basis-full text-xs text-slate-600">Yeni atama kurulamazsa mevcut atama korunur. Eski bildirim tarihçede kalır.</p>
                </form>}
                {replacementIssue&&<p role="alert" className="mt-2 text-sm text-amber-800">{replacementIssue}</p>}
                <button type="button" disabled={busy||!writeReady} className="mt-3 min-h-11 px-3 py-2 text-xs text-red-700 underline disabled:opacity-40" onClick={()=>void submit("remove",{requestId:r.id,assignmentId:a.id})}>Atamayı kaldır</button>
                {replacementDraft&&<button type="button" className="mt-2 px-3 py-2 text-sm underline disabled:opacity-40" disabled={busy} onClick={clearReplacement}>Değişim seçimini temizle</button>}
              </details>
            </li>;
          })}</ul>
          {process.env.NEXT_PUBLIC_BPS_CONVERSATION_ENABLED==="true"&&<RequestConversation requestId={r.id} initialDraft={conversationDrafts.current.get(r.id)} onDraftStateChange={onConversationDraft} />}
          <AttendancePanel records={r.attendance.filter(record=>record.removed)} workers={board.workers} future={r.workDate>today()} disabled={busy||!writeReady} onRecord={(a,status)=>void submit("attendance",{assignmentId:a.id,expectedRevision:a.revision,status})} />
          {r.lifecycle==="active"&&<div className="flex flex-wrap items-end gap-3"><form data-recovery-draft="card" aria-label={`Personel atama · ${cardLabel}`} className="flex flex-wrap items-end gap-2" onSubmit={e=>{e.preventDefault();if(!canAssign){setError(unavailableWorker||"Atanacak personeli seçin.");return;}void submit("assign",{requestId:r.id,workerId:assignmentDraft.workerId});}}><label className="text-sm">Personel<select className={inputClass} name="workerId" required disabled={busy||!writeReady||!company?.active||coverage.open===0} value={assignmentDrafts[r.id]?.workerId??""} onChange={e=>{const workerId=e.target.value;setAssignmentDrafts(previous=>{const next={...previous};if(workerId)next[r.id]={workerId,label:cardLabel,workerLabel:board.workers.find(w=>w.id===workerId)?.name??"Seçilen personel"};else delete next[r.id];return next;});}}><option value="" disabled>Personel seçin</option>{assignmentDraft&&(!selectedWorker||!selectedWorker.active)&&<option value={assignmentDraft.workerId} disabled>{assignmentDraft.workerLabel} · seçime uygun değil</option>}{requestWorkers.filter(w=>w.active).map(w=><option disabled={w.booked} key={w.id} value={w.id}>{w.name} · {w.code}{w.booked?" (bu saatlerde uygun değil)":""}</option>)}</select></label><button className={buttonClass} disabled={busy||!writeReady||!company?.active||coverage.open===0||!canAssign}>Ata</button>{assignmentDrafts[r.id]&&<button type="button" className="px-3 py-2 text-sm underline disabled:opacity-40" disabled={busy} onClick={()=>setAssignmentDrafts(previous=>{const next={...previous};delete next[r.id];return next;})}>Seçimi temizle</button>}{unavailableWorker&&<p role="alert" className="basis-full text-sm text-amber-800">{unavailableWorker} Başka bir personel seçin veya seçimi temizleyin.</p>}</form><button className="px-3 py-2 text-sm text-red-700 underline disabled:opacity-40" disabled={busy||!writeReady} onClick={()=>{setError("");setCancelTarget({id:r.id,label:`${location?.name??"Lokasyon"} · ${r.position} · ${r.workDate}`});}}>Talebi iptal et</button></div>}
        </article>;
      })}</fieldset></section>
    </>}
    </div>
  </>;
}
