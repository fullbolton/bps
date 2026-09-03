"use client";

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

import { useState, useMemo, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
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
import NewCompanyModal from "@/components/modals/NewCompanyModal";
import type { CreatedCompany } from "@/components/modals/NewCompanyModal";
import { useRole } from "@/context/AuthContext";
import { createClient } from "@/lib/supabase/client";
import { selectAllCompanies } from "@/lib/supabase/companies";
import { SECTOR_LABELS } from "@/lib/sector-codes";
import type { SectorCode } from "@/lib/sector-codes";
import type { CompanyRow } from "@/types/database.types";
import type { FirmaDurumu, RiskSeviyesi, ColumnDef, FilterConfig, FilterValues, RowAction } from "@/types/ui";

// ---------------------------------------------------------------------------
// Enriched row
// ---------------------------------------------------------------------------

interface FirmaListRow {
  id: string;
  firmaAdi: string;
  sektor: string;
  sehir: string;
  anaYetkili: string;
  aktifSozlesme: number;
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
  { key: "firmaAdi", header: "Firma Adi", sortable: true },
  {
    key: "sektor",
    header: "Sektor",
    sortable: true,
  },
  { key: "sehir", header: "Sehir", sortable: true },
  { key: "anaYetkili", header: "Ana Yetkili" },
  { key: "aktifSozlesme", header: "Aktif Sozlesme", sortable: true },
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

export default function FirmalarPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const { role } = useRole();
  const isYonetici = role === "yonetici";

  const [newOpen, setNewOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<FilterValues>({ durum: "", risk: "", sektor: "", sehir: "" });
  const handleSearch = useCallback((val: string) => setSearch(val), []);

  // ---------------------------------------------------------------------------
  // Data loading — UUID-keyed enrichment for ALL companies
  // ---------------------------------------------------------------------------
  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [primaryNameById, setPrimaryNameById] = useState<Record<string, string>>({});
  const [activeContractById, setActiveContractById] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  // Yeniden yükleme, mevcut effect'i TEKRAR çalıştırarak yapılıyor. Yükleyiciyi
  // dışarı almak, effect'in `active` iptal guard'ını her çağrı için ayrı ayrı
  // kurma özelliğini kaybettirirdi.
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const rows = await selectAllCompanies(supabase);
        if (!active) return;
        setCompanies(rows);

        const companyIds = rows.map((r) => r.id);
        if (companyIds.length === 0) { setLoading(false); return; }

        // Enrich via UUID — direct queries, works for all companies
        const [contactsResult, contractsResult] = await Promise.all([
          supabase.from("contacts").select("company_id, full_name, is_primary").eq("is_primary", true).in("company_id", companyIds),
          supabase.from("contracts").select("company_id").eq("status", "aktif").in("company_id", companyIds),
        ]);

        if (!active) return;

        // Primary contact name by company UUID
        const nameMap: Record<string, string> = {};
        for (const c of contactsResult.data ?? []) {
          nameMap[c.company_id] = c.full_name;
        }
        setPrimaryNameById(nameMap);

        // Active contract count by company UUID
        const countMap: Record<string, number> = {};
        for (const c of contractsResult.data ?? []) {
          countMap[c.company_id] = (countMap[c.company_id] ?? 0) + 1;
        }
        setActiveContractById(countMap);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [supabase, reloadKey]);

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
    const enriched: FirmaListRow[] = companies.map((c) => {
      const rowId = c.legacy_mock_id ?? c.id;
      return {
        id: rowId,
        firmaAdi: c.name,
        sektor: sectorLabel(c.sector),
        sehir: c.city ?? "—",
        anaYetkili: primaryNameById[c.id] ?? "—",
        aktifSozlesme: activeContractById[c.id] ?? 0,
        risk: c.risk,
        durum: c.status,
      };
    });

    return enriched.filter((f) => {
      if (search) {
        const q = search.toLowerCase();
        if (
          !f.firmaAdi.toLowerCase().includes(q) &&
          !f.anaYetkili.toLowerCase().includes(q) &&
          !f.sektor.toLowerCase().includes(q) &&
          !f.sehir.toLowerCase().includes(q)
        ) return false;
      }
      if (filters.durum && f.durum !== filters.durum) return false;
      if (filters.risk && f.risk !== filters.risk) return false;
      if (filters.sektor && f.sektor !== filters.sektor) return false;
      if (filters.sehir && f.sehir !== filters.sehir) return false;
      return true;
    });
  }, [search, filters, companies, primaryNameById, activeContractById]);

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
      setSearch("");
      setFilters({ durum: "", risk: "", sektor: "", sehir: "" });
      setReloadKey((k) => k + 1);
      setNotice(
        origin === "created"
          ? `${company.name} eklendi — durumu "aday". Aktife almak için firma detayına girin.`
          : `${company.name} zaten kayıtlı — listede.`,
      );
    },
    [],
  );

  const rowActions: RowAction<FirmaListRow>[] = [
    { label: "Detaya Git", onClick: (row) => router.push(`/firmalar/${row.id}`) },
  ];

  if (loading) {
    return (
      <>
        <PageHeader title="Firmalar" subtitle="Firma portfoyu" />
        <p className="text-sm text-slate-500 py-8 text-center">Yukleniyor...</p>
      </>
    );
  }

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
          <div className="flex items-start justify-between gap-3 rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-800">
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
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="w-full sm:max-w-xs">
            <SearchInput placeholder="Firma, yetkili, sektor ara..." onChange={handleSearch} />
          </div>
          <FilterBar filters={filterConfig} values={filters} onChange={setFilters} />
        </div>
        <DataTable<FirmaListRow>
          columns={COLUMNS}
          data={filteredData}
          rowKey="id"
          rowActions={rowActions}
          onRowClick={(row) => router.push(`/firmalar/${row.id}`)}
          emptyTitle={
            companies.length === 0 ? "Portfoyde firma yok" : "Firma bulunamadi"
          }
          emptyDescription={
            // İKİ AYRI DURUM, İKİ AYRI CÜMLE. Kiracıda hiç firma yokken
            // "filtrelerinizi degistirin" demek, kullanıcıyı olmayan bir
            // filtreyi aramaya gönderir — Mek Group'ta görülen tam olarak buydu.
            companies.length === 0
              ? isYonetici
                ? "Bu kiracida henuz firma yok. Yukaridaki \u201cYeni Firma\u201d ile ekleyebilirsiniz."
                : "Bu kiracida henuz firma yok."
              : "Arama veya filtre kriterlerinizi degistirin."
          }
        />
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
