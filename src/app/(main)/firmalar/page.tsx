"use client";

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
import { MOCK_FIRMALAR } from "@/mocks/firmalar";
import { FIRMA_PARTNER_MAP } from "@/mocks/ayarlar";
import { createClient } from "@/lib/supabase/client";
import { getPrimaryContactNamesByLegacyIds } from "@/lib/services/contacts";
import { getActiveContractCountsByLegacyIds } from "@/lib/services/contracts";
import { getWorkforceSummariesByLegacyIds, deriveOpenGap } from "@/lib/services/workforce-summary";
import { getAppointmentDatesByLegacyIds } from "@/lib/services/appointments";
import type { WorkforceSummaryRow } from "@/types/database.types";
import type { MockFirma } from "@/mocks/firmalar";
import type { ColumnDef, FilterConfig, FilterValues, RowAction } from "@/types/ui";

function getAppointmentTimestamp(tarih: string, saat?: string) {
  const value = new Date(`${tarih}T${saat || "00:00"}`).getTime();
  return Number.isNaN(value) ? 0 : value;
}

const FILTER_CONFIG: FilterConfig[] = [
  {
    key: "durum",
    label: "Durum",
    type: "select",
    placeholder: "Tüm durumlar",
    options: [
      { label: "Aday", value: "aday" },
      { label: "Aktif", value: "aktif" },
      { label: "Pasif", value: "pasif" },
    ],
  },
  {
    key: "risk",
    label: "Risk",
    type: "select",
    placeholder: "Tüm riskler",
    options: [
      { label: "Düşük", value: "dusuk" },
      { label: "Orta", value: "orta" },
      { label: "Yüksek", value: "yuksek" },
    ],
  },
  {
    key: "sektor",
    label: "Sektör",
    type: "select",
    placeholder: "Tüm sektörler",
    options: Array.from(new Set(MOCK_FIRMALAR.map((f) => f.sektor))).map((s) => ({
      label: s,
      value: s,
    })),
  },
  {
    key: "sehir",
    label: "Şehir",
    type: "select",
    placeholder: "Tüm şehirler",
    options: Array.from(new Set(MOCK_FIRMALAR.map((f) => f.sehir))).map((s) => ({
      label: s,
      value: s,
    })),
  },
  {
    key: "partner",
    label: "Partner",
    type: "select",
    placeholder: "Tüm partnerler",
    options: Array.from(new Set(Object.values(FIRMA_PARTNER_MAP).map((p) => p.partnerAdi))).map((name) => ({
      label: name,
      value: name,
    })),
  },
];

/**
 * Columns match PRODUCT_STRUCTURE > Firmalar > Liste kolonları exactly:
 * firma adı, sektör, şehir, ana yetkili, aktif sözleşme,
 * aktif iş gücü, son görüşme, sonraki randevu, risk etiketi, durum
 */
