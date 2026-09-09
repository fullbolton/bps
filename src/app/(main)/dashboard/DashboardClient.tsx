"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Building2,
  FileText,
  ListChecks,
  CalendarCheck,
  AlertTriangle,
  Megaphone,
  Eye,
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
import {
  listAllContracts,
  computeRemainingDays,
} from "@/lib/services/contracts";
import { listAllDocuments } from "@/lib/services/documents";
import type { ContractRow, DocumentRow } from "@/types/database.types";
import type { ExpiringContract } from "@/components/ui/ContractExpiryCard";
import type { EvrakDurumu } from "@/types/ui";
import { clsx } from "clsx";
import { formatDateTR } from "@/lib/format-date";
import { useRole } from "@/context/RoleContext";
import { listAllCriticalDates } from "@/lib/services/critical-dates";
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
  computeRemainingDays as computeDeadlineRemaining,
  deriveDeadlineStatus,
} from "@/lib/critical-date-types";
import type { CriticalDateRow, AnnouncementRow } from "@/types/database.types";
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
    }>
  >([]);
  const [taskScope, setTaskScope] = useState<"mine" | "all">("mine");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Varsayılan "bana atanan VEYA ATANMAMIŞ".
  //
  // Atanmamış olanlar bilerek dahil: `completeAppointment` handoff görevi
  // assignee YAZMIYOR (appointments.ts), yani sahipsiz görev üretiliyor.
  // Yalnız "bana atanan" filtrelenseydi o görevler HİÇ KİMSENİN ekranında
  // görünmezdi — WORKFLOW_RULES "sahipsiz iş yasağı" derken tam tersini
  // istiyor: sahipsiz iş gizlenmeli değil, görünür olmalı.
  const todayTasks = useMemo(() => {
    const scoped =
      taskScope === "all"
        ? openTasks
        : openTasks.filter(
            (t) =>
              t.assignedToUserId === null ||
              t.assignedToUserId === currentUserId,
          );
    return scoped.slice(0, 4);
  }, [openTasks, taskScope, currentUserId]);
  // Yaklaşan Sözleşme Bitişleri — real contracts under RLS. Filter and
  // ordering mirror the visible mock semantic: active contracts with a
  // non-past end_date, sorted by soonest expiry, capped at the card's
  // existing maxItems cap. No new threshold is introduced.
  const [expiringContracts, setExpiringContracts] = useState<ExpiringContract[]>(
    [],
  );

  // Eksik / Süresi Dolan Evraklar — real documents under RLS. Filter
  // matches the prior mock exactly: any document whose status is not
  // "tam". No new validity-date derivation.
  const [eksikEvraklar, setEksikEvraklar] = useState<
    Array<{ id: string; evrak: string; firma: string; durum: EvrakDurumu }>
  >([]);

  // Kurumsal Kritik Tarihler — real `critical_dates` truth. Broad-read
  // under RLS (no firm scope, no partner scope). Filter mirrors the
  // prior mock: derived status "suresi_yaklsiyor" or "suresi_doldu",
  // capped at 4 rows (subset-view). Order follows the service's
  // deadline-ascending read so the most urgent items show first.
  const [criticalDates, setCriticalDates] = useState<CriticalDateRow[]>([]);

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
        data: { user: currentUser },
      } = await supabase.auth.getUser();
      if (!cancelled) setCurrentUserId(currentUser?.id ?? null);
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
        // Shared company count and name lookup for the signal cards.
        supabase
          .from("companies")
          .select("id, name, legacy_mock_id"),
        supabase
          .from("contracts")
          .select("id", { count: "exact", head: true })
          .eq("status", "aktif"),
        // tasks: full rows feed both the Bekleyen Görev KPI (count via
        // data.length) and the Bugünün Görevleri signal card. Same
        // filter as the KPI — status IN ('acik','devam_ediyor','gecikti').
        supabase
          .from("tasks")
          .select("id, title, company_id, status, due_date, assigned_to_user_id")
          .in("status", ["acik", "devam_ediyor", "gecikti"]),
        supabase
          .from("appointments")
          .select("id", { count: "exact", head: true })
          .eq("status", "planlandi"),
        // Yaklaşan Sözleşme Bitişleri — reuse existing service reader.
        // Reader failures used to degrade silently to empty; now we
        // capture the failure so the JSX can show a real error state.
        listAllContracts(supabase).catch((err) => {
          console.error("[dashboard] listAllContracts:", err);
          contractsCatchError = true;
          return [] as ContractRow[];
        }),
        // Eksik / Süresi Dolan Evraklar — reuse existing service reader.
        listAllDocuments(supabase).catch((err) => {
          console.error("[dashboard] listAllDocuments:", err);
          documentsCatchError = true;
          return [] as DocumentRow[];
        }),
        // Kurumsal Kritik Tarihler — reuse existing service reader.
        // Broad-read under RLS; reader failure surfaces as the
        // "Veri yüklenemedi" branch on the Kritik Tarihler card.
        listAllCriticalDates(supabase).catch((err) => {
          console.error("[dashboard] listAllCriticalDates:", err);
          criticalDatesCatchError = true;
          return [] as CriticalDateRow[];
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

      setKpis({
        toplamFirma: companiesRes.error ? null : companiesRes.data?.length ?? 0,
        aktifSozlesme: contractsRes.error ? null : contractsRes.count ?? 0,
        bekleyenGorev: tasksRes.error ? null : tasksRes.data?.length ?? 0,
        yaklasanRandevu: appointmentsRes.error ? null : appointmentsRes.count ?? 0,
      });

      // --- Signal-card derivations ---
      const companyNameById = new Map<string, string>();
      if (!companiesRes.error) {
        for (const c of companiesRes.data ?? []) {
          companyNameById.set(c.id, c.name);
        }
      }

      // Bugünün Görevleri — mirrors the prior mock's sort exactly:
      // gecikti first, then devam_ediyor, then acik; within a status,
      // earlier due_date first. Row cap preserved at 4.
      const mappedTasks = tasksRes.error
        ? []
        : [...(tasksRes.data ?? [])]
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
              firma: companyNameById.get(t.company_id) ?? "—",
              gecikme: t.status === "gecikti",
              assignedToUserId: t.assigned_to_user_id ?? null,
            }));

      // Yaklaşan Sözleşme Bitişleri — derive card rows. Only active
      // contracts with a non-past end_date qualify as "yaklaşan". Order
      // by soonest expiry; cap at the ContractExpiryCard default (5).
      const now = new Date();
      const mappedExpiringContracts: ExpiringContract[] = allContractRows
        .filter((c) => c.status === "aktif" && c.end_date !== null)
        .map((c) => ({
          row: c,
          kalanGun: computeRemainingDays(c.end_date, now),
        }))
        .filter(
          (x): x is { row: ContractRow; kalanGun: number } =>
            x.kalanGun !== null && x.kalanGun >= 0,
        )
        .sort((a, b) => a.kalanGun - b.kalanGun)
        .slice(0, 5)
        .map(({ row, kalanGun }) => ({
          id: row.id,
          sozlesmeAdi: row.name,
          firmaAdi: companyNameById.get(row.company_id) ?? "—",
          kalanGun,
          durum: row.status,
        }));

      // Eksik / Süresi Dolan Evraklar — filter out complete documents.
      // No new status semantics; preserves the prior mock's filter.
      const mappedEksikEvraklar = allDocumentRows
        .filter((d) => d.status !== "tam")
        .slice(0, 5)
        .map((d) => ({
          id: d.id,
          evrak: d.name,
          firma: companyNameById.get(d.company_id) ?? "—",
          durum: d.status,
        }));

      setOpenTasks(mappedTasks);
      setExpiringContracts(mappedExpiringContracts);
      setEksikEvraklar(mappedEksikEvraklar);
      setCriticalDates(allCriticalDateRows);
      setAnnouncements(recentAnnouncements);
      // Surface per-section reader failures explicitly. Supabase
      // direct queries expose `.error` on the response object; service
      // readers were instrumented above with their `.catch` arm.
      setSignalErrors({
        tasks: tasksRes.error !== null,
        contracts: contractsCatchError,
        documents: documentsCatchError,
        criticalDates: criticalDatesCatchError,
        announcements: announcementsCatchError,
      });
      setSignalsLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

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
        title="Dashboard"
        subtitle="Günlük operasyon ve takip"
      />

      {role === "yonetici" && <a href="/kurulum" className="mb-4 inline-block text-sm text-blue-700 hover:underline">Çalışma alanı kurulumu →</a>}
      <div className="space-y-6">
        {/* KPI Cards — filtered by role; görüntüleyici sees values but no nav to blocked pages */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
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

        {/* Signal cards row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Bugünün Görevleri — hidden for muhasebe */}
          {!["muhasebe", "goruntuleyici"].includes(role) && <div className={CARD}>
            <div className="flex items-center justify-between gap-2">
              <h3 className={CARD_TITLE}>
                Bugünün Görevleri
              </h3>
              {/* "Tümü" YALNIZ yonetici'de.
                  Rol modeli kilitlendiğinde `operasyon` "yalnız kendine
                  atanan görevler" olacak (Step 3, RLS yeniden-yazımı).
                  Bugün RLS operasyon'a hepsini gösteriyor, yani şimdi
                  konacak bir "Tümü" düğmesi Step 3'ten sonra AYNI KALIP
                  farklı sonuç döndürürdü — düğme değişmeden anlamı
                  değişirdi. Söz vermemek, sonra geri almaktan iyi. */}
              {role === "yonetici" && (
                <button
                  type="button"
                  onClick={() =>
                    setTaskScope((s) => (s === "mine" ? "all" : "mine"))
                  }
                  className={`${TYPE_CAPTION} ${TEXT_MUTED} hover:text-slate-700 underline underline-offset-2`}
                >
                  {taskScope === "mine" ? "Tümü" : "Bana atanan"}
                </button>
              )}
            </div>
            <AsyncSection
              isLoading={signalsLoading}
              hasError={signalErrors.tasks}
              isEmpty={todayTasks.length === 0}
              emptyText="Bugün için görev yok."
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
                        {task.baslik}
                        {task.gecikme && (
                          <span className={`ml-2 ${TYPE_CAPTION} text-red-600 font-medium`}>
                            Gecikmiş
                          </span>
                        )}
                      </p>
                      <p className={`${TYPE_CAPTION} ${TEXT_MUTED} mt-0.5`}>
                        {task.firma}
                      </p>
                    </div>
                  </div>
                ))}
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
          const kritikler = criticalDates
            .filter((r) => {
              const s = deriveDeadlineStatus(r.deadline_date);
              return s === "suresi_yaklsiyor" || s === "suresi_doldu";
            })
            .slice(0, 4);
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
                  const kalan = computeDeadlineRemaining(r.deadline_date);
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

        {/* Yönetici İnisiyatifleri — attention bookmarks, yönetici-only */}
        {role === "yonetici" && (
          <div className={`${SURFACE_PRIMARY} border border-dashed ${BORDER_DEFAULT} ${RADIUS_DEFAULT} p-4`}>
            <h3 className={`${TYPE_CAPTION} ${TEXT_SECONDARY} flex items-center gap-1.5 mb-3`}>
              <Eye size={12} />
              Yönetici İnisiyatifleri
            </h3>
            <EmptyState title="İnisiyatif takibi henüz aktif değil." size="card" />
          </div>
        )}

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
