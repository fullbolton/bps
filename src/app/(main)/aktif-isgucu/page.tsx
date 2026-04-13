"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import {
  PageHeader,
  SearchInput,
  FilterBar,
  DataTable,
  KPIStatCard,
  WorkforceRiskBadge,
  RightSidePanel,
  CapacityRiskCard,
  EmptyState,
} from "@/components/ui";
import { useRole } from "@/context/RoleContext";
import { createClient } from "@/lib/supabase/client";
import {
  listAllWorkforceSummaries,
  deriveOpenGap,
  deriveRiskLevel,
} from "@/lib/services/workforce-summary";
import { getCompanyDisplayMapByIds } from "@/lib/services/companies";
import type { WorkforceSummaryRow } from "@/types/database.types";
import type { IsGucuRiskSeviyesi } from "@/types/batch4";
import { IS_GUCU_RISK_LABELS } from "@/types/batch4";
import type { ColumnDef, FilterConfig, FilterValues } from "@/types/ui";
import { clsx } from "clsx";
import {
  TYPE_BODY,
  TYPE_CAPTION,
  TEXT_MUTED,
  TEXT_LINK,
} from "@/styles/tokens";

/**
 * Augment the raw `WorkforceSummaryRow` with cached derived values + the
 * firma display name. This is the row shape consumed by the DataTable and
 * the RightSidePanel preview. firma_name is resolved via
 * `getCompanyDisplayMapByIds`; open_gap and risk_level are derived on the
 * fly per the "no second truth" rule.
 */
interface WorkforceListRow extends WorkforceSummaryRow {
  firma_name: string;
  open_gap: number;
  risk_level: IsGucuRiskSeviyesi;
  /** legacy_mock_id for linking to firma detail page */
  firma_legacy_id: string | null;
}

/**
 * Columns match PRODUCT_STRUCTURE > Aktif Is Gucu > Liste kolonlari:
 * firma, lokasyon, aktif kisi, hedef kisi, acik fark, son 30 gun giris,
 * son 30 gun cikis, risk etiketi
 */
const COLUMNS: ColumnDef<WorkforceListRow>[] = [
  { key: "firma_name", header: "Firma", sortable: true },
  { key: "location", header: "Lokasyon" },
  { key: "current_count", header: "Aktif Kisi", sortable: true },
  { key: "target_count", header: "Hedef Kisi", sortable: true },
  {
    key: "open_gap",
    header: "Acik Fark",
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
          {n > 0 ? `\u2212${n}` : "0"}
        </span>
      );
    },
  },
  {
    key: "hires_last_30d",
    header: "Son 30g Giris",
    render: (val) => (
      <span className={`${TYPE_BODY} text-green-600`}>+{val as number}</span>
    ),
  },
  {
    key: "exits_last_30d",
    header: "Son 30g Cikis",
    render: (val) => (
      <span className={`${TYPE_BODY} text-red-600`}>\u2212{val as number}</span>
    ),
  },
  {
    key: "risk_level",
    header: "Risk Etiketi",
    sortable: true,
    render: (val) => (
      <WorkforceRiskBadge risk={val as IsGucuRiskSeviyesi} />
    ),
  },
];

