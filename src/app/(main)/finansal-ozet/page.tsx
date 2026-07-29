"use client";

import { useCallback, useEffect, useState } from "react";
import { Download } from "lucide-react";
import {
  PageHeader,
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
  const [aktifIsGucu, setAktifIsGucu] = useState<number | null>(null);
  const [acikTalep, setAcikTalep] = useState<number | null>(null);
  const [kritikFirma, setKritikFirma] = useState<number | null>(null);

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
    try {
      const [
        portfolioRes,
        perCompanyRes,
        companiesRes,
        workforceRes,
        demandsRes,
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
        // Single companies.select — covers both the firma-name lookup
        // for per-company rows and the Portföy Sağlık Özeti
        // Aktif Firma / Kritik Firma counts. One round-trip, two uses.
        supabase.from("companies").select("id, name, status, risk"),
        // Aktif İş Gücü — same formula as Dashboard Faz 2A (sum of
        // workforce_summary.current_count).
        supabase.from("workforce_summary").select("current_count"),
        // Açık Talep — same formula as Dashboard Faz 2A: sum of
        // max(0, requested - provided) over non-cancelled demands.
        supabase
          .from("staffing_demands")
          .select("requested_count, provided_count")
          .neq("status", "iptal"),
      ]);

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
        risk: string;
      }>;
      const nameById = new Map<string, string>(
        companyList.map((c) => [c.id, c.name]),
      );
      setAktifFirma(
        companiesRes.error
          ? null
          : companyList.filter((c) => c.status === "aktif").length,
      );
      setKritikFirma(
        companiesRes.error
          ? null
          : companyList.filter((c) => c.risk === "yuksek").length,
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

      // Aktif İş Gücü — sum of workforce_summary.current_count.
      setAktifIsGucu(
        workforceRes.error
          ? null
          : (workforceRes.data ?? []).reduce(
              (sum, r) => sum + (r.current_count ?? 0),
              0,
            ),
      );

      // Açık Talep — sum of max(0, requested - provided) over
      // non-cancelled staffing_demands.
      setAcikTalep(
        demandsRes.error
          ? null
          : (demandsRes.data ?? []).reduce(
              (sum, r) =>
                sum +
                Math.max(
                  0,
                  (r.requested_count ?? 0) - (r.provided_count ?? 0),
                ),
              0,
            ),
      );
    } catch {
      setPortfolio(null);
      setPerCompany([]);
      setAktifFirma(null);
      setAktifIsGucu(null);
      setAcikTalep(null);
      setKritikFirma(null);
    }
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
    role === "yonetici"
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
        actions={pageActions}
      />

      {/* Print-only export timestamp — hidden on screen, visible in PDF.
          Empty until the user clicks "PDF Olarak İndir", which sets the
          timestamp then triggers window.print(). */}
      {exportTimestamp && (
        <div className={`hidden print:block mb-4 ${TYPE_CAPTION} ${TEXT_MUTED}`}>
          Dışa aktarıldı: {exportTimestamp}
        </div>
      )}

      <div className="space-y-6">
        {/* Portföy Sağlık Özeti — C-level summary, real Supabase truth.
            Aktif Firma / Kritik Firma come from companies (status + risk
            enum); Aktif İş Gücü / Açık Talep reuse the exact Dashboard
            Faz 2A formulas. Portföy Alacak Baskısı stays on the real
            financial_summaries portfolio row. Composite signals
            ("En Yoğun" city concentration, "Ticari baskı taşıyan")
            are intentionally dropped — same discipline applied to
            Dashboard Riskli Firmalar. A later bounded batch can
            reintroduce them on top of this honest baseline. */}
        <div className={`${SURFACE_PRIMARY} border ${BORDER_DEFAULT} ${RADIUS_DEFAULT} p-4`}>
          <h3 className={`${TYPE_CAPTION} ${TEXT_SECONDARY} mb-3`}>Portföy Sağlık Özeti</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-2">
            <div>
              <span className={`${TYPE_CAPTION} ${TEXT_MUTED}`}>Aktif Firma</span>
              <p className={`${TYPE_BODY} font-medium ${TEXT_PRIMARY}`}>{aktifFirma ?? "—"}</p>
            </div>
            <div>
              <span className={`${TYPE_CAPTION} ${TEXT_MUTED}`}>Aktif İş Gücü</span>
              <p className={`${TYPE_BODY} font-medium ${TEXT_PRIMARY}`}>{aktifIsGucu ?? "—"}</p>
            </div>
            <div>
              <span className={`${TYPE_CAPTION} ${TEXT_MUTED}`}>Açık Talep</span>
              <p className={`${TYPE_BODY} font-medium ${TEXT_PRIMARY}`}>{acikTalep ?? "—"}</p>
            </div>
            <div>
              <span className={`${TYPE_CAPTION} ${TEXT_MUTED}`}>Kritik Firma</span>
              <p
                className={`${TYPE_BODY} font-medium ${
                  kritikFirma !== null && kritikFirma > 0
                    ? "text-red-600"
                    : TEXT_PRIMARY
                }`}
              >
                {kritikFirma ?? "—"}
              </p>
            </div>
            <div>
              <span className={`${TYPE_CAPTION} ${TEXT_MUTED}`}>Portföy Alacak Baskısı</span>
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
            Portföy özeti için muhasebe onayı bekleniyor.
          </p>
        )}

        {/* Receivables breakdown — render only when there is something
            truthful to show. Mixed state (portfolio absent but per-company
            rows exist) renders with "—" totals and real distribution. */}
        {hasAnyRealData ? (
          <ReceivablesSummaryCard
            toplamAlacak={portfolio?.total_open_receivable ?? "—"}
            gecikmisAlacak={portfolio?.total_overdue ?? "—"}
            gecikmisFirmaSayisi={portfolio?.overdue_company_count ?? 0}
            firmaAlacakDagilimi={acikAlacakDagilimi}
            firmaKesilmemisDagilimi={kesilmemisDagilimi}
          />
        ) : (
          <EmptyState
            title="Alacak dağılımı henüz mevcut değil"
            description="Muhasebe onayı veya Luca mizan yüklemesi sonrası bu alan gerçek firma bazlı alacak görünümüyle dolacak."
          />
        )}
      </div>

    </>
  );
}
