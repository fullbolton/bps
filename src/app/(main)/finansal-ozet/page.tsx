"use client";

import { useCallback, useEffect, useState } from "react";
import { Upload } from "lucide-react";
import {
  PageHeader,
  EmptyState,
  FinancialSummaryCard,
  ReceivablesSummaryCard,
} from "@/components/ui";
import { useRole } from "@/context/RoleContext";
import {
  FINANSAL_OZET_KPIS,
  FIRMA_ALACAK_DAGILIMI,
  FIRMA_KESILMEMIS_DAGILIMI,
  GECIKMIŞ_OZET,
} from "@/mocks/finansal-ozet";
import { extractReceivablesSummary } from "@/lib/extract-financials";
import { createClient } from "@/lib/supabase/client";
import { selectCompaniesByLegacyMockIds } from "@/lib/supabase/companies";
import type { ExtractedReceivables } from "@/lib/extract-financials";
import type { FinansalOzetKPIs, FirmaAlacakEntry, FirmaKesilmemisEntry } from "@/types/batch5-finansal";
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

  // Upload-modal comparison seeds — the modal's "Mevcut" column reads
  // from these mock constants. They no longer feed the page display
  // and no longer mutate on confirm (writer parity now persists through
  // confirm_financial_data below). Kept as useState so modal layout
  // stays identical if a later batch promotes the comparison column
  // to real truth.
  const [kpis] = useState<FinansalOzetKPIs>(FINANSAL_OZET_KPIS);
  const [firmaAlacak] = useState<FirmaAlacakEntry[]>(FIRMA_ALACAK_DAGILIMI);
  const [firmaKesilmemis] = useState<FirmaKesilmemisEntry[]>(FIRMA_KESILMEMIS_DAGILIMI);
  const [gecikmisOzet] = useState(GECIKMIŞ_OZET);
  void firmaKesilmemis;
  void gecikmisOzet;

  // Upload flow state
  const [uploadOpen, setUploadOpen] = useState(false);
  const [extracted, setExtracted] = useState<ExtractedReceivables | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);

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
  }, [supabase]);

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
    if (!extracted || confirming) return;
    setConfirming(true);
    setConfirmError(null);

    try {
      // 1. Merge açık-alacak + kesilmemiş-bekleyen into one row per
      //    mock firmaId. is_overdue only exists on the açık-alacak
      //    side; defaults to false for firms that appear only on the
      //    kesilmemiş list.
      const merged = new Map<
        string,
        {
          open_receivable: string | null;
          unbilled_amount: string | null;
          is_overdue: boolean;
        }
      >();
      for (const e of extracted.firmaAlacakDagilimi) {
        const prev = merged.get(e.firmaId) ?? {
          open_receivable: null,
          unbilled_amount: null,
          is_overdue: false,
        };
        merged.set(e.firmaId, {
          ...prev,
          open_receivable: e.acikAlacak,
          is_overdue: Boolean(e.gecikmisMi),
        });
      }
      for (const e of extracted.firmaKesilmemisDagilimi) {
        const prev = merged.get(e.firmaId) ?? {
          open_receivable: null,
          unbilled_amount: null,
          is_overdue: false,
        };
        merged.set(e.firmaId, {
          ...prev,
          unbilled_amount: e.kesilmemisBekleyen,
        });
      }

      // 2. Resolve legacy mock firmaIds → real companies.id. Any mock id
      //    without a matching company is quietly dropped — demo mock
      //    artifacts may reference companies that do not exist in the
      //    live DB, and confirm_financial_data hard-fails on unknown
      //    company_ids. Filtering here keeps the confirm bounded to
      //    the rows that can actually persist.
      const mockIds = Array.from(merged.keys());
      const resolvedCompanies =
        mockIds.length > 0
          ? await selectCompaniesByLegacyMockIds(supabase, mockIds)
          : [];
      const legacyToUuid = new Map<string, string>();
      for (const c of resolvedCompanies) {
        if (c.legacy_mock_id) legacyToUuid.set(c.legacy_mock_id, c.id);
      }

      const p_company_rows: Array<{
        company_id: string;
        open_receivable: string | null;
        unbilled_amount: string | null;
        is_overdue: boolean;
      }> = [];
      for (const [mockId, values] of merged.entries()) {
        const uuid = legacyToUuid.get(mockId);
        if (!uuid) continue;
        p_company_rows.push({ company_id: uuid, ...values });
      }

      // 3. Portfolio-wide KPIs. Passed as opaque strings where the schema
      //    stores strings — no numeric reformatting. overdue_company_count
      //    is the one numeric field on the portfolio row.
      const p_portfolio_kpis = {
        total_open_receivable: extracted.kpis.toplamAcikAlacak,
        invoiced_this_month: extracted.kpis.buAyKesilenFaturalar,
        total_unbilled: extracted.kpis.kesilmemisAlacaklar,
        total_overdue: extracted.kpis.gecikmisAlacaklar,
        overdue_company_count: extracted.gecikmisOzet.toplamGecikmisFirmaSayisi,
        salary_costs: extracted.kpis.maasGiderleri,
        fixed_costs: extracted.kpis.sabitGiderler,
      };

      const { error: rpcError } = await supabase.rpc("confirm_financial_data", {
        p_portfolio_kpis,
        p_company_rows,
      });
      if (rpcError) {
        throw new Error(rpcError.message);
      }

      // 4. Refresh real readers so the page reflects confirmed truth,
      //    then close the modal. If refresh throws it is swallowed by
      //    fetchFinancials itself — the write already landed and user
      //    will see the new data on next render.
      await fetchFinancials();
      setExtracted(null);
      setUploadOpen(false);
    } catch (err) {
      // Keep the modal open, surface the error inline, and let the user
      // retry or cancel. Do not imply success, do not mutate any local
      // mock state that would drift from the real DB.
      setConfirmError(
        err instanceof Error ? err.message : "Onay sırasında bir hata oluştu.",
      );
    } finally {
      setConfirming(false);
    }
  }

  function handleCancel() {
    if (confirming) return;
    setExtracted(null);
    setUploadOpen(false);
    setConfirmError(null);
  }

  return (
    <>
      <PageHeader
        title="Finansal Özet"
        subtitle="Şirket geneli yönetim görünürlüğü"
        actions={[
          {
            label: "Rapor Yükle",
            onClick: () => { setExtracted(null); setUploadOpen(true); },
            icon: <Upload size={16} />,
            variant: "secondary" as const,
          },
        ]}
      />

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
        <div className={`fixed inset-0 ${SURFACE_OVERLAY_DARK} flex items-center justify-center ${Z_OVERLAY}`} onClick={handleCancel}>
          <div className={`${SURFACE_PRIMARY} ${RADIUS_DEFAULT} shadow-xl w-full max-w-xl mx-4 max-h-[85vh] flex flex-col`} onClick={(e) => e.stopPropagation()}>
            <div className={`px-5 py-4 border-b ${BORDER_DEFAULT} flex-shrink-0`}>
              <h2 className={`${TYPE_CARD_TITLE} ${TEXT_PRIMARY}`}>
                {extracted ? "Alacak Verileri — İnceleme" : "Muhasebe Raporu Yükle"}
              </h2>
              <p className={`${TYPE_CAPTION} ${TEXT_MUTED} mt-1`}>
                {extracted
                  ? "Yüklenen rapordaki alacak verilerini mevcut değerlerle karşılaştırın."
                  : "Muhasebenizin ürettiği alacak raporunu yükleyin."
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
                    Demo: tıklandığında örnek muhasebe raporu otomatik yüklenir.
                  </p>
                </div>
              ) : (
                /* Review phase — section-level comparison */
                <div className="space-y-5">
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
                            ["Toplam Açık Alacak", kpis.toplamAcikAlacak, extracted.kpis.toplamAcikAlacak],
                            ["Bu Ay Kesilen", kpis.buAyKesilenFaturalar, extracted.kpis.buAyKesilenFaturalar],
                            ["Kesilmemiş", kpis.kesilmemisAlacaklar, extracted.kpis.kesilmemisAlacaklar],
                            ["Gecikmiş", kpis.gecikmisAlacaklar, extracted.kpis.gecikmisAlacaklar],
                            ["Maaş Giderleri", kpis.maasGiderleri, extracted.kpis.maasGiderleri],
                            ["Sabit Giderler", kpis.sabitGiderler, extracted.kpis.sabitGiderler],
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
                            const current = firmaAlacak.find((f) => f.firmaId === ef.firmaId);
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
                    onClick={handleConfirm}
                    disabled={confirming}
                    className={`px-4 py-2 ${TYPE_BODY} font-medium text-white bg-blue-600 ${RADIUS_SM} hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed`}
                  >
                    {confirming ? "Kaydediliyor..." : "Onayla ve Uygula"}
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
