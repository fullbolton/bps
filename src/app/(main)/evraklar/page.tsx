"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
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
import { MOCK_FIRMALAR } from "@/mocks/firmalar";
import { createClient } from "@/lib/supabase/client";
import {
  listAllDocuments,
  createDocument,
  updateDocumentValidity,
} from "@/lib/services/documents";
import { getCompanyDisplayMapByIds } from "@/lib/services/companies";
import { DOCUMENT_CATEGORY_LABELS } from "@/lib/document-categories";
import type { DocumentCategory } from "@/lib/document-categories";
import type { DocumentRow } from "@/types/database.types";
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

// ---------------------------------------------------------------------------
// Enriched row — extends DocumentRow with resolved firma info
// ---------------------------------------------------------------------------

interface DocumentListRow extends DocumentRow {
  firma_name: string;
  firma_legacy_id: string | null;
}

// Page-local helpers
const CHIP_BASE = `px-3 py-1 ${TYPE_LABEL} ${RADIUS_FULL} border transition-colors`;
const CHIP_ACTIVE = `bg-slate-900 ${TEXT_INVERSE} border-slate-900`;
const CHIP_INACTIVE = "bg-white text-slate-600 border-slate-200 hover:bg-slate-50";
const LIST_DIVIDER = `border-b ${BORDER_SUBTLE} last:border-0`;

const STATUS_LABELS: Record<string, string> = {
  tam: "Tam",
  eksik: "Eksik",
  suresi_yaklsiyor: "Suresi Yaklaiyor",
  suresi_doldu: "Suresi Doldu",
};

const FILTER_CONFIG: FilterConfig[] = [
  {
    key: "durum",
    label: "Durum",
    type: "select",
    placeholder: "Tum durumlar",
    options: Object.entries(STATUS_LABELS).map(([v, l]) => ({ value: v, label: l })),
  },
  {
    key: "kategori",
    label: "Kategori",
    type: "select",
    placeholder: "Tum kategoriler",
    options: (Object.keys(DOCUMENT_CATEGORY_LABELS) as DocumentCategory[]).map((k) => ({ value: k, label: DOCUMENT_CATEGORY_LABELS[k] })),
  },
];

/**
 * Columns match PRODUCT_STRUCTURE > Evraklar > Liste kolonlari:
 * evrak adi, firma, kategori, gecerlilik tarihi, durum, yukleyen, guncellenme tarihi
 */
const COLUMNS: ColumnDef<DocumentListRow>[] = [
  { key: "name", header: "Evrak Adi", sortable: true },
  { key: "firma_name", header: "Firma", sortable: true },
  {
    key: "category",
    header: "Kategori",
    render: (val) => <span className={`${TYPE_BODY} ${TEXT_BODY}`}>{DOCUMENT_CATEGORY_LABELS[val as DocumentCategory] ?? String(val)}</span>,
  },
  {
    key: "validity_date",
    header: "Gecerlilik Tarihi",
    sortable: true,
    render: (val) => <span className={`${TYPE_BODY} ${TEXT_BODY}`}>{formatDateTR(val as string)}</span>,
  },
  {
    key: "status",
    header: "Durum",
    sortable: true,
    render: (val) => <StatusBadge status={val as DocumentListRow["status"]} />,
  },
  {
    key: "uploaded_by",
    header: "Yukleyen",
    render: (val) => <span className={`${TYPE_BODY} ${TEXT_BODY}`}>{(val as string) || "\u2014"}</span>,
  },
  {
    key: "updated_at",
    header: "Guncellenme",
    sortable: true,
    render: (val) => formatDateTR((val as string)?.split("T")[0] ?? ""),
  },
];

