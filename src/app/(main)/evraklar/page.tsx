"use client";

import { useState, useMemo, useCallback } from "react";
import { formatDateTR } from "@/lib/format-date";
import { Upload, AlertTriangle } from "lucide-react";
import {
  PageHeader,
  SearchInput,
  FilterBar,
  DataTable,
  StatusBadge,
  RightSidePanel,
  DocumentsChecklistCard,
  EmptyState,
} from "@/components/ui";
import { useRole } from "@/context/RoleContext";
import { UploadDocumentModal, UpdateValidityModal } from "@/components/modals";
import { MOCK_EVRAKLAR, getEvrakStatusCounts, updateEvraklar } from "@/mocks/evraklar";
import { MOCK_FIRMALAR } from "@/mocks/firmalar";
import { KATEGORI_LABELS } from "@/types/batch4";
import type { MockEvrak } from "@/mocks/evraklar";
import type { EvrakKategorisi } from "@/types/batch4";
import type { ColumnDef, FilterConfig, FilterValues, RowAction } from "@/types/ui";
import { clsx } from "clsx";
import {
  TYPE_BODY,
  TYPE_CAPTION,
  TYPE_LABEL,
  TEXT_BODY,
  TEXT_SECONDARY,
  TEXT_MUTED,
  TEXT_INVERSE,
  BORDER_SUBTLE,
  RADIUS_FULL,
  RADIUS_DEFAULT,
} from "@/styles/tokens";

// Page-local helpers
const CHIP_BASE = `px-3 py-1 ${TYPE_LABEL} ${RADIUS_FULL} border transition-colors`;
const CHIP_ACTIVE = `bg-slate-900 ${TEXT_INVERSE} border-slate-900`;
const CHIP_INACTIVE = "bg-white text-slate-600 border-slate-200 hover:bg-slate-50";
const LIST_DIVIDER = `border-b ${BORDER_SUBTLE} last:border-0`;

const STATUS_LABELS: Record<string, string> = {
  tam: "Tam",
  eksik: "Eksik",
  suresi_yaklsiyor: "Süresi Yaklaşıyor",
  suresi_doldu: "Süresi Doldu",
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
    key: "kategori",
    label: "Kategori",
    type: "select",
    placeholder: "Tüm kategoriler",
    options: (Object.keys(KATEGORI_LABELS) as EvrakKategorisi[]).map((k) => ({ value: k, label: KATEGORI_LABELS[k] })),
  },
  {
    key: "firma",
    label: "Firma",
    type: "select",
    placeholder: "Tüm firmalar",
    options: Array.from(new Set(MOCK_EVRAKLAR.map((e) => e.firmaAdi))).map((n) => ({ label: n, value: n })),
  },
];

/**
 * Columns match PRODUCT_STRUCTURE > Evraklar > Liste kolonları:
 * evrak adı, firma, kategori, geçerlilik tarihi, durum, yükleyen, güncellenme tarihi
 */
const COLUMNS: ColumnDef<MockEvrak>[] = [
  { key: "evrakAdi", header: "Evrak Adı", sortable: true },
  { key: "firmaAdi", header: "Firma", sortable: true },
  {
    key: "kategori",
    header: "Kategori",
    render: (val) => <span className={`${TYPE_BODY} ${TEXT_BODY}`}>{KATEGORI_LABELS[val as EvrakKategorisi] ?? String(val)}</span>,
  },
  {
    key: "gecerlilikTarihi",
    header: "Geçerlilik Tarihi",
    sortable: true,
    render: (val) => <span className={`${TYPE_BODY} ${TEXT_BODY}`}>{formatDateTR(val as string)}</span>,
  },
  {
    key: "durum",
    header: "Durum",
    sortable: true,
    render: (val) => <StatusBadge status={val as MockEvrak["durum"]} />,
  },
  {
    key: "yukleyen",
    header: "Yükleyen",
    render: (val) => <span className={`${TYPE_BODY} ${TEXT_BODY}`}>{(val as string) || "—"}</span>,
  },
  { key: "guncellenmeTarihi", header: "Güncellenme", sortable: true, render: (val) => formatDateTR(val as string) },
];

