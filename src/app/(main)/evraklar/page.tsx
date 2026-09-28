"use client";
import ListToolbar from "@/components/ui/ListToolbar";
import { useIstanbulDay } from "@/components/ui/useIstanbulDay";
import Link from "next/link";
import {DOCUMENT_FOLDERS,documentFolder} from "@/lib/document-folders";
import DocumentCategoryEditor from "@/components/modals/DocumentCategoryEditor";
import ActionNotice, { useActionNotice } from "@/components/ui/ActionNotice";
import { useListViewState } from "@/components/ui/useListViewState";
import type { SearchInputHandle } from "@/components/ui/SearchInput";
import AsyncSection from "@/components/ui/AsyncSection";
import { useScopedResource } from "@/components/ui/useScopedResource";
import { DocumentUploadReviewRequiredError } from "@/lib/company-document-upload";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { formatDateTR } from "@/lib/format-date";
import { Upload, ClipboardList, Folder } from "lucide-react";
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
import type { ColumnDef, FilterConfig, RowAction } from "@/types/ui";
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
} from "@/styles/tokens";

// ---------------------------------------------------------------------------
// Enriched row — extends DocumentRow with resolved firma info
// ---------------------------------------------------------------------------

interface DocumentListRow extends DocumentRow {
  firma_name: string;
  firma_legacy_id: string | null;
}

// Page-local helpers
const FOLLOW_UP_STATUSES = ["eksik", "suresi_yaklsiyor", "suresi_doldu"] as const;
const LIST_FILTER_DEFAULTS = { durum: "", kategori: "", firma: "", klasor: "" };
const CHIP_BASE = `min-h-11 px-3 py-1 ${TYPE_LABEL} ${RADIUS_FULL} border transition-colors`;
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
    options: (Object.keys(DOCUMENT_CATEGORY_LABELS) as DocumentCategory[]).map((k) => ({ value: k, label: DOCUMENT_CATEGORY_LABELS[k] })),
  },
];

/**
 * Columns match PRODUCT_STRUCTURE > Evraklar > Liste kolonlari:
 * evrak adi, firma, kategori, gecerlilik tarihi, durum, yukleyen, guncellenme tarihi
 */
