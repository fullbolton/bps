"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { formatDateTR } from "@/lib/format-date";
import { formatTRY } from "@/lib/format-currency";
import {
  PageHeader,
  SearchInput,
  FilterBar,
  DataTable,
  StatusBadge,
  RightSidePanel,
  EmptyState,
} from "@/components/ui";
import { useRole } from "@/context/RoleContext";
import { NewContractModal } from "@/components/modals";
// Faz 2: Sözleşmeler list cutover. Contracts and the active-count
// statistics come from the contracts service layer. The firma filter
// dropdown and the New Contract modal now source options from the
// real companies table via `selectAllCompanies` (RLS-scoped).
import { createClient } from "@/lib/supabase/client";
import { selectAllCompanies } from "@/lib/supabase/companies";
import type { CompanyRow } from "@/types/database.types";
import {
  listAllContracts,
  createContract,
  type ContractCreateInput,
} from "@/lib/services/contracts";
import { getCompanyDisplayMapByIds } from "@/lib/services/companies";
import type { ContractRow } from "@/types/database.types";
import type { ColumnDef, FilterConfig, FilterValues, RowAction } from "@/types/ui";
import { clsx } from "clsx";
import {
  TYPE_BODY,
  TYPE_CAPTION,
  TYPE_LABEL,
  TEXT_PRIMARY,
  TEXT_BODY,
  TEXT_SECONDARY,
  TEXT_MUTED,
  TEXT_INVERSE,
  TEXT_LINK,
  BORDER_SUBTLE,
  RADIUS_FULL,
} from "@/styles/tokens";
import { computeRemainingDays } from "@/lib/services/contracts";

// Page-local helpers
const CHIP_BASE = `px-3 py-1 ${TYPE_LABEL} ${RADIUS_FULL} border transition-colors`;
const CHIP_ACTIVE = `bg-slate-900 ${TEXT_INVERSE} border-slate-900`;
const CHIP_INACTIVE = `bg-white text-slate-600 border-slate-200 hover:bg-slate-50`;
const DL_LABEL = `${TYPE_CAPTION} ${TEXT_SECONDARY}`;
const DL_VALUE = `${TYPE_BODY} ${TEXT_BODY} mt-0.5`;

const STATUS_LABELS: Record<string, string> = {
  taslak: "Taslak",
  imza_bekliyor: "İmza Bekliyor",
  aktif: "Aktif",
  suresi_doldu: "Süresi Doldu",
  feshedildi: "Feshedildi",
};

/**
 * Augment the raw `ContractRow` with cached derived values + the firma
 * display name. This is the row shape consumed by the DataTable and the
 * RightSidePanel preview. firma_name is resolved via
 * `getCompanyDisplayMapByIds` against the real companies table.
 */
interface ContractListRow extends ContractRow {
  firma_name: string;
  remaining_days: number | null;
}