export default function EvraklarPage() {
  const { role } = useRole();
  const router = useRouter();
  const supabase = createClient();

  // ---------------------------------------------------------------------------
  // Data loading
  // ---------------------------------------------------------------------------
  const [documents, setDocuments] = useState<DocumentListRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setLoadError(null);
      const allDocs = await listAllDocuments(supabase);

      // Resolve company names
      const companyIds = [...new Set(allDocs.map((d) => d.company_id))];
      const { nameById, legacyById } = companyIds.length > 0
        ? await getCompanyDisplayMapByIds(supabase, companyIds)
        : { nameById: {} as Record<string, string>, legacyById: {} as Record<string, string> };

      const enriched: DocumentListRow[] = allDocs.map((d) => ({
        ...d,
        firma_name: nameById[d.company_id] ?? "Bilinmeyen Firma",
        firma_legacy_id: legacyById[d.company_id] ?? null,
      }));

      setDocuments(enriched);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Evraklar yuklenemedi.");
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    let active = true;
    reload().then(() => { if (!active) return; });
    return () => { active = false; };
  }, [reload]);

  // ---------------------------------------------------------------------------
  // UI state
  // ---------------------------------------------------------------------------
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<FilterValues>({ durum: "", kategori: "", firma: "" });
  const [uploadOpen, setUploadOpen] = useState(false);
  const [validityTarget, setValidityTarget] = useState<{ open: boolean; evrakAdi?: string; evrakId?: string; currentDate?: string }>({ open: false });
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const handleSearch = useCallback((val: string) => setSearch(val), []);
  const statusCounts = useMemo(() => {
    const c: Record<string, number> = { tam: 0, eksik: 0, suresi_yaklsiyor: 0, suresi_doldu: 0 };
    for (const e of documents) c[e.status] = (c[e.status] || 0) + 1;
    return c;
  }, [documents]);

  // Build firma filter options dynamically from loaded data
  const firmaFilterConfig = useMemo((): FilterConfig[] => {
    const firmaNames = [...new Set(documents.map((d) => d.firma_name))].sort();
    return [
      ...FILTER_CONFIG,
      {
        key: "firma",
        label: "Firma",
        type: "select" as const,
        placeholder: "Tum firmalar",
        options: firmaNames.map((n) => ({ label: n, value: n })),
      },
    ];
  }, [documents]);

  const filteredData = useMemo(() => {
    return documents.filter((e) => {
      if (search) {
        const q = search.toLowerCase();
        if (!e.name.toLowerCase().includes(q) && !e.firma_name.toLowerCase().includes(q)) return false;
      }
      if (filters.durum && e.status !== filters.durum) return false;
      if (filters.kategori && e.category !== filters.kategori) return false;
      if (filters.firma && e.firma_name !== filters.firma) return false;
      return true;
    });
  }, [documents, search, filters]);

  const selectedEvrak = useMemo(() => documents.find((e) => e.id === selectedId) ?? null, [documents, selectedId]);

  // FirmDocumentChecklistPanel: show selected firma's documents
  const firmaEvraklar = useMemo(() => {
    if (!selectedEvrak) return [];
    return documents.filter((e) => e.company_id === selectedEvrak.company_id);
  }, [documents, selectedEvrak]);

  const firmaEvrakCounts = useMemo(() => {
    const c = { tam: 0, eksik: 0, suresiYaklsiyor: 0, suresiDoldu: 0 };
    for (const e of firmaEvraklar) {
      if (e.status === "tam") c.tam++;
      else if (e.status === "eksik") c.eksik++;
      else if (e.status === "suresi_yaklsiyor") c.suresiYaklsiyor++;
      else if (e.status === "suresi_doldu") c.suresiDoldu++;
    }
    return c;
  }, [firmaEvraklar]);

  const firmaOptions = MOCK_FIRMALAR.map((f) => ({ id: f.id, ad: f.firmaAdi }));

  const canMutateEvrak = ["yonetici", "operasyon", "ik"].includes(role);
  const rowActions: RowAction<DocumentListRow>[] = canMutateEvrak ? [
    {
      label: "Gecerlilik Guncelle",
      onClick: (row) => setValidityTarget({ open: true, evrakAdi: row.name, evrakId: row.id, currentDate: row.validity_date ?? "" }),
    },
  ] : [];

  if (["goruntuleyici", "muhasebe"].includes(role)) {
    return (
      <>
        <PageHeader title="Evraklar" subtitle="Belge takibi" />
        <EmptyState title="Erisim kisitli" description="Bu ekran goruntleyici erisiminin disindadir." size="page" />
      </>
    );
  }

  if (loading) {
    return (
      <>
        <PageHeader title="Evraklar" subtitle="Belge ve uygunluk gorunurlugu" />
        <p className={`${TYPE_BODY} ${TEXT_SECONDARY} py-8 text-center`}>Yukleniyor...</p>
      </>
    );
  }

  if (loadError) {
    return (
      <>
        <PageHeader title="Evraklar" subtitle="Belge ve uygunluk gorunurlugu" />
        <div className={`${RADIUS_DEFAULT} border border-red-200 bg-red-50 p-4 text-sm text-red-700`}>{loadError}</div>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Evraklar" subtitle="Belge ve uygunluk gorunurlugu" actions={canMutateEvrak ? [
        { label: "Evrak Yukle", onClick: () => setUploadOpen(true), icon: <Upload size={16} /> },
      ] : []} />

      <div className="space-y-4">
        <DocumentsChecklistCard
          tam={statusCounts["tam"] ?? 0}
          eksik={statusCounts["eksik"] ?? 0}
          suresiYaklsiyor={statusCounts["suresi_yaklsiyor"] ?? 0}
          suresiDoldu={statusCounts["suresi_doldu"] ?? 0}
        />

        {/* Operational billing-risk signal -- read-only, driven by document completeness */}
        {(() => {
          const riskCount = (statusCounts["eksik"] ?? 0) + (statusCounts["suresi_doldu"] ?? 0);
          if (riskCount === 0) return null;
          // group by firma
          const firmaRisk = new Map<string, string[]>();
          for (const e of documents) {
            if (e.status === "eksik" || e.status === "suresi_doldu") {
              const list = firmaRisk.get(e.firma_name) ?? [];
              list.push(e.name);
              firmaRisk.set(e.firma_name, list);
            }
          }
          return (
            <div className={`${RADIUS_DEFAULT} border border-amber-200 bg-amber-50 p-4`}>
              <h3 className={`${TYPE_BODY} font-medium text-amber-800 flex items-center gap-1.5 mb-2`}>
                <AlertTriangle size={14} />
                Operasyonel Faturalama Riski
              </h3>
              <p className={`${TYPE_CAPTION} text-amber-700 mb-2`}>
                {riskCount} evrak eksik veya suresi dolmus -- ilgili firmalarda faturalama sureci etkilenebilir.
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
          <FilterBar filters={firmaFilterConfig} values={filters} onChange={setFilters} />
        </div>

        <DataTable<DocumentListRow> columns={COLUMNS} data={filteredData} rowKey="id" onRowClick={(row) => setSelectedId(row.id)} rowActions={rowActions} emptyTitle="Evrak bulunamadi" emptyDescription="Arama veya filtre kriterlerinizi degistirin." />
      </div>

      {/* FirmDocumentChecklistPanel */}
      <RightSidePanel open={!!selectedEvrak} onClose={() => setSelectedId(null)} title={selectedEvrak ? `${selectedEvrak.firma_name} -- Evrak Durumu` : undefined}>
        {selectedEvrak && (
          <div className="space-y-4">
            <DocumentsChecklistCard {...firmaEvrakCounts} />
            <div className="space-y-2">
              {firmaEvraklar.map((e) => (
                <div key={e.id} className={`flex items-center justify-between py-2 ${LIST_DIVIDER}`}>
                  <div className="min-w-0">
                    <p className={`${TYPE_BODY} ${TEXT_BODY}`}>{e.name}</p>
                    <p className={`${TYPE_CAPTION} ${TEXT_MUTED} mt-0.5`}>{DOCUMENT_CATEGORY_LABELS[e.category]} {e.validity_date ? `\u00b7 ${formatDateTR(e.validity_date)}` : ""}</p>
                  </div>
                  <StatusBadge status={e.status} />
                </div>
              ))}
            </div>
          </div>
        )}
      </RightSidePanel>

      <UploadDocumentModal open={uploadOpen} onClose={() => setUploadOpen(false)} firmalar={firmaOptions}
        onSubmit={async (p) => {
          await createDocument(supabase, {
            legacyCompanyId: p.firmaId,
            name: p.evrakAdi,
            category: p.kategori,
            validityDate: p.gecerlilikTarihi,
          });
          await reload();
          router.refresh();
        }}
      />
      <UpdateValidityModal open={validityTarget.open} onClose={() => setValidityTarget({ open: false })} evrakAdi={validityTarget.evrakAdi} evrakId={validityTarget.evrakId} currentDate={validityTarget.currentDate}
        onSubmit={async ({ evrakId, yeniTarih }) => {
          await updateDocumentValidity(supabase, evrakId, { validityDate: yeniTarih });
          await reload();
          router.refresh();
        }}
      />
    </>
  );
}
