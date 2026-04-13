"use client";

/**
 * Firmalar list — reads company shell from real Supabase truth.
 * Derived columns (anaYetkili, aktifSozlesme, aktifIsGucu, sonGorusme,
 * sonrakiRandevu) resolved from already-migrated domain truths.
 *
 * Phase 7 cutover restored for Excel Import V1 end-to-end story.
 */

import { useState, useMemo, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { formatDateTR } from "@/lib/format-date";
import {
  PageHeader,
  SearchInput,
  FilterBar,
  DataTable,
  StatusBadge,
  RiskBadge,
} from "@/components/ui";
import { FIRMA_PARTNER_MAP } from "@/mocks/ayarlar";
import { createClient } from "@/lib/supabase/client";
import { selectAllCompanies } from "@/lib/supabase/companies";
import { getPrimaryContactNamesByLegacyIds } from "@/lib/services/contacts";
import { getActiveContractCountsByLegacyIds } from "@/lib/services/contracts";
import { getWorkforceSummariesByLegacyIds, deriveOpenGap } from "@/lib/services/workforce-summary";
import { getAppointmentDatesByLegacyIds } from "@/lib/services/appointments";
import type { CompanyRow, WorkforceSummaryRow } from "@/types/database.types";
import type { FirmaDurumu, RiskSeviyesi, ColumnDef, FilterConfig, FilterValues, RowAction } from "@/types/ui";

// ---------------------------------------------------------------------------
// Enriched row — company shell + derived columns
// ---------------------------------------------------------------------------

interface FirmaListRow {
  id: string;
  firmaAdi: string;
  sektor: string;
  sehir: string;
  anaYetkili: string;
  aktifSozlesme: number;
  aktifIsGucu: number;
  sonGorusme: string;
  sonrakiRandevu: string;
  risk: RiskSeviyesi;
  durum: FirmaDurumu;
}

// ---------------------------------------------------------------------------
// Column definitions
// ---------------------------------------------------------------------------

const COLUMNS: ColumnDef<FirmaListRow>[] = [
  { key: "firmaAdi", header: "Firma Adi", sortable: true },
  { key: "sektor", header: "Sektor", sortable: true },
  {
    key: "sehir",
    header: "Sehir",
    sortable: true,
    render: (val, row) => {
      const partner = FIRMA_PARTNER_MAP[row.id];
      return (
        <div>
          <span className="text-sm text-slate-700">{val as string}</span>
          {partner && (
            <p className="text-xs text-slate-400">{partner.partnerAdi}</p>
          )}
        </div>
      );
    },
  },
  { key: "anaYetkili", header: "Ana Yetkili" },
  { key: "aktifSozlesme", header: "Aktif Sozlesme", sortable: true },
  { key: "aktifIsGucu", header: "Aktif Is Gucu", sortable: true },
  { key: "sonGorusme", header: "Son Gorusme", sortable: true, render: (val) => formatDateTR(val as string) },
  { key: "sonrakiRandevu", header: "Sonraki Randevu", sortable: true, render: (val) => formatDateTR(val as string) },
  {
    key: "risk",
    header: "Risk Etiketi",
    sortable: true,
    render: (val) => <RiskBadge risk={val as RiskSeviyesi} />,
  },
  {
    key: "durum",
    header: "Durum",
    sortable: true,
    render: (val) => <StatusBadge status={val as FirmaDurumu} />,
  },
];

export default function FirmalarPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<FilterValues>({
    durum: "",
    risk: "",
    sektor: "",
    sehir: "",
    partner: "",
  });
  const handleSearch = useCallback((val: string) => setSearch(val), []);

  // ---------------------------------------------------------------------------
  // Data loading — company shell from real DB + derived columns
  // ---------------------------------------------------------------------------
  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [primaryNames, setPrimaryNames] = useState<Record<string, string>>({});
  const [activeContractCounts, setActiveContractCounts] = useState<Record<string, number>>({});
  const [workforceByLegacy, setWorkforceByLegacy] = useState<Record<string, WorkforceSummaryRow>>({});
  const [appointmentDates, setAppointmentDates] = useState<{
    lastCompleted: Record<string, string>;
    nextPlanned: Record<string, string>;
  }>({ lastCompleted: {}, nextPlanned: {} });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const rows = await selectAllCompanies(supabase);
        if (!active) return;
        setCompanies(rows);

        const legacyIds = rows
          .filter((r) => r.legacy_mock_id)
          .map((r) => r.legacy_mock_id!);

        if (legacyIds.length > 0) {
          const [names, counts, workforce, apptDates] = await Promise.all([
            getPrimaryContactNamesByLegacyIds(supabase, legacyIds).catch(() => ({})),
            getActiveContractCountsByLegacyIds(supabase, legacyIds).catch(() => ({})),
            getWorkforceSummariesByLegacyIds(supabase, legacyIds).catch(() => ({})),
            getAppointmentDatesByLegacyIds(supabase, legacyIds).catch(() => ({ lastCompleted: {}, nextPlanned: {} })),
          ]);
          if (!active) return;
          setPrimaryNames(names);
          setActiveContractCounts(counts);
          setWorkforceByLegacy(workforce);
          setAppointmentDates(apptDates);
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [supabase]);

  // ---------------------------------------------------------------------------
  // Dynamic filter config
  // ---------------------------------------------------------------------------
  const filterConfig: FilterConfig[] = useMemo(() => [
    {
      key: "durum", label: "Durum", type: "select" as const, placeholder: "Tum durumlar",
      options: [
        { label: "Aday", value: "aday" },
        { label: "Aktif", value: "aktif" },
        { label: "Pasif", value: "pasif" },
      ],
    },
    {
      key: "risk", label: "Risk", type: "select" as const, placeholder: "Tum riskler",
      options: [
        { label: "Dusuk", value: "dusuk" },
        { label: "Orta", value: "orta" },
        { label: "Yuksek", value: "yuksek" },
      ],
    },
    {
      key: "sektor", label: "Sektor", type: "select" as const, placeholder: "Tum sektorler",
      options: [...new Set(companies.map((c) => c.sector).filter(Boolean))].sort().map((s) => ({ label: s!, value: s! })),
    },
    {
      key: "sehir", label: "Sehir", type: "select" as const, placeholder: "Tum sehirler",
      options: [...new Set(companies.map((c) => c.city).filter(Boolean))].sort().map((s) => ({ label: s!, value: s! })),
    },
    {
      key: "partner", label: "Partner", type: "select" as const, placeholder: "Tum partnerler",
      options: [...new Set(Object.values(FIRMA_PARTNER_MAP).map((p) => p.partnerAdi))].map((name) => ({ label: name, value: name })),
    },
  ], [companies]);

  // ---------------------------------------------------------------------------
  // Enriched + filtered rows
  // ---------------------------------------------------------------------------
  const filteredData = useMemo(() => {
    const enriched: FirmaListRow[] = companies.map((c) => {
      // Use legacy_mock_id for routing and derived column lookups; fall back to UUID for new imports
      const rowId = c.legacy_mock_id ?? c.id;
      const legId = c.legacy_mock_id ?? "";
      const wf = workforceByLegacy[legId];
      return {
        id: rowId,
        firmaAdi: c.name,
        sektor: c.sector ?? "\u2014",
        sehir: c.city ?? "\u2014",
        anaYetkili: primaryNames[legId] ?? "\u2014",
        aktifSozlesme: activeContractCounts[legId] ?? 0,
        aktifIsGucu: wf?.current_count ?? 0,
        sonGorusme: appointmentDates.lastCompleted[legId] ?? "\u2014",
        sonrakiRandevu: appointmentDates.nextPlanned[legId] ?? "\u2014",
        risk: c.risk,
        durum: c.status,
      };
    });

    return enriched.filter((f) => {
      if (search) {
        const q = search.toLowerCase();
        if (
          !f.firmaAdi.toLowerCase().includes(q) &&
          !f.anaYetkili.toLowerCase().includes(q) &&
          !f.sektor.toLowerCase().includes(q) &&
          !f.sehir.toLowerCase().includes(q)
        ) return false;
      }
      if (filters.durum && f.durum !== filters.durum) return false;
      if (filters.risk && f.risk !== filters.risk) return false;
      if (filters.sektor && f.sektor !== filters.sektor) return false;
      if (filters.sehir && f.sehir !== filters.sehir) return false;
      if (filters.partner && FIRMA_PARTNER_MAP[f.id]?.partnerAdi !== filters.partner) return false;
      return true;
    });
  }, [search, filters, companies, primaryNames, activeContractCounts, workforceByLegacy, appointmentDates]);

  const rowActions: RowAction<FirmaListRow>[] = [
    {
      label: "Detaya Git",
      onClick: (row) => router.push(`/firmalar/${row.id}`),
    },
  ];

  if (loading) {
    return (
      <>
        <PageHeader title="Firmalar" subtitle="Firma portfoyu" />
        <p className="text-sm text-slate-500 py-8 text-center">Yukleniyor...</p>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Firmalar" subtitle="Firma portfoyu" />

      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="w-full sm:max-w-xs">
            <SearchInput
              placeholder="Firma, yetkili, sektor ara..."
              onChange={handleSearch}
            />
          </div>
          <FilterBar
            filters={filterConfig}
            values={filters}
            onChange={setFilters}
          />
        </div>

        <DataTable<FirmaListRow>
          columns={COLUMNS}
          data={filteredData}
          rowKey="id"
          rowActions={rowActions}
          onRowClick={(row) => router.push(`/firmalar/${row.id}`)}
          emptyTitle="Firma bulunamadi"
          emptyDescription="Arama veya filtre kriterlerinizi degistirin."
        />
      </div>
    </>
  );
}