const FILTER_CONFIG: FilterConfig[] = [
  {
    key: "durum",
    label: "Durum",
    type: "select",
    placeholder: "Tüm durumlar",
    options: [
      { label: "Taslak", value: "taslak" },
      { label: "İmza Bekliyor", value: "imza_bekliyor" },
      { label: "Aktif", value: "aktif" },
      { label: "Süresi Doldu", value: "suresi_doldu" },
      { label: "Feshedildi", value: "feshedildi" },
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
 * Columns match PRODUCT_STRUCTURE > Sözleşmeler > Liste kolonları exactly:
 * sözleşme adı, firma, tür, başlangıç, bitiş, kalan gün, durum, sorumlu, son işlem
 */
const COLUMNS: ColumnDef<ContractListRow>[] = [
  { key: "name", header: "Sözleşme Adı", sortable: true },
  { key: "firma_name", header: "Firma", sortable: true },
  { key: "contract_type", header: "Tür", sortable: true, render: (v) => <span>{(v as string) ?? "—"}</span> },
  { key: "start_date", header: "Başlangıç", sortable: true, render: (val) => formatDateTR((val as string | null)?.slice(0, 10) ?? "") },
  { key: "end_date", header: "Bitiş", sortable: true, render: (val) => formatDateTR((val as string | null)?.slice(0, 10) ?? "") },
  {
    key: "remaining_days",
    header: "Kalan Gün",
    sortable: true,
    render: (val) => {
      if (val === null || val === undefined) return <span className={TEXT_MUTED}>—</span>;
      const num = val as number;
      return (
        <span
          className={clsx(
            `${TYPE_BODY} font-medium`,
            num <= 15 ? "text-red-600" : num <= 30 ? "text-amber-600" : TEXT_BODY
          )}
        >
          {num} gün
        </span>
      );
    },
  },
  {
    key: "status",
    header: "Durum",
    sortable: true,
    render: (val) => <StatusBadge status={val as ContractListRow["status"]} />,
  },
  { key: "responsible", header: "Sorumlu", sortable: true, render: (v) => <span>{(v as string) ?? "—"}</span> },
  {
    key: "last_action_label",
    header: "Son İşlem",
    render: (val) => <span className={`${TYPE_BODY} ${TEXT_BODY}`}>{(val as string) || "—"}</span>,
  },
];

export default function SozlesmelerPage() {
  const { role } = useRole();
  const router = useRouter();

  const supabase = useMemo(() => createClient(), []);
  const [contracts, setContracts] = useState<ContractRow[]>([]);
  const [companyNameById, setCompanyNameById] = useState<Record<string, string>>({});
  const [companyLegacyById, setCompanyLegacyById] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  // Real companies for the firma filter + New Contract modal.
  const [allCompanies, setAllCompanies] = useState<CompanyRow[]>([]);

  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<FilterValues>({
    durum: "",
    firma: "",
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const handleSearch = useCallback((val: string) => setSearch(val), []);

  const reload = useCallback(async () => {
    setLoadError(null);
    try {
      const rows = await listAllContracts(supabase);
      setContracts(rows);
      // Resolve firma display names + legacy ids for the rows we just
      // fetched. This is a single batched round trip — the
      // getCompanyDisplayMapByIds helper deduplicates ids internally.
      const uniqueCompanyIds = Array.from(new Set(rows.map((r) => r.company_id)));
      const display = await getCompanyDisplayMapByIds(supabase, uniqueCompanyIds);
      setCompanyNameById(display.nameById);
      setCompanyLegacyById(display.legacyById);
    } catch (err) {
      setContracts([]);
      setCompanyNameById({});
      setCompanyLegacyById({});
      setLoadError(
        err instanceof Error ? err.message : "Sözleşmeler yüklenirken bir hata oluştu.",
      );
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    setLoading(true);
    void reload();
  }, [reload]);

  // Companies for the firma filter + New Contract modal. RLS-scoped.
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

  const enrichedRows: ContractListRow[] = useMemo(() => {
    return contracts.map((c) => ({
      ...c,
      firma_name: companyNameById[c.company_id] ?? "—",
      remaining_days: computeRemainingDays(c.end_date),
    }));
  }, [contracts, companyNameById]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const c of contracts) {
      counts[c.status] = (counts[c.status] ?? 0) + 1;
    }
    return counts;
  }, [contracts]);

  const filteredData = useMemo(() => {
    return enrichedRows.filter((s) => {
      if (search) {
        const q = search.toLowerCase();
        const match =
          s.name.toLowerCase().includes(q) ||
          (s.firma_name?.toLowerCase().includes(q) ?? false) ||
          (s.contract_type?.toLowerCase().includes(q) ?? false);
        if (!match) return false;
      }
      if (filters.durum && s.status !== filters.durum) return false;
      if (filters.firma && s.firma_name !== filters.firma) return false;
      return true;
    });
  }, [enrichedRows, search, filters]);

  const selectedContract = useMemo(
    () => enrichedRows.find((s) => s.id === selectedId) ?? null,
    [enrichedRows, selectedId]
  );

  const rowActions: RowAction<ContractListRow>[] = [
    {
      label: "Önizleme",
      onClick: (row) => setSelectedId(row.id),
    },
  ];

  const canCreate = role === "yonetici" || role === "partner";

  if (["goruntuleyici", "ik", "muhasebe"].includes(role)) {
    return (
      <>
        <PageHeader title="Sözleşmeler" subtitle="Sözleşme yaşam döngüsü" />
        <EmptyState title="Erişim kısıtlı" description="Bu ekran erişiminizin dışındadır." size="page" />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Sözleşmeler"
        subtitle="Sözleşme yaşam döngüsü"
        actions={canCreate ? [
          {
            label: "Yeni Sözleşme",
            onClick: () => setCreateOpen(true),
            icon: <Plus size={16} />,
            variant: "primary",
          },
        ] : undefined}
      />

      <div className="space-y-4">
        {loadError && (
          <p className={`${TYPE_CAPTION} text-red-600`} role="alert" aria-live="polite">
            {loadError}
          </p>
        )}

        {/* Status summary chips — clickable as filter shortcuts */}
        <div className="flex items-center gap-2 flex-wrap">
          {Object.entries(statusCounts).map(([status, count]) => (
            <button
              key={status}
              onClick={() =>
                setFilters((prev) => ({
                  ...prev,
                  durum: prev.durum === status ? "" : status,
                }))
              }
              className={clsx(
                CHIP_BASE,
                filters.durum === status ? CHIP_ACTIVE : CHIP_INACTIVE
              )}
            >
              {STATUS_LABELS[status] ?? status} ({count})
            </button>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="w-full sm:max-w-xs">
            <SearchInput
              placeholder="Sözleşme, firma ara..."
              onChange={handleSearch}
            />
          </div>
          <FilterBar
            filters={filterConfig}
            values={filters}
            onChange={setFilters}
          />
        </div>

        {loading ? (
          <p className={`${TYPE_BODY} ${TEXT_MUTED} text-center py-8`}>Yükleniyor…</p>
        ) : (
          <DataTable<ContractListRow>
            columns={COLUMNS}
            data={filteredData}
            rowKey="id"
            onRowClick={(row) => router.push(`/sozlesmeler/${row.id}`)}
            rowActions={rowActions}
            emptyTitle="Sözleşme bulunamadı"
            emptyDescription="Arama veya filtre kriterlerinizi değiştirin."
          />
        )}
      </div>

      {/* Right side panel — preview (not full detail) */}
      <RightSidePanel
        open={!!selectedContract}
        onClose={() => setSelectedId(null)}
        title={selectedContract?.name}
      >
        {selectedContract && (
          <div className="space-y-4">
            <dl className="space-y-3">
              <div>
                <dt className={DL_LABEL}>Firma</dt>
                <dd className={`${TYPE_BODY} mt-0.5`}>
                  {companyLegacyById[selectedContract.company_id] ? (
                    <a
                      href={`/firmalar/${companyLegacyById[selectedContract.company_id]}`}
                      className={`${TEXT_LINK} hover:underline`}
                    >
                      {selectedContract.firma_name}
                    </a>
                  ) : (
                    <span className={TEXT_BODY}>{selectedContract.firma_name}</span>
                  )}
                </dd>
              </div>
              <div>
                <dt className={DL_LABEL}>Durum</dt>
                <dd className="mt-1">
                  <StatusBadge status={selectedContract.status} />
                </dd>
              </div>
              {selectedContract.contract_type && (
                <div>
                  <dt className={DL_LABEL}>Tür</dt>
                  <dd className={DL_VALUE}>{selectedContract.contract_type}</dd>
                </div>
              )}
              {selectedContract.start_date && (
                <div>
                  <dt className={DL_LABEL}>Başlangıç</dt>
                  <dd className={DL_VALUE}>
                    {formatDateTR(selectedContract.start_date.slice(0, 10))}
                  </dd>
                </div>
              )}
              {selectedContract.end_date && (
                <div>
                  <dt className={DL_LABEL}>Bitiş</dt>
                  <dd className={DL_VALUE}>
                    {formatDateTR(selectedContract.end_date.slice(0, 10))}
                  </dd>
                </div>
              )}
              {selectedContract.remaining_days !== null && (
                <div>
                  <dt className={DL_LABEL}>Kalan Gün</dt>
                  <dd
                    className={clsx(
                      `${TYPE_BODY} font-medium mt-0.5`,
                      selectedContract.remaining_days <= 15
                        ? "text-red-600"
                        : selectedContract.remaining_days <= 30
                          ? "text-amber-600"
                          : TEXT_BODY
                    )}
                  >
                    {selectedContract.remaining_days} gün
                  </dd>
                </div>
              )}
              {selectedContract.responsible && (
                <div>
                  <dt className={DL_LABEL}>Sorumlu</dt>
                  <dd className={DL_VALUE}>{selectedContract.responsible}</dd>
                </div>
              )}
              {selectedContract.last_action_label && (
                <div>
                  <dt className={DL_LABEL}>Son İşlem</dt>
                  <dd className={DL_VALUE}>{selectedContract.last_action_label}</dd>
                </div>
              )}
              {selectedContract.contract_value && (
                <div className={`pt-2 border-t ${BORDER_SUBTLE}`}>
                  <dt className={DL_LABEL}>Tutar</dt>
                  <dd className={`${TYPE_BODY} font-medium ${TEXT_PRIMARY} mt-0.5`}>
                    {formatTRY(selectedContract.contract_value)}
                  </dd>
                </div>
              )}
              {selectedContract.scope && (
                <div>
                  <dt className={DL_LABEL}>Kapsam</dt>
                  <dd className={DL_VALUE}>{selectedContract.scope}</dd>
                </div>
              )}
              <div className="pt-2">
                <a
                  href={`/sozlesmeler/${selectedContract.id}`}
                  className={`${TYPE_BODY} ${TEXT_LINK} hover:underline`}
                >
                  Detaya git →
                </a>
              </div>
            </dl>
          </div>
        )}
      </RightSidePanel>

      <NewContractModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        firmalar={firmaOptions}
        onSubmit={async (data) => {
          // Faz 2: persist via service layer. The service re-verifies
          // partner scope, validates name + date order + active-dates,
          // and stamps created_by from the auth session. Errors bubble
          // up so the modal can render them inline; only on resolve do
          // we refetch and close. router.refresh() invalidates the
          // entire client Router Cache so cached firma detail / firmalar
          // list pages will re-fetch on their next visit.
          const payload: ContractCreateInput = {
            legacyCompanyId: data.firmaId,
            name: data.sozlesmeAdi,
            contractType: data.tur || undefined,
            startDate: data.baslangic || null,
            endDate: data.bitis || null,
            scope: data.kapsam || undefined,
            contractValue: data.tutar || undefined,
            responsible: data.sorumlu || undefined,
          };
          await createContract(supabase, payload);
          await reload();
          router.refresh();
        }}
      />
    </>
  );
}
