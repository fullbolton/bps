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
import { createClient } from "@/lib/supabase/client";
import {
  listAllDocuments,
  createDocument,
  updateDocumentValidity,
} from "@/lib/services/documents";
import { getCompanyDisplayMapByIds } from "@/lib/services/companies";
import { selectAllCompanies } from "@/lib/supabase/companies";
import type { CompanyRow } from "@/types/database.types";
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
    render: (val) => <span className={`${TYPE_BODY} ${TEXT_BODY}`}>{(val as string) || "—"}</span>,
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
  // Real companies for the Upload modal's firma dropdown. RLS-scoped;
  // modal emits `firmaId` that flows to createDocument as
  // `legacyCompanyId`, so option id prefers legacy_mock_id and falls
  // back to the UUID.
  const [allCompanies, setAllCompanies] = useState<CompanyRow[]>([]);

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

  // Companies for the firma dropdown — loaded once on mount. Errors
  // degrade to an empty list so the dropdown is honestly empty.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const rows = await selectAllCompanies(supabase);
        if (active) setAllCompanies(rows);
      } catch {
        if (active) setAllCompanies([]);
      }
    })();
    return () => { active = false; };
  }, [supabase]);

  // ---------------------------------------------------------------------------
  // UI state
  // ---------------------------------------------------------------------------
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<FilterValues>({ durum: "", kategori: "", firma: "" });
  const [uploadOpen, setUploadOpen] = useState(false);
  const [validityTarget, setValidityTarget] = useState<{ open: boolean; evrakAdi?: string; evrakId?: string; currentDate?: string }>({ open: false });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Per-row signed-URL failures. A failure here used to flow into the
  // page-level `loadError` and collapse the whole page; now it stays
  // item-level so the row remains visible with a degraded "Indir"
  // action. Cleared on page reload (full mount = new Set).
  const [signedUrlErrorIds, setSignedUrlErrorIds] = useState<Set<string>>(
    () => new Set(),
  );

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

  const firmaOptions = useMemo(
    () =>
      allCompanies.map((c) => ({
        id: c.legacy_mock_id ?? c.id,
        ad: c.name,
      })),
    [allCompanies],
  );

  // Partner'ın evrak yükleme hakkı ROLE_MATRIX §5.7 ve documents RLS
  // INSERT policy'sinde "Portföyünde Evet" olarak kayıtlıdır. Mevcut
  // UI bu hakkı gizliyordu — bu batch'te UI kaynağa hizalandı (raporda
  // "Partner UI drift correction" olarak belirtildi). Partner scope
  // zaten RLS + storage.objects INSERT policy'sinde enforce edilir.
  const canMutateEvrak = ["yonetici", "partner", "operasyon", "ik"].includes(role);

  async function handleDownload(row: DocumentListRow) {
    if (!row.storage_path) return;
    try {
      const { data, error } = await supabase.storage
        .from("documents")
        .createSignedUrl(row.storage_path, 60);
      if (error || !data?.signedUrl) {
        throw error ?? new Error("signed URL bos dondu");
      }
      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    } catch (err) {
      // Per-row failure must NOT collapse the page (was: setLoadError(...)).
      // Mark the row so its "Indir" action goes disabled and the inline
      // banner above the table explains the reason. Full error context
      // stays in the console for ops; UI never surfaces raw messages.
      console.error(`[evraklar] signed URL failed for row ${row.id}:`, err);
      setSignedUrlErrorIds((prev) => {
        if (prev.has(row.id)) return prev;
        const next = new Set(prev);
        next.add(row.id);
        return next;
      });
    }
  }

  const rowActions: RowAction<DocumentListRow>[] = [
    ...(canMutateEvrak ? [{
      label: "Gecerlilik Guncelle",
      onClick: (row: DocumentListRow) => setValidityTarget({ open: true, evrakAdi: row.name, evrakId: row.id, currentDate: row.validity_date ?? "" }),
    }] : []),
    {
      label: "Indir",
      onClick: (row: DocumentListRow) => { void handleDownload(row); },
      // Disabled when (a) row has no storage_path (existing behavior)
      // or (b) a prior signed-URL attempt for this row failed.
      isDisabled: (row: DocumentListRow) =>
        !row.storage_path || signedUrlErrorIds.has(row.id),
    },
  ];

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

        {/* Per-row signed-URL failure banner. Visible only when at least
            one "Indir" attempt has failed in this session. Item-level UX:
            those rows' Indir actions are already disabled via isDisabled;
            this banner explains the reason without page collapse. Matches
            existing amber visual language used by the operational risk
            card above. Cleared on full page reload. */}
        {signedUrlErrorIds.size > 0 && (
          <div
            className={`${RADIUS_DEFAULT} border border-amber-200 bg-amber-50 p-3`}
            role="status"
            aria-live="polite"
          >
            <p className={`${TYPE_CAPTION} text-amber-700 flex items-center gap-1.5`}>
              <AlertTriangle size={14} />
              Bazi belgelerin baglantisi olusturulamadi. Sayfayi yenileyerek tekrar deneyin.
            </p>
          </div>
        )}

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
                    <p className={`${TYPE_CAPTION} ${TEXT_MUTED} mt-0.5`}>{DOCUMENT_CATEGORY_LABELS[e.category]} {e.validity_date ? `· ${formatDateTR(e.validity_date)}` : ""}</p>
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
          // Resolve real company UUID from the dropdown id (which is
          // legacy_mock_id when present, else the real UUID). This is
          // a pragmatic batch-local lookup against already-loaded
          // allCompanies — kept here to preserve storage-first order
          // without reshaping the documents service signature. See
          // report > "Page-level company_id lookup note".
          const company = allCompanies.find(
            (c) => (c.legacy_mock_id ?? c.id) === p.firmaId,
          );
          if (!company) {
            throw new Error("Firma bulunamadi veya erisim yetkiniz yok.");
          }
          const path = `${company.id}/${crypto.randomUUID()}.pdf`;

          // Storage first — fake storage_path rows must not exist.
          const up = await supabase.storage
            .from("documents")
            .upload(path, p.file, {
              contentType: "application/pdf",
              upsert: false,
            });
          if (up.error) {
            throw new Error(`Dosya yuklenemedi: ${up.error.message}`);
          }

          // DB second. If this throws, the storage object becomes
          // orphaned — see report > "Blockers or unresolved risks".
          await createDocument(supabase, {
            legacyCompanyId: p.firmaId,
            name: p.evrakAdi,
            category: p.kategori,
            validityDate: p.gecerlilikTarihi,
            storagePath: path,
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
