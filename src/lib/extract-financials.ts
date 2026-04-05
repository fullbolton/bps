/**
 * Batch 8 — Mock receivables extraction engine.
 * Simulates extracting structured receivables data from an accountant's report artifact.
 * Not a real document parser. Will be replaced by AI extraction in a future step.
 */

import type {
  FinansalOzetKPIs,
  FirmaAlacakEntry,
  FirmaKesilmemisEntry,
} from "@/types/batch5-finansal";

export interface ExtractedReceivables {
  kpis: FinansalOzetKPIs;
  firmaAlacakDagilimi: FirmaAlacakEntry[];
  firmaKesilmemisDagilimi: FirmaKesilmemisEntry[];
  gecikmisOzet: { toplamGecikmisFirmaSayisi: number; toplamGecikmisAlacak: string };
}

/**
 * Simulated accountant report artifact — represents what an uploaded file would contain.
 * Values differ from current Finansal Özet data to demonstrate the update flow.
 *
 * Changes from current data:
 *   f3: açık alacak ₺510K → ₺485K (partial collection), still gecikmiş
 *   f1: açık alacak ₺245K → ₺260K (new invoicing)
 *   f2: açık alacak ₺128K → ₺118K (partial collection), gecikmiş status resolved
 *   f8: açık alacak ₺120K → ₺135K (new invoicing), now gecikmiş
 *   f5: açık alacak ₺85K → ₺80K (minor reduction)
 *   kesilmemiş shifts accordingly
 */
export const MOCK_ACCOUNTANT_ARTIFACT: ExtractedReceivables = {
  kpis: {
    toplamAcikAlacak: "₺1.078.000",
    buAyKesilenFaturalar: "₺580.000",
    kesilmemisAlacaklar: "₺175.000",
    gecikmisAlacaklar: "₺250.000",
    maasGiderleri: "₺695.000",
    sabitGiderler: "₺185.000",
  },
  firmaAlacakDagilimi: [
    { firmaId: "f3", firmaAdi: "Başkent Güvenlik Ltd.", acikAlacak: "₺485.000", gecikmisMi: true },
    { firmaId: "f1", firmaAdi: "Anadolu Lojistik A.Ş.", acikAlacak: "₺260.000", gecikmisMi: false },
    { firmaId: "f8", firmaAdi: "İç Anadolu Enerji", acikAlacak: "₺135.000", gecikmisMi: true },
    { firmaId: "f2", firmaAdi: "Ege Temizlik Hizmetleri", acikAlacak: "₺118.000", gecikmisMi: false },
    { firmaId: "f5", firmaAdi: "Marmara Gıda San. Tic.", acikAlacak: "₺80.000", gecikmisMi: false },
  ],
  firmaKesilmemisDagilimi: [
    { firmaId: "f3", firmaAdi: "Başkent Güvenlik Ltd.", kesilmemisBekleyen: "₺78.000" },
    { firmaId: "f8", firmaAdi: "İç Anadolu Enerji", kesilmemisBekleyen: "₺32.000" },
    { firmaId: "f1", firmaAdi: "Anadolu Lojistik A.Ş.", kesilmemisBekleyen: "₺28.000" },
    { firmaId: "f5", firmaAdi: "Marmara Gıda San. Tic.", kesilmemisBekleyen: "₺20.000" },
    { firmaId: "f2", firmaAdi: "Ege Temizlik Hizmetleri", kesilmemisBekleyen: "₺17.000" },
  ],
  gecikmisOzet: {
    toplamGecikmisFirmaSayisi: 2,
    toplamGecikmisAlacak: "₺250.000",
  },
};

/**
 * Simulates extracting receivables data from an uploaded accountant report.
 * In production: this would parse a real file with AI assistance.
 * In demo: returns the pre-structured mock artifact.
 */
export function extractReceivablesSummary(): ExtractedReceivables {
  return MOCK_ACCOUNTANT_ARTIFACT;
}
