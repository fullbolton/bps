"use client";

import type { SearchInputHandle } from "@/components/ui/SearchInput";
import { useListViewState } from "@/components/ui/useListViewState";

/**
 * Firmalar list — reads company shell from real Supabase truth.
 * Enrichment via UUID-keyed direct queries for all companies.
 * No mock dependency for enrichment or partner display.
 *
 * ---------------------------------------------------------------------------
 * "YENİ FİRMA" — neden bugüne kadar yoktu, neden şimdi var
 * ---------------------------------------------------------------------------
 * Bu ekran baştan beri SALT OKUNURDU; regresyon değil. Firma yaratmanın tek
 * yolu Excel import'tu, sonra B batch'te inline yaratma eklendi ama BİLEREK
 * yalnız randevu ve talep formlarına bağlandı ("ilişkinin başladığı yerler").
 *
 * Eksik ancak yeni bir kiracı kurulunca görünür oldu: Mek Group'ta 0 firma var
 * ve o kiracıda firma eklemenin doğrudan yolu yok. Kalan yol — "firma eklemek
 * için önce randevu oluştur" — bir kurulum akışı değil.
 *
 * Omurga zaten hazırdı (createCompanyAction · NewCompanyModal · mükerrer
 * uyarısı); eksik olan yalnız tetikleyiciydi.
 *
 * ---------------------------------------------------------------------------
 * ÜÇ KARAR
 * ---------------------------------------------------------------------------
 * 1. DURUM `aday` — randevu akışıyla AYNI. Ayrı bir durum vermek, `status`'ü
 *    firmanın kendisi hakkında değil "hangi kapıdan girdiği" hakkında bir alan
 *    yapardı; ve bu ayrım kayıtta hiçbir yerde saklanmadığı için sonradan
 *    ayıklanamazdı. Hata maliyeti de asimetrik: `aday` → `aktif` tek tık,
 *    yanlışlıkla `aktif` doğan bir firma ise portföyü şişirir ve sessizdir.
 *    ⚠ Bu karar tek başına bir ÇIKMAZ üretiyordu — bkz. firmalar/[id] sayfası,
 *      "Aktife Al" düğmesi. Orada düzeltildi; ikisi birlikte geçerli.
 *
 * 2. BUTON yonetici-only. Güvenlik sınırı DEĞİL — o sınır zaten iki katmanda
 *    var (server action rol guard'ı + `companies_insert_yonetici` policy'si).
 *    Buradaki tek amaç, basıldığında kesin başarısız olacak bir düğmeyi
 *    göstermemek. `kurumsal-tarihler` ekranındaki desenin aynısı.
 *
 * 3. BAŞARI SONRASI listede kalınır, detaya gidilmez: ilk kurulumda firmalar
 *    arka arkaya eklenir ve her seferinde detaya sıçramak akışı keser.
 *    ⚠ Ama liste yenilemek TEK BAŞINA yetmiyor: aktif bir filtre varsa yeni
 *      `aday` firma listeye düşmez ve kullanıcı işlemin başarısız olduğunu
 *      sanar. Bu yüzden arama ve filtreler TEMİZLENİR — kaydın görünür olduğu
 *      garanti edilir, "oldu mu olmadı mı" belirsizliği bırakılmaz.
 */

import { useState, useRef, useMemo, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus } from "lucide-react";
import { formatDateTR } from "@/lib/format-date";
import {
  PageHeader,
  SearchInput,
  FilterBar,
  DataTable,
  StatusBadge,
  RiskBadge,
} from "@/components/ui";
import AsyncSection from "@/components/ui/AsyncSection";
import { useScopedResource } from "@/components/ui/useScopedResource";
import NewCompanyModal from "@/components/modals/NewCompanyModal";
import type { CreatedCompany } from "@/components/modals/NewCompanyModal";
import { useAuth } from "@/context/AuthContext";
import { useRole } from "@/context/AuthContext";
import { createClient } from "@/lib/supabase/client";
import { selectAllCompanies } from "@/lib/supabase/companies";
import { selectPrimaryContactNames, selectActiveContractCounts } from "@/lib/supabase/company-summaries";
import { SECTOR_LABELS } from "@/lib/sector-codes";
import type { SectorCode } from "@/lib/sector-codes";
import type { FirmaDurumu, RiskSeviyesi, ColumnDef, FilterConfig, FilterValues, RowAction } from "@/types/ui";

