"use client";

import { useEffect, useMemo, useState } from "react";
import { formatDateTR } from "@/lib/format-date";
import { createClient } from "@/lib/supabase/client";
import {
  listAllWorkforceSummaries,
  deriveOpenGap,
  deriveRiskLevel,
} from "@/lib/services/workforce-summary";
import {
  listAllContracts,
  computeRemainingDays,
} from "@/lib/services/contracts";
import { APPOINTMENT_TYPE_LABELS } from "@/lib/appointment-types";
import {
  PageHeader,
  DataTable,
  StatusBadge,
  RiskBadge,
  PriorityBadge,
  WorkforceRiskBadge,
  ReportSwitcher,
} from "@/components/ui";
import type { ReportOption } from "@/components/ui/ReportSwitcher";
import { useRole } from "@/context/RoleContext";
import type { UserRole } from "@/context/RoleContext";
import {
  // Report 6 still mock-backed (partner × city analytics — explicitly
  // deferred per the Faz 2B planning scope).
  getRaporPartnerOzet,
} from "@/mocks/raporlar";
import type {
  RaporIsGucuRow,
  RaporSozlesmeBitisRow,
  RaporTalepRow,
  RaporRandevuRow,
  RaporPartnerOzetRow,
} from "@/mocks/raporlar";
import type { ColumnDef } from "@/types/ui";
import type { IsGucuRiskSeviyesi } from "@/types/batch4";
import type { OncelikSeviyesi, RiskSeviyesi } from "@/types/ui";
import { clsx } from "clsx";
import {
  TYPE_BODY,
  TYPE_CAPTION,
  TEXT_PRIMARY,
  TEXT_BODY,
  TEXT_SECONDARY,
  TEXT_MUTED,
  TEXT_LINK,
} from "@/styles/tokens";

// ---------------------------------------------------------------------------
// Report definitions
// ---------------------------------------------------------------------------

const ALL_REPORTS: ReportOption[] = [
  { key: "is-gucu", label: "Firma Bazlı Aktif İş Gücü" },
  { key: "sozlesme-bitis", label: "Yaklaşan Sözleşme Bitişleri" },
  { key: "talep-analizi", label: "Açık / Kapanan Talep Analizi" },
  { key: "randevu-sonuc", label: "Randevu Hacmi ve Sonuçlar" },
  { key: "riskli-firma", label: "Riskli Firma Listesi" },
  { key: "partner-ozet", label: "Şehir ve Partner Operasyon Özeti" },
];

const REPORT_ROLE_ACCESS: Record<UserRole, string[]> = {
  yonetici: ["is-gucu", "sozlesme-bitis", "talep-analizi", "randevu-sonuc", "riskli-firma", "partner-ozet"],
  partner: ["is-gucu", "sozlesme-bitis", "talep-analizi", "randevu-sonuc", "riskli-firma", "partner-ozet"],
  operasyon: ["is-gucu", "talep-analizi", "randevu-sonuc"],
  ik: ["is-gucu"],
  muhasebe: ["riskli-firma", "partner-ozet"],
  goruntuleyici: ["is-gucu", "sozlesme-bitis", "talep-analizi", "randevu-sonuc", "riskli-firma"],
};

// ---------------------------------------------------------------------------
// Column definitions per report
// ---------------------------------------------------------------------------

const COLUMNS_IS_GUCU: ColumnDef<RaporIsGucuRow>[] = [
  { key: "firmaAdi", header: "Firma", sortable: true },
  { key: "lokasyon", header: "Lokasyon" },
  { key: "aktifKisi", header: "Aktif Kişi", sortable: true },
  { key: "hedefKisi", header: "Hedef Kişi", sortable: true },
  {
    key: "acikFark",
    header: "Açık Fark",
    sortable: true,
    render: (val) => {
      const n = val as number;
      return <span className={clsx(`${TYPE_BODY} font-medium`, n > 0 ? "text-red-600" : "text-green-600")}>{n > 0 ? `−${n}` : "0"}</span>;
    },
  },
  {
    key: "riskEtiketi",
    header: "Risk",
    sortable: true,
    render: (val) => <WorkforceRiskBadge risk={val as IsGucuRiskSeviyesi} />,
  },
];

