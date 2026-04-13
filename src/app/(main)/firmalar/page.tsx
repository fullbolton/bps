"use client";

/**
 * Firmalar list — reads company shell from real Supabase truth.
 * Enrichment via UUID-keyed direct queries for all companies.
 * No mock dependency for enrichment or partner display.
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
import { createClient } from "@/lib/supabase/client";
import { selectAllCompanies } from "@/lib/supabase/companies";
import { SECTOR_LABELS } from "@/lib/sector-codes";
import type { SectorCode } from "@/lib/sector-codes";
import type { CompanyRow } from "@/types/database.types";
import type { FirmaDurumu, RiskSeviyesi, ColumnDef, FilterConfig, FilterValues, RowAction } from "@/types/ui";

// ---------------------------------------------------------------------------
// Enriched row
// ---------------------------------------------------------------------------

interface FirmaListRow {
  id: string;
  firmaAdi: string;
  sektor: string;
  sehir: string;
  anaYetkili: string;
  aktifSozlesme: number;
  risk: RiskSeviyesi;
  durum: FirmaDurumu;
}

// ---------------------------------------------------------------------------
// Sector label helper
// ---------------------------------------------------------------------------

function sectorLabel(code: string | null): string {
  if (!code) return "—";
  return SECTOR_LABELS[code as SectorCode] ?? code;
}

// ---------------------------------------------------------------------------
// Column definitions — no mock dependency
// ---------------------------------------------------------------------------

const COLUMNS: ColumnDef<FirmaListRow>[] = [
  { key: "firmaAdi", header: "Firma Adi", sortable: true },
  {
    key: "sektor",
    header: "Sektor",
    sortable: true,
  },
  { key: "sehir", header: "Sehir", sortable: true },
  { key: "anaYetkili", header: "Ana Yetkili" },
  { key: "aktifSozlesme", header: "Aktif Sozlesme", sortable: true },
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
  const [filters, setFilters] = useState<FilterValues>({ durum: "", risk: "", sektor: "", sehir: "" });
  const handleSearch = useCallback((val: string) => setSearch(val), []);

  // ---------------------------------------------------------------------------
  // Data loading — UUID-keyed enrichment for ALL companies
  // ---------------------------------------------------------------------------
  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [primaryNameById, setPrimaryNameById] = useState<Record<string, string>>({});
  const [activeContractById, setActiveContractById] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const rows = await selectAllCompanies(supabase);
        if (!active) return;
        setCompanies(rows);

        const companyIds = rows.map((r) => r.id);
        if (companyIds.length === 0) { setLoading(false); return; }

        // Enrich via UUID — direct queries, works for all companies
        const [contactsResult, contractsResult] = await Promise.all([
          supabase.from("contacts").select("company_id, full_name, is_primary").eq("is_primary", true).in("company_id", companyIds),
          supabase.from("contracts").select("company_id").eq("status", "aktif").in("company_id", companyIds),
        ]);

        if (!active) return;

        // Primary contact name by company UUID
        const nameMap: Record<string, string> = {};
        for (const c of contactsResult.data ?? []) {
          nameMap[c.company_id] = c.full_name;
        }
        setPrimaryNameById(nameMap);

        // Active contract count by company UUID
        const countMap: Record<string, number> = {};
        for (const c of contractsResult.data ?? []) {
          countMap[c.company_id] = (countMap[c.company_id] ?? 0) + 1;
        }
        setActiveContractById(countMap);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [supabase]);

  // ---------------------------------------------------------------------------
  // Dynamic filter config — no mock dependency
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
      options: [...new Set(companies.map((c) => c.sector).filter(Boolean))].sort().map((s) => ({
        label: sectorLabel(s!),
        value: s!,
      })),
    },
    {
      key: "sehir", label: "Sehir", type: "select" as const, placeholder: "Tum sehirler",
      options: [...new Set(companies.map((c) => c.city).filter(Boolean))].sort().map((s) => ({ label: s!, value: s! })),
    },
  ], [companies]);

  // ---------------------------------------------------------------------------
  // Enriched + filtered rows
  // ---------------------------------------------------------------------------
  const filteredData = useMemo(() => {
    const enriched: FirmaListRow[] = companies.map((c) => {
      const rowId = c.legacy_mock_id ?? c.id;
      return {
        id: rowId,
        firmaAdi: c.name,
        sektor: sectorLabel(c.sector),
        sehir: c.city ?? "—",
        anaYetkili: primaryNameById[c.id] ?? "—",
        aktifSozlesme: activeContractById[c.id] ?? 0,
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
      return true;
    });
  }, [search, filters, companies, primaryNameById, activeContractById]);

  const rowActions: RowAction<FirmaListRow>[] = [
    { label: "Detaya Git", onClick: (row) => router.push(`/firmalar/${row.id}`) },
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
            <SearchInput placeholder="Firma, yetkili, sektor ara..." onChange={handleSearch} />
          </div>
          <FilterBar filters={filterConfig} values={filters} onChange={setFilters} />
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
