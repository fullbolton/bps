"use client";

import { useState, useMemo, useCallback } from "react";
import { formatDateTR } from "@/lib/format-date";
import { Plus } from "lucide-react";
import {
  PageHeader,
  SearchInput,
  FilterBar,
  DataTable,
  StatusBadge,
  PriorityBadge,
  KPIStatCard,
  RightSidePanel,
  EmptyState,
} from "@/components/ui";
import { useRole } from "@/context/RoleContext";
import { NewRequestModal, AssignOwnerModal } from "@/components/modals";
import { MOCK_TALEPLER, getTalepStatusCounts, updateTalepler } from "@/mocks/talepler";
import { MOCK_FIRMALAR } from "@/mocks/firmalar";
import type { MockTalep } from "@/mocks/talepler";
import type { ColumnDef, FilterConfig, FilterValues, RowAction, OncelikSeviyesi } from "@/types/ui";
import { clsx } from "clsx";
import {
  TYPE_BODY,
  TYPE_CAPTION,
  TYPE_LABEL,
  TEXT_PRIMARY,
  TEXT_BODY,
  TEXT_SECONDARY,
  TEXT_INVERSE,
  TEXT_LINK,
  BORDER_SUBTLE,
  RADIUS_FULL,
  SURFACE_HEADER,
} from "@/styles/tokens";

// Page-local helpers
const CHIP_BASE = `px-3 py-1 ${TYPE_LABEL} ${RADIUS_FULL} border transition-colors`;
const CHIP_ACTIVE = `bg-slate-900 ${TEXT_INVERSE} border-slate-900`;
const CHIP_INACTIVE = "bg-white text-slate-600 border-slate-200 hover:bg-slate-50";
const DL_LABEL = `${TYPE_CAPTION} ${TEXT_SECONDARY}`;
const DL_VALUE = `${TYPE_BODY} ${TEXT_BODY} mt-0.5`;

const STATUS_LABELS: Record<string, string> = {
  yeni: "Yeni",
  degerlendiriliyor: "Değerlendiriliyor",
  kismi_doldu: "Kısmi Doldu",
  tamamen_doldu: "Tamamen Doldu",
  beklemede: "Beklemede",
  iptal: "İptal",
};

const FILTER_CONFIG: FilterConfig[] = [
  {
    key: "durum",
    label: "Durum",
    type: "select",
    placeholder: "Tüm durumlar",
    options: Object.entries(STATUS_LABELS).map(([v, l]) => ({ value: v, label: l })),
  },
  {
    key: "oncelik",
    label: "Öncelik",
    type: "select",
    placeholder: "Tüm öncelikler",
    options: [
      { label: "Düşük", value: "dusuk" },
      { label: "Normal", value: "normal" },
      { label: "Yüksek", value: "yuksek" },
      { label: "Kritik", value: "kritik" },
    ],
  },
  {
    key: "firma",
    label: "Firma",
    type: "select",
    placeholder: "Tüm firmalar",
    options: Array.from(new Set(MOCK_TALEPLER.map((t) => t.firmaAdi))).map((n) => ({ label: n, value: n })),
  },
];

/**
 * Columns match PRODUCT_STRUCTURE > Personel Talepleri > Liste kolonları:
 * firma, pozisyon, talep edilen, sağlanan, açık kalan, lokasyon, başlangıç tarihi, öncelik, durum, sorumlu
 */
const COLUMNS: ColumnDef<MockTalep>[] = [
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
  { key: "lokasyon", header: "Lokasyon" },
  { key: "baslangicTarihi", header: "Başlangıç", sortable: true, render: (val) => formatDateTR(val as string) },
  {
    key: "oncelik",
    header: "Öncelik",
    sortable: true,
    render: (val) => <PriorityBadge priority={val as OncelikSeviyesi} />,
  },
  {
    key: "durum",
    header: "Durum",
    sortable: true,
    render: (val) => <StatusBadge status={val as MockTalep["durum"]} />,
  },
  {
    key: "sorumlu",
    header: "Sorumlu",
    render: (val) => <span className={`${TYPE_BODY} ${TEXT_BODY}`}>{(val as string) || "—"}</span>,
  },
];

