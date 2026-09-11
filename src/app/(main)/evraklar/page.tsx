"use client";
import ActionNotice, { useActionNotice } from "@/components/ui/ActionNotice";
import AsyncSection from "@/components/ui/AsyncSection";
import { useScopedResource } from "@/components/ui/useScopedResource";
import { DocumentUploadReviewRequiredError } from "@/lib/company-document-upload";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
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
import { useAuth } from "@/context/AuthContext";
import { UploadDocumentModal, UpdateValidityModal } from "@/components/modals";
import { createClient } from "@/lib/supabase/client";
import {
  listAllDocuments,
  updateDocumentValidity,
  DocumentValidationError,
} from "@/lib/services/documents";
import { uploadCompanyDocumentAction } from "../firmalar/[id]/actions";
import { getCompanyDisplayMapByIds } from "@/lib/services/companies";
import { selectAllCompanies } from "@/lib/supabase/companies";
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
  const { user, loading: authLoading } = useAuth();
  const supabase = createClient();

  // ---------------------------------------------------------------------------
  // Data loading
  // ---------------------------------------------------------------------------
  const scope = `${user?.id ?? ""}:${user?.app_metadata?.active_tenant ?? ""}:${role}`;
  const allowed = !authLoading && !!user && ["yonetici", "operasyon", "ik"].includes(role);
  const context = useMemo(() => ({ scope: allowed ? scope : null }), [allowed, scope]);
  const liveContext = useRef<typeof context | null>(context);
  liveContext.current = context;
  const notice = useActionNotice(scope);
  const readDocuments = useCallback(async () => {
    const allDocs = await listAllDocuments(supabase);
    const companyIds = [...new Set(allDocs.map(d => d.company_id))];
    const { nameById, legacyById } = companyIds.length > 0
      ? await getCompanyDisplayMapByIds(supabase, companyIds)
      : { nameById: {} as Record<string, string>, legacyById: {} as Record<string, string> };
    return allDocs.map(d => ({ ...d, firma_name: nameById[d.company_id] ?? "Bilinmeyen Firma", firma_legacy_id: legacyById[d.company_id] ?? null }));
  }, [supabase]);
  const documentResource = useScopedResource(context.scope, readDocuments);
  const documents: DocumentListRow[] = documentResource.data ?? [];
  const reload = documentResource.reload;
  const readCompanies = useCallback(() => selectAllCompanies(supabase), [supabase]);
  const companyResource = useScopedResource(context.scope, readCompanies);
  const allCompanies = companyResource.data ?? [];

  // ---------------------------------------------------------------------------
  // UI state
  // ---------------------------------------------------------------------------
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<FilterValues>({ durum: "", kategori: "", firma: "" });
  const [openUploadContext, setOpenUploadContext] = useState<typeof context | null>(null);
  const [validityTarget, setValidityTarget] = useState<{ context: typeof context; row: DocumentListRow } | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Per-row signed-URL failures. A failure here used to flow into the
  // page-level `loadError` and collapse the whole page; now it stays
  // item-level so the row remains visible with a degraded "Indir"
  // action. Cleared on page reload (full mount = new Set).
  const [signedUrlErrorIds, setSignedUrlErrorIds] = useState<Set<string>>(
    () => new Set(),
  );

  useEffect(() => {
    liveContext.current = context;
    setOpenUploadContext(null); setSelectedId(null); setValidityTarget(null); setSignedUrlErrorIds(new Set());
    notice.clear();
    return () => { liveContext.current = null; };
    // Notice functions change on render; reset only on authorization context changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [context]);

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
  const canMutateEvrak = allowed;

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
      onClick: (row: DocumentListRow) => setValidityTarget({ context, row }),
      isDisabled: (row: DocumentListRow) => !!row.contract_id && role !== "yonetici",
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

  // Auth not resolved yet — don't flash "Erisim kisitli" (role defaults to
  // "goruntuleyici" while AuthContext is loading). Wait, then decide.
  if (authLoading) {
    return (
      <>
        <PageHeader title="Evraklar" subtitle="Belge takibi" />
        <EmptyState title="Yukleniyor…" description="Yetki bilgisi kontrol ediliyor." size="page" />
      </>
    );
  }

  if (!allowed) {
    return (
      <>
        <PageHeader title="Evraklar" subtitle="Belge takibi" />
        <EmptyState title="Erisim kisitli" description="Bu rolde evrak görüntülenemez." size="page" />
      </>
    );
  }


  return (
    <>
      <PageHeader title="Evraklar" subtitle="Belge ve uygunluk gorunurlugu" actions={canMutateEvrak ? [
        { label: "Evrak Yukle", onClick: () => setOpenUploadContext(context), icon: <Upload size={16} /> },
      ] : []} />

      <ActionNotice message={notice.message} onDismiss={notice.clear} />
      <AsyncSection isLoading={documentResource.loading} hasError={documentResource.error} onRetry={() => { void reload(); }}>
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

      </AsyncSection>
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

      {openUploadContext === context && context.scope && <UploadDocumentModal open onClose={() => { if (liveContext.current === context) setOpenUploadContext(null); }} firmalar={firmaOptions}
        companiesState={companyResource.loading ? "loading" : companyResource.error ? "error" : "ready"}
        onRetryCompanies={() => { void companyResource.reload(); }}
        onSubmit={async (p) => {
          if (liveContext.current !== context) return;
          // Resolve real company UUID from the dropdown id (legacy_mock_id
          // when present, else the real UUID). The tenant-aware server
          // action needs the real company UUID.
          const company = allCompanies.find(
            (c) => (c.legacy_mock_id ?? c.id) === p.firmaId,
          );
          if (companyResource.loading || companyResource.error || !company) {
            throw new Error("Firma bulunamadi veya erisim yetkiniz yok.");
          }

          // Route through the tenant-aware server action: it sets
          // tenant_id (RPC) / company_id / created_by / uploaded_by /
          // storage_path server-side, role-guards, and does the storage
          // upload + DB insert. Replaces the previous browser-context
          // storage upload + tenant-less createDocument (Codex must-fix).
          const fd = new FormData();
          fd.set("company_id", company.id);
          fd.set("name", p.evrakAdi);
          fd.set("category", p.kategori);
          if (p.gecerlilikTarihi) fd.set("validity_date", p.gecerlilikTarihi);
          fd.set("file", p.file);

          let result;
          try { result = await uploadCompanyDocumentAction(fd); }
          catch {
            if (liveContext.current !== context) return;
            throw new DocumentUploadReviewRequiredError("Yükleme sonucu alınamadı. Tekrar denemeden önce belge listesini kontrol edin.");
          }
          if (liveContext.current !== context) return;
          if (!result.ok) {
            if (result.reviewRequired) throw new DocumentUploadReviewRequiredError(result.error);
            throw new Error(result.error);
          }
          setOpenUploadContext(null);
          notice.show(`${p.evrakAdi} evraklara yüklendi.`);
          void reload();
        }}
      />}
      {validityTarget?.context === context && context.scope && <UpdateValidityModal key={validityTarget.row.id} open
        onClose={() => { if (liveContext.current === context) setValidityTarget(null); }}
        evrakAdi={validityTarget.row.name} evrakId={validityTarget.row.id} currentDate={validityTarget.row.validity_date ?? ""}
        onSubmit={async ({ evrakId, yeniTarih }) => {
          if (liveContext.current !== context || evrakId !== validityTarget.row.id) return;
          try { await updateDocumentValidity(supabase, evrakId, { validityDate: yeniTarih }); }
          catch (error) {
            if (liveContext.current !== context) return;
            throw new Error(error instanceof DocumentValidationError ? error.message : "Geçerlilik güncellenemedi. Tekrar deneyin.");
          }
          if (liveContext.current !== context) return;
          setValidityTarget(null);
          notice.show(`${validityTarget.row.name} geçerlilik tarihi güncellendi.`);
          void reload();
        }}
      />}
    </>
  );
}
