"use client";

import { useState, useMemo, useCallback } from "react";
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
import { MOCK_SOZLESMELER } from "@/mocks/sozlesmeler";
import { MOCK_IS_GUCU } from "@/mocks/aktif-isgucu";
import { MOCK_RANDEVULAR } from "@/mocks/randevular";
import { getAnaYetkiliByFirma } from "@/mocks/yetkililer";
import { FIRMA_PARTNER_MAP } from "@/mocks/ayarlar";
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

  const filteredData = useMemo(() => {
    const derivedFirmalar = MOCK_FIRMALAR.map((f) => {
      const firmaRandevular = MOCK_RANDEVULAR.filter((r) => r.firmaId === f.id);
      const sonTamamlananRandevu = [...firmaRandevular]
        .filter((r) => r.durum === "tamamlandi")
        .sort((a, b) => getAppointmentTimestamp(b.tarih, b.saat) - getAppointmentTimestamp(a.tarih, a.saat))[0];
      const sonrakiPlanliRandevu = [...firmaRandevular]
        .filter((r) => r.durum === "planlandi")
        .sort((a, b) => getAppointmentTimestamp(a.tarih, a.saat) - getAppointmentTimestamp(b.tarih, b.saat))[0];

      return {
        ...f,
        aktifSozlesme: MOCK_SOZLESMELER.filter((s) => s.firmaId === f.id && s.durum === "aktif").length,
        aktifIsGucu: MOCK_IS_GUCU.find((ig) => ig.firmaId === f.id)?.aktifKisi ?? 0,
        anaYetkili: getAnaYetkiliByFirma(f.id) ?? f.anaYetkili,
        sonGorusme: sonTamamlananRandevu?.tarih ?? f.sonGorusme ?? "—",
        sonrakiRandevu: sonrakiPlanliRandevu?.tarih ?? f.sonrakiRandevu ?? "—",
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
  }, [search, filters]);

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