export default function TaleplerPage() {
  const { role } = useRole();
  const [requests, _setRequests] = useState(MOCK_TALEPLER);
  function setRequests(
    updater: typeof MOCK_TALEPLER | ((prev: typeof MOCK_TALEPLER) => typeof MOCK_TALEPLER)
  ) {
    _setRequests((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      updateTalepler(next);
      return next;
    });
  }
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<FilterValues>({ durum: "", oncelik: "", firma: "" });
  const [newOpen, setNewOpen] = useState(false);
  const [ownerTarget, setOwnerTarget] = useState<{ open: boolean; talepRef?: string; talepId?: string }>({ open: false });
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const handleSearch = useCallback((val: string) => setSearch(val), []);
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const t of requests) counts[t.durum] = (counts[t.durum] || 0) + 1;
    return counts;
  }, [requests]);
  const totalAcikKalan = useMemo(() => requests.reduce((sum, t) => sum + t.acikKalan, 0), [requests]);

  const filteredData = useMemo(() => {
    return requests.filter((t) => {
      if (search) {
        const q = search.toLowerCase();
        if (!t.firmaAdi.toLowerCase().includes(q) && !t.pozisyon.toLowerCase().includes(q) && !t.sorumlu.toLowerCase().includes(q)) return false;
      }
      if (filters.durum && t.durum !== filters.durum) return false;
      if (filters.oncelik && t.oncelik !== filters.oncelik) return false;
      if (filters.firma && t.firmaAdi !== filters.firma) return false;
      return true;
    });
  }, [requests, search, filters]);

  const selectedTalep = useMemo(() => requests.find((t) => t.id === selectedId) ?? null, [requests, selectedId]);
  const firmaOptions = MOCK_FIRMALAR.map((f) => ({ id: f.id, ad: f.firmaAdi }));

  const rowActions: RowAction<MockTalep>[] = [
    { label: "Sorumlu Ata", onClick: (row) => setOwnerTarget({ open: true, talepRef: `${row.pozisyon} — ${row.firmaAdi}`, talepId: row.id }) },
  ];

  if (["goruntuleyici", "ik", "muhasebe"].includes(role)) {
    return (
      <>
        <PageHeader title="Personel Talepleri" subtitle="Talep yönetimi" />
        <EmptyState title="Erişim kısıtlı" description="Bu ekran erişiminizin dışındadır." size="page" />
      </>
    );
  }

  return (
    <>
      <PageHeader title="Personel Talepleri" subtitle="Açık ihtiyaçlar ve doluluk durumu" actions={[
        { label: "Yeni Talep", onClick: () => setNewOpen(true), icon: <Plus size={16} /> },
      ]} />

      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KPIStatCard label="Yeni" value={statusCounts["yeni"] ?? 0} />
          <KPIStatCard label="Değerlendiriliyor" value={statusCounts["degerlendiriliyor"] ?? 0} />
          <KPIStatCard label="Kısmi Doldu" value={statusCounts["kismi_doldu"] ?? 0} />
          <KPIStatCard label="Toplam Açık Kalan" value={totalAcikKalan} />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {Object.entries(statusCounts).filter(([, c]) => c > 0).map(([status, count]) => (
            <button key={status} onClick={() => setFilters((p) => ({ ...p, durum: p.durum === status ? "" : status }))} className={clsx(
              CHIP_BASE,
              filters.durum === status ? CHIP_ACTIVE : CHIP_INACTIVE
            )}>{STATUS_LABELS[status] ?? status} ({count})</button>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="w-full sm:max-w-xs"><SearchInput placeholder="Firma, pozisyon, sorumlu ara..." onChange={handleSearch} /></div>
          <FilterBar filters={FILTER_CONFIG} values={filters} onChange={setFilters} />
        </div>

        <DataTable<MockTalep> columns={COLUMNS} data={filteredData} rowKey="id" onRowClick={(row) => setSelectedId(row.id)} rowActions={rowActions} emptyTitle="Talep bulunamadı" emptyDescription="Arama veya filtre kriterlerinizi değiştirin." />
      </div>

      {/* RequestDetailDrawer */}
      <RightSidePanel open={!!selectedTalep} onClose={() => setSelectedId(null)} title="Talep Detay">
        {selectedTalep && (
          <dl className="space-y-3">
            <div><dt className={DL_LABEL}>Firma</dt><dd className={`${TYPE_BODY} mt-0.5`}><a href={`/firmalar/${selectedTalep.firmaId}`} className={`${TEXT_LINK} hover:underline`}>{selectedTalep.firmaAdi}</a></dd></div>
            <div><dt className={DL_LABEL}>Pozisyon</dt><dd className={DL_VALUE}>{selectedTalep.pozisyon}</dd></div>
            <div><dt className={DL_LABEL}>Durum</dt><dd className="mt-1"><StatusBadge status={selectedTalep.durum} /></dd></div>
            <div><dt className={DL_LABEL}>Öncelik</dt><dd className="mt-1"><PriorityBadge priority={selectedTalep.oncelik} /></dd></div>
            <div className={`pt-2 border-t ${BORDER_SUBTLE}`}>
              <dt className={`${DL_LABEL} mb-2`}>Doluluk Detay</dt>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className={`${SURFACE_HEADER} rounded p-2`}><p className={`text-lg font-semibold ${TEXT_PRIMARY}`}>{selectedTalep.talepEdilen}</p><p className={`${TYPE_CAPTION} ${TEXT_SECONDARY}`}>Talep</p></div>
                <div className="bg-green-50 rounded p-2"><p className="text-lg font-semibold text-green-700">{selectedTalep.saglanan}</p><p className={`${TYPE_CAPTION} ${TEXT_SECONDARY}`}>Sağlanan</p></div>
                <div className={clsx("rounded p-2", selectedTalep.acikKalan > 0 ? "bg-red-50" : "bg-green-50")}><p className={clsx("text-lg font-semibold", selectedTalep.acikKalan > 0 ? "text-red-600" : "text-green-700")}>{selectedTalep.acikKalan}</p><p className={`${TYPE_CAPTION} ${TEXT_SECONDARY}`}>Açık</p></div>
              </div>
            </div>
            <div><dt className={DL_LABEL}>Lokasyon</dt><dd className={DL_VALUE}>{selectedTalep.lokasyon}</dd></div>
            <div><dt className={DL_LABEL}>Başlangıç Tarihi</dt><dd className={DL_VALUE}>{formatDateTR(selectedTalep.baslangicTarihi)}</dd></div>
            <div><dt className={DL_LABEL}>Sorumlu</dt><dd className={DL_VALUE}>{selectedTalep.sorumlu || "—"}</dd></div>
          </dl>
        )}
      </RightSidePanel>

      <NewRequestModal open={newOpen} onClose={() => setNewOpen(false)} firmalar={firmaOptions}
        onSubmit={(p) => {
          setRequests((prev) => [{
            id: `tlp-new-${Date.now()}`, firmaId: p.firmaId, firmaAdi: p.firmaAdi,
            pozisyon: p.pozisyon, talepEdilen: p.adet, saglanan: 0, acikKalan: p.adet,
            lokasyon: p.lokasyon, baslangicTarihi: p.baslangicTarihi,
            oncelik: p.oncelik as MockTalep["oncelik"], durum: "yeni", sorumlu: p.sorumlu,
          }, ...prev]);
        }}
      />
      <AssignOwnerModal open={ownerTarget.open} onClose={() => setOwnerTarget({ open: false })} talepRef={ownerTarget.talepRef} talepId={ownerTarget.talepId}
        onSubmit={({ talepId, sorumlu }) => {
          setRequests((prev) => prev.map((t) => t.id === talepId ? { ...t, sorumlu } : t));
        }}
      />
    </>
  );
}
