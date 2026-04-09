"use client";

/**
 * Personel Talepleri (Staffing Demands) list page.
 *
 * Faz 3A: cut over from mock data to Supabase truth. Demands now come
 * from the staffing-demands service layer; the still-mock MOCK_FIRMALAR
 * is reused only as a UI dictionary so the firma filter dropdown and
 * the NewRequestModal can offer firma names without touching the full
 * Firmalar migration. Company display names for rows fetched from the DB
 * are resolved via `getCompanyDisplayMapByIds` (same pattern as the
 * Sozlesmeler list page, Faz 2).
 *
 * open_count (acik kalan) is DERIVED via `computeOpenCount` and never
 * persisted — the DB has no column for it by design.
 */

import { useState, useMemo, useCallback, useEffect } from "react";
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
  KPIStatCard,
  RightSidePanel,
  EmptyState,
} from "@/components/ui";
import { useRole } from "@/context/RoleContext";
import { NewRequestModal, AssignOwnerModal } from "@/components/modals";
import { MOCK_FIRMALAR } from "@/mocks/firmalar";
import { createClient } from "@/lib/supabase/client";
import {
  listAllDemands,
  createDemand,
  updateDemand,
  computeOpenCount,
  type DemandCreateInput,
} from "@/lib/services/staffing-demands";
import { getCompanyDisplayMapByIds } from "@/lib/services/companies";
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
  TYPE_LABEL,
  TEXT_PRIMARY,
  TEXT_BODY,
  TEXT_SECONDARY,
  TEXT_INVERSE,
  TEXT_MUTED,
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
  degerlendiriliyor: "Degerlendiriliyor",
  kismi_doldu: "Kismi Doldu",
  tamamen_doldu: "Tamamen Doldu",
  beklemede: "Beklemede",
  iptal: "Iptal",
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
    placeholder: "Tum durumlar",
    options: Object.entries(STATUS_LABELS).map(([v, l]) => ({
      value: v,
      label: l,
    })),
  },
  {
    key: "oncelik",
    label: "Oncelik",
    type: "select",
    placeholder: "Tum oncelikler",
    options: [
      { label: "Dusuk", value: "dusuk" },
      { label: "Normal", value: "normal" },
      { label: "Yuksek", value: "yuksek" },
      { label: "Kritik", value: "kritik" },
    ],
  },
  {
    key: "firma",
    label: "Firma",
    type: "select",
    placeholder: "Tum firmalar",
    options: Array.from(new Set(MOCK_FIRMALAR.map((f) => f.firmaAdi))).map(
      (name) => ({ label: name, value: name }),
    ),
  },
];

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
  { key: "provided_count", header: "Saglanan", sortable: true },
  {
    key: "open_count",
    header: "Acik Kalan",
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
        {(val as string | null) ?? "\u2014"}
      </span>
    ),
  },
  {
    key: "start_date",
    header: "Baslangic",
    sortable: true,
    render: (val) => formatDateTR(((val as string | null) ?? "").slice(0, 10)),
  },
  {
    key: "priority",
    header: "Oncelik",
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
        {(val as string | null) ?? "\u2014"}
      </span>
    ),
  },
];

