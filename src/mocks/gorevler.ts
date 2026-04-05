/**
 * Mock data for Görevler screen.
 * Display-only — no schema implied. Will be replaced by Supabase queries.
 */

import type { GorevDurumu, OncelikSeviyesi } from "@/types/ui";

export type GorevKaynagi = "manuel" | "randevu" | "sozlesme";

export const KAYNAK_LABELS: Record<GorevKaynagi, string> = {
  manuel: "Manuel",
  randevu: "Randevu",
  sozlesme: "Sözleşme",
};

export interface MockGorev {
  id: string;
  baslik: string;
  firmaId: string;
  firmaAdi: string;
  kaynak: GorevKaynagi;
  kaynakRef?: string;
  atananKisi: string;
  termin: string;
  oncelik: OncelikSeviyesi;
  durum: GorevDurumu;
}

/** Mutable: updated by gorevler-related demo flows for cross-surface consistency. */
export let MOCK_GOREVLER: MockGorev[] = [
  {
    id: "g1",
    baslik: "Sözleşme yenileme teklifi hazırla",
    firmaId: "f3",
    firmaAdi: "Başkent Güvenlik Ltd.",
    kaynak: "sozlesme",
    kaynakRef: "s5",
    atananKisi: "Mehmet Y.",
    termin: "2026-04-05",
    oncelik: "kritik",
    durum: "gecikti",
  },
  {
    id: "g2",
    baslik: "SGK bildirge kontrolü",
    firmaId: "f1",
    firmaAdi: "Anadolu Lojistik A.Ş.",
    kaynak: "manuel",
    atananKisi: "Elif K.",
    termin: "2026-04-04",
    oncelik: "yuksek",
    durum: "devam_ediyor",
  },
  {
    id: "g3",
    baslik: "Yeni personel oryantasyon takibi",
    firmaId: "f5",
    firmaAdi: "Marmara Gıda San. Tic.",
    kaynak: "manuel",
    atananKisi: "Zeynep A.",
    termin: "2026-04-07",
    oncelik: "normal",
    durum: "acik",
  },
  {
    id: "g4",
    baslik: "Ödeme takip görevi",
    firmaId: "f2",
    firmaAdi: "Ege Temizlik Hizmetleri",
    kaynak: "randevu",
    kaynakRef: "r7",
    atananKisi: "Burak Ş.",
    termin: "2026-04-10",
    oncelik: "yuksek",
    durum: "acik",
  },
  {
    id: "g5",
    baslik: "Revize teklif hazırla",
    firmaId: "f3",
    firmaAdi: "Başkent Güvenlik Ltd.",
    kaynak: "randevu",
    kaynakRef: "r6",
    atananKisi: "Mehmet Y.",
    termin: "2026-04-08",
    oncelik: "kritik",
    durum: "devam_ediyor",
  },
  {
    id: "g6",
    baslik: "Ek protokol taslağı hazırla",
    firmaId: "f1",
    firmaAdi: "Anadolu Lojistik A.Ş.",
    kaynak: "randevu",
    kaynakRef: "r4",
    atananKisi: "Ahmet B.",
    termin: "2026-04-12",
    oncelik: "normal",
    durum: "acik",
  },
  {
    id: "g7",
    baslik: "Sözleşme bitiş değerlendirmesi",
    firmaId: "f5",
    firmaAdi: "Marmara Gıda San. Tic.",
    kaynak: "sozlesme",
    kaynakRef: "s7",
    atananKisi: "Zeynep A.",
    termin: "2026-04-20",
    oncelik: "yuksek",
    durum: "acik",
  },
  {
    id: "g8",
    baslik: "Müşteri ziyareti notu yazılacak",
    firmaId: "f2",
    firmaAdi: "Ege Temizlik Hizmetleri",
    kaynak: "manuel",
    atananKisi: "Burak Ş.",
    termin: "2026-04-03",
    oncelik: "dusuk",
    durum: "tamamlandi",
  },
  {
    id: "g9",
    baslik: "Enerji saha ekibi rotasyon planı",
    firmaId: "f8",
    firmaAdi: "İç Anadolu Enerji",
    kaynak: "sozlesme",
    kaynakRef: "s10",
    atananKisi: "Elif Y.",
    termin: "2026-04-15",
    oncelik: "normal",
    durum: "acik",
  },
  {
    id: "g10",
    baslik: "Tekstil atölye kalite raporu",
    firmaId: "f7",
    firmaAdi: "Trakya Tekstil A.Ş.",
    kaynak: "manuel",
    atananKisi: "Burak Ş.",
    termin: "2026-03-28",
    oncelik: "dusuk",
    durum: "iptal",
  },
];

export function updateGorevler(updated: MockGorev[]) {
  MOCK_GOREVLER = updated;
}

export function getGorevStatusCounts(tasks: MockGorev[] = MOCK_GOREVLER) {
  const counts: Record<GorevDurumu, number> = {
    acik: 0,
    devam_ediyor: 0,
    tamamlandi: 0,
    gecikti: 0,
    iptal: 0,
  };
  for (const g of tasks) {
    counts[g.durum]++;
  }
  return counts;
}