const COLUMNS: ColumnDef<MockFirma>[] = [
  { key: "firmaAdi", header: "Firma Adı", sortable: true },
  { key: "sektor", header: "Sektör", sortable: true },
  {
    key: "sehir",
    header: "Şehir",
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
  { key: "aktifSozlesme", header: "Aktif Sözleşme", sortable: true },
  { key: "aktifIsGucu", header: "Aktif İş Gücü", sortable: true },
  { key: "sonGorusme", header: "Son Görüşme", sortable: true, render: (val) => formatDateTR(val as string) },
  { key: "sonrakiRandevu", header: "Sonraki Randevu", sortable: true, render: (val) => formatDateTR(val as string) },
  {
    key: "risk",
    header: "Risk Etiketi",
    sortable: true,
    render: (val) => <RiskBadge risk={val as MockFirma["risk"]} />,
  },
  {
    key: "durum",
    header: "Durum",
    sortable: true,
    render: (val) => <StatusBadge status={val as MockFirma["durum"]} />,
  },
];

export default function FirmalarPage() {
  const router = useRouter();

  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<FilterValues>({
    durum: "",
    risk: "",
    sektor: "",
    sehir: "",
    partner: "",
  });
  const handleSearch = useCallback((val: string) => setSearch(val), []);

  // Faz 1A: Ana Yetkili column reads from real contacts truth via the
  // service layer. We resolve every visible firma's primary contact in a
  // single round trip (no N+1) and fall back to the firma's static
  // mock-shipped value when the firma has no primary contact yet, or
  // when RLS hides it from the current caller. The full Firmalar list
  // cutover will replace MOCK_FIRMALAR entirely; this slice only
  // touches the Ana Yetkili column.
  //
  // Faz 2 addition: the Aktif Sözleşme column now also resolves through
  // the contracts service via getActiveContractCountsByLegacyIds. The
  // batched query returns one count per firma in a single round trip;
  // out-of-scope or contract-less firmas surface as 0 in the fallback.
  // Both fetches share the same Supabase client and run in parallel.
  const supabase = useMemo(() => createClient(), []);
  const [primaryNames, setPrimaryNames] = useState<Record<string, string>>({});
  const [activeContractCounts, setActiveContractCounts] = useState<Record<string, number>>({});
  const [workforceByLegacy, setWorkforceByLegacy] = useState<Record<string, WorkforceSummaryRow>>({});
  const [appointmentDates, setAppointmentDates] = useState<{
    lastCompleted: Record<string, string>;
    nextPlanned: Record<string, string>;
  }>({ lastCompleted: {}, nextPlanned: {} });
  useEffect(() => {
    let active = true;
    const legacyIds = MOCK_FIRMALAR.map((f) => f.id);
    Promise.all([
      getPrimaryContactNamesByLegacyIds(supabase, legacyIds).catch(() => ({})),
      getActiveContractCountsByLegacyIds(supabase, legacyIds).catch(() => ({})),
      getWorkforceSummariesByLegacyIds(supabase, legacyIds).catch(() => ({})),
      getAppointmentDatesByLegacyIds(supabase, legacyIds).catch(() => ({ lastCompleted: {}, nextPlanned: {} })),
    ]).then(([names, counts, workforce, apptDates]) => {
      if (!active) return;
      setPrimaryNames(names);
      setActiveContractCounts(counts);
      setWorkforceByLegacy(workforce);
      setAppointmentDates(apptDates);
    });
    return () => {
      active = false;
    };
  }, [supabase]);

  const filteredData = useMemo(() => {
    const derivedFirmalar = MOCK_FIRMALAR.map((f) => {
      // Workforce: real DB truth if available, otherwise static mock
      const wf = workforceByLegacy[f.id];
      const aktifIsGucu = wf?.current_count ?? 0;

      return {
        ...f,
        aktifSozlesme: activeContractCounts[f.id] ?? 0,
        aktifIsGucu,
        anaYetkili: primaryNames[f.id] ?? f.anaYetkili,
        sonGorusme: appointmentDates.lastCompleted[f.id] ?? "—",
        sonrakiRandevu: appointmentDates.nextPlanned[f.id] ?? "—",
      };
    });

    return derivedFirmalar.filter((f) => {
      if (search) {
        const q = search.toLowerCase();
        const match =
          f.firmaAdi.toLowerCase().includes(q) ||
          f.anaYetkili.toLowerCase().includes(q) ||
          f.sektor.toLowerCase().includes(q) ||
          f.sehir.toLowerCase().includes(q);
        if (!match) return false;
      }
      if (filters.durum && f.durum !== filters.durum) return false;
      if (filters.risk && f.risk !== filters.risk) return false;
      if (filters.sektor && f.sektor !== filters.sektor) return false;
      if (filters.sehir && f.sehir !== filters.sehir) return false;
      if (filters.partner && FIRMA_PARTNER_MAP[f.id]?.partnerAdi !== filters.partner) return false;
      return true;
    });
  }, [search, filters, primaryNames, activeContractCounts, workforceByLegacy, appointmentDates]);

  const rowActions: RowAction<MockFirma>[] = [
    {
      label: "Detaya Git",
      onClick: (row: MockFirma) => router.push(`/firmalar/${row.id}`),
    },
  ];

  return (
    <>
      <PageHeader
        title="Firmalar"
        subtitle="Firma portföyü"
      />

      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="w-full sm:max-w-xs">
            <SearchInput
              placeholder="Firma, yetkili, sektör ara..."
              onChange={handleSearch}
            />
          </div>
          <FilterBar
            filters={FILTER_CONFIG}
            values={filters}
            onChange={setFilters}
          />
        </div>

        <DataTable<MockFirma>
          columns={COLUMNS}
          data={filteredData}
          rowKey="id"
          onRowClick={(row) => router.push(`/firmalar/${row.id}`)}
          rowActions={rowActions}
          emptyTitle="Firma bulunamadı"
          emptyDescription="Arama veya filtre kriterlerinizi değiştirin."
        />
      </div>
    </>
  );
}
