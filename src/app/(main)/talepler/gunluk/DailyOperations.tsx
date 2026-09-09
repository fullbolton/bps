"use client";
import { useCallback,useEffect,useRef,useState } from "react";
import Link from "next/link";
import AttendancePanel from "./AttendancePanel";
import RequestBatch from "./RequestBatch";
import PendingOperations from "./PendingOperations";
import LocationImport from "./LocationImport";
import CancelRequestDialog from "./CancelRequestDialog";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { PageHeader,EmptyState } from "@/components/ui";
import { isWorkDate,deriveDailyCoverage } from "@/lib/operations/daily-demand";
import type { PilotBoard,PilotCompany,PilotKind } from "@/lib/operations/pilot-types";
import { pilotBoardAction,pilotCommandAction,pilotCompaniesAction,pilotScopeAction } from "./actions";

import { isUuid,validatePilotPayload } from "@/lib/operations/pilot-validation";
import { taskPrefillHref } from "@/lib/operations/task-prefill";
import { reserveCommand,acknowledgeCommand,pendingCount,type CommandScope } from "@/lib/operations/pending-commands";

const inputClass="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm";
const buttonClass="rounded-lg bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-40";
const emptyBoard:PilotBoard={locations:[],workers:[],requests:[]};
const today=()=>new Intl.DateTimeFormat("sv-SE",{timeZone:"Europe/Istanbul"}).format(new Date());