export default function AktifIsgucuPage() {
  const { role } = useRole();

  const supabase = useMemo(() => createClient(), []);
  const [summaries, setSummaries] = useState<WorkforceSummaryRow[]>([]);
  const [companyNameById, setCompanyNameById] = useState<
    Record<string, string>
  >({});
  const [companyLegacyById, setCompanyLegacyById] = useState<
    Record<string, string>
  >({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<FilterValues>({
    risk: "",
    firma: "",
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const handleSearch = useCallback((val: string) => setSearch(val), []);

  // --- data load ---
  const reload = useCallback(async () => {
    setLoadError(null);
    try {
      const rows = await listAllWorkforceSummaries(supabase);
      setSummaries(rows);

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
      setSummaries([]);
      setCompanyNameById({});
      setCompanyLegacyById({});
      setLoadError(
        err instanceof Error
          ? err.message
          : "Is gucu verileri yuklenirken bir hata olustu.",
      );
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    setLoading(true);
    void reload();
  }, [reload]);

  // --- enriched rows ---
  const enrichedRows: WorkforceListRow[] = useMemo(() => {
    return summaries.map((row) => ({
      ...row,
      firma_name: companyNameById[row.company_id] ?? "—",
      open_gap: deriveOpenGap(row),
      risk_level: deriveRiskLevel(row),
      firma_legacy_id: companyLegacyById[row.company_id] ?? null,
    }));
  }, [summaries, companyNameById, companyLegacyById]);

  // --- filter config (built from loaded data) ---
  const filterConfig: FilterConfig[] = useMemo(() => {
    const firmaOptions = Array.from(
      new Set(enrichedRows.map((r) => r.firma_name)),
    )
      .filter((n) => n !== "—")
      .map((name) => ({ label: name, value: name }));

    return [
      {
        key: "risk",
        label: "Risk",
        type: "select" as const,
        placeholder: "Tum riskler",
        options: (
          Object.keys(IS_GUCU_RISK_LABELS) as IsGucuRiskSeviyesi[]
        ).map((r) => ({
          label: IS_GUCU_RISK_LABELS[r],
          value: r,
        })),
      },
      {
        key: "firma",
        label: "Firma",
        type: "select" as const,
        placeholder: "Tum firmalar",
        options: firmaOptions,
      },
    ];
  }, [enrichedRows]);

  // --- KPI totals ---
  const totals = useMemo(() => {
    let aktif = 0;
    let hedef = 0;
    let fark = 0;
    let riskli = 0;
    for (const row of enrichedRows) {
      aktif += row.current_count;
      hedef += row.target_count;
      fark += row.open_gap;
      if (row.risk_level !== "stabil") riskli++;
    }
    return { aktif, hedef, fark, riskli };
  }, [enrichedRows]);

  // --- search + filter ---
  const filteredData = useMemo(() => {
    return enrichedRows.filter((row) => {
      if (search) {
        const q = search.toLowerCase();
        if (
          !row.firma_name.toLowerCase().includes(q) &&
          !(row.location ?? "").toLowerCase().includes(q)
        )
          return false;
      }
      if (filters.risk && row.risk_level !== filters.risk) return false;
      if (filters.firma && row.firma_name !== filters.firma) return false;
      return true;
    });
  }, [enrichedRows, search, filters]);

  const selected = useMemo(
    () => enrichedRows.find((r) => r.id === selectedId) ?? null,
    [enrichedRows, selectedId],
  );

  // --- role gate ---
  if (["goruntuleyici", "muhasebe"].includes(role)) {
    return (
      <>
        <PageHeader
          title="Aktif Is Gucu"
          subtitle="Firma bazli kapasite"
        />
        <EmptyState
          title="Erisim kisitli"
          description="Bu ekran goruntleyici erisiminin disindadir."
          size="page"
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Aktif Is Gucu"
        subtitle="Firma bazli doluluk ve kapasite"
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
          <KPIStatCard label="Toplam Aktif" value={totals.aktif} />
          <KPIStatCard label="Toplam Hedef" value={totals.hedef} />
          <KPIStatCard label="Toplam Acik Fark" value={totals.fark} />
          <KPIStatCard label="Riskli Firma" value={totals.riskli} />
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="w-full sm:max-w-xs">
            <SearchInput
              placeholder="Firma, lokasyon ara..."
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
          <p className={`${TYPE_BODY} ${TEXT_MUTED} text-center py-8`}>
            Yukleniyor\u2026
          </p>
        ) : (
          <DataTable<WorkforceListRow>
            columns={COLUMNS}
            data={filteredData}
            rowKey="id"
            onRowClick={(row) => setSelectedId(row.id)}
            emptyTitle="Kayit bulunamadi"
            emptyDescription="Arama veya filtre kriterlerinizi degistirin."
          />
        )}
      </div>

      <RightSidePanel
        open={!!selected}
        onClose={() => setSelectedId(null)}
        title={selected?.firma_name}
      >
        {selected && (
          <div className="space-y-4">
            <div>
              {selected.firma_legacy_id ? (
                <a
                  href={`/firmalar/${selected.firma_legacy_id}`}
                  className={`${TYPE_BODY} ${TEXT_LINK} hover:underline`}
                >
                  {selected.firma_name}
                </a>
              ) : (
                <span className={TYPE_BODY}>{selected.firma_name}</span>
              )}
              <p className={`${TYPE_CAPTION} ${TEXT_MUTED} mt-0.5`}>
                {selected.location ?? "—"}
              </p>
            </div>
            <CapacityRiskCard
              aktifKisi={selected.current_count}
              hedefKisi={selected.target_count}
              acikFark={selected.open_gap}
              son30GunGiris={selected.hires_last_30d}
              son30GunCikis={selected.exits_last_30d}
              riskEtiketi={selected.risk_level}
            />
          </div>
        )}
      </RightSidePanel>
    </>
  );
}
