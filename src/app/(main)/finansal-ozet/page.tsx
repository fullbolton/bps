"use client";

import { useState } from "react";
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
  updateReceivablesData,
  getTicariBaskiByFirma,
} from "@/mocks/finansal-ozet";
import { extractReceivablesSummary } from "@/lib/extract-financials";
import { MOCK_FIRMALAR } from "@/mocks/firmalar";
import { MOCK_IS_GUCU } from "@/mocks/aktif-isgucu";
import { MOCK_TALEPLER } from "@/mocks/talepler";
import { FIRMA_PARTNER_MAP } from "@/mocks/ayarlar";
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

  // Local demo state — initialized from mock data, updated by confirmed uploads
  const [kpis, setKpis] = useState<FinansalOzetKPIs>(FINANSAL_OZET_KPIS);
  const [firmaAlacak, setFirmaAlacak] = useState<FirmaAlacakEntry[]>(FIRMA_ALACAK_DAGILIMI);
  const [firmaKesilmemis, setFirmaKesilmemis] = useState<FirmaKesilmemisEntry[]>(FIRMA_KESILMEMIS_DAGILIMI);
  const [gecikmisOzet, setGecikmisOzet] = useState(GECIKMIŞ_OZET);

  // Upload flow state
  const [uploadOpen, setUploadOpen] = useState(false);
  const [extracted, setExtracted] = useState<ExtractedReceivables | null>(null);

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
    const result = extractReceivablesSummary();
    setExtracted(result);
  }

  function handleConfirm() {
    if (!extracted) return;
    // Update local page state
    setKpis(extracted.kpis);
    setFirmaAlacak(extracted.firmaAlacakDagilimi);
    setFirmaKesilmemis(extracted.firmaKesilmemisDagilimi);
    setGecikmisOzet(extracted.gecikmisOzet);
    // Update shared module-level data so getTicariBaskiByFirma reflects confirmed values
    updateReceivablesData(
      extracted.kpis,
      extracted.firmaAlacakDagilimi,
      extracted.firmaKesilmemisDagilimi,
      extracted.gecikmisOzet,
    );
    setExtracted(null);
    setUploadOpen(false);
  }

  function handleCancel() {
    setExtracted(null);
    setUploadOpen(false);
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
        {/* Portföy Sağlık Özeti — C-level summary, present-state only */}
        {(() => {
          const aktifFirma = MOCK_FIRMALAR.filter((f) => f.durum === "aktif").length;
          const aktifIsGucu = MOCK_IS_GUCU.reduce((s, ig) => s + ig.aktifKisi, 0);
          const acikTalep = MOCK_TALEPLER.reduce((s, t) => s + t.acikKalan, 0);
          const kritikFirma = MOCK_FIRMALAR.filter((f) => f.risk === "yuksek").length;

          // City with highest risky-firm concentration
          const cityRisk = new Map<string, { count: number; partner: string }>();
          for (const f of MOCK_FIRMALAR.filter((x) => x.risk === "orta" || x.risk === "yuksek")) {
            const p = FIRMA_PARTNER_MAP[f.id];
            const prev = cityRisk.get(f.sehir);
            cityRisk.set(f.sehir, { count: (prev?.count ?? 0) + 1, partner: p?.partnerAdi ?? "—" });
          }
          const topCity = [...cityRisk.entries()].sort((a, b) => b[1].count - a[1].count)[0];

          // Firms with active ticari baskı
          const ticariBaskiFirmalar = MOCK_FIRMALAR
            .filter((f) => f.durum === "aktif" && getTicariBaskiByFirma(f.id) !== null)
            .map((f) => f.firmaAdi);

          return (
            <div className={`${SURFACE_PRIMARY} border ${BORDER_DEFAULT} ${RADIUS_DEFAULT} p-4`}>
              <h3 className={`${TYPE_CAPTION} ${TEXT_SECONDARY} mb-3`}>Portföy Sağlık Özeti</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-2">
                <div>
                  <span className={`${TYPE_CAPTION} ${TEXT_MUTED}`}>Aktif Firma</span>
                  <p className={`${TYPE_BODY} font-medium ${TEXT_PRIMARY}`}>{aktifFirma}</p>
                </div>
                <div>
                  <span className={`${TYPE_CAPTION} ${TEXT_MUTED}`}>Aktif İş Gücü</span>
                  <p className={`${TYPE_BODY} font-medium ${TEXT_PRIMARY}`}>{aktifIsGucu}</p>
                </div>
                <div>
                  <span className={`${TYPE_CAPTION} ${TEXT_MUTED}`}>Açık Talep</span>
                  <p className={`${TYPE_BODY} font-medium ${TEXT_PRIMARY}`}>{acikTalep}</p>
                </div>
                <div>
                  <span className={`${TYPE_CAPTION} ${TEXT_MUTED}`}>Kritik Firma</span>
                  <p className={`${TYPE_BODY} font-medium ${kritikFirma > 0 ? "text-red-600" : TEXT_PRIMARY}`}>{kritikFirma}</p>
                </div>
                <div>
                  <span className={`${TYPE_CAPTION} ${TEXT_MUTED}`}>Portföy Alacak Baskısı</span>
                  <p className={`${TYPE_BODY} font-medium ${TEXT_PRIMARY}`}>{kpis.toplamAcikAlacak}</p>
                </div>
                {topCity && (
                  <div>
                    <span className={`${TYPE_CAPTION} ${TEXT_MUTED}`}>En Yoğun</span>
                    <p className={`${TYPE_BODY} font-medium ${TEXT_PRIMARY}`}>{topCity[0]} — {topCity[1].partner}</p>
                  </div>
                )}
              </div>
              {ticariBaskiFirmalar.length > 0 && (
                <p className={`${TYPE_CAPTION} text-amber-600 mt-3 pt-2 border-t ${BORDER_SUBTLE}`}>
                  Ticari baskı taşıyan: {ticariBaskiFirmalar.join(", ")}
                </p>
              )}
            </div>
          );
        })()}

        {/* Management-visibility boundary banner */}
        <div className={`${TYPE_CAPTION} ${TEXT_MUTED} border ${BORDER_DEFAULT} ${RADIUS_SM} px-3 py-2`}>
          Yönetim görünürlüğü — resmi muhasebe kaydı değildir
        </div>

        {/* 6 top-level KPI cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <FinancialSummaryCard
            label="Toplam Açık Alacak"
            value={kpis.toplamAcikAlacak}
          />
          <FinancialSummaryCard
            label="Bu Ay Kesilen Faturalar"
            value={kpis.buAyKesilenFaturalar}
          />
          <FinancialSummaryCard
            label="Kesilmemiş Alacaklar"
            value={kpis.kesilmemisAlacaklar}
            subLabel="Faturaya dönüşmemiş bekleyen"
          />
          <FinancialSummaryCard
            label="Gecikmiş Alacaklar"
            value={kpis.gecikmisAlacaklar}
            subLabel={`${gecikmisOzet.toplamGecikmisFirmaSayisi} firmada gecikme`}
          />
          <FinancialSummaryCard
            label="Maaş Giderleri"
            value={kpis.maasGiderleri}
            subLabel="Verilen iş gücü maliyet özeti"
          />
          <FinancialSummaryCard
            label="Sabit Giderler"
            value={kpis.sabitGiderler}
            subLabel="Operasyonel sabit maliyetler"
          />
        </div>

        {/* Receivables breakdown */}
        <ReceivablesSummaryCard
          toplamAlacak={kpis.toplamAcikAlacak}
          gecikmisAlacak={gecikmisOzet.toplamGecikmisAlacak}
          gecikmisFirmaSayisi={gecikmisOzet.toplamGecikmisFirmaSayisi}
          firmaAlacakDagilimi={firmaAlacak}
          firmaKesilmemisDagilimi={firmaKesilmemis}
        />
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
            <div className={`px-5 py-3 border-t ${BORDER_DEFAULT} flex justify-end gap-2 flex-shrink-0`}>
              <button onClick={handleCancel} className={`px-4 py-2 ${TYPE_BODY} font-medium ${TEXT_BODY} ${SURFACE_PRIMARY} border ${BORDER_DEFAULT} ${RADIUS_SM} hover:bg-slate-50`}>
                İptal
              </button>
              {extracted && (
                <button onClick={handleConfirm} className={`px-4 py-2 ${TYPE_BODY} font-medium text-white bg-blue-600 ${RADIUS_SM} hover:bg-blue-700`}>
                  Onayla ve Uygula
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
