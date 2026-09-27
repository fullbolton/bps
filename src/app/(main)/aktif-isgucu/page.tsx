"use client";
import AsyncSection from "@/components/ui/AsyncSection";
import { useScopedResource } from "@/components/ui/useScopedResource";
import ListToolbar from "@/components/ui/ListToolbar";
import Link from "next/link";
import DailyOverview from "../dashboard/DailyOverview";

import { useState, useMemo, useCallback, useEffect } from "react";
import {
  PageHeader,
  SearchInput,
  FilterBar,
  DataTable,
  KPIStatCard,
  RightSidePanel,
  EmptyState,
} from "@/components/ui";
import { useRole } from "@/context/RoleContext";
import { useAuth } from "@/context/AuthContext";
import { createClient } from "@/lib/supabase/client";
import {
  listAllWorkforceSummaries,
} from "@/lib/services/workforce-summary";
import { getCompanyDisplayMapByIds } from "@/lib/services/companies";
import type { WorkforceSummaryRow } from "@/types/database.types";
import { workforceCapacity, workforceCapacityTotals } from "@/lib/workforce-capacity";
import type { ColumnDef, FilterConfig, FilterValues } from "@/types/ui";
import { clsx } from "clsx";
import {
  TYPE_BODY,
  TYPE_CAPTION,
  TEXT_LINK,
  TEXT_MUTED,
} from "@/styles/tokens";

/**
 * Augment the raw `WorkforceSummaryRow` with cached derived values + the
 * firma display name. This is the row shape consumed by the DataTable and
 * the RightSidePanel preview. firma_name is resolved via
 * `getCompanyDisplayMapByIds`; open_gap and surplus are derived on the
 * fly per the "no second truth" rule.
 */
interface WorkforceListRow extends WorkforceSummaryRow {
  firma_name: string;
  open_gap: number;
  surplus: number;
}

/**
 * Columns match PRODUCT_STRUCTURE > Aktif Is Gucu > Liste kolonlari:
 * firma, lokasyon, aktif kisi, hedef kisi, acik fark, son 30 gun giris,
 * son 30 gun cikis, kadro fazlası
 */
const COLUMNS: ColumnDef<WorkforceListRow>[] = [
  { key: "firma_name", header: "Firma", sortable: true },
  { key: "location", header: "Lokasyon" },
  { key: "current_count", header: "Aktif Kişi", sortable: true },
  { key: "target_count", header: "Hedef Kişi", sortable: true },
  {
    key: "open_gap",
    header: "Eksik Personel",
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
    key: "hires_last_30d",
    header: "Son 30 gün giriş",
    render: (val) => (
      <span className={`${TYPE_BODY} text-green-600`}>{(val as number) > 0 ? `+${val}` : "0"}</span>
    ),
  },
  {
    key: "exits_last_30d",
    header: "Son 30 gün çıkış",
    render: (val) => (
      <span className={`${TYPE_BODY} text-red-600`}>{(val as number) > 0 ? `−${val}` : "0"}</span>
    ),
  },
  { key: "surplus", header: "Kadro Fazlası", sortable: true },
];