const COLUMNS: ColumnDef<DocumentListRow>[] = [
  { key: "name", header: "Evrak Adı", sortable: true },
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
    header: "Yükleyen",
    render: (val) => <span className={`${TYPE_BODY} ${TEXT_BODY}`}>{(val as string) || "—"}</span>,
  },
  {
    key: "updated_at",
    header: "Güncellenme",
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
  const documentDay = useIstanbulDay();
  const readDocuments = useCallback(async () => {
    const allDocs = await listAllDocuments(supabase);
    const companyIds = [...new Set(allDocs.map(d => d.company_id))];
    const { nameById, legacyById } = companyIds.length > 0
      ? await getCompanyDisplayMapByIds(supabase, companyIds)
      : { nameById: {} as Record<string, string>, legacyById: {} as Record<string, string> };
    return allDocs.map(d => ({ ...d, firma_name: nameById[d.company_id] ?? "Bilinmeyen Firma", firma_legacy_id: legacyById[d.company_id] ?? null }));
  }, [supabase, documentDay]);
  const documentResource = useScopedResource(context.scope, readDocuments);
  const documents: DocumentListRow[] = documentResource.data ?? [];
  const reload = documentResource.reload;
  const readCompanies = useCallback(() => selectAllCompanies(supabase), [supabase]);
  const companyResource = useScopedResource(context.scope, readCompanies);
  const allCompanies = companyResource.data ?? [];

  // ---------------------------------------------------------------------------
  // UI state
  // ---------------------------------------------------------------------------
  const searchControl = useRef<SearchInputHandle>(null);
  const { search, filters, setSearch: handleSearch, setFilters, ready: viewReady } = useListViewState("evraklar", context.scope, LIST_FILTER_DEFAULTS);
  const [openUploadContext, setOpenUploadContext] = useState<typeof context | null>(null);
  const [validityTarget, setValidityTarget] = useState<{ context: typeof context; row: DocumentListRow } | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  type DownloadState = { context: typeof context; row: DocumentListRow; phase: "loading" | "error" | "ready"; href?: string; expiresAt?: number; message?: string };
  const [download, setDownload] = useState<DownloadState | null>(null);
  const downloadFlight = useRef<{ context: typeof context } | null>(null);
  const currentDownload = download?.context === context ? download : null;
  function dismissDownload() { downloadFlight.current = null; setDownload(null); }
  useEffect(() => {
    if (download?.phase !== "ready" || !download.expiresAt) return;
    const timer = window.setTimeout(() => setDownload(current => current === download
      ? { context: download.context, row: download.row, phase: "error", message: "Bağlantının süresi doldu. Yeniden hazırlayın." } : current), Math.max(0, download.expiresAt - Date.now()));
    return () => window.clearTimeout(timer);
  }, [download]);

  useEffect(() => {
    liveContext.current = context;
    setOpenUploadContext(null); setSelectedId(null); setValidityTarget(null); downloadFlight.current = null; setDownload(null);
    notice.clear();
    return () => { liveContext.current = null; downloadFlight.current = null; };
    // Notice functions change on render; reset only on authorization context changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [context]);

  const statusCounts = useMemo(() => {
    const c: Record<string, number> = { tam: 0, eksik: 0, suresi_yaklsiyor: 0, suresi_doldu: 0 };
    for (const e of documents) c[e.status] = (c[e.status] || 0) + 1;
    return c;
  }, [documents]);

  const followUpCompanies = useMemo(() => {
    const groups = new Map<string, { id: string; name: string; counts: Record<(typeof FOLLOW_UP_STATUSES)[number], number> }>();
    for (const row of documents) {
      if (!FOLLOW_UP_STATUSES.some(status => status === row.status)) continue;
      const group = groups.get(row.company_id) ?? { id: row.company_id, name: row.firma_name, counts: { eksik: 0, suresi_yaklsiyor: 0, suresi_doldu: 0 } };
      group.counts[row.status as (typeof FOLLOW_UP_STATUSES)[number]]++;
      groups.set(row.company_id, group);
    }
    return [...groups.values()].sort((a, b) => a.name.localeCompare(b.name, "tr"));
  }, [documents]);
  const searchArea = useRef<HTMLDivElement>(null);
  function showFollowUp(companyId: string, status: (typeof FOLLOW_UP_STATUSES)[number]) {
    searchControl.current?.clear();
    setFilters({ ...LIST_FILTER_DEFAULTS, firma: companyId, durum: status });
    searchArea.current?.scrollIntoView({ block: "center" });
  }

  // Build firma filter options dynamically from loaded data
  const firmaFilterConfig = useMemo((): FilterConfig[] => {
    const firms = [...new Map(documents.map(d => [d.company_id, d.firma_name])).entries()].sort((a, b) => a[1].localeCompare(b[1], "tr"));
    return [
      ...FILTER_CONFIG,
      {
        key: "firma",
        label: "Firma",
        type: "select" as const,
        placeholder: "Tüm firmalar",
        options: firms.map(([id, name]) => ({ label: name, value: id })),
      },
    ];
  }, [documents]);

  const filteredData = useMemo(() => {
    return documents.filter((e) => {
      if (search.trim()) {
        const q = search.trim().toLocaleLowerCase("tr-TR");
        if (!e.name.toLocaleLowerCase("tr-TR").includes(q) && !e.firma_name.toLocaleLowerCase("tr-TR").includes(q)) return false;
      }
      if (filters.durum && e.status !== filters.durum) return false;
      if (filters.klasor && documentFolder(e.category,e.contract_id) !== filters.klasor) return false;
      if (filters.kategori && e.category !== filters.kategori) return false;
      if (filters.firma && e.company_id !== filters.firma) return false;
      return true;
    });
  }, [documents, search, filters]);

  const columns = useMemo<ColumnDef<DocumentListRow>[]>(() => COLUMNS.map(column => column.key !== "name" ? column : {
    ...column,
    render: (_value, row) => <button type="button" aria-haspopup="dialog" onClick={event => { event.stopPropagation(); setSelectedId(row.id); }}
      className="min-h-11 w-52 max-w-full whitespace-normal break-words rounded-lg py-2 text-left font-medium text-blue-700 underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 sm:w-auto sm:max-w-xs">{row.name}</button>,
  }), []);

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

  const canMutateEvrak = allowed;

  async function handleDownload(row: DocumentListRow) {
    if (!context.scope || liveContext.current !== context || !row.storage_path || downloadFlight.current?.context === context) return;
    const operation = { context };
    downloadFlight.current = operation;
    setDownload({ context, row, phase: "loading" });
    // Conservative client lifetime measured before requesting the server's 60s URL.
    const expiresAt = Date.now() + 55_000;
    const current = () => liveContext.current === context && downloadFlight.current === operation;
    try {
      const { data, error } = await supabase.storage.from("documents").createSignedUrl(row.storage_path, 60);
      if (!current()) return;
      if (error || !data?.signedUrl) throw new Error("download unavailable");
      if (Date.now() >= expiresAt) {
        setDownload({ context, row, phase: "error", message: "Bağlantının süresi doldu. Yeniden hazırlayın." });
      } else {
        setDownload({ context, row, phase: "ready", href: data.signedUrl, expiresAt });
      }
    } catch {
      if (current()) setDownload({ context, row, phase: "error", message: "Dosya bağlantısı hazırlanamadı. Tekrar deneyin." });
    } finally {
      if (current()) downloadFlight.current = null;
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
      isDisabled: (row: DocumentListRow) => !row.storage_path || currentDownload?.phase === "loading",
    },
  ];

  // Auth not resolved yet — don't flash "Erişim kısıtlı" (role defaults to
  // "goruntuleyici" while AuthContext is loading). Wait, then decide.
  if (authLoading) {
    return (
      <>
        <PageHeader title="Evraklar" subtitle="Belge takibi" />
        <EmptyState title="Yükleniyor…" description="Yetki bilgisi kontrol ediliyor." size="page" />
      </>
    );
  }

  if (!allowed) {
    return (
      <>
        <PageHeader title="Evraklar" subtitle="Belge takibi" />
        <EmptyState title="Erişim kısıtlı" description="Evrakları görüntüleme yetkiniz yok. Erişim için yöneticinizle görüşün." size="page" />
      </>
    );
  }


  return (
    <>
      <PageHeader title="Evraklar" subtitle="Firma evraklarını ve sözleşmeleri klasörlerinden bulun" actions={canMutateEvrak ? [
        { label: "Evrak Yükle", onClick: () => setOpenUploadContext(context), icon: <Upload size={16} /> },
      ] : []} />

      <ActionNotice message={notice.message} onDismiss={notice.clear} />
      {currentDownload && <section aria-label="Evrak indirme" className="mb-5 rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex items-start justify-between gap-3">
          <p className="min-w-0 break-words text-sm font-medium text-slate-800">{currentDownload.row.name}</p>
          <button type="button" onClick={dismissDownload} className="min-h-11 shrink-0 px-3 text-sm text-slate-600">Kapat</button>
        </div>
        {currentDownload.phase === "loading" && <p role="status" className="text-sm text-blue-700">Dosya bağlantısı hazırlanıyor…</p>}
        {currentDownload.phase === "error" && <>
          <p role="status" className="text-sm text-amber-700">{currentDownload.message}</p>
          <button type="button" onClick={() => { void handleDownload(currentDownload.row); }} className="min-h-11 mt-2 text-sm text-blue-700 underline">Bağlantıyı yeniden hazırla</button>
        </>}
        {currentDownload.phase === "ready" && <>
          <p role="status" className="text-sm text-slate-600">Bağlantı hazır. Dosyayı yeni sekmede açabilirsiniz.</p>
          <a href={currentDownload.href} target="_blank" rel="noopener noreferrer" onClick={event => {
            if (!currentDownload.expiresAt || Date.now() >= currentDownload.expiresAt) {
              event.preventDefault(); setDownload({ context, row: currentDownload.row, phase: "error", message: "Bağlantının süresi doldu. Yeniden hazırlayın." });
            }
          }} className="min-h-11 mt-2 inline-flex items-center text-sm font-medium text-blue-700 underline">Dosyayı aç</a>
        </>}
      </section>}
      <AsyncSection isLoading={documentResource.loading || !viewReady} hasError={documentResource.error} onRetry={() => { void reload(); }}>
      <div className="space-y-4">
        <section aria-label="Evrak klasörleri" className="space-y-3">
          <button type="button" aria-pressed={!filters.klasor} className="min-h-11 rounded-lg border px-4 text-sm aria-pressed:bg-blue-50" onClick={()=>setFilters(p=>({...p,klasor:'',kategori:''}))}>Tüm evraklar ({documents.length})</button>
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">{DOCUMENT_FOLDERS.map(folder=><button type="button" key={folder.id} aria-pressed={filters.klasor===folder.id} onClick={()=>setFilters(p=>({...p,klasor:folder.id,kategori:''}))} className="min-w-0 break-words rounded-xl border border-slate-200 bg-white p-3 sm:p-4 text-left hover:border-blue-400 aria-pressed:border-blue-600 aria-pressed:bg-blue-50">
            <Folder className="mb-3 text-blue-600" size={24} aria-hidden="true"/><span className="block font-semibold">{folder.name} <span className="text-slate-500">({documents.filter(d=>documentFolder(d.category,d.contract_id)===folder.id).length})</span></span><span className="mt-1 hidden text-sm text-slate-500 sm:block">{folder.description}</span>
          </button>)}</div>
          <p className="text-xs text-slate-500">Klasör sayıları tüm erişilebilir evrakları gösterir. Firma, arama ve durum filtreleri aşağıdaki listeye uygulanır.</p>
        </section>
        <DocumentsChecklistCard
          tam={statusCounts["tam"] ?? 0}
          eksik={statusCounts["eksik"] ?? 0}
          suresiYaklsiyor={statusCounts["suresi_yaklsiyor"] ?? 0}
          suresiDoldu={statusCounts["suresi_doldu"] ?? 0}
        />

        {followUpCompanies.length > 0 && (
          <section aria-label="Takip gerektiren evraklar" className="rounded-xl border border-slate-200 bg-white p-4">
            <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-800"><ClipboardList size={16} />Takip gerektiren evraklar</h3>
            <p className="mb-3 text-xs text-slate-500">Yüklenen listedeki kayıtlı durumlar gösterilir. Bir durum seçerek ilgili firmanın evraklarını listeleyin.</p>
            <div className="divide-y divide-slate-100">
              {followUpCompanies.map(company => (
                <section key={company.id} aria-label={`${company.name} evrak takibi`} className="py-3 first:pt-0 last:pb-0">
                  <h4 className="mb-2 break-words text-sm font-medium text-slate-800">{company.name}</h4>
                  <div className="flex flex-wrap gap-2">
                    {FOLLOW_UP_STATUSES.filter(status => company.counts[status] > 0).map(status => (
                      <button type="button" key={status} onClick={() => showFollowUp(company.id, status)}
                        aria-pressed={filters.firma === company.id && filters.durum === status}
                        className="min-h-11 rounded-lg border border-slate-200 px-3 text-sm text-blue-700 hover:bg-blue-50 aria-pressed:border-blue-500 aria-pressed:bg-blue-50">
                        {STATUS_LABELS[status]} ({company.counts[status]})
                      </button>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </section>
        )}

        <div className="flex items-center gap-2 flex-wrap">
          {Object.entries(statusCounts).filter(([, c]) => c > 0).map(([status, count]) => (
            <button type="button" aria-pressed={filters.durum === status} key={status} onClick={() => setFilters((p) => ({ ...p, durum: p.durum === status ? "" : status }))} className={clsx(
              CHIP_BASE,
              filters.durum === status ? CHIP_ACTIVE : CHIP_INACTIVE
            )}>{STATUS_LABELS[status] ?? status} ({count})</button>
          ))}
        </div>

        <div ref={searchArea}>
          <ListToolbar label="Evraklarda ara" search={<SearchInput key={context.scope} ref={searchControl} value={search} maxLength={512} placeholder="Evrak, firma ara..." onChange={handleSearch} />}>
            <FilterBar filters={firmaFilterConfig} values={filters} onChange={setFilters} />
          </ListToolbar>
        </div>

        <DataTable<DocumentListRow> columns={columns} data={filteredData} rowKey="id" onRowClick={(row) => setSelectedId(row.id)} rowActions={rowActions} emptyTitle={documents.length === 0 ? "Henüz evrak yok" : "Bu filtrelerle eşleşen evrak yok"}
          emptyDescription={documents.length === 0 ? "Evrak Yükle ile ilk firma belgenizi ekleyebilirsiniz." : "Aramayı veya filtreleri değiştirerek yeniden deneyin."}
          emptyAction={documents.length === 0 ? { label: "İlk evrakı yükle", onClick: () => setOpenUploadContext(context) }
            : (search !== "" || Object.values(filters).some(Boolean)) ? { label: "Arama ve filtreleri temizle", onClick: () => { searchControl.current?.clear(); setFilters(LIST_FILTER_DEFAULTS); } } : undefined} />
      </div>

      </AsyncSection>
      {/* FirmDocumentChecklistPanel */}
      <RightSidePanel open={!!selectedEvrak} onClose={() => setSelectedId(null)} title="Evrak detayı">
        {selectedEvrak && (
          <div className="space-y-5">
            <section aria-label="Seçili evrak" className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <h3 className="break-words text-base font-semibold text-slate-900">{selectedEvrak.name}</h3>
              <StatusBadge status={selectedEvrak.status} />
              <dl className="space-y-3 text-sm">
                <div><dt className="text-slate-500">Firma</dt><dd className="min-w-0"><Link href={`/firmalar/${selectedEvrak.company_id}`} className="inline-flex min-h-11 max-w-full items-center break-words py-2 font-medium text-blue-700 underline">{selectedEvrak.firma_name}</Link></dd></div>
                <div><dt className="text-slate-500">Kategori</dt><dd>{DOCUMENT_CATEGORY_LABELS[selectedEvrak.category]}</dd></div>
                <div><dt className="text-slate-500">Geçerlilik tarihi</dt><dd>{selectedEvrak.validity_date ? formatDateTR(selectedEvrak.validity_date) : "Belirtilmemiş"}</dd></div>
                <div><dt className="text-slate-500">Dosya</dt><dd>{selectedEvrak.storage_path ? "Dosya kayıtlı" : "Henüz dosya yüklenmemiş"}</dd></div>
              </dl>
            </section>
            {canMutateEvrak&&<DocumentCategoryEditor key={`${scope}:${selectedEvrak.id}:${selectedEvrak.updated_at}`} row={selectedEvrak} onSaved={()=>{if(liveContext.current!==context)return;notice.show('Belgenin klasörü ve türü güncellendi.');void reload();}} />}
            <h3 className="text-sm font-semibold text-slate-800">Firmanın evrakları</h3>
            <DocumentsChecklistCard {...firmaEvrakCounts} />
            <div className="space-y-2">
              {firmaEvraklar.map((e) => (
                <div key={e.id} className={`flex flex-col gap-2 py-2 sm:flex-row sm:items-center sm:justify-between ${LIST_DIVIDER}`}>
                  <div className="min-w-0">
                    <p className={`break-words ${TYPE_BODY} ${TEXT_BODY}`}>{e.name}</p>
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
