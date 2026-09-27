"use client";

/**
 * Personel Talepleri (Staffing Demands) list page.
 *
 * Faz 3A: cut over from mock data to Supabase truth. Demands come
 * from the staffing-demands service layer; the firma filter dropdown
 * and NewRequestModal now source options from real companies (RLS-
 * scoped) via `selectAllCompanies`. Row-level company display names
 * are resolved via `getCompanyDisplayMapByIds`.
 *
 * open_count (acik kalan) is DERIVED via `computeOpenCount` and never
 * persisted — the DB has no column for it by design.
 */

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import Link from "next/link";
import { useListViewState } from "@/components/ui/useListViewState";
import type { SearchInputHandle } from "@/components/ui/SearchInput";
import { useRouter } from "next/navigation";
import { formatDateTR } from "@/lib/format-date";
import { Plus } from "lucide-react";
import {
  PageHeader,
  SearchInput,
  FilterBar,
  DataTable,
  StatusBadge,
  PriorityBadge,
  RightSidePanel,
  EmptyState,
} from "@/components/ui";
import ActionNotice, { useActionNotice } from "@/components/ui/ActionNotice";
import PickerFeedback from "@/components/ui/PickerFeedback";
import { useRole } from "@/context/RoleContext";
import { useAuth } from "@/context/AuthContext";
import { NewRequestModal, AssignOwnerModal } from "@/components/modals";
import { createClient } from "@/lib/supabase/client";
import { selectAllCompanies } from "@/lib/supabase/companies";
import type { CompanyRow } from "@/types/database.types";
import {
  listAllDemands,
  updateDemand,
  computeOpenCount,
  type DemandCreateInput,
} from "@/lib/services/staffing-demands";
import { getCompanyDisplayMapByIds } from "@/lib/services/companies";
// Talep create routes through the server action so the passive-company
// guard runs before the insert (updateDemand stays a direct service call).
import { createDemandAction } from "./actions";
import type { StaffingDemandRow } from "@/types/database.types";
import type {
  ColumnDef,
  FilterConfig,
  FilterValues,
  RowAction,
  OncelikSeviyesi,
} from "@/types/ui";
import { clsx } from "clsx";
import {
  TYPE_BODY,
  TYPE_CAPTION,
  TEXT_PRIMARY,
  TEXT_BODY,
  TEXT_SECONDARY,
  TEXT_MUTED,
  TEXT_LINK,
  BORDER_SUBTLE,
  SURFACE_HEADER,
} from "@/styles/tokens";

// Page-local helpers
const DL_LABEL = `${TYPE_CAPTION} ${TEXT_SECONDARY}`;
const DL_VALUE = `${TYPE_BODY} ${TEXT_BODY} mt-0.5`;

const STATUS_LABELS: Record<string, string> = {
  yeni: "Yeni",
  degerlendiriliyor: "Değerlendiriliyor",
  kismi_doldu: "Kısmi doldu",
  tamamen_doldu: "Tamamen Doldu",
  beklemede: "Beklemede",
  iptal: "İptal",
};

/**
 * Augment the raw `StaffingDemandRow` with cached derived values + the
 * firma display name. firma_name is resolved via
 * `getCompanyDisplayMapByIds` against the real companies table.
 */
interface DemandListRow extends StaffingDemandRow {
  firma_name: string;
  open_count: number;
}