export default function DailyOperations() {
  const {user,role,loading:authLoading}=useAuth(); const search=useSearchParams();
  const [companies,setCompanies]=useState<PilotCompany[]>([]);
  const [companyId,setCompanyId]=useState(search.get("firma")??"");
  const [date,setDate]=useState(()=>{const d=search.get("gun");return isWorkDate(d)&&d>="2000-01-01"&&d<="2100-12-31"?d:today();}); const [board,setBoard]=useState<PilotBoard>(emptyBoard);
  const [boardReady,setBoardReady]=useState(false);
  const [loading,setLoading]=useState(true); const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState(""); const [error,setError]=useState("");
  const [cancelTarget,setCancelTarget]=useState<{id:string;label:string}|null>(null);
  const requestSequence=useRef(0); const submitting=useRef(false);
  const forms=useRef<HTMLDivElement>(null);
  const [formEpoch,setFormEpoch]=useState(0);
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
  useEffect(()=>{
    if(authLoading||!allowed)return;
    let current=true;
    pilotCompaniesAction().then(result=>{
      if(!current)return;
      if(result.ok){setCompanies(result.data);setCompanyId(old=>result.data.some(c=>c.id===old)?old:result.data[0]?.id??"");}
      else setError(result.message);
    }).catch(()=>{if(current)setError("Firmalar yüklenemedi.");});
    return()=>{current=false;};
  },[authLoading,allowed,user?.id]);
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
      if(kind==="cancel")setCancelTarget(null);form?.reset();setMessage(saved);await refresh();
    }catch(e){setError(sent?"İşlemin sonucu alınamadı. Bu tarayıcıda aynı formu tekrar göndererek kontrol edebilirsiniz.":e instanceof Error?e.message:"İşlem kurtarma kaydı oluşturulamadı; kayıt gönderilmedi.");}
    finally{submitting.current=false;setBusy(false);}
  }

  const company=companies.find(c=>c.id===companyId);
  if(authLoading)return <p role="status">Oturum yükleniyor…</p>;
  if(!allowed)return <EmptyState title="Bu çalışma alanına erişiminiz yok" />;
  return <>
    <CancelRequestDialog target={cancelTarget} busy={busy} error={error} onClose={()=>{if(!busy)setCancelTarget(null);}} onConfirm={()=>{if(cancelTarget)void submit("cancel",{requestId:cancelTarget.id});}} />
    <PageHeader title="Günlük personel planı" subtitle="Şube ihtiyacını kaydedin, personeli atayın ve açıkları takip edin." />
    <Link className="mb-4 mr-5 inline-block text-sm underline" href={`/talepler/dizin?firma=${companyId}`}>Şube ve personel dizini</Link>
    <Link className="mb-4 mr-5 inline-block text-sm underline" href={`/talepler/ise-baslama?gun=${date}`}>İşe Başlama Takibi</Link>
    <Link className="mb-4 mr-5 inline-block text-sm underline" href={`/talepler/kontrol?firma=${companyId}&gun=${date}`}>Operasyon kontrol listesi</Link>
    <Link className="mb-4 mr-5 inline-block text-sm underline" href={`/talepler/haftalik?firma=${companyId}&gun=${date}`}>Haftalık plan ve çıktı</Link>
    <Link className="mb-4 inline-block text-sm underline" href={companyId?`/firmalar/${companyId}`:"/firmalar"}>Firma detayına dön</Link>
    <fieldset disabled={busy} className="mb-5 grid gap-3 rounded-xl border bg-white p-4 sm:grid-cols-3">
      <label className="text-sm">Firma<select className={inputClass} value={companyId} onChange={e=>{setCompanyId(e.target.value);setMessage("");}}><option value="">Firma seçin</option>{companies.map(c=><option key={c.id} value={c.id}>{c.name}{c.active?"":" (pasif)"}</option>)}</select></label>
      <label className="text-sm">İş günü<input className={inputClass} type="date" min="2000-01-01" max="2100-12-31" value={date} onChange={e=>{if(e.target.value)setDate(e.target.value);}} /></label>
      <div className="flex items-end"><button className={buttonClass} onClick={()=>void refresh()} disabled={loading}>Yenile</button></div>
    </fieldset>
    {recoveryError&&<p role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-red-800">{recoveryError}</p>}
    {scope&&<PendingOperations key={`${scope.actorId}:${scope.tenantId}`} scope={scope} count={pending} disabled={busy||!writeReady} onBusy={setBusy} onComplete={async settled=>{
      syncPending();
      if(settled){forms.current?.querySelectorAll("form").forEach(form=>form.reset());setFormEpoch(n=>n+1);setCancelTarget(null);setError("");setMessage("");await refresh();}
    }} />}
    {error&&<p role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-red-800">{error}</p>}
    {message&&<p role="status" className="mb-4 rounded-lg bg-emerald-50 p-3 text-emerald-800">{message}</p>}
    <div ref={forms}>
    {!companyId?<EmptyState title="Önce firma ekleyin" description="Günlük plan firma altında tutulur." />:<>
      {!company?.active&&<p className="mb-4 text-amber-800">Pasif firmaya yeni lokasyon, talep veya atama eklenemez. Mevcut atamalar kaldırılabilir.</p>}
      {manager&&<LocationImport key={`${scope?.actorId}:${scope?.tenantId}:${companyId}:${formEpoch}`} scope={scope} companyId={companyId} disabled={busy||!writeReady||!company?.active} onBusy={setBusy} onComplete={refresh} onPendingChange={syncPending} />}
      {manager&&<div className="mb-5 grid gap-4 lg:grid-cols-2">
        <details className="rounded-xl border bg-white p-4"><summary className="cursor-pointer font-medium">Lokasyon ekle</summary><form className="mt-3 space-y-3" onSubmit={e=>{e.preventDefault();const f=e.currentTarget,d=new FormData(f);void submit("location",{companyId,name:String(d.get("name")),city:String(d.get("city"))},f);}}><fieldset disabled={busy||!writeReady||!company?.active} className="space-y-3"><label className="block text-sm">Şube / bina adı<input name="name" className={inputClass} maxLength={160} required /></label><label className="block text-sm">İl<input name="city" className={inputClass} maxLength={80} required /></label><button className={buttonClass}>Lokasyonu kaydet</button></fieldset></form></details>
        <details className="rounded-xl border bg-white p-4"><summary className="cursor-pointer font-medium">Personel ekle</summary><form className="mt-3 space-y-3" onSubmit={e=>{e.preventDefault();const f=e.currentTarget,d=new FormData(f);void submit("worker",{name:String(d.get("name")),code:String(d.get("code")),kind:String(d.get("kind"))},f);}}><fieldset disabled={busy||!writeReady} className="space-y-3"><label className="block text-sm">Ad soyad<input name="name" className={inputClass} maxLength={160} required /></label><label className="block text-sm">Personel kodu<input name="code" className={inputClass} maxLength={40} required /></label><label className="block text-sm">Tür<select name="kind" className={inputClass}><option value="idp">İDP</option><option value="sabit">Sabit</option></select></label><button className={buttonClass}>Personeli kaydet</button></fieldset></form></details>
      </div>}
      <RequestBatch key={`${scope?.actorId}:${scope?.tenantId}:${companyId}:${date}:${formEpoch}`} companyId={companyId} date={date} locations={board.locations} scope={scope} disabled={busy||!writeReady||loading||!boardReady||!company?.active} onBusy={setBusy} onComplete={refresh} onPendingChange={syncPending} />
      <section className="mb-5 rounded-xl border bg-white p-4"><h2 className="font-semibold">Günlük talep aç</h2><form onSubmit={e=>{e.preventDefault();const f=e.currentTarget,d=new FormData(f);void submit("request",{companyId,locationId:String(d.get("locationId")),workDate:date,serviceLine:String(d.get("serviceLine")),position:String(d.get("position")),requiredCount:Number(d.get("requiredCount"))},f);}}><fieldset disabled={busy||!writeReady||loading||!boardReady||!company?.active} className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><label className="text-sm">Lokasyon<select className={inputClass} name="locationId" required defaultValue=""><option value="" disabled>Lokasyon seçin</option>{board.locations.filter(l=>l.active).map(l=><option key={l.id} value={l.id}>{l.name} · {l.city}</option>)}</select></label><label className="text-sm">Hizmet hattı<input name="serviceLine" className={inputClass} defaultValue="Temizlik" maxLength={80} required /></label><label className="text-sm">Pozisyon<input name="position" className={inputClass} defaultValue="Temizlik görevlisi" maxLength={80} required /></label><label className="text-sm">Kişi sayısı<input name="requiredCount" className={inputClass} type="number" defaultValue={1} min={1} max={100} required /></label><button className={buttonClass}>Talebi kaydet</button></fieldset></form></section>
      <section aria-busy={loading} className="space-y-3"><h2 className="font-semibold">{date} · Talepler</h2>{loading?<p role="status">Plan yükleniyor…</p>:!boardReady?<p role="status">Plan doğrulanamadı. Bağlantı düzeldikten sonra Yenile düğmesini kullanın.</p>:!board.requests.length?<EmptyState title="Bu gün için talep yok" size="tab" />:board.requests.map(r=>{
        const coverage=deriveDailyCoverage(r.requiredCount,r.assignments.length,r.lifecycle);
        const location=board.locations.find(l=>l.id===r.locationId);
        return <article id={`talep-${r.id}`} key={r.id} className={`scroll-mt-24 rounded-xl border bg-white p-4 ${search.get("talep")===r.id?"ring-2 ring-slate-700":""}`}><div className="flex flex-wrap justify-between gap-2"><div><h3 className="font-semibold">{location?.name??"Lokasyon"} · {r.position}</h3><p className="text-sm text-slate-600">{r.serviceLine} · {r.assignments.length}/{r.requiredCount} kişi</p></div><span className="text-sm font-medium">{r.lifecycle==="cancelled"?"İptal":coverage.open?`${coverage.open} kişi açık`:"Atandı"}</span></div>
          {r.lifecycle==="active"&&<form key={`${r.id}:${r.requiredCount}:${formEpoch}`} className="mt-3 flex flex-wrap items-end gap-2" onSubmit={e=>{e.preventDefault();const d=new FormData(e.currentTarget);void submit("resize",{requestId:r.id,expectedCount:r.requiredCount,requiredCount:Number(d.get("requiredCount"))});}}><label className="text-sm">Yeni kişi sayısı<input className={inputClass} name="requiredCount" type="number" min={Math.max(1,r.assignments.length)} max={100} defaultValue={r.requiredCount} required disabled={busy||!writeReady||!company?.active} /></label><button className={buttonClass} disabled={busy||!writeReady||!company?.active}>İhtiyacı güncelle</button></form>}
          {r.lifecycle==="active"&&company?.active&&<Link className="mt-3 inline-block text-sm underline" href={taskPrefillHref({companyId,requestId:r.id,date:r.workDate})}>Takip görevi hazırla</Link>}
          <ul className="my-3 space-y-3">{r.assignments.map(a=>{
            const report=r.attendance.find(x=>x.id===a.id)!;
            return <li className="rounded-lg border border-slate-200 p-3 text-sm" key={a.id}>
              <div className="flex flex-wrap items-center justify-between gap-2"><span>{board.workers.find(w=>w.id===a.workerId)?.name??"Personel"}</span><button disabled={busy||!writeReady} className="underline disabled:opacity-40" onClick={()=>void submit("remove",{requestId:r.id,assignmentId:a.id})}>Atamayı kaldır</button></div>
              <details className="mt-2"><summary className="cursor-pointer text-xs underline">Personeli değiştir</summary>
                {report.status==="present"?<p className="mt-2 text-xs">Geldi bildirimi var. Bildirim hatalıysa önce düzeltin.</p>:<form className="mt-2 flex flex-wrap items-end gap-2" onSubmit={e=>{e.preventDefault();const d=new FormData(e.currentTarget);void submit("replace",{assignmentId:a.id,workerId:String(d.get("workerId")),expectedRevision:report.revision});}}>
                  <label>Yerine atanacak personel<select className={inputClass} name="workerId" required defaultValue="" disabled={busy||!writeReady||!company?.active}><option value="" disabled>Personel seçin</option>{board.workers.filter(w=>w.active&&!w.booked&&w.id!==a.workerId).map(w=><option key={w.id} value={w.id}>{w.name} · {w.code}</option>)}</select></label>
                  <button className={buttonClass} disabled={busy||!writeReady||!company?.active}>Değişimi kaydet</button><p className="basis-full text-xs text-slate-600">Yeni atama kurulamazsa mevcut atama korunur. Eski bildirim tarihçede kalır.</p>
                </form>}
              </details>
            </li>;
          })}</ul>
          <AttendancePanel records={r.attendance} workers={board.workers} future={r.workDate>today()} disabled={busy||!writeReady} onRecord={(a,status)=>void submit("attendance",{assignmentId:a.id,expectedRevision:a.revision,status})} />
          {r.lifecycle==="active"&&<div className="flex flex-wrap items-end gap-3"><form className="flex flex-wrap items-end gap-2" onSubmit={e=>{e.preventDefault();const d=new FormData(e.currentTarget);void submit("assign",{requestId:r.id,workerId:String(d.get("workerId"))});}}><label className="text-sm">Personel<select className={inputClass} name="workerId" required disabled={busy||!writeReady||!company?.active||coverage.open===0} defaultValue=""><option value="" disabled>Personel seçin</option>{board.workers.filter(w=>w.active).map(w=><option disabled={w.booked} key={w.id} value={w.id}>{w.name} · {w.code}{w.booked?" (bu gün atanmış)":""}</option>)}</select></label><button className={buttonClass} disabled={busy||!writeReady||!company?.active||coverage.open===0}>Ata</button></form><button className="px-3 py-2 text-sm text-red-700 underline disabled:opacity-40" disabled={busy||!writeReady} onClick={()=>{setError("");setCancelTarget({id:r.id,label:`${location?.name??"Lokasyon"} · ${r.position} · ${r.workDate}`});}}>Talebi iptal et</button></div>}
        </article>;
      })}</section>
    </>}
    </div>
  </>;
}
