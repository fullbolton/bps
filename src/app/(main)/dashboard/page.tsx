"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Building2,
  FileText,
  Users,
  Briefcase,
  ListChecks,
  CalendarCheck,
  AlertTriangle,
  Mail,
  Megaphone,
  Eye,
  Clock,
} from "lucide-react";
import {
  PageHeader,
  KPIStatCard,
  ContractExpiryCard,
  RiskBadge,
  EmptyState,
} from "@/components/ui";
import {
  listAllContracts,
  computeRemainingDays,
} from "@/lib/services/contracts";
import { listAllDocuments } from "@/lib/services/documents";
import type { ContractRow, DocumentRow } from "@/types/database.types";
import type { ExpiringContract } from "@/components/ui/ContractExpiryCard";
import type { EvrakDurumu } from "@/types/ui";
import { clsx } from "clsx";
import { useRole } from "@/context/RoleContext";
import { listAllCriticalDates } from "@/lib/services/critical-dates";
import {
  CRITICAL_DATE_TYPE_LABELS,
  computeRemainingDays as computeDeadlineRemaining,
  deriveDeadlineStatus,
} from "@/lib/critical-date-types";
import type { CriticalDateRow } from "@/types/database.types";
import { getHotelEmailContext, generateHotelEmailDraft } from "@/lib/draft-hotel-email";
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
  SURFACE_HEADER,
  SURFACE_OVERLAY_DARK,
  RADIUS_SM,
  Z_OVERLAY,
} from "@/styles/tokens";

// Page-local helpers — same pattern as Firma Detay pilot
const CARD = `${SURFACE_PRIMARY} border ${BORDER_DEFAULT} ${RADIUS_DEFAULT} p-4`;
const CARD_LG = `${SURFACE_PRIMARY} border ${BORDER_DEFAULT} ${RADIUS_DEFAULT} p-5`;
const CARD_TITLE = `${TYPE_CARD_TITLE} ${TEXT_PRIMARY} mb-3`;
const CARD_TITLE_ICON = `${TYPE_CARD_TITLE} ${TEXT_PRIMARY} mb-3 flex items-center gap-1.5`;
const LIST_DIVIDER = `border-b ${BORDER_SUBTLE}`;

