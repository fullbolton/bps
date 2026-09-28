"use client";
import { countedResult } from "@/lib/supabase/complete-result";
import { hasCompleteCompanyReferences } from "@/lib/supabase/company-references";
import { useIstanbulDay } from "@/components/ui/useIstanbulDay";

import {claimTaskAction} from "../gorevler/actions";
import Link from "next/link";
import {taskLinkHref} from "@/lib/task-link";
import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Building2,
  FileText,
  ListChecks,
  CalendarCheck,
  AlertTriangle,
  Megaphone,
  ArrowUpRight,
  CalendarDays,
  UserCheck,
  Clock,
  Trash2,
} from "lucide-react";
import {
  PageHeader,
  KPIStatCard,
  ContractExpiryCard,
  EmptyState,
  ModalShell,
} from "@/components/ui";
import AsyncSection from "@/components/ui/AsyncSection";
import {selectDashboardContracts, selectDashboardDocuments, selectDashboardDeadlines, selectDashboardCompanyNames, dashboardRemainingDays, type DashboardContract, type DashboardDocument, type DashboardDeadline} from '@/lib/supabase/dashboard-cards';
import type { ExpiringContract } from "@/components/ui/ContractExpiryCard";
import type { EvrakDurumu } from "@/types/ui";
import { clsx } from "clsx";
import { formatDateTR } from "@/lib/format-date";
import { useRole } from "@/context/RoleContext";
import {
  listRecentAnnouncements,
  ANNOUNCEMENT_MAX_LENGTH,
} from "@/lib/services/announcements";
import {
  createAnnouncementAction,
  deleteAnnouncementAction,
} from "./actions";
import {
  CRITICAL_DATE_TYPE_LABELS,
} from "@/lib/critical-date-types";
import type { AnnouncementRow } from "@/types/database.types";
import DailyOverview from "./DailyOverview";
import RecentActivities from "./RecentActivities";
import {
  SURFACE_PRIMARY,
  BORDER_DEFAULT,
  BORDER_SUBTLE,
  RADIUS_DEFAULT,
  TYPE_BODY,
  TYPE_CARD_TITLE,
  TYPE_CAPTION,
  TEXT_PRIMARY,
  TEXT_BODY,
  TEXT_MUTED,
  TEXT_LINK,
  TEXT_SECONDARY,
  RADIUS_SM,
} from "@/styles/tokens";

// Page-local helpers — same pattern as Firma Detay pilot
const CARD = `${SURFACE_PRIMARY} border ${BORDER_DEFAULT} ${RADIUS_DEFAULT} p-4`;
const CARD_LG = `${SURFACE_PRIMARY} border ${BORDER_DEFAULT} ${RADIUS_DEFAULT} p-5`;
const CARD_TITLE = `${TYPE_CARD_TITLE} ${TEXT_PRIMARY} mb-3`;
const CARD_TITLE_ICON = `${TYPE_CARD_TITLE} ${TEXT_PRIMARY} mb-3 flex items-center gap-1.5`;
const LIST_DIVIDER = `border-b ${BORDER_SUBTLE}`;