const FILTER_CONFIG: FilterConfig[] = [
  {
    key: "durum",
    label: "Durum",
    type: "select",
    placeholder: "Tüm durumlar",
    options: Object.entries(STATUS_LABELS).map(([v, l]) => ({
      value: v,
      label: l,
    })),
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
  // Note: the "firma" filter is appended at the component level so its
  // options come from the real companies table (RLS-scoped).
];

function buildFirmaFilter(companyNames: string[]): FilterConfig {
  return {
    key: "firma",
    label: "Firma",
    type: "select",
    placeholder: "Tüm firmalar",
    options: Array.from(new Set(companyNames)).map((name) => ({
      label: name,
      value: name,
    })),
  };
}

/**
 * Columns match PRODUCT_STRUCTURE > Personel Talepleri > Liste kolonlari:
 * firma, pozisyon, talep edilen, saglanan, acik kalan, lokasyon, baslangic tarihi, oncelik, durum, sorumlu
 */
const COLUMNS: ColumnDef<DemandListRow>[] = [
  { key: "firma_name", header: "Firma", sortable: true },
  { key: "position", header: "Pozisyon", sortable: true },
  {
    key: "requested_count",
    header: "Talep Edilen",
    sortable: true,
  },
  { key: "provided_count", header: "Sağlanan", sortable: true },
  {
    key: "open_count",
    header: "Açık Kalan",
    sortable: true,
    render: (val) => {
      const n = val as number;
      return (
        <span
          className={clsx(
            `${TYPE_BODY} font-medium`,
            n > 0 ? "text-red-600" : "text-green-600",
          )}
        >
          {n}
        </span>
      );
    },
  },
  {
    key: "location",
    header: "Lokasyon",
    render: (val) => (
      <span className={`${TYPE_BODY} ${TEXT_BODY}`}>
        {(val as string | null) ?? "—"}
      </span>
    ),
  },
  {
    key: "start_date",
    header: "Başlangıç",
    sortable: true,
    render: (val) => formatDateTR(((val as string | null) ?? "").slice(0, 10)),
  },
  {
    key: "priority",
    header: "Öncelik",
    sortable: true,
    render: (val) => <PriorityBadge priority={val as OncelikSeviyesi} />,
  },
  {
    key: "status",
    header: "Durum",
    sortable: true,
    render: (val) => <StatusBadge status={val as DemandListRow["status"]} />,
  },
  {
    key: "responsible",
    header: "Sorumlu",
    render: (val) => (
      <span className={`${TYPE_BODY} ${TEXT_BODY}`}>
        {(val as string | null) ?? "—"}
      </span>
    ),
  },
];

const LIST_FILTER_DEFAULTS: FilterValues = { durum: "", oncelik: "", firma: "" };

export default function TaleplerPage() {
  const { role } = useRole();
  const { loading: authLoading, user } = useAuth();
  const router = useRouter();

  // ---------------------------------------------------------------------------
  // Supabase data state
  // ---------------------------------------------------------------------------
  const supabase = useMemo(() => createClient(), []);
  const listScope = !authLoading && user ? JSON.stringify([user.id, user.app_metadata?.active_tenant ?? null, role]) : null;
  const context = useMemo(() => ({scope: listScope}), [listScope]);
  const liveContext = useRef<typeof context | null>(context);
  liveContext.current = context;
  const generation = useRef(0);
  const feedback = useActionNotice(listScope ?? "pending");
  const [snapshot, setSnapshot] = useState<{scope: string; rows: StaffingDemandRow[]; names: Record<string,string>} | null>(null);
  const [readState, setReadState] = useState<{scope: string; loading: boolean; error: string | null} | null>(null);
  const [companySnapshot, setCompanySnapshot] = useState<{scope: string; rows: CompanyRow[]; status: "ready" | "error"} | null>(null);
  const [companyRetry, setCompanyRetry] = useState(0);
  const demands = useMemo(() => snapshot?.scope === listScope ? snapshot?.rows ?? [] : [], [snapshot, listScope]);
  const companyNameById = useMemo(() => snapshot?.scope === listScope ? snapshot?.names ?? {} : {}, [snapshot, listScope]);
  const loading = readState?.scope !== listScope || readState?.loading !== false;
  const loadError = readState?.scope === listScope ? readState?.error : null;
  const allCompanies = useMemo(() => companySnapshot?.scope === listScope ? companySnapshot?.rows ?? [] : [], [companySnapshot, listScope]);
  const companiesDurum = companySnapshot?.scope === listScope ? companySnapshot?.status ?? "loading" : "loading";

  // ---------------------------------------------------------------------------
  // UI state
  // ---------------------------------------------------------------------------
  const searchControl = useRef<SearchInputHandle>(null);
  const { search, filters, setSearch: handleSearch, setFilters, ready: viewReady } = useListViewState("talepler", listScope, LIST_FILTER_DEFAULTS);
  const [newOpen, setNewOpen] = useState(false);
  const canOpenDailyPlan = role === "yonetici" || role === "operasyon";
  // The legacy list filters by display name; never guess when two firms share a name.
  const matchingCompanies = filters.firma ? allCompanies.filter(company => company.name === filters.firma) : [];
  const dailyPlanHref = matchingCompanies.length === 1 ? `/talepler/gunluk?firma=${matchingCompanies[0].id}` : "/talepler/gunluk";
  const [ownerTarget, setOwnerTarget] = useState<{
    open: boolean;
    talepRef?: string;
    talepId?: string;
    initialSorumlu?: string;
  }>({ open: false });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const mobileDetailControls = useRef(new Map<string, HTMLButtonElement>());
  const closeDetail = () => {
    const id = selectedId;
    setSelectedId(null);
    // Reload can replace the original trigger while a detail stays open.
    requestAnimationFrame(() => {
      if (liveContext.current !== context) return;
      const trigger = id ? mobileDetailControls.current.get(id) : null;
      if (trigger?.isConnected && trigger.getClientRects().length) trigger.focus({preventScroll: true});
    });
  };


  // ---------------------------------------------------------------------------
  // Fetch / reload
  // ---------------------------------------------------------------------------
  const reload = useCallback(async () => {
    if (!listScope || liveContext.current !== context) return;
    const request = ++generation.current;
    const isCurrent = () => request === generation.current && liveContext.current === context;
    setReadState({scope: listScope, loading: true, error: null});
    try {
      const rows = await listAllDemands(supabase);
      if (!isCurrent()) return;
      const display = await getCompanyDisplayMapByIds(supabase, Array.from(new Set(rows.map(row => row.company_id))));
      if (!isCurrent()) return;
      setSnapshot({scope: listScope, rows, names: display.nameById});
      setReadState({scope: listScope, loading: false, error: null});
    } catch (err) {
      if (!isCurrent()) return;
      setSnapshot(null);
      setReadState({scope: listScope, loading: false, error: err instanceof Error ? err.message : "Talepler yüklenirken bir hata oluştu."});
    }
  }, [supabase, listScope, context]);

  useEffect(() => {
    liveContext.current = context;
    setSnapshot(null); setNewOpen(false); setSelectedId(null); setOwnerTarget({open: false});
    feedback.clear();
    void reload();
    return () => { generation.current++; liveContext.current = null; };
    // Notice functions are recreated on render; clear only when context changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reload, context]);

  useEffect(() => {
    if (!listScope) return;
    let active = true;
    setCompanySnapshot(null);
    void selectAllCompanies(supabase).then(rows => {
      if (active) setCompanySnapshot({scope: listScope, rows, status: "ready"});
    }).catch(() => {
      if (active) setCompanySnapshot({scope: listScope, rows: [], status: "error"});
    });
    return () => { active = false; };
  }, [supabase, listScope, companyRetry]);

  // ---------------------------------------------------------------------------
  // Derived / enriched data
  // ---------------------------------------------------------------------------
  const enrichedRows: DemandListRow[] = useMemo(() => {
    return demands.map((d) => ({
      ...d,
      firma_name: companyNameById[d.company_id] ?? "—",
      open_count: computeOpenCount(d),
    }));
  }, [demands, companyNameById]);

  const totalOpenCount = useMemo(
    () => demands.reduce((sum, d) => sum + computeOpenCount(d), 0),
    [demands],
  );

  const filteredData = useMemo(() => {
    return enrichedRows.filter((d) => {
      if (search) {
        const q = search.toLowerCase();
        if (
          !d.firma_name.toLowerCase().includes(q) &&
          !d.position.toLowerCase().includes(q) &&
          !(d.responsible ?? "").toLowerCase().includes(q)
        )
          return false;
      }
      if (filters.durum && d.status !== filters.durum) return false;
      if (filters.oncelik && d.priority !== filters.oncelik) return false;
      if (filters.firma && d.firma_name !== filters.firma) return false;
      return true;
    });
  }, [enrichedRows, search, filters]);

  const selectedTalep = useMemo(
    () => enrichedRows.find((d) => d.id === selectedId) ?? null,
    [enrichedRows, selectedId],
  );

  const firmaOptions = useMemo(
    () =>
      allCompanies.map((c) => ({
        id: c.legacy_mock_id ?? c.id,
        ad: c.name,
      })),
    [allCompanies],
  );

  const filterConfig = useMemo<FilterConfig[]>(
    () => [
      ...FILTER_CONFIG,
      buildFirmaFilter(allCompanies.map((c) => c.name)),
    ],
    [allCompanies],
  );

  const openOwner = (row: DemandListRow) => setOwnerTarget({
    open: true, talepRef: `${row.position} — ${row.firma_name}`,
    talepId: row.id, initialSorumlu: row.responsible ?? "",
  });

  const columns = useMemo<ColumnDef<DemandListRow>[]>(() => COLUMNS.map(column => column.key !== "firma_name" ? column : {
    ...column,
    render: (_value, row) => <div className="w-56 whitespace-normal break-words sm:w-auto">
      <span>{row.firma_name}</span>
      <div className="mt-2 space-y-2 sm:hidden">
        <p className="font-medium text-slate-900">{row.position}</p>
        <StatusBadge status={row.status} />
        <p className="text-xs text-slate-600">{row.requested_count} kişi talep · {row.provided_count} sağlanan · {row.open_count} açık</p>
        <button type="button" ref={element => {
          if (element) mobileDetailControls.current.set(row.id, element);
          else mobileDetailControls.current.delete(row.id);
        }} onClick={event => { event.stopPropagation(); setSelectedId(row.id); }}
          aria-label={`${row.position} talebini aç`} className="min-h-11 rounded-lg border border-slate-200 px-3 text-sm font-medium text-blue-700">Talep detayı</button>
      </div>
    </div>,
  }), []);

  const rowActions: RowAction<DemandListRow>[] = [
    {
      label: "Sorumlu Ata",
      onClick: openOwner,
    },
  ];

  // ---------------------------------------------------------------------------
  // Role gate
  // ---------------------------------------------------------------------------
  // Auth not resolved yet — don't flash "Erişim kısıtlı" (role defaults to
  // "goruntuleyici" while AuthContext is loading). Wait, then decide.
  if (authLoading || !viewReady) {
    return (
      <>
        <PageHeader title="Personel Talepleri" subtitle="Talep yönetimi" />
        <EmptyState title="Yükleniyor…" description="Yetki bilgisi kontrol ediliyor." size="page" />
      </>
    );
  }

  if (["goruntuleyici", "ik", "muhasebe"].includes(role)) {
    return (
      <>
        <PageHeader title="Personel Talepleri" subtitle="Talep yönetimi" />
        <EmptyState
          title="Erişim kısıtlı"
          description="Bu ekran erisiminizin disindadir."
          size="page"
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Personel Talepleri"
        subtitle="Firma bazlı personel ihtiyaçları ve karşılanma durumu"
        actions={[
          ...(canOpenDailyPlan ? [{ label: "Günlük planı aç", onClick: () => router.push(dailyPlanHref), variant: "secondary" as const }] : []),
          {
            label: "Yeni Talep",
            onClick: () => setNewOpen(true),
            icon: <Plus size={16} />,
          },
        ]}
      />

      <div className="mb-5 rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-950">
        <p>Bu liste genel personel ihtiyaçlarını takip eder. Şube, çalışma günü, personel atama ve yoklama işlemleri Günlük plan ekranındadır. Buradaki talep kaydı kendiliğinden günlük görevlendirme oluşturmaz.</p>
        {canOpenDailyPlan && <Link href={dailyPlanHref} className="mt-2 inline-flex min-h-11 items-center font-semibold underline">{matchingCompanies.length===1?"Seçili firmanın günlük planını aç":"Günlük personel planını aç"} →</Link>}
      </div>
      <ActionNotice message={feedback.message} onDismiss={feedback.clear} />
      <div className="space-y-4">
        <PickerFeedback id="request-company-directory" status={companiesDurum} count={allCompanies.length} name="Firma listesi"
          emptyText="Listede firma yok. Talep formundan yeni firma ekleyebilirsiniz." onRetry={() => setCompanyRetry(value => value + 1)} />
        {loadError && (
          <p
            className={`${TYPE_CAPTION} text-red-600`}
            role="alert"
            aria-live="polite"
          >
            Talep listesi yüklenemedi. Listeyi tekrar yükleyebilirsiniz.
          </p>
        )}

        {!loading && !loadError && <p className="text-sm text-slate-600" aria-label="Talep özeti">
          <strong className="text-slate-900">{demands.length}</strong> talep · <strong className="text-slate-900">{totalOpenCount}</strong> kişilik açık ihtiyaç
          <span className="ml-2 text-xs text-slate-500">Tüm yüklü talepler</span>
        </p>}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="w-full sm:max-w-xs">
            <SearchInput ref={searchControl} key={listScope} value={search} maxLength={512}
              placeholder="Firma, pozisyon, sorumlu ara..."
              onChange={handleSearch}
            />
          </div>
          <FilterBar filters={filterConfig} values={filters} onChange={setFilters} />
        </div>

        {loading ? (
          <p role="status" className={`${TYPE_BODY} ${TEXT_MUTED} text-center py-8`}>
            Talepler yükleniyor…
          </p>
        ) : loadError ? (
          <button type="button" onClick={() => void reload()} className="min-h-11 rounded-lg border border-slate-200 px-4 text-sm font-medium text-blue-700">Listeyi tekrar yükle</button>
        ) : (
          <DataTable<DemandListRow>
            columns={columns}
            data={filteredData}
            rowKey="id"
            onRowClick={(row) => setSelectedId(row.id)}
            rowActions={rowActions}
            emptyTitle={demands.length === 0 ? "Henüz personel talebi yok" : "Bu filtrelerle eşleşen talep yok"}
            emptyDescription={demands.length === 0 ? "Yeni Talep ile ilk personel ihtiyacınızı kaydedebilirsiniz." : "Aramayı veya filtreleri değiştirerek yeniden deneyin."}
            emptyAction={demands.length === 0 ? {
              label: "İlk talebi oluştur", onClick: () => setNewOpen(true),
            } : (search !== "" || Object.values(filters).some(Boolean)) ? {
              label: "Arama ve filtreleri temizle", onClick: () => { searchControl.current?.clear(); setFilters(LIST_FILTER_DEFAULTS); },
            } : undefined}
          />
        )}
      </div>

      {/* RequestDetailDrawer */}
      <RightSidePanel
        open={!!selectedTalep}
        onClose={closeDetail}
        title="Talep detayı"
      >
        {selectedTalep && (
          <dl className="space-y-3">
            <div>
              <dt className={DL_LABEL}>Firma</dt>
              <dd className={`${TYPE_BODY} mt-0.5`}>
                <Link href={`/firmalar/${selectedTalep.company_id}`}
                  className={`${TEXT_LINK} inline-block min-h-11 max-w-full break-words py-2 underline underline-offset-4`}>
                  {selectedTalep.firma_name === "—" ? "Firma kaydını aç" : selectedTalep.firma_name}
                </Link>
              </dd>
            </div>
            <div>
              <dt className={DL_LABEL}>Pozisyon</dt>
              <dd className={DL_VALUE}>{selectedTalep.position}</dd>
            </div>
            <div>
              <dt className={DL_LABEL}>Durum</dt>
              <dd className="mt-1">
                <StatusBadge status={selectedTalep.status} />
              </dd>
            </div>
            <div>
              <dt className={DL_LABEL}>Oncelik</dt>
              <dd className="mt-1">
                <PriorityBadge priority={selectedTalep.priority} />
              </dd>
            </div>
            <div className={`pt-2 border-t ${BORDER_SUBTLE}`}>
              <dt className={`${DL_LABEL} mb-2`}>Doluluk Detay</dt>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className={`${SURFACE_HEADER} rounded p-2`}>
                  <p className={`text-lg font-semibold ${TEXT_PRIMARY}`}>
                    {selectedTalep.requested_count}
                  </p>
                  <p className={`${TYPE_CAPTION} ${TEXT_SECONDARY}`}>Talep</p>
                </div>
                <div className="bg-green-50 rounded p-2">
                  <p className="text-lg font-semibold text-green-700">
                    {selectedTalep.provided_count}
                  </p>
                  <p className={`${TYPE_CAPTION} ${TEXT_SECONDARY}`}>
                    Saglanan
                  </p>
                </div>
                <div
                  className={clsx(
                    "rounded p-2",
                    selectedTalep.open_count > 0 ? "bg-red-50" : "bg-green-50",
                  )}
                >
                  <p
                    className={clsx(
                      "text-lg font-semibold",
                      selectedTalep.open_count > 0
                        ? "text-red-600"
                        : "text-green-700",
                    )}
                  >
                    {selectedTalep.open_count}
                  </p>
                  <p className={`${TYPE_CAPTION} ${TEXT_SECONDARY}`}>Acik</p>
                </div>
              </div>
            </div>
            <div>
              <dt className={DL_LABEL}>Lokasyon</dt>
              <dd className={DL_VALUE}>
                {selectedTalep.location ?? "—"}
              </dd>
            </div>
            <div>
              <dt className={DL_LABEL}>Baslangic Tarihi</dt>
              <dd className={DL_VALUE}>
                {selectedTalep.start_date
                  ? formatDateTR(selectedTalep.start_date.slice(0, 10))
                  : "—"}
              </dd>
            </div>
            <div>
              <dt className={DL_LABEL}>Sorumlu</dt>
              <dd className={DL_VALUE}>
                {selectedTalep.responsible?.trim() || "Henüz sorumlu atanmadı"}
              </dd>
              <dd className="mt-2">
                <button type="button" onClick={() => openOwner(selectedTalep)} className="min-h-11 rounded-lg border border-slate-200 px-4 text-sm font-medium text-blue-700 hover:bg-blue-50">
                  {selectedTalep.responsible?.trim() ? "Sorumluyu değiştir" : "Sorumlu ata"}
                </button>
              </dd>
            </div>
          </dl>
        )}
      </RightSidePanel>

      <NewRequestModal
        key={listScope}
        open={newOpen}
        onClose={() => { if (liveContext.current === context) setNewOpen(false); }}
        firmalar={firmaOptions}
        firmalarDurum={companiesDurum}
        onRetryFirmalar={() => setCompanyRetry(value => value + 1)}
        onSubmit={async (p) => {
          if (liveContext.current !== context) return;
          const payload: DemandCreateInput = {
            legacyCompanyId: p.firmaId,
            position: p.pozisyon,
            requestedCount: p.adet,
            location: p.lokasyon || undefined,
            startDate: p.baslangicTarihi || undefined,
            priority: p.oncelik || undefined,
            responsible: p.sorumlu || undefined,
          };
          const result = await createDemandAction(payload);
          if (liveContext.current !== context) return;
          if (!result.ok) throw new Error(result.error);
          feedback.show(`${p.pozisyon} için ${p.adet} kişilik personel talebi kaydedildi.`);
          await reload();
          if (liveContext.current !== context) return;
          router.refresh();
        }}
      />
      <AssignOwnerModal
        key={`${listScope}:${ownerTarget.talepId ?? "none"}`}
        open={ownerTarget.open}
        onClose={() => { if (liveContext.current === context) setOwnerTarget({ open: false }); }}
        talepRef={ownerTarget.talepRef}
        talepId={ownerTarget.talepId}
        initialSorumlu={ownerTarget.initialSorumlu}
        onSubmit={async ({ talepId, sorumlu }) => {
          if (liveContext.current !== context) return;
          try {
            await updateDemand(supabase, talepId, { responsible: sorumlu });
          } catch {
            if (liveContext.current !== context) return;
            throw new Error("Sorumlu kaydedilemedi. Lütfen tekrar deneyin.");
          }
          if (liveContext.current !== context) return;
          feedback.show(`${ownerTarget.talepRef ?? "Talep"} için sorumlu ${sorumlu} olarak kaydedildi.`);
          await reload();
          if (liveContext.current !== context) return;
          router.refresh();
        }}
      />
    </>
  );
}
