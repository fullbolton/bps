/**
 * Mock data for Finansal Özet screen — Phase 1.
 * Management-visibility summary only. Not accounting records.
 *
 * Values are directionally coherent with existing CommercialSummaryCard data:
 *   f1: açıkBakiye ₺245K, kesilmemiş ₺32K, ticariRisk düşük
 *   f2: açıkBakiye ₺128K, kesilmemiş ₺18.5K, ticariRisk orta
 *   f3: açıkBakiye ₺510K, kesilmemiş ₺95K, ticariRisk yüksek
 * Firms without detail records (f5, f7, f8) have plausible estimates.
 * Portfolio totals ≈ sum of all firma values.
 */

import type {
  FinansalOzetKPIs,
  FirmaAlacakEntry,
  FirmaKesilmemisEntry,
} from "@/types/batch5-finansal";

/**
 * 4 top-level KPI values.
 * Toplam Açık Alacak ≈ sum of all firma açık bakiye values.
 * f1(245) + f2(128) + f3(510) + f5(~85) + f7(~45) + f8(~120) ≈ 1.133K
 * Add f4(aday, ~0) + f6(pasif, ~0) = ~1.133K total.
 *
 * Gecikmiş ≈ f3(most overdue) + f2(payment delay noted) + f8(partial) ≈ 285K subset.
 * Kesilmemiş ≈ f1(32) + f2(18.5) + f3(95) + f5(~22) + f8(~35) ≈ 203K.
 * Bu ay kesilen ≈ recent invoicing activity, plausible management estimate.
 */
/** Mutable: updated by Batch 8 upload-confirm flow for shared summary truth. */
export let FINANSAL_OZET_KPIS: FinansalOzetKPIs = {
  toplamAcikAlacak: "₺1.133.000",
  buAyKesilenFaturalar: "₺540.000",
  kesilmemisAlacaklar: "₺203.000",
  gecikmisAlacaklar: "₺285.000",
  maasGiderleri: "₺680.000",
  sabitGiderler: "₺180.000",
};

/** Top firms by açık alacak — rank order matches existing ticari risk levels.
 *  Mutable: updated by Batch 8 upload-confirm flow via updateReceivablesData(). */
export let FIRMA_ALACAK_DAGILIMI: FirmaAlacakEntry[] = [
  { firmaId: "f3", firmaAdi: "Başkent Güvenlik Ltd.", acikAlacak: "₺510.000", gecikmisMi: true },
  { firmaId: "f1", firmaAdi: "Anadolu Lojistik A.Ş.", acikAlacak: "₺245.000", gecikmisMi: false },
  { firmaId: "f2", firmaAdi: "Ege Temizlik Hizmetleri", acikAlacak: "₺128.000", gecikmisMi: true },
  { firmaId: "f8", firmaAdi: "İç Anadolu Enerji", acikAlacak: "₺120.000", gecikmisMi: false },
  { firmaId: "f5", firmaAdi: "Marmara Gıda San. Tic.", acikAlacak: "₺85.000", gecikmisMi: false },
];

/** Top firms by kesilmemiş bekleyen — proportional to existing CommercialSummaryCard data.
 *  Mutable: updated by Batch 8 upload-confirm flow via updateReceivablesData(). */
export let FIRMA_KESILMEMIS_DAGILIMI: FirmaKesilmemisEntry[] = [
  { firmaId: "f3", firmaAdi: "Başkent Güvenlik Ltd.", kesilmemisBekleyen: "₺95.000" },
  { firmaId: "f8", firmaAdi: "İç Anadolu Enerji", kesilmemisBekleyen: "₺35.000" },
  { firmaId: "f1", firmaAdi: "Anadolu Lojistik A.Ş.", kesilmemisBekleyen: "₺32.000" },
  { firmaId: "f5", firmaAdi: "Marmara Gıda San. Tic.", kesilmemisBekleyen: "₺22.000" },
  { firmaId: "f2", firmaAdi: "Ege Temizlik Hizmetleri", kesilmemisBekleyen: "₺18.500" },
];

/** Overdue summary for ReceivablesSummaryCard */
export interface GecikmisOzet {
  toplamGecikmisFirmaSayisi: number;
  toplamGecikmisAlacak: string;
}

/** Mutable: updated by Batch 8 upload-confirm flow for shared summary truth. */
export let GECIKMIŞ_OZET: GecikmisOzet = {
  toplamGecikmisFirmaSayisi: 2,
  toplamGecikmisAlacak: "₺285.000",
};

/**
 * Updates the shared receivables data source — called from Batch 8 upload-confirm flow.
 * Ensures getTicariBaskiByFirma and all surfaces reading FIRMA_ALACAK_DAGILIMI /
 * FIRMA_KESILMEMIS_DAGILIMI reflect the confirmed upload values.
 */
export function updateReceivablesData(
  kpis: FinansalOzetKPIs,
  alacak: FirmaAlacakEntry[],
  kesilmemis: FirmaKesilmemisEntry[],
  gecikmisOzet: GecikmisOzet,
) {
  FINANSAL_OZET_KPIS = kpis;
  FIRMA_ALACAK_DAGILIMI = alacak;
  FIRMA_KESILMEMIS_DAGILIMI = kesilmemis;
  GECIKMIŞ_OZET = gecikmisOzet;
}

/**
 * Lookup helper for Phase 2 ticari baskı signal integration.
 * Returns compact commercial-pressure signals for a given firma, or null.
 * Two .find() calls — no derivation engine.
 */
export function getTicariBaskiByFirma(firmaId: string): {
  gecikmisAlacak?: string;
  kesilmemisBekleyen?: string;
} | null {
  const alacak = FIRMA_ALACAK_DAGILIMI.find(
    (f) => f.firmaId === firmaId && f.gecikmisMi
  );
  const kesilmemis = FIRMA_KESILMEMIS_DAGILIMI.find(
    (f) => f.firmaId === firmaId
  );

  // Only return if at least one signal is present
  if (!alacak && !kesilmemis) return null;

  return {
    ...(alacak ? { gecikmisAlacak: alacak.acikAlacak } : {}),
    ...(kesilmemis ? { kesilmemisBekleyen: kesilmemis.kesilmemisBekleyen } : {}),
  };
}