export default function TaleplerPage() {
  const { role } = useRole();
  const router = useRouter();

  // ---------------------------------------------------------------------------
  // Supabase data state
  // ---------------------------------------------------------------------------
  const supabase = useMemo(() => createClient(), []);
  const [demands, setDemands] = useState<StaffingDemandRow[]>([]);
  const [companyNameById, setCompanyNameById] = useState<
    Record<string, string>
  >({});
  const [companyLegacyById, setCompanyLegacyById] = useState<
    Record<string, string>
  >({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // UI state
  // ---------------------------------------------------------------------------
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<FilterValues>({
    durum: "",
    oncelik: "",
    firma: "",
  });
  const [newOpen, setNewOpen] = useState(false);
  const [ownerTarget, setOwnerTarget] = useState<{
    open: boolean;
    talepRef?: string;
    talepId?: string;
  }>({ open: false });
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const handleSearch = useCallback((val: string) => setSearch(val), []);

  // ---------------------------------------------------------------------------
  // Fetch / reload
  // ---------------------------------------------------------------------------
  const reload = useCallback(async () => {
    setLoadError(null);
    try {
      const rows = await listAllDemands(supabase);
      setDemands(rows);
      // Resolve firma display names + legacy ids for the rows we just
      // fetched. This is a single batched round trip.
      const uniqueCompanyIds = Array.from(
        new Set(rows.map((r) => r.company_id)),
      );
      const display = await getCompanyDisplayMapByIds(
        supabase,
        uniqueCompanyIds,
      );
      setCompanyNameById(display.nameById);
      setCompanyLegacyById(display.legacyById);
    } catch (err) {
      setDemands([]);
      setCompanyNameById({});
      setCompanyLegacyById({});
      setLoadError(
        err instanceof Error
          ? err.message
          : "Talepler yuklenirken bir hata olustu.",
      );
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    setLoading(true);
    void reload();
  }, [reload]);

  // ---------------------------------------------------------------------------
  // Derived / enriched data
  // ---------------------------------------------------------------------------
  const enrichedRows: DemandListRow[] = useMemo(() => {
    return demands.map((d) => ({
      ...d,
      firma_name: companyNameById[d.company_id] ?? "\u2014",
      open_count: computeOpenCount(d),
    }));
  }, [demands, companyNameById]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const d of demands) {
      counts[d.status] = (counts[d.status] ?? 0) + 1;
    }
    return counts;
  }, [demands]);

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

  const firmaOptions = MOCK_FIRMALAR.map((f) => ({
    id: f.id,
    ad: f.firmaAdi,
  }));

  const rowActions: RowAction<DemandListRow>[] = [
    {
      label: "Sorumlu Ata",
      onClick: (row) =>
        setOwnerTarget({
          open: true,
          talepRef: `${row.position} \u2014 ${row.firma_name}`,
          talepId: row.id,
        }),
    },
  ];

  // ---------------------------------------------------------------------------
  // Role gate
  // ---------------------------------------------------------------------------
  if (["goruntuleyici", "ik", "muhasebe"].includes(role)) {
    return (
      <>
        <PageHeader title="Personel Talepleri" subtitle="Talep yonetimi" />
        <EmptyState
          title="Erisim kisitli"
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
        subtitle="Acik ihtiyaclar ve doluluk durumu"
        actions={[
          {
            label: "Yeni Talep",
            onClick: () => setNewOpen(true),
            icon: <Plus size={16} />,
          },
        ]}
      />

      <div className="space-y-4">
        {loadError && (
          <p
            className={`${TYPE_CAPTION} text-red-600`}
            role="alert"
            aria-live="polite"
          >
            {loadError}
          </p>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KPIStatCard label="Yeni" value={statusCounts["yeni"] ?? 0} />
          <KPIStatCard
            label="Degerlendiriliyor"
            value={statusCounts["degerlendiriliyor"] ?? 0}
          />
          <KPIStatCard
            label="Kismi Doldu"
            value={statusCounts["kismi_doldu"] ?? 0}
          />
          <KPIStatCard label="Toplam Acik Kalan" value={totalOpenCount} />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {Object.entries(statusCounts)
            .filter(([, c]) => c > 0)
            .map(([status, count]) => (
              <button
                key={status}
                onClick={() =>
                  setFilters((p) => ({
                    ...p,
                    durum: p.durum === status ? "" : status,
                  }))
                }
                className={clsx(
                  CHIP_BASE,
                  filters.durum === status ? CHIP_ACTIVE : CHIP_INACTIVE,
                )}
              >
                {STATUS_LABELS[status] ?? status} ({count})
              </button>
            ))}
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="w-full sm:max-w-xs">
            <SearchInput
              placeholder="Firma, pozisyon, sorumlu ara..."
              onChange={handleSearch}
            />
          </div>
          <FilterBar filters={FILTER_CONFIG} values={filters} onChange={setFilters} />
        </div>

        {loading ? (
          <p className={`${TYPE_BODY} ${TEXT_MUTED} text-center py-8`}>
            Yukleniyor...
          </p>
        ) : (
          <DataTable<DemandListRow>
            columns={COLUMNS}
            data={filteredData}
            rowKey="id"
            onRowClick={(row) => setSelectedId(row.id)}
            rowActions={rowActions}
            emptyTitle="Talep bulunamadi"
            emptyDescription="Arama veya filtre kriterlerinizi degistirin."
          />
        )}
      </div>

      {/* RequestDetailDrawer */}
      <RightSidePanel
        open={!!selectedTalep}
        onClose={() => setSelectedId(null)}
        title="Talep Detay"
      >
        {selectedTalep && (
          <dl className="space-y-3">
            <div>
              <dt className={DL_LABEL}>Firma</dt>
              <dd className={`${TYPE_BODY} mt-0.5`}>
                {companyLegacyById[selectedTalep.company_id] ? (
                  <a
                    href={`/firmalar/${companyLegacyById[selectedTalep.company_id]}`}
                    className={`${TEXT_LINK} hover:underline`}
                  >
                    {selectedTalep.firma_name}
                  </a>
                ) : (
                  <span className={TEXT_BODY}>{selectedTalep.firma_name}</span>
                )}
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
                {selectedTalep.location ?? "\u2014"}
              </dd>
            </div>
            <div>
              <dt className={DL_LABEL}>Baslangic Tarihi</dt>
              <dd className={DL_VALUE}>
                {selectedTalep.start_date
                  ? formatDateTR(selectedTalep.start_date.slice(0, 10))
                  : "\u2014"}
              </dd>
            </div>
            <div>
              <dt className={DL_LABEL}>Sorumlu</dt>
              <dd className={DL_VALUE}>
                {selectedTalep.responsible ?? "\u2014"}
              </dd>
            </div>
          </dl>
        )}
      </RightSidePanel>

      <NewRequestModal
        open={newOpen}
        onClose={() => setNewOpen(false)}
        firmalar={firmaOptions}
        onSubmit={async (p) => {
          const payload: DemandCreateInput = {
            legacyCompanyId: p.firmaId,
            position: p.pozisyon,
            requestedCount: p.adet,
            location: p.lokasyon || undefined,
            startDate: p.baslangicTarihi || undefined,
            priority: p.oncelik || undefined,
            responsible: p.sorumlu || undefined,
          };
          await createDemand(supabase, payload);
          await reload();
          router.refresh();
        }}
      />
      <AssignOwnerModal
        open={ownerTarget.open}
        onClose={() => setOwnerTarget({ open: false })}
        talepRef={ownerTarget.talepRef}
        talepId={ownerTarget.talepId}
        onSubmit={async ({ talepId, sorumlu }) => {
          await updateDemand(supabase, talepId, { responsible: sorumlu });
          await reload();
          router.refresh();
        }}
      />
    </>
  );
}