// ---------------------------------------------------------------------------
// Enriched row
// ---------------------------------------------------------------------------

interface FirmaListRow {
  id: string;
  firmaAdi: string;
  sektor: string;
  sektorKodu: string | null;
  sehir: string;
  anaYetkili: string;
  aktifSozlesme: number | null;
  risk: RiskSeviyesi;
  durum: FirmaDurumu;
}

// ---------------------------------------------------------------------------
// Sector label helper
// ---------------------------------------------------------------------------

function sectorLabel(code: string | null): string {
  if (!code) return "—";
  return SECTOR_LABELS[code as SectorCode] ?? code;
}

// ---------------------------------------------------------------------------
// Column definitions — no mock dependency
// ---------------------------------------------------------------------------

const COLUMNS: ColumnDef<FirmaListRow>[] = [
  {
    key: "firmaAdi", header: "Firma Adı", sortable: true,
    render: (_value, row) => <div className="whitespace-normal break-words sm:w-64">
      <Link href={`/firmalar/${row.id}`} onClick={event => event.stopPropagation()}
        className="flex min-h-11 items-center rounded-lg py-2 font-medium text-blue-700 underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 [overflow-wrap:anywhere]">
        {row.firmaAdi}
      </Link>
      <div className="mt-2 space-y-3 sm:hidden">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={row.durum} />
          <span className="text-xs text-slate-500">Risk etiketi:</span><RiskBadge risk={row.risk} />
        </div>
        <dl className="space-y-2 text-sm">
          <div><dt className="text-xs text-slate-500">Şehir · Sektör</dt><dd className="[overflow-wrap:anywhere]">{row.sehir} · {row.sektor}</dd></div>
          <div><dt className="text-xs text-slate-500">Ana yetkili</dt><dd className="[overflow-wrap:anywhere]">{row.anaYetkili}</dd></div>
          <div><dt className="text-xs text-slate-500">Aktif sözleşme</dt><dd>{row.aktifSozlesme === null ? "Okunamadı" : row.aktifSozlesme}</dd></div>
        </dl>
      </div>
    </div>,
  },
  {
    key: "sektor",
    header: "Sektor",
    sortable: true,
  },
  { key: "sehir", header: "Sehir", sortable: true },
  { key: "anaYetkili", header: "Ana Yetkili", render: value => <span className="inline-block w-48 whitespace-normal [overflow-wrap:anywhere]">{String(value)}</span> },
  { key: "aktifSozlesme", header: "Aktif Sozlesme", sortable: true, render: value => value === null ? "Okunamadı" : String(value) },
  {
    key: "risk",
    header: "Risk Etiketi",
    sortable: true,
    render: (val) => <RiskBadge risk={val as RiskSeviyesi} />,
  },
  {
    key: "durum",
    header: "Durum",
    sortable: true,
    render: (val) => <StatusBadge status={val as FirmaDurumu} />,
  },
];

const LIST_FILTER_DEFAULTS: FilterValues = { durum: "", risk: "", sektor: "", sehir: "" };
const normalizeCompanySearch = (value: string) => value.normalize("NFC").trim().toLocaleLowerCase("tr");