const COLUMNS_SOZLESME_BITIS: ColumnDef<RaporSozlesmeBitisRow>[] = [
  { key: "sozlesmeAdi", header: "Sözleşme Adı", sortable: true },
  { key: "firmaAdi", header: "Firma", sortable: true },
  { key: "bitis", header: "Bitiş", sortable: true, render: (val) => formatDateTR(val as string) },
  {
    key: "kalanGun",
    header: "Kalan Gün",
    sortable: true,
    render: (val) => {
      const n = val as number;
      return (
        <span className={clsx(`${TYPE_BODY} font-medium`, n <= 15 ? "text-red-600" : n <= 30 ? "text-amber-600" : TEXT_BODY)}>
          {n} gün
        </span>
      );
    },
  },
  { key: "sorumlu", header: "Sorumlu" },
  {
    key: "hazirlikDurumu",
    header: "Hazırlık Durumu",
    render: (val) => (
      <span className={`${TYPE_BODY} ${(val as string) !== "—" ? "text-amber-600" : TEXT_SECONDARY}`}>
        {val as string}
      </span>
    ),
  },
  {
    key: "durum",
    header: "Durum",
    render: (val) => <StatusBadge status={val as RaporSozlesmeBitisRow["durum"]} />,
  },
];

const COLUMNS_TALEPLER: ColumnDef<RaporTalepRow>[] = [
  { key: "firmaAdi", header: "Firma", sortable: true },
  { key: "pozisyon", header: "Pozisyon", sortable: true },
  { key: "talepEdilen", header: "Talep Edilen", sortable: true },
  { key: "saglanan", header: "Sağlanan", sortable: true },
  {
    key: "acikKalan",
    header: "Açık Kalan",
    sortable: true,
    render: (val) => {
      const n = val as number;
      return <span className={clsx(`${TYPE_BODY} font-medium`, n > 0 ? "text-red-600" : "text-green-600")}>{n}</span>;
    },
  },
  {
    key: "oncelik",
    header: "Öncelik",
    sortable: true,
    render: (val) => <PriorityBadge priority={val as OncelikSeviyesi} />,
  },
  {
    key: "durum",
    header: "Durum",
    render: (val) => <StatusBadge status={val as RaporTalepRow["durum"]} />,
  },
];

const COLUMNS_RANDEVULAR: ColumnDef<RaporRandevuRow>[] = [
  { key: "tarih", header: "Tarih", sortable: true, render: (val) => formatDateTR(val as string) },
  { key: "firmaAdi", header: "Firma", sortable: true },
  { key: "gorusmeTipiLabel", header: "Görüşme Tipi" },
  { key: "katilimci", header: "Katılımcı" },
  {
    key: "durum",
    header: "Durum",
    sortable: true,
    render: (val) => <StatusBadge status={val as RaporRandevuRow["durum"]} />,
  },
  {
    key: "sonuc",
    header: "Sonuç",
    render: (val) => (
      <span className={`${TYPE_BODY} ${TEXT_SECONDARY} truncate max-w-[200px] block`}>
        {val as string}
      </span>
    ),
  },
];

// Real-truth row shape for Raporlar 5. Composite signals (ticari baskı,
// açık talep, eksik evrak) require derivations explicitly out of scope
// for this batch — only fields sourced directly from `companies` survive.
interface RaporRiskliFirmaRow {
  firmaId: string;
  firmaAdi: string;
  risk: RiskSeviyesi;
}