export default function DashboardClient({operationsEnabled}:{operationsEnabled:boolean}) {
  const { role } = useRole();
  // KPI top-row — real Supabase truth. Partner scope is enforced by RLS
  // on each underlying table; no application-level scoping added here.
  // Null = not yet loaded or query errored → render as honest "—".
  // 0 = real query returned empty → honest zero.
  const [kpis, setKpis] = useState<{
    toplamFirma: number | null;
    aktifSozlesme: number | null;
    bekleyenGorev: number | null;
    yaklasanRandevu: number | null;
  }>({
    toplamFirma: null,
    aktifSozlesme: null,
    bekleyenGorev: null,
    yaklasanRandevu: null,
  });

  // Signal cards paired with the KPIs above. Same RLS / partner-scope
  // behavior as the KPIs; shape mirrors the previous mock render shape
  // so the card layout stays byte-identical.
  // Kişi-merkezli daraltma: ham liste burada durur, gösterilen liste
  // aşağıdaki useMemo'da türetilir. Filtre slice'tan ÖNCE uygulanmalı —
  // sonra uygulansaydı "bana atanan" görünümü elde olandan az satır
  // gösterirdi.
  const [openTasks, setOpenTasks] = useState<
    Array<{
      id: string;
      baslik: string;
      firma: string;
      gecikme: boolean;
      assignedToUserId: string | null;
      assignedName: string | null;
      dueDate: string | null;
      revision: number;
    }>
  >([]);
  const [taskScope, setTaskScope] = useState<"mine" | "all" | "unassigned">("all");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [taskDay,setTaskDay]=useState<'all'|'today'|'overdue'>('all');
  const [taskTenant,setTaskTenant]=useState<string|null>(null);
  const [claiming,setClaiming]=useState<string|null>(null),[claimMessage,setClaimMessage]=useState('');
  const claimFlight=useRef(false);
  const todayKey=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Istanbul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const scopedTasks = useMemo(() => openTasks.filter(task =>
    (taskScope === "all" || (taskScope === "unassigned" ? task.assignedToUserId === null : !!currentUserId && task.assignedToUserId === currentUserId)) && (taskDay==='all'||(!!task.dueDate&&(taskDay==='today'?task.dueDate.slice(0,10)===todayKey:task.dueDate.slice(0,10)<todayKey)))
  ), [openTasks, taskScope, currentUserId, taskDay, todayKey]);
  const todayTasks = scopedTasks.slice(0, 8);
  // Yaklaşan Sözleşme Bitişleri — real contracts under RLS. Filter and
  // ordering mirror the visible mock semantic: active contracts with a
  // non-past end_date, sorted by soonest expiry, capped at the card's
  // existing maxItems cap. No new threshold is introduced.
  const [expiringContracts, setExpiringContracts] = useState<ExpiringContract[]>(
    [],
  );

  // Eksik / Süresi Dolan Evraklar — real documents under RLS. Filter
  // matches the prior mock exactly: any document whose status is not
  // "tam". The service derives date-based status at read time.
  const [eksikEvraklar, setEksikEvraklar] = useState<
    Array<{ id: string; evrak: string; firma: string; durum: EvrakDurumu }>
  >([]);

  // Kurumsal Kritik Tarihler — real `critical_dates` truth. Broad-read
  // under RLS (no firm scope, no partner scope). Filter mirrors the
  // prior mock: derived status "suresi_yaklsiyor" or "suresi_doldu",
  // capped at 4 rows (subset-view). Order follows the service's
  // deadline-ascending read so the most urgent items show first.
  const [criticalDates, setCriticalDates] = useState<DashboardDeadline[]>([]);

  // Duyurular — real `announcements` truth (Batch 10 Phase 2). Tenant-scoped
  // by RLS, newest first, capped at ANNOUNCEMENT_STRIP_LIMIT by the service.
  // One-directional: nothing here replies, reacts, or marks as read.
  const [announcements, setAnnouncements] = useState<AnnouncementRow[]>([]);

  const [signalsLoading, setSignalsLoading] = useState(true);

  // Per-section error flags. Replaces the previous silent
  // `catch(() => [])` / `error ? []` pattern that rendered reader
  // failures as healthy-empty. Each flag corresponds to one signal
  // card; the JSX renders an explicit "Veri yüklenemedi" branch when
  // its flag is set.
  const [signalErrors, setSignalErrors] = useState<{
    tasks: boolean;
    contracts: boolean;
    documents: boolean;
    criticalDates: boolean;
    announcements: boolean;
  }>({
    tasks: false,
    contracts: false,
    documents: false,
    criticalDates: false,
    announcements: false,
  });

  // Bumped by the "Tekrar dene" button in the error branch to re-fire
  // the data-loading useEffect without restructuring the fetch.
  const [refreshKey, setRefreshKey] = useState(0);

  // Duyuru compose/remove state. yonetici-only surfaces; the DB refuses
  // anyone else regardless of what the UI shows.
  const [announceOpen, setAnnounceOpen] = useState(false);
  const [announceText, setAnnounceText] = useState("");
  const [announceSaving, setAnnounceSaving] = useState(false);
  const [announceError, setAnnounceError] = useState<string | null>(null);

  const signalDay = useIstanbulDay();
  useEffect(() => {
    let cancelled = false;
    setSignalsLoading(true);
    // Service-reader error capture: the `.catch` arms below set these
    // outer flags so the useEffect body can build a single
    // setSignalErrors call after Promise.all settles.
    let contractsCatchError = false;
    let documentsCatchError = false;
    let criticalDatesCatchError = false;
    let announcementsCatchError = false;
    (async () => {
      const supabase = createClient();
      // Oturum sahibinin id'si — "bana atanan" daraltmasının anahtarı.
      // Çözülemezse currentUserId null kalır ve filtre yalnız atanmamış
      // görevleri gösterir; sessizce "hepsi"ne düşmez.
      const {
        data: { user: currentUser }, error: authError,
      } = await supabase.auth.getUser();
      if(authError||!currentUser)throw new Error("Dashboard session unavailable");
      if (!cancelled) {setCurrentUserId(currentUser?.id ?? null);setTaskTenant(currentUser?.app_metadata?.active_tenant??null);}
      const [
        companiesRes,
        contractsRes,
        tasksRes,
        appointmentsRes,
        allContractRows,
        allDocumentRows,
        allCriticalDateRows,
        recentAnnouncements,
      ] = await Promise.all([
        // Count only; names are fetched for the displayed references below.
        supabase
          .from("companies")
          .select("id", { count: "exact", head: true }),
        supabase
          .from("contracts")
          .select("id", { count: "exact", head: true })
          .eq("status", "aktif"),
        // tasks: exact count feeds the KPI; only a complete row set feeds
        // the task card. Same
        // filter as the KPI — status IN ('acik','devam_ediyor','gecikti').
        supabase
          .from("tasks")
          .select("id, title, company_id, status, due_date, assigned_to_user_id, assigned_to, revision", { count: "exact" })
          .in("status", ["acik", "devam_ediyor", "gecikti"]),
        supabase
          .from("appointments")
          .select("id", { count: "exact", head: true })
          .eq("status", "planlandi"),
        // Filter and cap on the server before transferring card rows.
        // Reader failures used to degrade silently to empty; now we
        // capture the failure so the JSX can show a real error state.
        selectDashboardContracts(supabase, signalDay).catch((err) => {
          console.error("[dashboard] contracts card:", err);
          contractsCatchError = true;
          return [] as DashboardContract[];
        }),
        // Calendar-derived document predicates are applied before the cap.
        selectDashboardDocuments(supabase, signalDay).catch((err) => {
          console.error("[dashboard] documents card:", err);
          documentsCatchError = true;
          return [] as DashboardDocument[];
        }),
        // Only the four earliest due/approaching dates are transferred.
        // Broad-read under RLS; reader failure surfaces as the
        // "Veri yüklenemedi" branch on the Kritik Tarihler card.
        selectDashboardDeadlines(supabase, signalDay).catch((err) => {
          console.error("[dashboard] critical dates card:", err);
          criticalDatesCatchError = true;
          return [] as DashboardDeadline[];
        }),
        // Duyurular — tenant-scoped under RLS, newest first. Same explicit
        // failure capture as the readers above: an unreadable strip must not
        // render as "no announcements".
        listRecentAnnouncements(supabase).catch((err) => {
          console.error("[dashboard] listRecentAnnouncements:", err);
          announcementsCatchError = true;
          return [] as AnnouncementRow[];
        }),
      ]);
      if (cancelled) return;

      const companiesResult=countedResult(companiesRes),tasksResult=countedResult(tasksRes);
      setKpis({
        toplamFirma: companiesResult.count,
        aktifSozlesme: countedResult(contractsRes).count,
        bekleyenGorev: tasksResult.count,
        yaklasanRandevu: countedResult(appointmentsRes).count,
      });

      // --- Signal-card derivations ---
      let companyNameById: Map<string,string>;
      try {
        companyNameById = await selectDashboardCompanyNames(supabase, [
          ...(tasksResult.rows ?? []), ...allContractRows, ...allDocumentRows,
        ].flatMap(row => row.company_id ? [row.company_id] : []));
      } catch { companyNameById = new Map(); }
      if (cancelled) return;
      const companyIds = new Set(companyNameById.keys());
      const linkedTasks = tasksResult.rows?.filter((task): task is typeof task & {company_id:string} => task.company_id !== null) ?? null;
      const tasksReady = linkedTasks !== null && (linkedTasks.length === 0 || hasCompleteCompanyReferences(linkedTasks, companyIds));
      const contractsReady = !contractsCatchError && hasCompleteCompanyReferences(allContractRows, companyIds);
      const documentsReady = !documentsCatchError && hasCompleteCompanyReferences(allDocumentRows, companyIds);

      // Bugünün Görevleri — mirrors the prior mock's sort exactly:
      // gecikti first, then devam_ediyor, then acik; within a status,
      // earlier due_date first; the visible task subset is capped at 8.
      const mappedTasks = !tasksReady
        ? []
        : [...(tasksResult.rows ?? [])]
            .sort((a, b) => {
              const weight = (s: string) =>
                s === "gecikti" ? 0 : s === "devam_ediyor" ? 1 : 2;
              const diff = weight(a.status) - weight(b.status);
              if (diff !== 0) return diff;
              const aTime = a.due_date
                ? new Date(a.due_date).getTime()
                : Number.MAX_SAFE_INTEGER;
              const bTime = b.due_date
                ? new Date(b.due_date).getTime()
                : Number.MAX_SAFE_INTEGER;
              return aTime - bTime;
            })
            .map((t) => ({
              id: t.id,
              baslik: t.title,
              firma: t.company_id ? companyNameById.get(t.company_id) ?? "—" : "Firma dışı görev",
              gecikme: t.status === "gecikti",
              assignedToUserId: t.assigned_to_user_id ?? null,
              assignedName: t.assigned_to ?? null,
              dueDate: t.due_date,
              revision:t.revision,
            }));

      // Yaklaşan Sözleşme Bitişleri — derive card rows. Only active
      // contracts with a non-past end_date qualify as "yaklaşan". Order
      // by soonest expiry; cap at the ContractExpiryCard default (5).
      const mappedExpiringContracts: ExpiringContract[] = allContractRows.map(row => ({
        id: row.id,
        sozlesmeAdi: row.name,
        firmaAdi: companyNameById.get(row.company_id) ?? "—",
        kalanGun: dashboardRemainingDays(row.end_date!, signalDay),
        durum: row.status,
      }));
      const mappedEksikEvraklar = allDocumentRows.map(row => ({
        id: row.id, evrak: row.name,
        firma: companyNameById.get(row.company_id) ?? "—", durum: row.status,
      }));

      setOpenTasks(mappedTasks);
      setExpiringContracts(contractsReady ? mappedExpiringContracts : []);
      setEksikEvraklar(documentsReady ? mappedEksikEvraklar : []);
      setCriticalDates(allCriticalDateRows);
      setAnnouncements(recentAnnouncements);
      // Surface per-section reader failures explicitly. Supabase
      // direct queries expose `.error` on the response object; service
      // readers were instrumented above with their `.catch` arm.
      setSignalErrors({
        tasks: !tasksReady,
        contracts: !contractsReady,
        documents: !documentsReady,
        criticalDates: criticalDatesCatchError,
        announcements: announcementsCatchError,
      });
    })().catch(() => {
      if(cancelled)return;
      // Transport/Auth/derivation exceptions must not leave an endless spinner or stale totals.
      setCurrentUserId(null);setTaskTenant(null);
      setKpis({toplamFirma:null,aktifSozlesme:null,bekleyenGorev:null,yaklasanRandevu:null});
      setOpenTasks([]);setExpiringContracts([]);setEksikEvraklar([]);setCriticalDates([]);setAnnouncements([]);
      setSignalErrors({tasks:true,contracts:true,documents:true,criticalDates:true,announcements:true});
    }).finally(() => {if(!cancelled)setSignalsLoading(false);});
    return () => {
      cancelled = true;
    };
  }, [refreshKey, signalDay]);

  // Single retry handler shared by every signal card's error branch.
  // Re-fires the load `useEffect` by bumping the dependency. Cheap and
  // consistent across cards; no per-card refetch wiring.
  const handleRetry = () => setRefreshKey((k) => k + 1);

  // --- Duyuru write handlers ------------------------------------------------
  // Both go through server actions: `announcements.tenant_id` is server-
  // resolved and can never come from a client payload. After a successful
  // write the existing refreshKey mechanism re-fires the load effect — no
  // separate refetch wiring, and the strip re-reads through RLS.

  async function handleCreateAnnouncement() {
    if (announceSaving) return;
    const body = announceText.trim();
    if (body.length === 0) {
      setAnnounceError("Duyuru metni bos olamaz.");
      return;
    }
    setAnnounceSaving(true);
    setAnnounceError(null);
    const result = await createAnnouncementAction({ body });
    setAnnounceSaving(false);
    if (!result.ok) {
      setAnnounceError(result.error);
      return;
    }
    setAnnounceText("");
    setAnnounceOpen(false);
    setRefreshKey((k) => k + 1);
  }

  async function handleDeleteAnnouncement(id: string) {
    const result = await deleteAnnouncementAction(id);
    if (!result.ok) {
      console.error("[dashboard] deleteAnnouncementAction:", result.error);
      return;
    }
    setRefreshKey((k) => k + 1);
  }

  return (
    <>
      <PageHeader
        title="Genel Bakış"
        subtitle="İş planınız, bekleyen işler ve ekip gündemi bir arada."
      />

      <div className="space-y-7">
        <section aria-label="Hızlı erişim" className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 text-slate-900">
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
            <div className="max-w-md">
              
              <h2 className="text-base font-semibold tracking-tight">Hızlı erişim</h2>
              <p className="mt-1 text-sm leading-6 text-slate-500">Plan, işe başlama takibi ve ekip işleri.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              {operationsEnabled && ["yonetici", "operasyon"].includes(role) && <>
                <a href="/talepler/gunluk" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700"><CalendarDays size={18}/>Günlük plan<ArrowUpRight size={16}/></a>
                <a href="/talepler/ise-baslama" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-medium hover:bg-slate-50"><UserCheck size={18}/>İşe başlama takibi<ArrowUpRight size={16}/></a>
              </>}
              {!['muhasebe','goruntuleyici'].includes(role) && <a href="/gorevler" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-medium hover:bg-slate-50"><ListChecks size={18}/>Görevler<ArrowUpRight size={16}/></a>}
              {role==='muhasebe' && <a href="/finansal-ozet" className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-white px-4 text-sm font-semibold text-slate-900">Finansal özet<ArrowUpRight size={16}/></a>}
              {role==='goruntuleyici' && <a href="/raporlar" className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-white px-4 text-sm font-semibold text-slate-900">Raporlar<ArrowUpRight size={16}/></a>}
            </div>
          </div>
        </section>
        {/* KPI Cards — filtered by role; görüntüleyici sees values but no nav to blocked pages */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          <KPIStatCard
            label="Toplam Firma"
            value={kpis.toplamFirma ?? "—"}
            icon={<Building2 size={18} />}
            href="/firmalar"
          />
          {!["ik", "muhasebe", "goruntuleyici"].includes(role) && (
            <KPIStatCard
              label="Aktif Sözleşme"
              value={kpis.aktifSozlesme ?? "—"}
              icon={<FileText size={18} />}
              href="/sozlesmeler"
            />
          )}
          {!["muhasebe", "goruntuleyici"].includes(role) && (
            <KPIStatCard
              label="Bekleyen Görev"
              value={kpis.bekleyenGorev ?? "—"}
              icon={<ListChecks size={18} />}
              href="/gorevler"
            />
          )}
          {!["ik", "muhasebe", "goruntuleyici"].includes(role) && (
            <KPIStatCard
              label="Yaklaşan Randevu"
              value={kpis.yaklasanRandevu ?? "—"}
              icon={<CalendarCheck size={18} />}
              href="/randevular"
            />
          )}
        </div>

        {operationsEnabled && <DailyOverview />}

        {!["muhasebe", "goruntuleyici"].includes(role) && <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-semibold text-slate-900">Takip masası</h2><p className="mt-1 text-sm text-slate-500">Bekleyen görevler, sözleşmeler ve evraklar.</p></div>{role === "yonetici" && <a href="/kurulum" className="text-sm text-blue-700 hover:underline">Çalışma alanı kurulumu →</a>}</div>}
        {/* Signal cards row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Bugünün Görevleri — hidden for muhasebe */}
          {!["muhasebe", "goruntuleyici"].includes(role) && <div className={CARD}>
            <div className="flex items-center justify-between gap-2">
              <h3 className={CARD_TITLE}>
                Açık işler ve sorumlular
              </h3>
              <Link href="/gorevler" className="inline-flex min-h-11 items-center text-sm text-blue-700 underline">Tüm görevler</Link>
            </div>
            <p className="mb-3 text-xs text-slate-500">Erişiminiz olan açık işler. Sorumlu adı, görevde kayıtlı atama bilgisidir.</p>
            <div className="mb-3 flex flex-wrap gap-2" aria-label="Görev kapsamı">
              {([{value:'all',label:'Ekip işleri'},{value:'mine',label:'Bendeki işler'},{value:'unassigned',label:'Atanmamış'}] as const).map(item=><button key={item.value} type="button" aria-pressed={taskScope===item.value} onClick={()=>setTaskScope(item.value)} className="min-h-11 rounded-lg border px-3 text-sm aria-pressed:border-blue-500 aria-pressed:bg-blue-50">{item.label}</button>)}
            </div>
            <label className="mb-3 block text-sm">Son tarih<select className="ml-2 min-h-11 rounded-lg border bg-white px-2" value={taskDay} onChange={e=>setTaskDay(e.target.value as typeof taskDay)}><option value="all">Tüm açık işler</option><option value="today">Bugün son tarihli</option><option value="overdue">Tarihi geçenler</option></select></label>
            {claimMessage&&<p role="status" className="mb-3 rounded-lg bg-blue-50 p-3 text-sm">{claimMessage}</p>}
            <AsyncSection
              isLoading={signalsLoading}
              hasError={signalErrors.tasks}
              isEmpty={todayTasks.length === 0}
              emptyText="Seçtiğiniz filtrelere uygun bekleyen görev yok."
              onRetry={handleRetry}
            >
              <div className="space-y-0">
                {todayTasks.map((task, idx) => (
                  <div
                    key={task.id}
                    className={clsx(
                      "flex items-start gap-2 py-2.5",
                      idx < todayTasks.length - 1 && LIST_DIVIDER
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <p className={`${TYPE_BODY} ${TEXT_BODY}`}>
                        <Link href={taskLinkHref(task.id)} className="inline-flex min-h-11 items-center text-blue-700 underline underline-offset-2">{task.baslik}</Link>
                        {task.gecikme && (
                          <span className={`ml-2 ${TYPE_CAPTION} text-red-600 font-medium`}>
                            Gecikmiş
                          </span>
                        )}
                      </p>
                      <p className={`${TYPE_CAPTION} ${TEXT_MUTED} mt-0.5`}>
                        {task.firma}
                      </p>
                      <p className="mt-1 text-sm text-slate-700">{task.assignedToUserId ? task.assignedName?.trim() || 'Sorumlu adı belirtilmemiş' : task.assignedName?.trim() ? `${task.assignedName} (eski kayıt; kullanıcı ataması yok)` : 'Henüz kimseye atanmadı'}</p>
                      <p className="mt-1 text-xs text-slate-500">{task.dueDate ? `Son tarih: ${formatDateTR(task.dueDate)}` : 'Tarih belirtilmemiş'}
                      </p>
                      {['yonetici','operasyon'].includes(role)&&!task.assignedToUserId&&task.assignedName===null&&<button type="button" disabled={!!claiming||signalsLoading||!currentUserId||!taskTenant} className="mt-2 min-h-11 rounded-lg border border-blue-200 px-3 text-sm font-medium text-blue-700 disabled:opacity-40" onClick={async()=>{
                        if(claimFlight.current||!currentUserId||!taskTenant)return;
                        claimFlight.current=true;setClaiming(task.id);setClaimMessage('');
                        try{const result=await claimTaskAction({id:task.id,revision:task.revision,actorId:currentUserId,tenantId:taskTenant});setClaimMessage(result.ok?'İş üzerinize alındı.':result.error);}
                        catch{setClaimMessage('İşlemin sonucu alınamadı. Tekrar üstlenmeden önce güncel listeyi kontrol edin.');}
                        finally{claimFlight.current=false;setClaiming(null);setRefreshKey(k=>k+1);}
                      }}>{claiming===task.id?'Kaydediliyor…':'İşi üstlen'}</button>}
                    </div>
                  </div>
                ))}
                {scopedTasks.length>8&&<p className="mt-3 text-xs text-slate-500">Yüklenen {scopedTasks.length} açık işin ilk 8 kaydı gösteriliyor. Tam liste için Tüm görevler’i açın.</p>}
              </div>
            </AsyncSection>
          </div>}

          {/* Yaklaşan Sözleşme Bitişleri — hidden for ik + muhasebe.
              Real contracts under RLS, filtered to active + not-past
              end_date. Loading state is honest: the component's own
              empty state would read as "no data" which is misleading
              during pre-load, so a wrapper card shows "Yükleniyor…"
              until the fetch resolves. */}
          {!["ik", "muhasebe", "goruntuleyici"].includes(role) && (
            signalsLoading || signalErrors.contracts ? (
              <div className={CARD}>
                <h3 className={CARD_TITLE}>Yaklaşan Sözleşme Bitişleri</h3>
                <AsyncSection
                  isLoading={signalsLoading}
                  hasError={signalErrors.contracts}
                  onRetry={handleRetry}
                >
                  {null}
                </AsyncSection>
              </div>
            ) : (
              <ContractExpiryCard
                contracts={expiringContracts}
                actionHref="/sozlesmeler"
              />
            )
          )}

          {/* Eksik / Süresi Dolan Evraklar — hidden for muhasebe.
              Real documents under RLS, filtered to status != "tam"
              (identical to the prior mock filter). */}
          {!["muhasebe", "goruntuleyici"].includes(role) && (
            <div className={CARD}>
              <div className="flex items-center justify-between mb-3">
                <h3 className={`${TYPE_CARD_TITLE} ${TEXT_PRIMARY}`}>
                  Eksik / Süresi Dolan Evraklar
                </h3>
                <a href="/evraklar" className={`${TYPE_CAPTION} ${TEXT_LINK} hover:underline`}>Tümünü Gör</a>
              </div>
              <AsyncSection
                isLoading={signalsLoading}
                hasError={signalErrors.documents}
                isEmpty={eksikEvraklar.length === 0}
                emptyText="Eksik evrak yok."
                onRetry={handleRetry}
              >
                <div className="space-y-0">
                  {eksikEvraklar.map((doc, idx) => (
                    <div
                      key={doc.id}
                      className={clsx(
                        "flex items-center justify-between py-2.5",
                        idx < eksikEvraklar.length - 1 && LIST_DIVIDER
                      )}
                    >
                      <div className="min-w-0">
                        <p className={`${TYPE_BODY} ${TEXT_BODY}`}>{doc.evrak}</p>
                        <p className={`${TYPE_CAPTION} ${TEXT_MUTED}`}>{doc.firma}</p>
                      </div>
                      <span className={`${TYPE_CAPTION} text-red-600 font-medium ml-3 flex-shrink-0`}>
                        {doc.durum === "eksik" ? "Eksik" : doc.durum === "suresi_doldu" ? "Süresi Doldu" : "Yaklaşıyor"}
                      </span>
                    </div>
                  ))}
                </div>
              </AsyncSection>
            </div>
          )}


        </div>

        {/* Kurumsal Kritik Tarihler — all roles. Real `critical_dates`
            truth (broad-read under RLS). Subset-view preserved: card
            renders only when approaching/overdue items exist post-load.
            While the fetch is in flight the card wrapper is shown with
            an honest "Yükleniyor…" state rather than mock-backed rows. */}
        {(() => {
          if (signalsLoading || signalErrors.criticalDates) {
            return (
              <div className={CARD}>
                <div className="flex items-center justify-between mb-3">
                  <h3 className={CARD_TITLE_ICON}>
                    <Clock size={14} className="text-amber-500" />
                    Kritik Tarihler
                  </h3>
                  <a href="/kurumsal-tarihler" className={`${TYPE_CAPTION} ${TEXT_LINK} hover:underline`}>Tümünü Gör</a>
                </div>
                <AsyncSection
                  isLoading={signalsLoading}
                  hasError={signalErrors.criticalDates}
                  onRetry={handleRetry}
                >
                  {null}
                </AsyncSection>
              </div>
            );
          }
          const kritikler = criticalDates;
          if (kritikler.length === 0) return null;
          return (
            <div className={CARD}>
              <div className="flex items-center justify-between mb-3">
                <h3 className={CARD_TITLE_ICON}>
                  <Clock size={14} className="text-amber-500" />
                  Kritik Tarihler
                </h3>
                <a href="/kurumsal-tarihler" className={`${TYPE_CAPTION} ${TEXT_LINK} hover:underline`}>Tümünü Gör</a>
              </div>
              <div className="space-y-0">
                {kritikler.map((r, idx) => {
                  const kalan = dashboardRemainingDays(r.deadline_date, signalDay);
                  return (
                    <div key={r.id} className={clsx("py-2.5", idx < kritikler.length - 1 && LIST_DIVIDER)}>
                      <div className="flex items-center justify-between">
                        <div className="min-w-0">
                          <p className={`${TYPE_BODY} ${TEXT_BODY}`}>{r.title}</p>
                          <p className={`${TYPE_CAPTION} ${TEXT_MUTED} mt-0.5`}>
                            {CRITICAL_DATE_TYPE_LABELS[r.date_type]}
                            {r.responsible ? ` · ${r.responsible}` : ""}
                          </p>
                        </div>
                        <span className={`${TYPE_CAPTION} font-medium flex-shrink-0 ml-3 ${kalan < 0 ? "text-red-600" : "text-amber-600"}`}>
                          {kalan < 0 ? `${Math.abs(kalan)} gün gecikmiş` : `${kalan} gün`}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {/* Duyurular — Batch 10 Phase 2 management-announcement strip on real
            `announcements` truth. One-directional by design: no reply, no
            reaction, no read-state. Compose/remove are yonetici-only here, and
            RLS refuses everyone else regardless of what this renders.

            Hidden for muhasebe — and that hiding lives ONLY here. RLS lets all
            six roles read announcements within the tenant (measured in prod,
            identical to critical_dates_select); muhasebe is filtered out at the
            UI because announcements are an operational signal and muhasebe is
            scoped to the financial surface. Product decision, not a security
            one: if it is ever reversed, this condition goes away and no policy
            changes. See ROLE_MATRIX.md for the layer-by-layer rule. */}
        {role !== "muhasebe" && (
          <div className={CARD}>
            <div className="flex items-center justify-between mb-3">
              <h3 className={`${TYPE_CAPTION} ${TEXT_SECONDARY} flex items-center gap-1.5`}>
                <Megaphone size={12} />
                Duyurular
              </h3>
              {role === "yonetici" && (
                <button
                  type="button"
                  onClick={() => { setAnnounceText(""); setAnnounceError(null); setAnnounceOpen(true); }}
                  className={`${TYPE_CAPTION} ${TEXT_LINK} hover:underline`}
                >
                  Duyuru Ekle
                </button>
              )}
            </div>
            <AsyncSection
              isLoading={signalsLoading}
              hasError={signalErrors.announcements}
              onRetry={handleRetry}
            >
              {announcements.length === 0 ? (
                <EmptyState title="Henüz duyuru yok." size="card" />
              ) : (
                <div className="space-y-0">
                  {announcements.map((a, idx) => (
                    <div
                      key={a.id}
                      className={clsx("py-2.5", idx < announcements.length - 1 && LIST_DIVIDER)}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className={`${TYPE_BODY} ${TEXT_BODY} whitespace-pre-wrap break-words`}>
                            {a.body}
                          </p>
                          {/* created_at is a timestamptz; formatDateTR only
                              parses YYYY-MM-DD, so the date part is sliced off
                              first. Passing the raw value would render a
                              mangled string without erroring. */}
                          <p className={`${TYPE_CAPTION} ${TEXT_MUTED} mt-0.5`}>
                            {formatDateTR(a.created_at.slice(0, 10))}
                          </p>
                        </div>
                        {role === "yonetici" && (
                          <button
                            type="button"
                            onClick={() => handleDeleteAnnouncement(a.id)}
                            aria-label="Duyuruyu kaldır"
                            title="Duyuruyu kaldır"
                            className={`${TEXT_MUTED} hover:text-red-600 flex-shrink-0 transition-colors`}
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </AsyncSection>
          </div>
        )}

        <RecentActivities />

      </div>

      {/* Duyuru compose modal — yonetici-only. Uses the shared ModalShell so
          Escape handling matches the rest of the app (topmost modal only). */}
      <ModalShell
        open={announceOpen}
        onClose={() => { if (!announceSaving) setAnnounceOpen(false); }}
        title="Yeni Duyuru"
        footer={
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setAnnounceOpen(false)}
              disabled={announceSaving}
              className={`${TYPE_BODY} ${TEXT_BODY} px-3 py-1.5 ${RADIUS_SM} hover:bg-slate-100 disabled:opacity-50`}
            >
              Vazgeç
            </button>
            <button
              type="button"
              onClick={handleCreateAnnouncement}
              disabled={announceSaving || announceText.trim().length === 0}
              className={`${TYPE_BODY} px-3 py-1.5 ${RADIUS_SM} bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50`}
            >
              {announceSaving ? "Kaydediliyor…" : "Yayınla"}
            </button>
          </div>
        }
      >
        <div className="space-y-2">
          <textarea
            value={announceText}
            onChange={(e) => setAnnounceText(e.target.value)}
            maxLength={ANNOUNCEMENT_MAX_LENGTH}
            rows={4}
            placeholder="Duyuru metni"
            className={`w-full border ${BORDER_DEFAULT} ${RADIUS_SM} px-3 py-2 ${TYPE_BODY} ${TEXT_BODY}`}
          />
          <div className="flex items-center justify-between">
            {/* Announcements cannot be edited after publishing — delete is the
                only correction path, so the cost of a typo is stated up front. */}
            <p className={`${TYPE_CAPTION} ${TEXT_MUTED}`}>
              Yayınlanan duyuru düzenlenemez, yalnızca kaldırılabilir.
            </p>
            <p className={`${TYPE_CAPTION} ${TEXT_MUTED}`}>
              {announceText.trim().length}/{ANNOUNCEMENT_MAX_LENGTH}
            </p>
          </div>
          {announceError && (
            <p className={`${TYPE_CAPTION} text-red-600`}>{announceError}</p>
          )}
        </div>
      </ModalShell>

    </>
  );
}
