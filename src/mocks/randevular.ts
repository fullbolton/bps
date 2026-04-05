/**
 * Mock data for Randevular screen.
 * Display-only — no schema implied. Will be replaced by Supabase queries.
 */

import type { RandevuDurumu } from "@/types/ui";

export type RandevuTipi = "ziyaret" | "online" | "telefon" | "teklif_sunumu" | "denetim" | "diger";

export const RANDEVU_TIPI_LABELS: Record<RandevuTipi, string> = {
  ziyaret: "Ziyaret",
  online: "Online",
  telefon: "Telefon",
  teklif_sunumu: "Teklif Sunumu",
  denetim: "Denetim",
  diger: "Diğer",
};

export interface MockRandevu {
  id: string;
  tarih: string;
  saat: string;
  firmaId: string;
  firmaAdi: string;
  gorusmeTipi: RandevuTipi;
  katilimci: string;
  durum: RandevuDurumu;
  /** Required when durum === "tamamlandi" */
  sonuc: string;
  /** Required when durum === "tamamlandi" */
  sonrakiAksiyon: string;
}

/** Mutable: updated by Randevular page mutations for cross-surface consistency. */
export let MOCK_RANDEVULAR: MockRandevu[] = [
  {
    id: "r1",
    tarih: "2026-04-07",
    saat: "10:00",
    firmaId: "f3",
    firmaAdi: "Başkent Güvenlik Ltd.",
    gorusmeTipi: "ziyaret",
    katilimci: "Mehmet Y.",
    durum: "planlandi",
    sonuc: "",
    sonrakiAksiyon: "",
  },
  {
    id: "r2",
    tarih: "2026-04-10",
    saat: "14:00",
    firmaId: "f1",
    firmaAdi: "Anadolu Lojistik A.Ş.",
    gorusmeTipi: "online",
    katilimci: "Ahmet B.",
    durum: "planlandi",
    sonuc: "",
    sonrakiAksiyon: "",
  },
  {
    id: "r3",
    tarih: "2026-04-12",
    saat: "09:30",
    firmaId: "f8",
    firmaAdi: "İç Anadolu Enerji",
    gorusmeTipi: "teklif_sunumu",
    katilimci: "Elif Y.",
    durum: "planlandi",
    sonuc: "",
    sonrakiAksiyon: "",
  },
  {
    id: "r4",
    tarih: "2026-03-28",
    saat: "11:00",
    firmaId: "f1",
    firmaAdi: "Anadolu Lojistik A.Ş.",
    gorusmeTipi: "ziyaret",
    katilimci: "Mehmet Y.",
    durum: "tamamlandi",
    sonuc: "Yıllık değerlendirme olumlu. Kapasite artışı talebi iletildi.",
    sonrakiAksiyon: "Ek protokol taslağı hazırlanacak",
  },
  {
    id: "r5",
    tarih: "2026-03-25",
    saat: "15:00",
    firmaId: "f5",
    firmaAdi: "Marmara Gıda San. Tic.",
    gorusmeTipi: "telefon",
    katilimci: "Zeynep A.",
    durum: "tamamlandi",
    sonuc: "Sezonluk personel ihtiyacı görüşüldü. 10 kişilik ek talep planlanıyor.",
    sonrakiAksiyon: "Personel talebi açılacak",
  },
  {
    id: "r6",
    tarih: "2026-03-30",
    saat: "10:00",
    firmaId: "f3",
    firmaAdi: "Başkent Güvenlik Ltd.",
    gorusmeTipi: "ziyaret",
    katilimci: "Mehmet Y.",
    durum: "tamamlandi",
    sonuc: "Sözleşme yenileme koşulları görüşüldü. Fiyat revizyonu bekleniyor.",
    sonrakiAksiyon: "Revize teklif hazırlanacak, görev açılacak",
  },
  {
    id: "r7",
    tarih: "2026-03-20",
    saat: "14:00",
    firmaId: "f2",
    firmaAdi: "Ege Temizlik Hizmetleri",
    gorusmeTipi: "online",
    katilimci: "Burak Ş.",
    durum: "tamamlandi",
    sonuc: "Ödeme gecikmesi konuşuldu. Ödeme planı taahhüdü alındı.",
    sonrakiAksiyon: "Ödeme takip görevi oluşturulacak",
  },
  {
    id: "r8",
    tarih: "2026-04-05",
    saat: "11:00",
    firmaId: "f5",
    firmaAdi: "Marmara Gıda San. Tic.",
    gorusmeTipi: "denetim",
    katilimci: "Zeynep A.",
    durum: "ertelendi",
    sonuc: "",
    sonrakiAksiyon: "",
  },
  {
    id: "r9",
    tarih: "2026-03-15",
    saat: "09:00",
    firmaId: "f7",
    firmaAdi: "Trakya Tekstil A.Ş.",
    gorusmeTipi: "telefon",
    katilimci: "Burak Ş.",
    durum: "iptal",
    sonuc: "",
    sonrakiAksiyon: "",
  },
  {
    id: "r10",
    tarih: "2026-04-15",
    saat: "16:00",
    firmaId: "f5",
    firmaAdi: "Marmara Gıda San. Tic.",
    gorusmeTipi: "ziyaret",
    katilimci: "Zeynep A.",
    durum: "planlandi",
    sonuc: "",
    sonrakiAksiyon: "",
  },
];

export function updateRandevular(updated: MockRandevu[]) {
  MOCK_RANDEVULAR = updated;
}

export function getRandevuStatusCounts() {
  const counts: Record<string, number> = {};
  for (const r of MOCK_RANDEVULAR) {
    counts[r.durum] = (counts[r.durum] || 0) + 1;
  }
  return counts;
}