const COLUMNS_RISKLI_FIRMA: ColumnDef<RaporRiskliFirmaRow>[] = [
  {
    key: "firmaAdi",
    header: "Firma",
    sortable: true,
    render: (val, row) => (
      <a href={`/firmalar/${row.firmaId}`} className={`${TYPE_BODY} ${TEXT_LINK} hover:underline`}>
        {val as string}
      </a>
    ),
  },
  {
    key: "risk",
    header: "Risk Seviyesi",
    sortable: true,
    render: (val) => <RiskBadge risk={val as RiskSeviyesi} />,
  },
];

const COLUMNS_PARTNER_OZET: ColumnDef<RaporPartnerOzetRow>[] = [
  {
    key: "partnerAdi",
    header: "Partner",
    render: (val, row) => (
      <span className={clsx(
        TYPE_BODY,
        row.rowType === "partner" ? `font-medium ${TEXT_BODY}` : TEXT_MUTED,
      )}>
        {(val as string) || ""}
      </span>
    ),
  },
  {
    key: "sehir",
    header: "Şehir",
    render: (val, row) => (
      <span className={clsx(
        TYPE_BODY,
        row.rowType !== "partner" ? `font-medium ${TEXT_PRIMARY}` : TEXT_BODY,
      )}>
        {val as string}
      </span>
    ),
  },
  { key: "firmaSayisi", header: "Firma" },
  { key: "isGucu", header: "İş Gücü" },
  { key: "acikTalep", header: "Açık Talep" },
  {
    key: "alacakYogunlugu",
    header: "Alacak Yoğunluğu",
    render: (val) => <span className={`${TYPE_BODY} ${TEXT_BODY}`}>{val as string}</span>,
  },
  {
    key: "kesilmemisBaski",
    header: "Kesilmemiş Baskı",
    render: (val) => <span className={`${TYPE_BODY} text-amber-600`}>{val as string}</span>,
  },
  {
    key: "gecikmisYogunluk",
    header: "Gecikmiş Firma",
    render: (val, row) => {
      const n = val as number;
      return <span className={clsx(TYPE_BODY, n > 0 ? "text-red-600 font-medium" : TEXT_MUTED)}>{n > 0 ? `${n} firma` : "—"}</span>;
    },
  },
];

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function RaporlarPage() {
  const { role } = useRole();
  const allowedKeys = REPORT_ROLE_ACCESS[role] ?? [];
  const visibleReports = useMemo(
    () => ALL_REPORTS.filter((r) => allowedKeys.includes(r.key)),
    [allowedKeys]
  );
  const [activeKey, setActiveKey] = useState(() => visibleReports[0]?.key ?? "");

  // Reports 1-4 — real Supabase truth. RLS on each underlying table
  // enforces partner scope. Null/empty loading is honest; errors fall
  // to empty with no mock fallback.
  const [raporIsGucu, setRaporIsGucu] = useState<RaporIsGucuRow[]>([]);
  const [raporSozlesmeBitis, setRaporSozlesmeBitis] = useState<
    RaporSozlesmeBitisRow[]
  >([]);
  const [raporTalepler, setRaporTalepler] = useState<RaporTalepRow[]>([]);
  const [raporRandevular, setRaporRandevular] = useState<RaporRandevuRow[]>([]);
  const [reportsLoading, setReportsLoading] = useState(true);

  // Report 5 — Riskli Firma Listesi. Real `companies.risk` enum only.
  // Composite narrative (sebep, ticari baskı, açık talep, eksik evrak)
  // is intentionally omitted — each would require derivations explicitly
  // out of scope for this batch. Honest absence > fabricated content.
  const [raporRiskli, setRaporRiskli] = useState<RaporRiskliFirmaRow[]>([]);

  // Report 6 — still mock-backed. Partner × city aggregation is out of
  // scope for this batch.
  const raporPartnerOzet = getRaporPartnerOzet();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const [
        companiesRes,
        workforceRows,
        contractRows,
        demandsRes,
        appointmentsRes,
      ] = await Promise.all([
        // Single companies.select for the batch — feeds firma-name
        // resolution across reports 1-4 and the Riskli Firma derivation
        // (risk + legacy_mock_id added for Report 5).
        supabase.from("companies").select("id, name, risk, legacy_mock_id"),
        // Service readers already used by the destination list pages.
        listAllWorkforceSummaries(supabase).catch(() => []),
        listAllContracts(supabase).catch(() => []),
        // Talep Analizi — per-record grain preserved, same shape as the
        // destination /talepler page.
        supabase
          .from("staffing_demands")
          .select(
            "id, company_id, position, requested_count, provided_count, priority, status",
          ),
        // Randevu Sonuçları — per-record grain preserved.
        supabase
          .from("appointments")
          .select(
            "id, company_id, meeting_date, meeting_type, attendee, status, result",
          ),
      ]);
      if (cancelled) return;

      const companyNameById = new Map<string, string>();
      if (!companiesRes.error) {
        for (const c of companiesRes.data ?? []) {
          companyNameById.set(c.id, c.name);
        }
      }

      // Report 1 — İş Gücü. Reuses deriveOpenGap + deriveRiskLevel from
      // the workforce-summary service so the derivation is byte-
      // identical to the /aktif-isgucu page. No new threshold invented.
      const isGucuRows: RaporIsGucuRow[] = workforceRows
        .map((row) => ({
          firmaId: row.company_id,
          firmaAdi: companyNameById.get(row.company_id) ?? "—",
          lokasyon: row.location ?? "—",
          aktifKisi: row.current_count,
          hedefKisi: row.target_count,
          acikFark: deriveOpenGap(row),
          riskEtiketi: deriveRiskLevel(row),
        }))
        .filter((r) => r.firmaAdi !== "—");

      // Report 2 — Sözleşme Bitişleri. Preserve the mock's 90-day
      // window + kalanGun ASC sort. hazirlikDurumu has no real-schema
      // equivalent on contracts; render honest "—" per row.
      const now = new Date();
      const sozlesmeRows: RaporSozlesmeBitisRow[] = contractRows
        .map((c) => ({
          row: c,
          kalanGun: computeRemainingDays(c.end_date, now),
        }))
        .filter(
          (x): x is { row: (typeof contractRows)[number]; kalanGun: number } =>
            x.kalanGun !== null && x.kalanGun <= 90,
        )
        .sort((a, b) => a.kalanGun - b.kalanGun)
        .map(({ row, kalanGun }) => ({
          sozlesmeAdi: row.name,
          firmaAdi: companyNameById.get(row.company_id) ?? "—",
          bitis: row.end_date ?? "",
          kalanGun,
          sorumlu: row.responsible ?? "—",
          durum: row.status,
          hazirlikDurumu: "—",
        }));

      // Report 3 — Talep Analizi. Per-record, no aggregation.
      const talepRows: RaporTalepRow[] = demandsRes.error
        ? []
        : (demandsRes.data ?? []).map((d) => ({
            firmaAdi: companyNameById.get(d.company_id) ?? "—",
            pozisyon: d.position,
            talepEdilen: d.requested_count,
            saglanan: d.provided_count,
            acikKalan: d.requested_count - d.provided_count,
            oncelik: d.priority,
            durum: d.status,
          }));

      // Report 4 — Randevu Sonuçları. Per-record. meeting_type maps
      // through the existing APPOINTMENT_TYPE_LABELS helper.
      const randevuRows: RaporRandevuRow[] = appointmentsRes.error
        ? []
        : (appointmentsRes.data ?? []).map((a) => ({
            tarih: a.meeting_date,
            firmaAdi: companyNameById.get(a.company_id) ?? "—",
            gorusmeTipiLabel:
              APPOINTMENT_TYPE_LABELS[a.meeting_type] ?? a.meeting_type,
            katilimci: a.attendee ?? "—",
            durum: a.status,
            sonuc: a.result && a.result.trim() !== "" ? a.result : "—",
          }));

      // Report 5 — Riskli Firma Listesi. Filter companies by risk enum,
      // sort yuksek first then orta then name ASC. Mirrors the Dashboard
      // Riskli Firmalar pattern. legacy_mock_id ?? id keeps firma-detay
      // routing aligned with the rest of the app. No subset cap — the
      // full report shows every matching company.
      const riskliRows: RaporRiskliFirmaRow[] = companiesRes.error
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
            .map((c) => ({
              firmaId: c.legacy_mock_id ?? c.id,
              firmaAdi: c.name,
              risk: c.risk,
            }));

      setRaporIsGucu(isGucuRows);
      setRaporSozlesmeBitis(sozlesmeRows);
      setRaporTalepler(talepRows);
      setRaporRandevular(randevuRows);
      setRaporRiskli(riskliRows);
      setReportsLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      <PageHeader title="Raporlar" subtitle="Operasyonel raporlar" />

      <div className="space-y-4">
        <ReportSwitcher
          reports={visibleReports}
          activeKey={activeKey}
          onSwitch={setActiveKey}
        />

        <p className={`${TYPE_CAPTION} ${TEXT_SECONDARY}`}>Dönem: Mart 2026</p>

        {activeKey === "is-gucu" && (
          reportsLoading ? (
            <p className={`${TYPE_BODY} ${TEXT_MUTED} text-center py-6`}>Yükleniyor…</p>
          ) : (
            <DataTable<RaporIsGucuRow>
              columns={COLUMNS_IS_GUCU}
              data={raporIsGucu}
              rowKey="firmaId"
              emptyTitle="İş gücü verisi yok"
            />
          )
        )}

        {activeKey === "sozlesme-bitis" && (
          reportsLoading ? (
            <p className={`${TYPE_BODY} ${TEXT_MUTED} text-center py-6`}>Yükleniyor…</p>
          ) : (
            <DataTable<RaporSozlesmeBitisRow>
              columns={COLUMNS_SOZLESME_BITIS}
              data={raporSozlesmeBitis}
              rowKey="sozlesmeAdi"
              emptyTitle="Yaklaşan sözleşme yok"
            />
          )
        )}

        {activeKey === "talep-analizi" && (
          reportsLoading ? (
            <p className={`${TYPE_BODY} ${TEXT_MUTED} text-center py-6`}>Yükleniyor…</p>
          ) : (
            <DataTable<RaporTalepRow>
              columns={COLUMNS_TALEPLER}
              data={raporTalepler}
              rowKey="pozisyon"
              emptyTitle="Talep verisi yok"
            />
          )
        )}

        {activeKey === "randevu-sonuc" && (
          reportsLoading ? (
            <p className={`${TYPE_BODY} ${TEXT_MUTED} text-center py-6`}>Yükleniyor…</p>
          ) : (
            <DataTable<RaporRandevuRow>
              columns={COLUMNS_RANDEVULAR}
              data={raporRandevular}
              rowKey="tarih"
              emptyTitle="Randevu verisi yok"
            />
          )
        )}

        {activeKey === "riskli-firma" && (
          reportsLoading ? (
            <p className={`${TYPE_BODY} ${TEXT_MUTED} text-center py-6`}>Yükleniyor…</p>
          ) : (
            <DataTable<RaporRiskliFirmaRow>
              columns={COLUMNS_RISKLI_FIRMA}
              data={raporRiskli}
              rowKey="firmaId"
              emptyTitle="Riskli firma yok"
            />
          )
        )}

        {activeKey === "partner-ozet" && (
          <DataTable<RaporPartnerOzetRow>
            columns={COLUMNS_PARTNER_OZET}
            data={raporPartnerOzet}
            rowKey="id"
            emptyTitle="Partner verisi yok"
            pageSize={30}
          />
        )}
      </div>
    </>
  );
}