export default function EvraklarPage() {
  const { role } = useRole();
  const [documents, _setDocuments] = useState(MOCK_EVRAKLAR);
  // Wrap setter to sync shared module state for Dashboard/Company Detail consistency
  function setDocuments(updater: typeof MOCK_EVRAKLAR | ((prev: typeof MOCK_EVRAKLAR) => typeof MOCK_EVRAKLAR)) {
    _setDocuments((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      updateEvraklar(next);
      return next;
    });
  }
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<FilterValues>({ durum: "", kategori: "", firma: "" });
  const [uploadOpen, setUploadOpen] = useState(false);
  const [validityTarget, setValidityTarget] = useState<{ open: boolean; evrakAdi?: string; evrakId?: string; currentDate?: string }>({ open: false });
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const handleSearch = useCallback((val: string) => setSearch(val), []);
  const statusCounts = useMemo(() => {
    const c: Record<string, number> = { tam: 0, eksik: 0, suresi_yaklsiyor: 0, suresi_doldu: 0 };
    for (const e of documents) c[e.durum] = (c[e.durum] || 0) + 1;
    return c;
  }, [documents]);

  const filteredData = useMemo(() => {
    return documents.filter((e) => {
      if (search) {
        const q = search.toLowerCase();
        if (!e.evrakAdi.toLowerCase().includes(q) && !e.firmaAdi.toLowerCase().includes(q)) return false;
      }
      if (filters.durum && e.durum !== filters.durum) return false;
      if (filters.kategori && e.kategori !== filters.kategori) return false;
      if (filters.firma && e.firmaAdi !== filters.firma) return false;
      return true;
    });
  }, [documents, search, filters]);

  const selectedEvrak = useMemo(() => documents.find((e) => e.id === selectedId) ?? null, [documents, selectedId]);

  // FirmDocumentChecklistPanel: show selected firma's documents
  const firmaEvraklar = useMemo(() => {
    if (!selectedEvrak) return [];
    return documents.filter((e) => e.firmaId === selectedEvrak.firmaId);
  }, [documents, selectedEvrak]);

  const firmaEvrakCounts = useMemo(() => {
    const c = { tam: 0, eksik: 0, suresiYaklsiyor: 0, suresiDoldu: 0 };
    for (const e of firmaEvraklar) {
      if (e.durum === "tam") c.tam++;
      else if (e.durum === "eksik") c.eksik++;
      else if (e.durum === "suresi_yaklsiyor") c.suresiYaklsiyor++;
      else if (e.durum === "suresi_doldu") c.suresiDoldu++;
    }
    return c;
  }, [firmaEvraklar]);

  const firmaOptions = MOCK_FIRMALAR.map((f) => ({ id: f.id, ad: f.firmaAdi }));

  const canMutateEvrak = ["yonetici", "operasyon", "ik"].includes(role);
  const rowActions: RowAction<MockEvrak>[] = canMutateEvrak ? [
    {
      label: "Geçerlilik Güncelle",
      onClick: (row) => setValidityTarget({ open: true, evrakAdi: row.evrakAdi, evrakId: row.id, currentDate: row.gecerlilikTarihi }),
    },
  ] : [];

  if (["goruntuleyici", "muhasebe"].includes(role)) {
    return (
      <>
        <PageHeader title="Evraklar" subtitle="Belge takibi" />
        <EmptyState title="Erişim kısıtlı" description="Bu ekran görüntüleyici erişiminin dışındadır." size="page" />
      </>
    );
  }

  return (
    <>
      <PageHeader title="Evraklar" subtitle="Belge ve uygunluk görünürlüğü" actions={canMutateEvrak ? [
        { label: "Evrak Yükle", onClick: () => setUploadOpen(true), icon: <Upload size={16} /> },
      ] : []} />

      <div className="space-y-4">
        <DocumentsChecklistCard
          tam={statusCounts["tam"] ?? 0}
          eksik={statusCounts["eksik"] ?? 0}
          suresiYaklsiyor={statusCounts["suresi_yaklsiyor"] ?? 0}
          suresiDoldu={statusCounts["suresi_doldu"] ?? 0}
        />

        {/* Operational billing-risk signal — read-only, driven by document completeness */}
        {(() => {
          const riskCount = (statusCounts["eksik"] ?? 0) + (statusCounts["suresi_doldu"] ?? 0);
          if (riskCount === 0) return null;
          // group by firma
          const firmaRisk = new Map<string, string[]>();
          for (const e of documents) {
            if (e.durum === "eksik" || e.durum === "suresi_doldu") {
              const list = firmaRisk.get(e.firmaAdi) ?? [];
              list.push(e.evrakAdi);
              firmaRisk.set(e.firmaAdi, list);
            }
          }
          return (
            <div className={`${RADIUS_DEFAULT} border border-amber-200 bg-amber-50 p-4`}>
              <h3 className={`${TYPE_BODY} font-medium text-amber-800 flex items-center gap-1.5 mb-2`}>
                <AlertTriangle size={14} />
                Operasyonel Faturalama Riski
              </h3>
              <p className={`${TYPE_CAPTION} text-amber-700 mb-2`}>
                {riskCount} evrak eksik veya süresi dolmuş — ilgili firmalarda faturalama süreci etkilenebilir.
              </p>
              <div className="space-y-1">
                {Array.from(firmaRisk.entries()).map(([firma, evraklar]) => (
                  <p key={firma} className={`${TYPE_CAPTION} text-amber-600`}>
                    <span className="font-medium">{firma}</span>: {evraklar.length} sorunlu evrak
                  </p>
                ))}
              </div>
            </div>
          );
        })()}

        <div className="flex items-center gap-2 flex-wrap">
          {Object.entries(statusCounts).filter(([, c]) => c > 0).map(([status, count]) => (
            <button key={status} onClick={() => setFilters((p) => ({ ...p, durum: p.durum === status ? "" : status }))} className={clsx(
              CHIP_BASE,
              filters.durum === status ? CHIP_ACTIVE : CHIP_INACTIVE
            )}>{STATUS_LABELS[status] ?? status} ({count})</button>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="w-full sm:max-w-xs"><SearchInput placeholder="Evrak, firma ara..." onChange={handleSearch} /></div>
          <FilterBar filters={FILTER_CONFIG} values={filters} onChange={setFilters} />
        </div>

        <DataTable<MockEvrak> columns={COLUMNS} data={filteredData} rowKey="id" onRowClick={(row) => setSelectedId(row.id)} rowActions={rowActions} emptyTitle="Evrak bulunamadı" emptyDescription="Arama veya filtre kriterlerinizi değiştirin." />
      </div>

      {/* FirmDocumentChecklistPanel */}
      <RightSidePanel open={!!selectedEvrak} onClose={() => setSelectedId(null)} title={selectedEvrak ? `${selectedEvrak.firmaAdi} — Evrak Durumu` : undefined}>
        {selectedEvrak && (
          <div className="space-y-4">
            <DocumentsChecklistCard {...firmaEvrakCounts} />
            <div className="space-y-2">
              {firmaEvraklar.map((e) => (
                <div key={e.id} className={`flex items-center justify-between py-2 ${LIST_DIVIDER}`}>
                  <div className="min-w-0">
                    <p className={`${TYPE_BODY} ${TEXT_BODY}`}>{e.evrakAdi}</p>
                    <p className={`${TYPE_CAPTION} ${TEXT_MUTED} mt-0.5`}>{KATEGORI_LABELS[e.kategori]} {e.gecerlilikTarihi ? `· ${formatDateTR(e.gecerlilikTarihi)}` : ""}</p>
                  </div>
                  <StatusBadge status={e.durum} />
                </div>
              ))}
            </div>
          </div>
        )}
      </RightSidePanel>

      <UploadDocumentModal open={uploadOpen} onClose={() => setUploadOpen(false)} firmalar={firmaOptions}
        onSubmit={(p) => {
          setDocuments((prev) => [{
            id: `ev-new-${Date.now()}`, evrakAdi: p.evrakAdi, firmaId: p.firmaId, firmaAdi: p.firmaAdi,
            kategori: p.kategori, gecerlilikTarihi: p.gecerlilikTarihi,
            durum: p.gecerlilikTarihi ? "tam" : "eksik", yukleyen: "Demo Kullanıcı",
            guncellenmeTarihi: new Date().toISOString().split("T")[0],
          }, ...prev]);
        }}
      />
      <UpdateValidityModal open={validityTarget.open} onClose={() => setValidityTarget({ open: false })} evrakAdi={validityTarget.evrakAdi} evrakId={validityTarget.evrakId} currentDate={validityTarget.currentDate}
        onSubmit={({ evrakId, yeniTarih }) => {
          setDocuments((prev) => prev.map((e) => e.id === evrakId ? { ...e, gecerlilikTarihi: yeniTarih, durum: "tam" as const, guncellenmeTarihi: new Date().toISOString().split("T")[0] } : e));
        }}
      />
    </>
  );
}
