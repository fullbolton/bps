"use client";

import { useState, useMemo, useCallback } from "react";
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
import { MOCK_IS_GUCU } from "@/mocks/aktif-isgucu";
import type { MockIsGucu } from "@/mocks/aktif-isgucu";
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

const FILTER_CONFIG: FilterConfig[] = [
  {
    key: "risk",
    label: "Risk",
    type: "select",
    placeholder: "Tüm riskler",
    options: (Object.keys(IS_GUCU_RISK_LABELS) as IsGucuRiskSeviyesi[]).map((r) => ({
      label: IS_GUCU_RISK_LABELS[r],
      value: r,
    })),
  },
  {
    key: "firma",
    label: "Firma",
    type: "select",
    placeholder: "Tüm firmalar",
    options: MOCK_IS_GUCU.map((ig) => ({ label: ig.firmaAdi, value: ig.firmaAdi })),
  },
];

/**
 * Columns match PRODUCT_STRUCTURE > Aktif İş Gücü > Liste kolonları:
 * firma, lokasyon, aktif kişi, hedef kişi, açık fark, son 30 gün giriş, son 30 gün çıkış, risk etiketi
 */
const COLUMNS: ColumnDef<MockIsGucu>[] = [
  { key: "firmaAdi", header: "Firma", sortable: true },
  { key: "lokasyon", header: "Lokasyon" },
  { key: "aktifKisi", header: "Aktif Kişi", sortable: true },
  { key: "hedefKisi", header: "Hedef Kişi", sortable: true },
  {
    key: "acikFark",
    header: "Açık Fark",
    sortable: true,
    render: (val) => {
      const n = val as number;
      return <span className={clsx(`${TYPE_BODY} font-medium`, n > 0 ? "text-red-600" : "text-green-600")}>{n > 0 ? `−${n}` : "0"}</span>;
    },
  },
  {
    key: "son30GunGiris",
    header: "Son 30g Giriş",
    render: (val) => <span className={`${TYPE_BODY} text-green-600`}>+{val as number}</span>,
  },
  {
    key: "son30GunCikis",
    header: "Son 30g Çıkış",
    render: (val) => <span className={`${TYPE_BODY} text-red-600`}>−{val as number}</span>,
  },
  {
    key: "riskEtiketi",
    header: "Risk Etiketi",
    sortable: true,
    render: (val) => <WorkforceRiskBadge risk={val as IsGucuRiskSeviyesi} />,
  },
];

export default function AktifIsgucuPage() {
  const { role } = useRole();
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<FilterValues>({ risk: "", firma: "" });
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const handleSearch = useCallback((val: string) => setSearch(val), []);

  const totals = useMemo(() => {
    let aktif = 0, hedef = 0, fark = 0, riskli = 0;
    for (const ig of MOCK_IS_GUCU) {
      aktif += ig.aktifKisi;
      hedef += ig.hedefKisi;
      fark += ig.acikFark;
      if (ig.riskEtiketi !== "stabil") riskli++;
    }
    return { aktif, hedef, fark, riskli };
  }, []);

  const filteredData = useMemo(() => {
    return MOCK_IS_GUCU.filter((ig) => {
      if (search) {
        const q = search.toLowerCase();
        if (!ig.firmaAdi.toLowerCase().includes(q) && !ig.lokasyon.toLowerCase().includes(q)) return false;
      }
      if (filters.risk && ig.riskEtiketi !== filters.risk) return false;
      if (filters.firma && ig.firmaAdi !== filters.firma) return false;
      return true;
    });
  }, [search, filters]);

  const selected = useMemo(() => MOCK_IS_GUCU.find((ig) => ig.id === selectedId) ?? null, [selectedId]);

  if (["goruntuleyici", "muhasebe"].includes(role)) {
    return (
      <>
        <PageHeader title="Aktif İş Gücü" subtitle="Firma bazlı kapasite" />
        <EmptyState title="Erişim kısıtlı" description="Bu ekran görüntüleyici erişiminin dışındadır." size="page" />
      </>
    );
  }

  return (
    <>
      <PageHeader title="Aktif İş Gücü" subtitle="Firma bazlı doluluk ve kapasite" />

      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KPIStatCard label="Toplam Aktif" value={totals.aktif} />
          <KPIStatCard label="Toplam Hedef" value={totals.hedef} />
          <KPIStatCard label="Toplam Açık Fark" value={totals.fark} />
          <KPIStatCard label="Riskli Firma" value={totals.riskli} />
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="w-full sm:max-w-xs"><SearchInput placeholder="Firma, lokasyon ara..." onChange={handleSearch} /></div>
          <FilterBar filters={FILTER_CONFIG} values={filters} onChange={setFilters} />
        </div>

        <DataTable<MockIsGucu> columns={COLUMNS} data={filteredData} rowKey="id" onRowClick={(row) => setSelectedId(row.id)} emptyTitle="Kayıt bulunamadı" emptyDescription="Arama veya filtre kriterlerinizi değiştirin." />
      </div>

      <RightSidePanel open={!!selected} onClose={() => setSelectedId(null)} title={selected?.firmaAdi}>
        {selected && (
          <div className="space-y-4">
            <div>
              <a href={`/firmalar/${selected.firmaId}`} className={`${TYPE_BODY} ${TEXT_LINK} hover:underline`}>{selected.firmaAdi}</a>
              <p className={`${TYPE_CAPTION} ${TEXT_MUTED} mt-0.5`}>{selected.lokasyon}</p>
            </div>
            <CapacityRiskCard
              aktifKisi={selected.aktifKisi}
              hedefKisi={selected.hedefKisi}
              acikFark={selected.acikFark}
              son30GunGiris={selected.son30GunGiris}
              son30GunCikis={selected.son30GunCikis}
              riskEtiketi={selected.riskEtiketi}
            />
          </div>
        )}
      </RightSidePanel>
    </>
  );
}