export default function AktifIsgucuPage() {
  const { role } = useRole();
  const { user, loading: authLoading } = useAuth();

  const supabase = useMemo(() => createClient(), []);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<FilterValues>({
    firma: "",
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const handleSearch = useCallback((val: string) => setSearch(val), []);

  const scope = !authLoading && user && !["goruntuleyici", "muhasebe"].includes(role)
    ? JSON.stringify([user.id, user.app_metadata?.active_tenant ?? null, role]) : null;
  const readWorkforce = useCallback(async () => {
    const rows = await listAllWorkforceSummaries(supabase);
    const uniqueCompanyIds = [...new Set(rows.map(row => row.company_id))];
    const display = await getCompanyDisplayMapByIds(supabase, uniqueCompanyIds);
    if (rows.some(row => !Object.hasOwn(display.nameById, row.company_id))) {
      throw new Error("Kadro kayıtlarının firma eşlemesi doğrulanamadı.");
    }
    return { rows, ...display };
  }, [supabase]);
  const resource = useScopedResource(scope, readWorkforce);
  const summaries = resource.data?.rows ?? [];
  const companyNameById = resource.data?.nameById ?? {};
  useEffect(() => {
    setSelectedId(null);
    setSearch("");
    setFilters({ firma: "" });
  }, [scope]);

  // --- enriched rows ---
  const enrichedRows: WorkforceListRow[] = useMemo(() => {
    return summaries.map((row) => ({
      ...row,
      firma_name: companyNameById[row.company_id] ?? "—",
      open_gap: workforceCapacity(row).shortage,
      surplus: workforceCapacity(row).surplus,
    }));
  }, [summaries, companyNameById]);

  // --- filter config (built from loaded data) ---
  const filterConfig: FilterConfig[] = useMemo(() => {
    const firmaOptions = Array.from(
      new Set(enrichedRows.map((r) => r.firma_name)),
    )
      .filter((n) => n !== "—")
      .map((name) => ({ label: name, value: name }));

    return [
      {
        key: "firma",
        label: "Firma",
        type: "select" as const,
        placeholder: "Tüm firmalar",
        options: firmaOptions,
      },
    ];
  }, [enrichedRows]);

  // --- KPI totals ---
  const totals = useMemo(() => workforceCapacityTotals(enrichedRows), [enrichedRows]);

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
      if (filters.firma && row.firma_name !== filters.firma) return false;
      return true;
    });
  }, [enrichedRows, search, filters]);

  const selected = useMemo(
    () => enrichedRows.find((r) => r.id === selectedId) ?? null,
    [enrichedRows, selectedId],
  );

  // --- role gate ---
  // Auth not resolved yet — don't flash "Erişim kısıtlı" (role defaults to
  // "goruntuleyici" while AuthContext is loading). Wait, then decide.
  if (authLoading) {
    return (
      <>
        <PageHeader
          title="Aktif İş Gücü"
          subtitle="Firma ve şube bazında personel durumu"
        />
        <EmptyState title="Yükleniyor…" description="Yetki bilgisi kontrol ediliyor." size="page" />
      </>
    );
  }

  if (!user || ["goruntuleyici", "muhasebe"].includes(role)) {
    return (
      <>
        <PageHeader
          title="Aktif İş Gücü"
          subtitle="Firma ve şube bazında personel durumu"
        />
        <EmptyState
          title="Erişim kısıtlı"
          description="Bu ekranı görüntülemek için operasyon yetkisi gerekir."
          size="page"
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Aktif İş Gücü"
        subtitle="Günlük yerleştirmeler, işe başlama takibi ve önceki kadro kayıtları"
      />

      <div className="space-y-4">
        <DailyOverview />
        <nav aria-label="İş gücü işlemleri" className="grid gap-3 sm:grid-cols-3">
          {[
            {href:"/talepler/dizin",title:"Şube ve personel kayıtları",description:"Şubeleri ve kayıtlı personeli görüntüleyin."},
            {href:"/talepler/haftalik",title:"Haftalık plan ve katılım",description:"Haftanın görevlendirmelerini takip edin."},
            {href:"/talepler/kontrol",title:"Operasyon kontrol listesi",description:"Kontrol bekleyen kayıtları inceleyin."},
          ].map(item => <Link key={item.href} href={item.href} className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 hover:border-blue-300 focus-visible:outline-2 focus-visible:outline-blue-600">
            <span className="block text-sm font-semibold text-blue-700">{item.title} →</span>
            <span className="mt-1 block text-sm text-slate-500">{item.description}</span>
          </Link>)}
        </nav>
        <details className="rounded-2xl border border-slate-200 bg-white">
          <summary className="cursor-pointer rounded-2xl p-4 font-semibold focus-visible:outline-2 focus-visible:outline-blue-600">Önceki kadro özetleri</summary>
          <div className="space-y-4 px-4 pb-4">
            <p className="text-sm text-slate-600">Eski kadro kayıtlarıdır. Güncel görevlendirmeler için yukarıdaki günlük operasyonu kullanın.</p>
        <AsyncSection isLoading={resource.loading} hasError={resource.error} onRetry={resource.reload}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KPIStatCard label="Toplam Aktif" value={totals.active} />
          <KPIStatCard label="Toplam Hedef" value={totals.target} />
          <KPIStatCard label="Eksik Personel" value={totals.shortage} />
          <KPIStatCard label="Kadro Fazlası" value={totals.surplus} />
        </div>

        <ListToolbar label="Kadro kayıtlarında ara" search={<SearchInput key={scope} placeholder="Firma veya şube ara…" onChange={handleSearch} />}>
          <FilterBar filters={filterConfig} values={filters} onChange={setFilters} />
        </ListToolbar>

          <DataTable<WorkforceListRow>
            columns={COLUMNS}
            data={filteredData}
            rowKey="id"
            onRowClick={(row) => setSelectedId(row.id)}
            emptyTitle="Önceki kadro kaydı bulunamadı"
            emptyDescription="Güncel ihtiyaç ve yerleştirmeler için günlük planı, personel için dizini kullanın."
          />
        </AsyncSection>
          </div>
        </details>
      </div>

      <RightSidePanel
        open={!!selected}
        onClose={() => setSelectedId(null)}
        title={selected?.firma_name}
      >
        {selected && (
          <div className="space-y-4">
            <div>
              <Link href={`/firmalar/${selected.company_id}`} className={`${TYPE_BODY} ${TEXT_LINK} hover:underline`}>
                {selected.firma_name}
              </Link>
              <p className={`${TYPE_CAPTION} ${TEXT_MUTED} mt-0.5`}>
                {selected.location ?? "—"}
              </p>
            </div>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div><dt className="text-slate-500">Aktif kişi</dt><dd>{selected.current_count}</dd></div>
              <div><dt className="text-slate-500">Hedef kişi</dt><dd>{selected.target_count}</dd></div>
              <div><dt className="text-slate-500">Eksik personel</dt><dd>{selected.open_gap}</dd></div>
              <div><dt className="text-slate-500">Kadro fazlası</dt><dd>{selected.surplus}</dd></div>
              <div><dt className="text-slate-500">Son 30 gün giriş</dt><dd>{selected.hires_last_30d}</dd></div>
              <div><dt className="text-slate-500">Son 30 gün çıkış</dt><dd>{selected.exits_last_30d}</dd></div>
            </dl>
          </div>
        )}
      </RightSidePanel>
    </>
  );
}
