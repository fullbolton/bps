"use client";

import { useCallback, useEffect, useState } from "react";
import { Upload, Download } from "lucide-react";
import {
  PageHeader,
  EmptyState,
  FinancialSummaryCard,
  ReceivablesSummaryCard,
} from "@/components/ui";
import { useRole } from "@/context/RoleContext";
import { extractReceivablesSummary } from "@/lib/extract-financials";
import { createClient } from "@/lib/supabase/client";
import type { ExtractedReceivables } from "@/lib/extract-financials";
import type { FirmaAlacakEntry, FirmaKesilmemisEntry } from "@/types/batch5-finansal";
import {
  TYPE_BODY,
  TYPE_CAPTION,
  TYPE_CARD_TITLE,
  TEXT_PRIMARY,
  TEXT_BODY,
  TEXT_SECONDARY,
  TEXT_MUTED,
  SURFACE_PRIMARY,
  SURFACE_HEADER,
  SURFACE_OVERLAY_DARK,
  BORDER_DEFAULT,
  BORDER_SUBTLE,
  RADIUS_DEFAULT,
  RADIUS_SM,
  Z_OVERLAY,
} from "@/styles/tokens";

export default function FinansalOzetPage() {
  const { role } = useRole();
  const supabase = createClient();

  // Upload flow state
  const [uploadOpen, setUploadOpen] = useState(false);
  const [extracted, setExtracted] = useState<ExtractedReceivables | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);

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

  // Extracted as a callable so the upload-modal confirm path can refresh
  // readers immediately after a successful write. React 18 no-ops state
  // updates on unmounted components, so an explicit cancel flag is not
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

  function handleExtract() {
    setConfirmError(null);
    const result = extractReceivablesSummary();
    setExtracted(result);
  }

  async function handleConfirm() {
    // Pre-cutover blocker fix (May 2026): the extractor in
    // `src/lib/extract-financials.ts` is entirely mock-backed and was
    // previously able to feed `confirm_financial_data` with demo
    // values. Until a real parser exists, this path is hard-gated —
    // the UI button is permanently disabled, and this handler bails
    // out before any write so a programmatic invocation cannot leak
    // mock values into `financial_summaries`. The original write body
    // (merge → legacy-uuid resolve → confirm_financial_data RPC →
    // refetch) lives in git history; restore it behind a real-vs-demo
    // gate once a parser ships. `setConfirming` is intentionally not
    // touched — there is no async work to await.
    setConfirmError(
      "Demo verisi üretime yazılamaz. Gerçek dosya parser entegrasyonu gelene kadar onay devre dışıdır.",
    );
  }

  function handleCancel() {
    if (confirming) return;
    setExtracted(null);
    setUploadOpen(false);
    setConfirmError(null);
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

  // Action set — "PDF Olarak İndir" is yonetici-only; "Rapor Yükle" is
  // unchanged (yonetici + muhasebe). Actions are hidden in @media print.
  const pageActions = [
    ...(role === "yonetici"
      ? [
          {
            label: "PDF Olarak İndir",
            onClick: handleExportPdf,
            icon: <Download size={16} />,
            variant: "secondary" as const,
          },
        ]
      : []),
    {
      label: "Rapor Yükle",
      onClick: () => { setExtracted(null); setUploadOpen(true); },
      icon: <Upload size={16} />,
      variant: "secondary" as const,
    },
  ];

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

      {/* Upload → Extract → Review → Confirm modal */}
      {uploadOpen && (
        <div className={`fixed inset-0 ${SURFACE_OVERLAY_DARK} flex items-center justify-center ${Z_OVERLAY} print:hidden`} onClick={handleCancel}>
          <div className={`${SURFACE_PRIMARY} ${RADIUS_DEFAULT} shadow-xl w-full max-w-xl mx-4 max-h-[85vh] flex flex-col`} onClick={(e) => e.stopPropagation()}>
            <div className={`px-5 py-4 border-b ${BORDER_DEFAULT} flex-shrink-0`}>
              <h2 className={`${TYPE_CARD_TITLE} ${TEXT_PRIMARY}`}>
                {extracted ? "Demo Önizleme — Alacak Verileri" : "Demo Önizleme — Muhasebe Raporu"}
              </h2>
              <p className={`${TYPE_CAPTION} ${TEXT_MUTED} mt-1`}>
                {extracted
                  ? "Bu önizleme demo amaçlıdır; gerçek dosya parser entegrasyonu gelene kadar üretime yazılamaz."
                  : "Bu modül şu anda demo amaçlıdır — gerçek dosya yüklemesi yoktur ve üretime yazma kapalıdır."
                }
              </p>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              {!extracted ? (
                /* Upload phase — simulated file drop */
                <div className="space-y-4">
                  <div
                    onClick={handleExtract}
                    className={`border-2 border-dashed ${BORDER_DEFAULT} ${RADIUS_DEFAULT} p-8 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition-colors`}
                  >
                    <Upload size={32} className={`mx-auto ${TEXT_MUTED} mb-3`} />
                    <p className={`${TYPE_BODY} ${TEXT_BODY}`}>Muhasebe raporunu seçmek için tıklayın</p>
                    <p className={`${TYPE_CAPTION} ${TEXT_MUTED} mt-1`}>PDF, Excel veya CSV formatında alacak raporu</p>
                  </div>
                  <p className={`${TYPE_CAPTION} ${TEXT_MUTED}`}>
                    Demo: tıklandığında örnek muhasebe çıktısı gösterilir. Gerçek dosya yüklenmez ve üretime yazma kapalıdır.
                  </p>
                </div>
              ) : (
                /* Review phase — section-level comparison */
                <div className="space-y-5">
                  {/* DEMO warning — pre-cutover blocker fix (May 2026).
                      The extractor is mock-backed; the confirm action is
                      hard-disabled. Banner makes the non-applicability
                      explicit so reviewers do not mistake the demo values
                      for real accounting output. */}
                  <div className={`border border-amber-300 bg-amber-50 ${RADIUS_SM} px-3 py-2`}>
                    <p className={`${TYPE_CAPTION} text-amber-800`}>
                      <strong>Demo önizleme.</strong> Aşağıdaki değerler örnek bir muhasebe çıktısından gelmektedir; gerçek muhasebe verisi değildir ve üretime yazılamaz.
                    </p>
                  </div>

                  {/* KPI comparison */}
                  <div>
                    <h3 className={`${TYPE_CAPTION} ${TEXT_SECONDARY} mb-2`}>Özet Karşılaştırma</h3>
                    <div className={`border ${BORDER_DEFAULT} ${RADIUS_SM} overflow-hidden`}>
                      <table className="w-full">
                        <thead className={SURFACE_HEADER}>
                          <tr>
                            <th className={`px-3 py-2 text-left ${TYPE_CAPTION} ${TEXT_SECONDARY}`}>Metrik</th>
                            <th className={`px-3 py-2 text-right ${TYPE_CAPTION} ${TEXT_SECONDARY}`}>Mevcut</th>
                            <th className={`px-3 py-2 text-right ${TYPE_CAPTION} ${TEXT_SECONDARY}`}>Yüklenen</th>
                          </tr>
                        </thead>
                        <tbody>
                          {([
                            ["Toplam Açık Alacak", portfolio?.total_open_receivable ?? "—", extracted.kpis.toplamAcikAlacak],
                            ["Bu Ay Kesilen", portfolio?.invoiced_this_month ?? "—", extracted.kpis.buAyKesilenFaturalar],
                            ["Kesilmemiş", portfolio?.total_unbilled ?? "—", extracted.kpis.kesilmemisAlacaklar],
                            ["Gecikmiş", portfolio?.total_overdue ?? "—", extracted.kpis.gecikmisAlacaklar],
                            ["Maaş Giderleri", portfolio?.salary_costs ?? "—", extracted.kpis.maasGiderleri],
                            ["Sabit Giderler", portfolio?.fixed_costs ?? "—", extracted.kpis.sabitGiderler],
                          ] as const).map(([label, current, uploaded], idx) => (
                            <tr key={label} className={idx < 5 ? `border-b ${BORDER_SUBTLE}` : ""}>
                              <td className={`px-3 py-2 ${TYPE_BODY} ${TEXT_BODY}`}>{label}</td>
                              <td className={`px-3 py-2 text-right ${TYPE_BODY} ${TEXT_MUTED}`}>{current}</td>
                              <td className={`px-3 py-2 text-right ${TYPE_BODY} font-medium ${TEXT_PRIMARY}`}>{uploaded}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Firma distribution comparison */}
                  <div>
                    <h3 className={`${TYPE_CAPTION} ${TEXT_SECONDARY} mb-2`}>Firma Bazlı Açık Alacak</h3>
                    <div className={`border ${BORDER_DEFAULT} ${RADIUS_SM} overflow-hidden`}>
                      <table className="w-full">
                        <thead className={SURFACE_HEADER}>
                          <tr>
                            <th className={`px-3 py-2 text-left ${TYPE_CAPTION} ${TEXT_SECONDARY}`}>Firma</th>
                            <th className={`px-3 py-2 text-right ${TYPE_CAPTION} ${TEXT_SECONDARY}`}>Mevcut</th>
                            <th className={`px-3 py-2 text-right ${TYPE_CAPTION} ${TEXT_SECONDARY}`}>Yüklenen</th>
                            <th className={`px-3 py-2 text-right ${TYPE_CAPTION} ${TEXT_SECONDARY}`}>Gecikmiş</th>
                          </tr>
                        </thead>
                        <tbody>
                          {extracted.firmaAlacakDagilimi.map((ef, idx) => {
                            // ef.firmaId is a legacy mock id ("f1"..); perCompany
                            // is keyed by real UUIDs. The lookup will miss for
                            // demo rows — that's the honest state: render "—"
                            // rather than a fabricated "Mevcut" value.
                            const current = perCompany.find((r) => r.firmaId === ef.firmaId);
                            return (
                              <tr key={ef.firmaId} className={idx < extracted.firmaAlacakDagilimi.length - 1 ? `border-b ${BORDER_SUBTLE}` : ""}>
                                <td className={`px-3 py-2 ${TYPE_BODY} ${TEXT_BODY}`}>{ef.firmaAdi}</td>
                                <td className={`px-3 py-2 text-right ${TYPE_BODY} ${TEXT_MUTED}`}>{current?.acikAlacak ?? "—"}</td>
                                <td className={`px-3 py-2 text-right ${TYPE_BODY} font-medium ${TEXT_PRIMARY}`}>{ef.acikAlacak}</td>
                                <td className={`px-3 py-2 text-right ${TYPE_CAPTION} ${ef.gecikmisMi ? "text-amber-600" : TEXT_MUTED}`}>
                                  {ef.gecikmisMi ? "Evet" : "Hayır"}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className={`px-5 py-3 border-t ${BORDER_DEFAULT} flex-shrink-0 space-y-2`}>
              {confirmError && (
                <p className={`${TYPE_CAPTION} text-red-600`} role="alert">
                  {confirmError}
                </p>
              )}
              <div className="flex justify-end gap-2">
                <button
                  onClick={handleCancel}
                  disabled={confirming}
                  className={`px-4 py-2 ${TYPE_BODY} font-medium ${TEXT_BODY} ${SURFACE_PRIMARY} border ${BORDER_DEFAULT} ${RADIUS_SM} hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed`}
                >
                  İptal
                </button>
                {extracted && (
                  <button
                    type="button"
                    onClick={handleConfirm}
                    disabled
                    title="Demo verisi üretime yazılamaz. Gerçek dosya parser entegrasyonu gelene kadar onay devre dışıdır."
                    className={`px-4 py-2 ${TYPE_BODY} font-medium text-white bg-blue-600 ${RADIUS_SM} disabled:opacity-40 disabled:cursor-not-allowed`}
                  >
                    Onaylanamaz — Demo
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