export default function FirmalarPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const { role } = useRole();
  const { user, loading: authLoading } = useAuth();
  const isYonetici = role === "yonetici";

  const [newOpen, setNewOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const searchControl = useRef<SearchInputHandle>(null);
  const listScope = !authLoading && user ? JSON.stringify([user.id, user.app_metadata?.active_tenant ?? null, role]) : null;
  const { search, filters, setSearch: handleSearch, setFilters, ready: viewReady } = useListViewState("firmalar", listScope, LIST_FILTER_DEFAULTS);


  // ---------------------------------------------------------------------------
  // Data loading — UUID-keyed enrichment for ALL companies
  // ---------------------------------------------------------------------------
  const readDirectory = useCallback(async () => {
    const rows = await selectAllCompanies(supabase);
    const companyIds = rows.map(row => row.id);
    const [contacts, contracts] = await Promise.allSettled([
      selectPrimaryContactNames(supabase, companyIds),
      selectActiveContractCounts(supabase, companyIds),
    ]);
    return {
      rows,
      nameMap: contacts.status === "fulfilled" ? contacts.value : {},
      countMap: contracts.status === "fulfilled" ? contracts.value : {},
      contactsError: contacts.status === "rejected",
      contractsError: contracts.status === "rejected",
    };
  }, [supabase]);
  const directory = useScopedResource(listScope, readDirectory);
  const companies = directory.data?.rows ?? [];
  const primaryNameById = directory.data?.nameMap ?? {};
  const activeContractById = directory.data?.countMap ?? {};
  const contactsError = directory.data?.contactsError ?? false;
  const contractsError = directory.data?.contractsError ?? false;
  const viewContext = useMemo(() => ({ scope: listScope }), [listScope]);
  const liveView = useRef(viewContext); liveView.current = viewContext;
  useEffect(() => { setNotice(null); setNewOpen(false); }, [viewContext]);

  // ---------------------------------------------------------------------------
  // Dynamic filter config — no mock dependency
  // ---------------------------------------------------------------------------
  const filterConfig: FilterConfig[] = useMemo(() => [
    {
      key: "durum", label: "Durum", type: "select" as const, placeholder: "Tum durumlar",
      options: [
        { label: "Aday", value: "aday" },
        { label: "Aktif", value: "aktif" },
        { label: "Pasif", value: "pasif" },
      ],
    },
    {
      key: "risk", label: "Risk", type: "select" as const, placeholder: "Tum riskler",
      options: [
        { label: "Dusuk", value: "dusuk" },
        { label: "Orta", value: "orta" },
        { label: "Yuksek", value: "yuksek" },
      ],
    },
    {
      key: "sektor", label: "Sektor", type: "select" as const, placeholder: "Tum sektorler",
      options: [...new Set(companies.map((c) => c.sector).filter(Boolean))].sort().map((s) => ({
        label: sectorLabel(s!),
        value: s!,
      })),
    },
    {
      key: "sehir", label: "Sehir", type: "select" as const, placeholder: "Tum sehirler",
      options: [...new Set(companies.map((c) => c.city).filter(Boolean))].sort().map((s) => ({ label: s!, value: s! })),
    },
  ], [companies]);

  // ---------------------------------------------------------------------------
  // Enriched + filtered rows
  // ---------------------------------------------------------------------------
  const filteredData = useMemo(() => {
    const query = normalizeCompanySearch(search);
    const enriched: FirmaListRow[] = companies.map((c) => {
      return {
        id: c.id,
        firmaAdi: c.name,
        sektor: sectorLabel(c.sector),
        sektorKodu: c.sector,
        sehir: c.city ?? "—",
        anaYetkili: contactsError ? "Okunamadı" : primaryNameById[c.id] ?? "—",
        aktifSozlesme: contractsError ? null : activeContractById[c.id] ?? 0,
        risk: c.risk,
        durum: c.status,
      };
    });

    return enriched.filter((f) => {
      const searchable = [f.firmaAdi, f.sektor, f.sehir, contactsError ? "" : f.anaYetkili];
      if (query && !searchable.some(value => normalizeCompanySearch(value).includes(query))) return false;
      if (filters.durum && f.durum !== filters.durum) return false;
      if (filters.risk && f.risk !== filters.risk) return false;
      if (filters.sektor && f.sektorKodu !== filters.sektor) return false;
      if (filters.sehir && f.sehir !== filters.sehir) return false;
      return true;
    });
  }, [search, filters, companies, primaryNameById, activeContractById, contactsError, contractsError]);

  /**
   * Modal kapandığında: kayıt GÖRÜNÜR olmalı, yoksa "oldu mu" belirsizliği
   * kalır. Aktif bir filtre yeni `aday` firmayı listeden düşürebileceği için
   * arama ve filtreler temizlenir, sonra liste yeniden okunur.
   *
   * `origin` olmadan buradaki cümle iki durumdan birinde yalan olurdu:
   * mükerrer listesinden mevcut bir firma seçmek "eklendi" değildir.
   */
  const handleCompanyCreated = useCallback(
    (company: CreatedCompany, origin: "created" | "existing") => {
      if (liveView.current !== viewContext) return;
      handleSearch("");
      setFilters({ durum: "", risk: "", sektor: "", sehir: "" });
      void directory.reload();
      setNotice(
        origin === "created"
          ? `${company.name} firmalara eklendi. Durumu: aday.`
          : `${company.name} zaten kayıtlı — listede.`,
      );
    },
    [handleSearch, setFilters, directory.reload, viewContext],
  );

  const rowActions: RowAction<FirmaListRow>[] = [
    { label: "Detaya Git", onClick: (row) => router.push(`/firmalar/${row.id}`) },
  ];


  return (
    <>
      <PageHeader
        title="Firmalar"
        subtitle="Firma portfoyu"
        actions={
          isYonetici
            ? [
                {
                  label: "Yeni Firma",
                  onClick: () => {
                    setNotice(null);
                    setNewOpen(true);
                  },
                  icon: <Plus size={16} />,
                },
              ]
            : undefined
        }
      />
      <div className="space-y-4">
        {notice && (
          <div role="status" aria-live="polite" className="flex items-start justify-between gap-3 rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-800">
            <span>{notice}</span>
            <button
              type="button"
              onClick={() => setNotice(null)}
              className="shrink-0 text-xs text-green-700 hover:underline"
            >
              Kapat
            </button>
          </div>
        )}
        <AsyncSection isLoading={directory.loading || !viewReady} hasError={directory.error} onRetry={() => { void directory.reload(); }}>
        {(contactsError || contractsError) && <div role="status" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <p>Firma listesi yüklendi; bazı yetkili veya sözleşme özetleri okunamadı.</p>
          <button type="button" onClick={() => { void directory.reload(); }} className="min-h-11 text-blue-700 underline">Özetleri yeniden dene</button>
        </div>}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="w-full sm:max-w-xs">
            <SearchInput ref={searchControl} key={listScope} maxLength={512} value={search} placeholder="Firma, yetkili, sektor ara..." onChange={handleSearch} />
          </div>
          <FilterBar filters={filterConfig} values={filters} onChange={setFilters} />
        </div>
        <div aria-label="Firma listesi" role="region" className="max-sm:[&_table]:w-full max-sm:[&_table]:table-fixed max-sm:[&_th:not(:first-child)]:hidden max-sm:[&_td:not(:first-child)]:hidden">
        <DataTable<FirmaListRow>
          columns={COLUMNS}
          data={filteredData}
          rowKey="id"
          rowActions={rowActions}
          onRowClick={(row) => router.push(`/firmalar/${row.id}`)}
          emptyAction={companies.length === 0 && isYonetici ? {
            label: "İlk firmayı ekle",
            onClick: () => { setNotice(null); setNewOpen(true); },
          } : (companies.length > 0 && (normalizeCompanySearch(search) !== "" || Object.values(filters).some(Boolean))) ? {
            label: "Arama ve filtreleri temizle",
            onClick: () => { searchControl.current?.clear(); setFilters(LIST_FILTER_DEFAULTS); },
          } : undefined}
          emptyTitle={
            companies.length === 0 ? "Firma listeniz boş" : "Bu arama ve filtrelerle eşleşen firma yok"
          }
          emptyDescription={
            companies.length === 0
              ? isYonetici
                ? "İlk firmanızı ekleyerek müşteri ve operasyon kayıtlarını takip etmeye başlayın."
                : "Erişebildiğiniz firmalar burada listelenir."
              : "Farklı bir arama deneyin veya filtreleri temizleyin."
          }
        />
        </div>
        </AsyncSection>
      </div>

      {/* yonetici-only: RLS ve server action zaten kapatıyor, bu üçüncü katman. */}
      {isYonetici && (
        <NewCompanyModal
          open={newOpen}
          onClose={() => setNewOpen(false)}
          onCreated={handleCompanyCreated}
        />
      )}
    </>
  );
}
