"use client";

import { useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { formatDateTR } from "@/lib/format-date";
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
import {
  MOCK_SOZLESMELER,
  MOCK_SOZLESME_DETAY,
  getSozlesmeStatusCounts,
} from "@/mocks/sozlesmeler";
import type { MockSozlesme } from "@/mocks/sozlesmeler";
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
  {
    key: "firma",
    label: "Firma",
    type: "select",
    placeholder: "Tüm firmalar",
    options: Array.from(new Set(MOCK_SOZLESMELER.map((s) => s.firmaAdi))).map(
      (name) => ({ label: name, value: name })
    ),
  },
  {
    key: "tur",
    label: "Tür",
    type: "select",
    placeholder: "Tüm türler",
    options: Array.from(new Set(MOCK_SOZLESMELER.map((s) => s.tur))).map(
      (t) => ({ label: t, value: t })
    ),
  },
];

/**
 * Columns match PRODUCT_STRUCTURE > Sözleşmeler > Liste kolonları exactly:
 * sözleşme adı, firma, tür, başlangıç, bitiş, kalan gün, durum, sorumlu, son işlem
 */
const COLUMNS: ColumnDef<MockSozlesme>[] = [
  { key: "sozlesmeAdi", header: "Sözleşme Adı", sortable: true },
  { key: "firmaAdi", header: "Firma", sortable: true },
  { key: "tur", header: "Tür", sortable: true },
  { key: "baslangic", header: "Başlangıç", sortable: true, render: (val) => formatDateTR(val as string) },
  { key: "bitis", header: "Bitiş", sortable: true, render: (val) => formatDateTR(val as string) },
  {
    key: "kalanGun",
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
    key: "durum",
    header: "Durum",
    sortable: true,
    render: (val) => <StatusBadge status={val as MockSozlesme["durum"]} />,
  },
  { key: "sorumlu", header: "Sorumlu", sortable: true },
  {
    key: "sonIslem",
    header: "Son İşlem",
    render: (val, row) => {
      // Only show preparation milestone for early-lifecycle contracts (taslak, imza_bekliyor)
      if (row.durum === "taslak" || row.durum === "imza_bekliyor") {
        const detay = MOCK_SOZLESME_DETAY[row.id];
        if (detay?.ticariHazirlik) {
          const last = [...detay.ticariHazirlik.adimlar].reverse().find((a) => a.tamamlandi);
          if (last) return <span className={`${TYPE_BODY} ${TEXT_BODY}`}>{last.adim} — {last.tarih}</span>;
        }
      }
      return <span className={`${TYPE_BODY} ${TEXT_BODY}`}>{(val as string) || "—"}</span>;
    },
  },
];

export default function SozlesmelerPage() {
  const { role } = useRole();
  const router = useRouter();

  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<FilterValues>({
    durum: "",
    firma: "",
    tur: "",
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const handleSearch = useCallback((val: string) => setSearch(val), []);

  const statusCounts = useMemo(() => getSozlesmeStatusCounts(), []);

  const filteredData = useMemo(() => {
    return MOCK_SOZLESMELER.filter((s) => {
      if (search) {
        const q = search.toLowerCase();
        const match =
          s.sozlesmeAdi.toLowerCase().includes(q) ||
          s.firmaAdi.toLowerCase().includes(q) ||
          s.tur.toLowerCase().includes(q);
        if (!match) return false;
      }
      if (filters.durum && s.durum !== filters.durum) return false;
      if (filters.firma && s.firmaAdi !== filters.firma) return false;
      if (filters.tur && s.tur !== filters.tur) return false;
      return true;
    });
  }, [search, filters]);

  const selectedContract = useMemo(
    () => MOCK_SOZLESMELER.find((s) => s.id === selectedId) ?? null,
    [selectedId]
  );

  const rowActions: RowAction<MockSozlesme>[] = [
    {
      label: "Önizleme",
      onClick: (row) => setSelectedId(row.id),
    },
  ];

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
      />

      <div className="space-y-4">
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
            filters={FILTER_CONFIG}
            values={filters}
            onChange={setFilters}
          />
        </div>

        <DataTable<MockSozlesme>
          columns={COLUMNS}
          data={filteredData}
          rowKey="id"
          onRowClick={(row) => router.push(`/sozlesmeler/${row.id}`)}
          rowActions={rowActions}
          emptyTitle="Sözleşme bulunamadı"
          emptyDescription="Arama veya filtre kriterlerinizi değiştirin."
        />
      </div>

      {/* Right side panel — preview (not full detail) */}
      <RightSidePanel
        open={!!selectedContract}
        onClose={() => setSelectedId(null)}
        title={selectedContract?.sozlesmeAdi}
      >
        {selectedContract && (
          <div className="space-y-4">
            <dl className="space-y-3">
              <div>
                <dt className={DL_LABEL}>Firma</dt>
                <dd className={`${TYPE_BODY} mt-0.5`}>
                  <a
                    href={`/firmalar/${selectedContract.firmaId}`}
                    className={`${TEXT_LINK} hover:underline`}
                  >
                    {selectedContract.firmaAdi}
                  </a>
                </dd>
              </div>
              <div>
                <dt className={DL_LABEL}>Durum</dt>
                <dd className="mt-1">
                  <StatusBadge status={selectedContract.durum} />
                </dd>
              </div>
              <div>
                <dt className={DL_LABEL}>Tür</dt>
                <dd className={DL_VALUE}>
                  {selectedContract.tur}
                </dd>
              </div>
              <div>
                <dt className={DL_LABEL}>Başlangıç</dt>
                <dd className={DL_VALUE}>
                  {formatDateTR(selectedContract.baslangic)}
                </dd>
              </div>
              <div>
                <dt className={DL_LABEL}>Bitiş</dt>
                <dd className={DL_VALUE}>
                  {formatDateTR(selectedContract.bitis)}
                </dd>
              </div>
              {selectedContract.kalanGun !== null && (
                <div>
                  <dt className={DL_LABEL}>Kalan Gün</dt>
                  <dd
                    className={clsx(
                      `${TYPE_BODY} font-medium mt-0.5`,
                      selectedContract.kalanGun <= 15
                        ? "text-red-600"
                        : selectedContract.kalanGun <= 30
                          ? "text-amber-600"
                          : TEXT_BODY
                    )}
                  >
                    {selectedContract.kalanGun} gün
                  </dd>
                </div>
              )}
              <div>
                <dt className={DL_LABEL}>Sorumlu</dt>
                <dd className={DL_VALUE}>
                  {selectedContract.sorumlu}
                </dd>
              </div>
              <div>
                <dt className={DL_LABEL}>Son İşlem</dt>
                <dd className={DL_VALUE}>
                  {selectedContract.sonIslem}
                </dd>
              </div>
              <div className={`pt-2 border-t ${BORDER_SUBTLE}`}>
                <dt className={DL_LABEL}>Tutar</dt>
                <dd className={`${TYPE_BODY} font-medium ${TEXT_PRIMARY} mt-0.5`}>
                  {selectedContract.tutar}
                </dd>
              </div>
              <div>
                <dt className={DL_LABEL}>Kapsam</dt>
                <dd className={DL_VALUE}>
                  {selectedContract.kapsam}
                </dd>
              </div>
            </dl>
          </div>
        )}
      </RightSidePanel>

    </>
  );
}
