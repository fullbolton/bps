/**
 * Mock data for Evraklar screen.
 * Display-only — no schema implied. Will be replaced by Supabase queries.
 * NOT a file folder. Focus: missing and expiring document visibility.
 */

import type { EvrakDurumu } from "@/types/ui";
import type { EvrakKategorisi } from "@/types/batch4";

export interface MockEvrak {
  id: string;
  evrakAdi: string;
  firmaId: string;
  firmaAdi: string;
  kategori: EvrakKategorisi;
  gecerlilikTarihi: string;
  durum: EvrakDurumu;
  yukleyen: string;
  guncellenmeTarihi: string;
}

/** Mutable: updated by evraklar page mutations for cross-surface consistency. */
export let MOCK_EVRAKLAR: MockEvrak[] = [
  {
    id: "ev1",
    evrakAdi: "Özel Güvenlik Yetki Belgesi",
    firmaId: "f3",
    firmaAdi: "Başkent Güvenlik Ltd.",
    kategori: "yetki_belgesi",
    gecerlilikTarihi: "2026-03-25",
    durum: "suresi_doldu",
    yukleyen: "Ali K.",
    guncellenmeTarihi: "2025-03-20",
  },
  {
    id: "ev2",
    evrakAdi: "İş Sağlığı Sertifikası",
    firmaId: "f2",
    firmaAdi: "Ege Temizlik Hizmetleri",
    kategori: "operasyon_evraki",
    gecerlilikTarihi: "",
    durum: "eksik",
    yukleyen: "",
    guncellenmeTarihi: "",
  },
  {
    id: "ev3",
    evrakAdi: "SGK İşe Giriş Bildirgeleri",
    firmaId: "f3",
    firmaAdi: "Başkent Güvenlik Ltd.",
    kategori: "operasyon_evraki",
    gecerlilikTarihi: "",
    durum: "eksik",
    yukleyen: "",
    guncellenmeTarihi: "",
  },
  {
    id: "ev4",
    evrakAdi: "Çerçeve Sözleşme — Ana Güvenlik",
    firmaId: "f3",
    firmaAdi: "Başkent Güvenlik Ltd.",
    kategori: "cerceve_sozlesme",
    gecerlilikTarihi: "2026-04-15",
    durum: "suresi_yaklsiyor",
    yukleyen: "Mehmet Y.",
    guncellenmeTarihi: "2025-05-01",
  },
  {
    id: "ev5",
    evrakAdi: "Lojistik Hizmet Sözleşmesi",
    firmaId: "f1",
    firmaAdi: "Anadolu Lojistik A.Ş.",
    kategori: "cerceve_sozlesme",
    gecerlilikTarihi: "2026-12-31",
    durum: "tam",
    yukleyen: "Ahmet B.",
    guncellenmeTarihi: "2026-01-05",
  },
  {
    id: "ev6",
    evrakAdi: "Forklift Operatör Sertifikası",
    firmaId: "f1",
    firmaAdi: "Anadolu Lojistik A.Ş.",
    kategori: "yetki_belgesi",
    gecerlilikTarihi: "2026-06-15",
    durum: "suresi_yaklsiyor",
    yukleyen: "Elif K.",
    guncellenmeTarihi: "2025-06-10",
  },
  {
    id: "ev7",
    evrakAdi: "Temizlik Hizmet Ek Protokolü",
    firmaId: "f2",
    firmaAdi: "Ege Temizlik Hizmetleri",
    kategori: "ek_protokol",
    gecerlilikTarihi: "2026-08-31",
    durum: "tam",
    yukleyen: "Burak Ş.",
    guncellenmeTarihi: "2025-09-01",
  },
  {
    id: "ev8",
    evrakAdi: "Enerji Saha Yetki Belgesi",
    firmaId: "f8",
    firmaAdi: "İç Anadolu Enerji",
    kategori: "yetki_belgesi",
    gecerlilikTarihi: "2026-05-01",
    durum: "suresi_yaklsiyor",
    yukleyen: "Elif Y.",
    guncellenmeTarihi: "2025-05-01",
  },
  {
    id: "ev9",
    evrakAdi: "Gıda Üretim Personeli Teklif",
    firmaId: "f5",
    firmaAdi: "Marmara Gıda San. Tic.",
    kategori: "teklif_dosyasi",
    gecerlilikTarihi: "",
    durum: "tam",
    yukleyen: "Zeynep A.",
    guncellenmeTarihi: "2025-11-01",
  },
  {
    id: "ev10",
    evrakAdi: "Güvenlik Denetim Tutanağı",
    firmaId: "f3",
    firmaAdi: "Başkent Güvenlik Ltd.",
    kategori: "ziyaret_tutanagi",
    gecerlilikTarihi: "",
    durum: "tam",
    yukleyen: "Ali K.",
    guncellenmeTarihi: "2026-03-15",
  },
  {
    id: "ev11",
    evrakAdi: "Tekstil Atölye Operasyon Belgesi",
    firmaId: "f7",
    firmaAdi: "Trakya Tekstil A.Ş.",
    kategori: "operasyon_evraki",
    gecerlilikTarihi: "2026-12-31",
    durum: "tam",
    yukleyen: "Burak Ş.",
    guncellenmeTarihi: "2026-01-05",
  },
  {
    id: "ev12",
    evrakAdi: "Enerji Santral Güvenlik Belgesi",
    firmaId: "f8",
    firmaAdi: "İç Anadolu Enerji",
    kategori: "yetki_belgesi",
    gecerlilikTarihi: "2025-06-30",
    durum: "suresi_doldu",
    yukleyen: "Elif Y.",
    guncellenmeTarihi: "2024-07-01",
  },
];

/**
 * Sync helper: updates the shared module-level array so Dashboard and Company Detail read the same truth.
 */
export function updateEvraklar(updated: MockEvrak[]) {
  MOCK_EVRAKLAR = updated;
}

export function getEvrakStatusCounts() {
  const counts: Record<string, number> = { tam: 0, eksik: 0, suresi_yaklsiyor: 0, suresi_doldu: 0 };
  for (const e of MOCK_EVRAKLAR) {
    counts[e.durum] = (counts[e.durum] || 0) + 1;
  }
  return counts;
}
