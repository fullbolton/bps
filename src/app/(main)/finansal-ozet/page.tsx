"use client";

import { useCallback, useEffect, useState } from "react";
import AsyncSection from "@/components/ui/AsyncSection";
import { Download } from "lucide-react";
import {
  PageHeader,
  ModalShell,
  EmptyState,
  FinancialSummaryCard,
  ReceivablesSummaryCard,
} from "@/components/ui";
import { useRole } from "@/context/RoleContext";
import { useAuth } from "@/context/AuthContext";
import { createClient } from "@/lib/supabase/client";
import type { FirmaAlacakEntry, FirmaKesilmemisEntry } from "@/types/batch5-finansal";
import {
  TYPE_BODY,
  TYPE_CAPTION,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
  TEXT_MUTED,
  SURFACE_PRIMARY,
  BORDER_DEFAULT,
  RADIUS_DEFAULT,
  RADIUS_SM,
} from "@/styles/tokens";

export default function FinansalOzetPage() {
  const { role } = useRole();
  const { loading: authLoading } = useAuth();
  const supabase = createClient();

  // PDF export — bounded snapshot. Timestamp reflects the moment the user
  // clicked "PDF Olarak İndir" and is rendered only in @media print.
  // No DB write, no archive entity; this is a download event only.
  const [advancedOpen,setAdvancedOpen]=useState(false);
  const [exportTimestamp, setExportTimestamp] = useState<string>("");

  // Real truth — portfolio-wide row (company_id IS NULL). Absent = honest
  // absence (no muhasebe confirm yet). Do NOT substitute mock defaults.
  const [portfolio, setPortfolio] = useState<{
    total_open_receivable: string | null;
    invoiced_this_month: string | null;
    total_unbilled: string | null;
    total_overdue: string | null;
    overdue_company_count: number | null;
    salary_costs: string | null;
    fixed_costs: string | null;
  } | null>(null);

  // Real truth — per-company rows with any financial value. Shape matches
  // what ReceivablesSummaryCard consumes. is_overdue drives the red dot
  // on the açık-alacak row; source attribution already lives on Firma
  // Detay's Ticari Özet card and is intentionally not surfaced here.
  const [perCompany, setPerCompany] = useState<
    Array<{
      firmaId: string;
      firmaAdi: string;
      acikAlacak: string | null;
      kesilmemisBekleyen: string | null;
      gecikmisMi: boolean;
    }>
  >([]);

  // Portföy Sağlık Özeti top-block scalars — real Supabase reads.
  // null = loading / error → render "—"; honest 0 shown only on a
  // successful empty query. No mock fallback. Composite signals
  // ("En Yoğun", "Ticari baskı") are intentionally omitted.
  const [aktifFirma, setAktifFirma] = useState<number | null>(null);

  const [loading,setLoading]=useState(true);
  const [loadError,setLoadError]=useState(false);

  // Kept as a callable so a future write path can refresh readers on demand
  // (the mock upload modal that used to call it was removed). React 18 no-ops
  // state updates on unmounted components, so an explicit cancel flag is not
  // needed here.
  const fetchFinancials = useCallback(async () => {
    // Gate the fetch on role. During the initial render `useRole()` returns
    // the unresolved default ("goruntuleyici") until AuthContext finishes
    // loading; without this guard the page would fire financial reads for
    // any unauthorized role before the access screen had a chance to render.
    // `role` is in the deps below so the fetch re-fires once auth resolves
    // to yonetici or muhasebe.
    if (!["yonetici", "muhasebe"].includes(role)) return;
    setLoading(true);setLoadError(false);
    try {
      const [
        portfolioRes,
        perCompanyRes,
        companiesRes,
      ] = await Promise.all([
        supabase
          .from("financial_summaries")
          .select(
            "total_open_receivable, invoiced_this_month, total_unbilled, total_overdue, overdue_company_count, salary_costs, fixed_costs",
          )
          .is("company_id", null)
          .maybeSingle(),
        supabase
          .from("financial_summaries")
          .select("company_id, open_receivable, unbilled_amount, is_overdue")
          .not("company_id", "is", null),
        supabase.from("companies").select("id, name, status"),
      ]);

      if(portfolioRes.error||perCompanyRes.error||companiesRes.error)throw Error("FINANCIAL_READ");
      const pRow = portfolioRes.data as
        | {
            total_open_receivable: string | null;
            invoiced_this_month: string | null;
            total_unbilled: string | null;
            total_overdue: string | null;
            overdue_company_count: number | null;
            salary_costs: string | null;
            fixed_costs: string | null;
          }
        | null;
      setPortfolio(pRow ?? null);

      // Companies name-map + top-block counts. One source of truth.
      const companyList = (companiesRes.data ?? []) as Array<{
        id: string;
        name: string;
        status: string;
      }>;
      const nameById = new Map<string, string>(
        companyList.map((c) => [c.id, c.name]),
      );
      setAktifFirma(
        companiesRes.error
          ? null
          : companyList.filter((c) => c.status === "aktif").length,
      );
      // Per-company financial_summaries rows — reuse the same name map.
      const rawRows = (perCompanyRes.data ?? []) as Array<{
        company_id: string | null;
        open_receivable: string | null;
        unbilled_amount: string | null;
        is_overdue: boolean | null;
      }>;
      const withFinancial = rawRows.filter(
        (r) =>
          r.company_id !== null &&
          (r.open_receivable !== null || r.unbilled_amount !== null),
      );

      const mapped = withFinancial
        .map((r) => ({
          firmaId: r.company_id as string,
          firmaAdi: nameById.get(r.company_id as string) ?? "—",
          acikAlacak: r.open_receivable,
          kesilmemisBekleyen: r.unbilled_amount,
          gecikmisMi: Boolean(r.is_overdue),
        }))
        // Only list companies whose name actually resolved; unresolved
        // rows would surface "—" placeholders that look broken.
        .filter((r) => r.firmaAdi !== "—");

      setPerCompany(mapped);

    } catch {
      setLoadError(true);
      setPortfolio(null);
      setPerCompany([]);
      setAktifFirma(null);
    } finally {setLoading(false);}
  }, [supabase, role]);

  useEffect(() => {
    fetchFinancials();
  }, [fetchFinancials]);

  // Derived view data for the real readers
  const acikAlacakDagilimi: FirmaAlacakEntry[] = perCompany
    .filter((r) => r.acikAlacak !== null)
    .map((r) => ({
      firmaId: r.firmaId,
      firmaAdi: r.firmaAdi,
      acikAlacak: r.acikAlacak ?? "—",
      gecikmisMi: r.gecikmisMi,
    }));
  const kesilmemisDagilimi: FirmaKesilmemisEntry[] = perCompany
    .filter((r) => r.kesilmemisBekleyen !== null)
    .map((r) => ({
      firmaId: r.firmaId,
      firmaAdi: r.firmaAdi,
      kesilmemisBekleyen: r.kesilmemisBekleyen ?? "—",
    }));
  const hasAnyRealData = portfolio !== null || perCompany.length > 0;

  // Auth not resolved yet — don't flash "Erişim kısıtlı" (role defaults to
  // "goruntuleyici" while AuthContext is loading). Wait, then decide.
  if (authLoading) {
    return (
      <>
        <PageHeader title="Finansal Özet" subtitle="Yönetim görünürlüğü" />
        <EmptyState title="Yükleniyor…" description="Yetki bilgisi kontrol ediliyor." size="page" />
      </>
    );
  }

  if (!["yonetici", "muhasebe"].includes(role)) {
    return (
      <>
        <PageHeader title="Finansal Özet" subtitle="Yönetim görünürlüğü" />
        <EmptyState
          title="Erişim kısıtlı"
          description="Bu ekran yönetici veya muhasebe erişimi gerektirir."
          size="page"
        />
      </>
    );
  }

  // Bounded PDF export — yonetici-only, snapshot-of-screen. Uses the
  // browser's native print-to-PDF path so no new dependencies and no new
  // document/archive entity. Timestamp is committed before print snapshots
  // the DOM via requestAnimationFrame.
  function handleExportPdf() {
    const now = new Date();
    const formatted = now.toLocaleString("tr-TR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    setExportTimestamp(formatted);
    window.requestAnimationFrame(() => {
      window.print();
    });
  }

  // Action set — "PDF Olarak İndir" is yonetici-only. Hidden in @media print.
  // The old "Rapor Yükle" action was removed: it opened a mock-backed preview
  // whose confirm path was permanently disabled, so it could never write. Real
  // receivables data arrives through the Luca mizan import.
  const pageActions =
    role === "yonetici" && !loading && !loadError
      ? [
          {
            label: "PDF Olarak İndir",
            onClick: handleExportPdf,
            icon: <Download size={16} />,
            variant: "secondary" as const,
          },
        ]
      : [];

  return (
    <>
      <PageHeader
        title="Finansal Özet"
        subtitle="Şirket geneli yönetim görünürlüğü"
        actions={[{label:"Gelişmiş özet",onClick:()=>setAdvancedOpen(true),variant:"secondary" as const},...pageActions]}
      />

      <ModalShell open={advancedOpen} onClose={()=>setAdvancedOpen(false)} title="Gelişmiş finansal özet">
        <div className="space-y-5">
          <p className="text-sm text-slate-600">Mevcut mali kayıtlar firma bazındadır. Proje, sözleşme ve şube kırılımları henüz bağlanmadığı için bu görünüm proje kârlılığı hesaplamaz.</p>
          <AsyncSection isLoading={loading} hasError={loadError} onRetry={fetchFinancials}>
            <section aria-label="Mevcut firma alacakları" className="space-y-2">
              <h3 className="font-semibold">Mevcut firma alacakları</h3>
              <p className="text-xs text-slate-500">Kaydedilmiş son özet; seçilmiş bir dönemin gelir tablosu değildir. Açık alacak ile gelir farklı ölçümlerdir.</p>
              {perCompany.length===0 ? <p className="text-sm">Henüz firma bazlı mali kayıt yok.</p> :
                <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b"><th className="py-2 pr-3">Firma</th><th className="pr-3">Açık alacak</th><th>Kesilmemiş bekleyen</th></tr></thead><tbody>{perCompany.map(row=><tr key={row.firmaId} className="border-b"><td className="py-3 pr-3"><a className="text-blue-700 underline" href={`/firmalar/${row.firmaId}`}>{row.firmaAdi}</a></td><td className="pr-3">{row.acikAlacak??'—'}</td><td>{row.kesilmemisBekleyen??'—'}</td></tr>)}</tbody></table></div>}
            </section>
          </AsyncSection>
          <section className="space-y-2" aria-label="Proje maliyet kapsamı">
            <h3 className="font-semibold">Proje kırılımı için gerekenler</h3>
            <dl className="text-sm divide-y">
              <div className="py-2"><dt className="font-medium">Gelir</dt><dd className="text-slate-600">Dönem ve proje koduyla eşleştirilmiş gelir hareketleri.</dd></div>
              <div className="py-2"><dt className="font-medium">Maaş ve personel maliyeti</dt><dd className="text-slate-600">Bordro maliyeti ve kişinin projeye ayrılan çalışması. Günlük atama tek başına ücret değildir.</dd></div>
              <div className="py-2"><dt className="font-medium">Diğer giderler</dt><dd className="text-slate-600">Malzeme, ulaşım ve diğer masrafların proje eşlemesi; ortak giderler için dağıtım kuralı.</dd></div>
              <div className="py-2"><dt className="font-medium">Proje sonucu</dt><dd className="text-slate-600">Gelir ve gider kaynakları tamamlanınca hesaplanacak. Eksik kayıtlar sıfır kabul edilmez.</dd></div>
            </dl>
          </section>
          <section className="rounded border bg-slate-50 p-3 text-sm space-y-2">
            <h3 className="font-semibold">Luca aktarımının mevcut kapsamı</h3>
            <p>Mizan aktarımı müşteri hesaplarından firma bazlı açık alacak üretir. Proje geliri, maaş ve masraf dağıtımı bu aktarımın mevcut kapsamına dahil değildir.</p>
            {role==='yonetici'&&<a href="/luca-import" className="inline-block text-blue-700 underline">Luca aktarımını aç →</a>}
          </section>
        </div>
      </ModalShell>

      {/* Print-only export timestamp — hidden on screen, visible in PDF.
          Empty until the user clicks "PDF Olarak İndir", which sets the
          timestamp then triggers window.print(). */}
      {exportTimestamp && (
        <div className={`hidden print:block mb-4 ${TYPE_CAPTION} ${TEXT_MUTED}`}>
          Dışa aktarıldı: {exportTimestamp}
        </div>
      )}

      <button type="button" disabled={loading} onClick={fetchFinancials} className="mb-4 text-sm text-blue-700 disabled:opacity-50 print:hidden">Mali verileri yenile</button>
      <AsyncSection isLoading={loading} hasError={loadError} onRetry={fetchFinancials}>
      <div className="space-y-6">
        <div className={`${SURFACE_PRIMARY} border ${BORDER_DEFAULT} ${RADIUS_DEFAULT} p-4`}>
          <h3 className={`${TYPE_CAPTION} ${TEXT_SECONDARY} mb-3`}>Finansal portföy</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-2">
            <div>
              <span className={`${TYPE_CAPTION} ${TEXT_MUTED}`}>Aktif Firma</span>
              <p className={`${TYPE_BODY} font-medium ${TEXT_PRIMARY}`}>{aktifFirma ?? "—"}</p>
            </div>
            <div>
              <span className={`${TYPE_CAPTION} ${TEXT_MUTED}`}>Toplam Açık Alacak</span>
              <p className={`${TYPE_BODY} font-medium ${TEXT_PRIMARY}`}>{portfolio?.total_open_receivable ?? "—"}</p>
            </div>
          </div>
        </div>

        {/* Management-visibility boundary banner */}
        <div className={`${TYPE_CAPTION} ${TEXT_MUTED} border ${BORDER_DEFAULT} ${RADIUS_SM} px-3 py-2`}>
          Yönetim görünürlüğü — resmi muhasebe kaydı değildir
        </div>

        {/* 6 top-level KPI cards — read from real financial_summaries
            portfolio row (company_id IS NULL). Absent row = honest "—". */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <FinancialSummaryCard
            label="Toplam Açık Alacak"
            value={portfolio?.total_open_receivable ?? "—"}
          />
          <FinancialSummaryCard
            label="Bu Ay Kesilen Faturalar"
            value={portfolio?.invoiced_this_month ?? "—"}
          />
          <FinancialSummaryCard
            label="Kesilmemiş Alacaklar"
            value={portfolio?.total_unbilled ?? "—"}
            subLabel="Faturaya dönüşmemiş bekleyen"
          />
          <FinancialSummaryCard
            label="Gecikmiş Alacaklar"
            value={portfolio?.total_overdue ?? "—"}
            subLabel={
              portfolio?.overdue_company_count != null
                ? `${portfolio.overdue_company_count} firmada gecikme`
                : undefined
            }
          />
          <FinancialSummaryCard
            label="Maaş Giderleri"
            value={portfolio?.salary_costs ?? "—"}
            subLabel="Verilen iş gücü maliyet özeti"
          />
          <FinancialSummaryCard
            label="Sabit Giderler"
            value={portfolio?.fixed_costs ?? "—"}
            subLabel="Operasyonel sabit maliyetler"
          />
        </div>

        {/* Honest absence note when portfolio row has not been confirmed yet */}
        {portfolio === null && (
          <p className={`${TYPE_CAPTION} ${TEXT_MUTED}`}>
            Henüz portföy özeti kaydedilmemiş.
          </p>
        )}

        {/* Receivables breakdown — render only when there is something
            truthful to show. Mixed state (portfolio absent but per-company
            rows exist) renders with "—" totals and real distribution. */}
        {hasAnyRealData ? (
          <ReceivablesSummaryCard
            toplamAlacak={portfolio?.total_open_receivable ?? "—"}
            gecikmisAlacak={portfolio?.total_overdue ?? "—"}
            gecikmisFirmaSayisi={portfolio?.overdue_company_count ?? null}
            firmaAlacakDagilimi={acikAlacakDagilimi}
            firmaKesilmemisDagilimi={kesilmemisDagilimi}
          />
        ) : (
          <EmptyState
            title="Alacak dağılımı henüz mevcut değil"
            description="Firma bazlı mali kayıt bulunamadı. Mali veri kaydedildiğinde alacak dağılımı burada görünecek."
          />
        )}
      </div>
      </AsyncSection>

    </>
  );
}
