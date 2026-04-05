/**
 * Batch 5 Phase 1 — Finansal Özet types.
 * Management-visibility interfaces only. Not accounting record structures.
 */

export interface FinansalOzetKPIs {
  toplamAcikAlacak: string;
  buAyKesilenFaturalar: string;
  kesilmemisAlacaklar: string;
  gecikmisAlacaklar: string;
  maasGiderleri: string;
  sabitGiderler: string;
}

export interface FirmaAlacakEntry {
  firmaId: string;
  firmaAdi: string;
  acikAlacak: string;
  gecikmisMi: boolean;
}

export interface FirmaKesilmemisEntry {
  firmaId: string;
  firmaAdi: string;
  kesilmemisBekleyen: string;
}