export default function DashboardPage() {
  const { role } = useRole();
  const [draftOpen, setDraftOpen] = useState(false);
  const [draftText, setDraftText] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  // KPI top-row — real Supabase truth. Partner scope is enforced by RLS
  // on each underlying table; no application-level scoping added here.
  // Null = not yet loaded or query errored → render as honest "—".
  // 0 = real query returned empty → honest zero.
  const [kpis, setKpis] = useState<{
    toplamFirma: number | null;
    aktifSozlesme: number | null;
    acikTalep: number | null;
    aktifPersonel: number | null;
    bekleyenGorev: number | null;
    yaklasanRandevu: number | null;
  }>({
    toplamFirma: null,
    aktifSozlesme: null,
    acikTalep: null,
    aktifPersonel: null,
    bekleyenGorev: null,
    yaklasanRandevu: null,
  });

  // Signal cards paired with the KPIs above. Same RLS / partner-scope
  // behavior as the KPIs; shape mirrors the previous mock render shape
  // so the card layout stays byte-identical.
  const [todayTasks, setTodayTasks] = useState<
    Array<{ id: string; baslik: string; firma: string; gecikme: boolean }>
  >([]);
  const [openDemands, setOpenDemands] = useState<
    Array<{ id: string; firma: string; pozisyon: string; adet: number }>
  >([]);

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

  // Riskli Firmalar — real companies.risk enum only. Composite risk
  // narrative (sebep), ticari baskı sub-lines, and partner/city
  // concentration are intentionally dropped — each would require a
  // composite risk derivation that is explicitly out of scope.
  const [riskyCompanies, setRiskyCompanies] = useState<
    Array<{
      id: string;
      firmaAdi: string;
      risk: "orta" | "yuksek";
      href: string;
    }>
  >([]);

  // Kurumsal Kritik Tarihler — real `critical_dates` truth. Broad-read
  // under RLS (no firm scope, no partner scope). Filter mirrors the
  // prior mock: derived status "suresi_yaklsiyor" or "suresi_doldu",
  // capped at 4 rows (subset-view). Order follows the service's
  // deadline-ascending read so the most urgent items show first.
  const [criticalDates, setCriticalDates] = useState<CriticalDateRow[]>([]);

  const [signalsLoading, setSignalsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const [
        companiesRes,
        contractsRes,
        demandsRes,
        workforceRes,
        tasksRes,
        appointmentsRes,
        allContractRows,
        allDocumentRows,
        allCriticalDateRows,
      ] = await Promise.all([
        // companies: fetch id+name+risk+legacy_mock_id. Single query
        // covers the Toplam Firma KPI (count via data.length), the
        // name-lookup map used by the signal cards, and the Riskli
        // Firmalar derivation (risk enum only — no composite signal).
        supabase
          .from("companies")
          .select("id, name, risk, legacy_mock_id"),
        supabase
          .from("contracts")
          .select("id", { count: "exact", head: true })
          .eq("status", "aktif"),
        // staffing_demands: full rows so the same fetch feeds both the
        // Açık Talep KPI (sum of max(0, requested - provided)) and the
        // Açık Personel Talepleri signal card (per-row open count).
        supabase
          .from("staffing_demands")
          .select(
            "id, position, company_id, requested_count, provided_count, status",
          )
          .neq("status", "iptal"),
        supabase.from("workforce_summary").select("current_count"),
        // tasks: full rows feed both the Bekleyen Görev KPI (count via
        // data.length) and the Bugünün Görevleri signal card. Same
        // filter as the KPI — status IN ('acik','devam_ediyor','gecikti').
        supabase
          .from("tasks")
          .select("id, title, company_id, status, due_date")
          .in("status", ["acik", "devam_ediyor", "gecikti"]),
        supabase
          .from("appointments")
          .select("id", { count: "exact", head: true })
          .eq("status", "planlandi"),
        // Yaklaşan Sözleşme Bitişleri — reuse existing service reader.
        // Errors degrade to empty so one transient failure cannot break
        // the whole Dashboard reader batch.
        listAllContracts(supabase).catch(() => [] as ContractRow[]),
        // Eksik / Süresi Dolan Evraklar — reuse existing service reader.
        listAllDocuments(supabase).catch(() => [] as DocumentRow[]),
        // Kurumsal Kritik Tarihler — reuse existing service reader.
        // Broad-read under RLS; errors degrade to empty so a transient
        // failure does not break the whole Dashboard reader batch.
        listAllCriticalDates(supabase).catch(() => [] as CriticalDateRow[]),
      ]);
      if (cancelled) return;

      const acikTalep = demandsRes.error
        ? null
        : (demandsRes.data ?? []).reduce(
            (sum, r) =>
              sum +
              Math.max(
                0,
                (r.requested_count ?? 0) - (r.provided_count ?? 0),
              ),
            0,
          );
      const aktifPersonel = workforceRes.error
        ? null
        : (workforceRes.data ?? []).reduce(
            (sum, r) => sum + (r.current_count ?? 0),
            0,
          );

      setKpis({
        toplamFirma: companiesRes.error ? null : companiesRes.data?.length ?? 0,
        aktifSozlesme: contractsRes.error ? null : contractsRes.count ?? 0,
        acikTalep,
        aktifPersonel,
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
            .slice(0, 4)
            .map((t) => ({
              id: t.id,
              baslik: t.title,
              firma: companyNameById.get(t.company_id) ?? "—",
              gecikme: t.status === "gecikti",
            }));

      // Açık Personel Talepleri — row cap 4 (subset view). No new
      // sorting introduced; preserves Supabase's insertion order, same
      // as the prior mock card.
      const mappedDemands = demandsRes.error
        ? []
        : (demandsRes.data ?? [])
            .filter(
              (d) =>
                (d.requested_count ?? 0) > (d.provided_count ?? 0),
            )
            .slice(0, 4)
            .map((d) => ({
              id: d.id,
              firma: companyNameById.get(d.company_id) ?? "—",
              pozisyon: d.position,
              adet: Math.max(
                0,
                (d.requested_count ?? 0) - (d.provided_count ?? 0),
              ),
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

      // Riskli Firmalar — enum-only filter on the already-fetched
      // companies rows. Sort yuksek first, then orta, then name ASC.
      // Cap at 5 rows for subset-view parity with the other signal
      // cards. Composite sebep, ticari baskı, and geographic
      // concentration are intentionally omitted.
      const mappedRiskyCompanies = companiesRes.error
        ? []
        : (companiesRes.data ?? [])
            .filter(
              (c): c is typeof c & { risk: "orta" | "yuksek" } =>
                c.risk === "orta" || c.risk === "yuksek",
            )
            .sort((a, b) => {
              if (a.risk !== b.risk) {
                return a.risk === "yuksek" ? -1 : 1;
              }
              return a.name.localeCompare(b.name, "tr-TR");
            })
            .slice(0, 5)
            .map((c) => ({
              id: c.id,
              firmaAdi: c.name,
              risk: c.risk,
              href: `/firmalar/${c.legacy_mock_id ?? c.id}`,
            }));

      setTodayTasks(mappedTasks);
      setOpenDemands(mappedDemands);
      setExpiringContracts(mappedExpiringContracts);
      setEksikEvraklar(mappedEksikEvraklar);
      setRiskyCompanies(mappedRiskyCompanies);
      setCriticalDates(allCriticalDateRows);
      setSignalsLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function handleGenerateDraft() {
    const ctx = getHotelEmailContext();
    setDraftText(generateHotelEmailDraft(ctx));
    setCopied(false);
  }

  function handleCopy() {
    if (draftText) {
      navigator.clipboard.writeText(draftText).then(() => setCopied(true));
    }
  }

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle="Operasyon ve risk görünürlüğü"
      />

      <div className="space-y-6">
        {/* KPI Cards — filtered by role; görüntüleyici sees values but no nav to blocked pages */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
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
          {!["ik", "muhasebe", "goruntuleyici"].includes(role) && (
            <KPIStatCard
              label="Açık Talep"
              value={kpis.acikTalep ?? "—"}
              icon={<Users size={18} />}
              href="/talepler"
            />
          )}
          {!["muhasebe", "goruntuleyici"].includes(role) && (
            <KPIStatCard
              label="Aktif Personel"
              value={kpis.aktifPersonel ?? "—"}
              icon={<Briefcase size={18} />}
              href="/aktif-isgucu"
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

        {/* Signal cards row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Bugünün Görevleri — hidden for muhasebe */}
          {!["muhasebe", "goruntuleyici"].includes(role) && <div className={CARD}>
            <h3 className={CARD_TITLE}>
              Bugünün Görevleri
            </h3>
            {signalsLoading ? (
              <p className={`${TYPE_BODY} ${TEXT_MUTED} text-center py-4`}>
                Yükleniyor…
              </p>
            ) : todayTasks.length === 0 ? (
              <p className={`${TYPE_BODY} ${TEXT_MUTED} text-center py-4`}>
                Bugün için görev yok.
              </p>
            ) : (
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
            )}
          </div>}

          {/* Yaklaşan Sözleşme Bitişleri — hidden for ik + muhasebe.
              Real contracts under RLS, filtered to active + not-past
              end_date. Loading state is honest: the component's own
              empty state would read as "no data" which is misleading
              during pre-load, so a wrapper card shows "Yükleniyor…"
              until the fetch resolves. */}
          {!["ik", "muhasebe", "goruntuleyici"].includes(role) && (
            signalsLoading ? (
              <div className={CARD}>
                <h3 className={CARD_TITLE}>Yaklaşan Sözleşme Bitişleri</h3>
                <p className={`${TYPE_BODY} ${TEXT_MUTED} text-center py-4`}>
                  Yükleniyor…
                </p>
              </div>
            ) : (
              <ContractExpiryCard
                contracts={expiringContracts}
                actionHref="/sozlesmeler"
              />
            )
          )}

          {/* Açık Talepler — hidden for ik + muhasebe */}
          {!["ik", "muhasebe", "goruntuleyici"].includes(role) && <div className={CARD}>
            <div className="flex items-center justify-between mb-3">
              <h3 className={`${TYPE_CARD_TITLE} ${TEXT_PRIMARY}`}>
                Açık Personel Talepleri
              </h3>
              <a href="/talepler" className={`${TYPE_CAPTION} ${TEXT_LINK} hover:underline`}>Tümünü Gör</a>
            </div>
            {signalsLoading ? (
              <p className={`${TYPE_BODY} ${TEXT_MUTED} text-center py-4`}>
                Yükleniyor…
              </p>
            ) : openDemands.length === 0 ? (
              <p className={`${TYPE_BODY} ${TEXT_MUTED} text-center py-4`}>
                Açık talep yok.
              </p>
            ) : (
              <div className="space-y-0">
                {openDemands.map((d, idx) => (
                  <div
                    key={d.id}
                    className={clsx(
                      "flex items-center justify-between py-2.5",
                      idx < openDemands.length - 1 && LIST_DIVIDER
                    )}
                  >
                    <div className="min-w-0">
                      <p className={`${TYPE_BODY} ${TEXT_BODY}`}>{d.pozisyon}</p>
                      <p className={`${TYPE_CAPTION} ${TEXT_MUTED}`}>{d.firma}</p>
                    </div>
                    <span className={`${TYPE_BODY} font-medium ${TEXT_PRIMARY} ml-3 flex-shrink-0`}>
                      {d.adet} kişi
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>}

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
              {signalsLoading ? (
                <p className={`${TYPE_BODY} ${TEXT_MUTED} text-center py-4`}>
                  Yükleniyor…
                </p>
              ) : eksikEvraklar.length === 0 ? (
                <p className={`${TYPE_BODY} ${TEXT_MUTED} text-center py-4`}>
                  Eksik evrak yok.
                </p>
              ) : (
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
              )}
            </div>
          )}

          {/* Riskli Firmalar — real companies.risk enum only. Composite
              sebep narrative, ticari baskı sub-lines, and partner/city
              concentration footer are intentionally dropped — each
              requires a risk engine that is out of scope for this
              batch. A later bounded batch can reintroduce composite
              signals on top of this honest baseline. */}
          <div className={CARD}>
            <h3 className={CARD_TITLE_ICON}>
              <AlertTriangle size={14} className="text-amber-500" />
              Riskli Firmalar
            </h3>
            {signalsLoading ? (
              <p className={`${TYPE_BODY} ${TEXT_MUTED} text-center py-4`}>
                Yükleniyor…
              </p>
            ) : riskyCompanies.length === 0 ? (
              <p className={`${TYPE_BODY} ${TEXT_MUTED} text-center py-4`}>
                Risk sinyali yok.
              </p>
            ) : (
              <div className="space-y-0">
                {riskyCompanies.map((company, idx) => (
                  <div
                    key={company.id}
                    className={clsx(
                      "flex items-center justify-between gap-3 py-2.5",
                      idx < riskyCompanies.length - 1 && LIST_DIVIDER
                    )}
                  >
                    <a
                      href={company.href}
                      className={`${TYPE_BODY} ${TEXT_LINK} hover:underline font-medium truncate min-w-0`}
                    >
                      {company.firmaAdi}
                    </a>
                    <RiskBadge risk={company.risk} size="sm" />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Kurumsal Kritik Tarihler — all roles. Real `critical_dates`
            truth (broad-read under RLS). Subset-view preserved: card
            renders only when approaching/overdue items exist post-load.
            While the fetch is in flight the card wrapper is shown with
            an honest "Yükleniyor…" state rather than mock-backed rows. */}
        {(() => {
          if (signalsLoading) {
            return (
              <div className={CARD}>
                <div className="flex items-center justify-between mb-3">
                  <h3 className={CARD_TITLE_ICON}>
                    <Clock size={14} className="text-amber-500" />
                    Kritik Tarihler
                  </h3>
                  <a href="/kurumsal-tarihler" className={`${TYPE_CAPTION} ${TEXT_LINK} hover:underline`}>Tümünü Gör</a>
                </div>
                <p className={`${TYPE_BODY} ${TEXT_MUTED} text-center py-4`}>
                  Yükleniyor…
                </p>
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

        {/* Operational draft helper — signal-adjacent, visually secondary */}
        {["yonetici", "operasyon"].includes(role) && (
          <div
            onClick={() => { setDraftText(null); setCopied(false); setDraftOpen(true); }}
            className={`border border-dashed ${BORDER_DEFAULT} ${RADIUS_DEFAULT} p-3 flex items-center gap-3 cursor-pointer hover:border-blue-300 hover:bg-blue-50/30 transition-colors`}
          >
            <Mail size={16} className={TEXT_MUTED} />
            <div>
              <p className={`${TYPE_BODY} ${TEXT_BODY}`}>Günlük Otel E-postası</p>
              <p className={`${TYPE_CAPTION} ${TEXT_MUTED}`}>Bugünkü personel dağılımına göre konaklama bildirimi taslağı</p>
            </div>
          </div>
        )}

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

        {/* Duyurular — management priority strip, hidden for muhasebe */}
        {role !== "muhasebe" && (
          <div className={CARD}>
            <h3 className={`${TYPE_CAPTION} ${TEXT_SECONDARY} flex items-center gap-1.5 mb-3`}>
              <Megaphone size={12} />
              Duyurular
            </h3>
            <EmptyState title="Duyuru akışı henüz bağlı değil." size="card" />
          </div>
        )}

        {/* Son Aktiviteler — hidden for muhasebe */}
        {role !== "muhasebe" && (
          <div className={CARD_LG}>
            <h3 className={CARD_TITLE}>
              Son Aktiviteler
            </h3>
            <EmptyState title="Aktivite akışı henüz bağlı değil." size="card" />
          </div>
        )}
      </div>

      {/* Morning hotel email draft modal */}
      {draftOpen && (
        <div className={`fixed inset-0 ${SURFACE_OVERLAY_DARK} flex items-center justify-center ${Z_OVERLAY}`} onClick={() => setDraftOpen(false)}>
          <div className={`${SURFACE_PRIMARY} ${RADIUS_DEFAULT} shadow-xl w-full max-w-lg mx-4 max-h-[85vh] flex flex-col`} onClick={(e) => e.stopPropagation()}>
            <div className={`px-5 py-4 border-b ${BORDER_DEFAULT} flex-shrink-0`}>
              <h2 className={`${TYPE_CARD_TITLE} ${TEXT_PRIMARY}`}>Günlük Otel E-postası</h2>
              <p className={`${TYPE_CAPTION} ${TEXT_MUTED} mt-1`}>
                Taslak metin — göndermeden önce gözden geçirin
              </p>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              {!draftText ? (
                <div className="space-y-3">
                  <p className={`${TYPE_BODY} ${TEXT_BODY}`}>
                    Bugünkü aktif personel dağılımına göre otel bilgilendirme e-postası taslağı oluşturulacak.
                  </p>
                  <p className={`${TYPE_CAPTION} ${TEXT_SECONDARY}`}>
                    Veriler mevcut iş gücü kayıtlarından alınacaktır. Taslak gönderilmeden önce incelemeniz gerekir.
                  </p>
                </div>
              ) : (
                <div className={`${SURFACE_HEADER} ${RADIUS_SM} p-4`}>
                  <pre className={`${TYPE_BODY} ${TEXT_BODY} whitespace-pre-wrap font-sans`}>{draftText}</pre>
                </div>
              )}
            </div>

            <div className={`px-5 py-3 border-t ${BORDER_DEFAULT} flex justify-end gap-2 flex-shrink-0`}>
              <button onClick={() => setDraftOpen(false)} className={`px-4 py-2 ${TYPE_BODY} font-medium ${TEXT_BODY} ${SURFACE_PRIMARY} border ${BORDER_DEFAULT} ${RADIUS_SM} hover:bg-slate-50`}>
                {draftText ? "Kapat" : "İptal"}
              </button>
              {!draftText ? (
                <button onClick={handleGenerateDraft} className={`px-4 py-2 ${TYPE_BODY} font-medium text-white bg-blue-600 ${RADIUS_SM} hover:bg-blue-700`}>
                  Taslak Oluştur
                </button>
              ) : (
                <button onClick={handleCopy} className={`px-4 py-2 ${TYPE_BODY} font-medium text-white ${copied ? "bg-green-600" : "bg-blue-600"} ${RADIUS_SM} ${copied ? "" : "hover:bg-blue-700"}`}>
                  {copied ? "Kopyalandı" : "Kopyala"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
