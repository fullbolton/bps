/**
 * Mock data for Sözleşmeler Liste screen.
 * Display-only — no schema implied. Will be replaced by Supabase queries.
 */

import type { SozlesmeDurumu } from "@/types/ui";

export interface MockSozlesme {
  id: string;
  sozlesmeAdi: string;
  firmaId: string;
  firmaAdi: string;
  tur: string;
  baslangic: string;
  bitis: string;
  kalanGun: number | null;
  durum: SozlesmeDurumu;
  sorumlu: string;
  sonIslem: string;
  /** Kept for side panel preview, not a table column */
  tutar: string;
  kapsam: string;
}

export const MOCK_SOZLESMELER: MockSozlesme[] = [
  {
    id: "s1",
    sozlesmeAdi: "Lojistik Hizmet Sözleşmesi 2026",
    firmaId: "f1",
    firmaAdi: "Anadolu Lojistik A.Ş.",
    tur: "Hizmet",
    baslangic: "2026-01-01",
    bitis: "2026-12-31",
    kalanGun: 273,
    durum: "aktif",
    sorumlu: "Ahmet B.",
    sonIslem: "Sözleşme oluşturuldu",
    tutar: "₺1.200.000",
    kapsam: "Depo ve sevkiyat personeli temini",
  },
  {
    id: "s2",
    sozlesmeAdi: "Depo Operasyon Ek Protokolü",
    firmaId: "f1",
    firmaAdi: "Anadolu Lojistik A.Ş.",
    tur: "Ek Protokol",
    baslangic: "2026-02-01",
    bitis: "2026-06-30",
    kalanGun: 88,
    durum: "aktif",
    sorumlu: "Ahmet B.",
    sonIslem: "Personel ataması yapıldı",
    tutar: "₺320.000",
    kapsam: "Ek depo personeli — kış dönemi",
  },
  {
    id: "s3",
    sozlesmeAdi: "Nakliye Destek Sözleşmesi",
    firmaId: "f1",
    firmaAdi: "Anadolu Lojistik A.Ş.",
    tur: "Hizmet",
    baslangic: "",
    bitis: "",
    kalanGun: null,
    durum: "taslak",
    sorumlu: "Ahmet B.",
    sonIslem: "Taslak oluşturuldu",
    tutar: "—",
    kapsam: "Yeni hat nakliye personeli",
  },
  {
    id: "s4",
    sozlesmeAdi: "Temizlik Hizmet Sözleşmesi",
    firmaId: "f2",
    firmaAdi: "Ege Temizlik Hizmetleri",
    tur: "Hizmet",
    baslangic: "2025-09-01",
    bitis: "2026-08-31",
    kalanGun: 150,
    durum: "aktif",
    sorumlu: "Mehmet Y.",
    sonIslem: "Dönem uzatma onaylandı",
    tutar: "₺480.000",
    kapsam: "Ofis ve saha temizlik hizmeti",
  },
  {
    id: "s5",
    sozlesmeAdi: "Ana Güvenlik Sözleşmesi",
    firmaId: "f3",
    firmaAdi: "Başkent Güvenlik Ltd.",
    tur: "Hizmet",
    baslangic: "2025-05-01",
    bitis: "2026-04-15",
    kalanGun: 12,
    durum: "aktif",
    sorumlu: "Mehmet Y.",
    sonIslem: "Yenileme görüşmesi planlandı",
    tutar: "₺960.000",
    kapsam: "7/24 güvenlik personeli temini",
  },
  {
    id: "s6",
    sozlesmeAdi: "Ek Güvenlik Protokolü",
    firmaId: "f3",
    firmaAdi: "Başkent Güvenlik Ltd.",
    tur: "Ek Protokol",
    baslangic: "2026-04-16",
    bitis: "2027-04-15",
    kalanGun: null,
    durum: "imza_bekliyor",
    sorumlu: "Mehmet Y.",
    sonIslem: "İmza için gönderildi",
    tutar: "₺1.080.000",
    kapsam: "Yenileme — ek kamera operatör kadrosu",
  },
  {
    id: "s7",
    sozlesmeAdi: "Gıda Üretim Personeli Sözleşmesi",
    firmaId: "f5",
    firmaAdi: "Marmara Gıda San. Tic.",
    tur: "Hizmet",
    baslangic: "2025-11-01",
    bitis: "2026-04-30",
    kalanGun: 27,
    durum: "aktif",
    sorumlu: "Zeynep A.",
    sonIslem: "Kapasite değerlendirmesi yapıldı",
    tutar: "₺540.000",
    kapsam: "Üretim hattı personeli",
  },
  {
    id: "s8",
    sozlesmeAdi: "Paketleme Hattı Ek Protokolü",
    firmaId: "f5",
    firmaAdi: "Marmara Gıda San. Tic.",
    tur: "Ek Protokol",
    baslangic: "2026-01-15",
    bitis: "2026-07-15",
    kalanGun: 103,
    durum: "aktif",
    sorumlu: "Zeynep A.",
    sonIslem: "Personel ataması yapıldı",
    tutar: "₺210.000",
    kapsam: "Sezonluk paketleme personeli",
  },
  {
    id: "s9",
    sozlesmeAdi: "Tekstil Atölye Sözleşmesi",
    firmaId: "f7",
    firmaAdi: "Trakya Tekstil A.Ş.",
    tur: "Hizmet",
    baslangic: "2026-01-01",
    bitis: "2026-12-31",
    kalanGun: 273,
    durum: "aktif",
    sorumlu: "Burak Ş.",
    sonIslem: "Sözleşme imzalandı",
    tutar: "₺390.000",
    kapsam: "Atölye ve kalite kontrol personeli",
  },
  {
    id: "s10",
    sozlesmeAdi: "Enerji Saha Personeli",
    firmaId: "f8",
    firmaAdi: "İç Anadolu Enerji",
    tur: "Hizmet",
    baslangic: "2025-07-01",
    bitis: "2026-06-30",
    kalanGun: 88,
    durum: "aktif",
    sorumlu: "Elif Y.",
    sonIslem: "Dönem uzatma değerlendirmesi",
    tutar: "₺720.000",
    kapsam: "Saha bakım ve operasyon ekibi",
  },
  {
    id: "s11",
    sozlesmeAdi: "Enerji Güvenlik Ek Sözleşmesi",
    firmaId: "f8",
    firmaAdi: "İç Anadolu Enerji",
    tur: "Hizmet",
    baslangic: "2024-07-01",
    bitis: "2025-06-30",
    kalanGun: null,
    durum: "suresi_doldu",
    sorumlu: "Elif Y.",
    sonIslem: "Süre doldu — yenileme bekleniyor",
    tutar: "₺480.000",
    kapsam: "Santral güvenlik personeli — süresi doldu",
  },
  {
    id: "s12",
    sozlesmeAdi: "Otel Personel Sözleşmesi",
    firmaId: "f6",
    firmaAdi: "Akdeniz Turizm Otelcilik",
    tur: "Hizmet",
    baslangic: "2024-04-01",
    bitis: "2025-03-31",
    kalanGun: null,
    durum: "feshedildi",
    sorumlu: "Burak Ş.",
    sonIslem: "Fesih işlemi tamamlandı",
    tutar: "₺600.000",
    kapsam: "Otel hizmet personeli — feshedildi",
  },
];

// --- Sözleşme Detay extended data (Batch 3) ---

export interface SozlesmeDetayDosya {
  ad: string;
  versiyon: string;
  tarih: string;
}

export interface SozlesmeDetayNot {
  tarih: string;
  user: string;
  icerik: string;
}

export interface SozlesmeYenileme {
  bpisTarihi: string;
  gorusmeAcildiMi: boolean;
  sorumluVar: boolean;
  gorevUretildi: boolean;
}

export interface SozlesmeBagliGorev {
  id: string;
  baslik: string;
  durum: string;
}

export interface SozlesmeBagliRandevu {
  id: string;
  tarih: string;
  durum: string;
  sonuc?: string;
}

import type { TicariHazirlik } from "@/types/batch6";

export interface MockSozlesmeDetay extends MockSozlesme {
  dosyalar: SozlesmeDetayDosya[];
  kritikMaddeler: string[];
  yenileme: SozlesmeYenileme;
  icNotlar: SozlesmeDetayNot[];
  bagliGorevler: SozlesmeBagliGorev[];
  bagliRandevular: SozlesmeBagliRandevu[];
  /** Optional: contract-context commercial preparation history (Batch 6) */
  ticariHazirlik?: TicariHazirlik;
}

export const MOCK_SOZLESME_DETAY: Record<string, MockSozlesmeDetay> = {
  s1: {
    ...MOCK_SOZLESMELER.find((s) => s.id === "s1")!,
    dosyalar: [
      { ad: "Lojistik_Hizmet_2026_v2.pdf", versiyon: "v2", tarih: "2026-01-05" },
      { ad: "Lojistik_Hizmet_2026_v1.pdf", versiyon: "v1", tarih: "2025-12-20" },
    ],
    kritikMaddeler: [
      "Personel devir oranı %15'i aşarsa cezai şart uygulanır",
      "Aylık performans raporu 5. iş gününe kadar teslim edilecek",
      "Yıllık fiyat revizyonu TÜFE endeksine bağlıdır",
    ],
    yenileme: { bpisTarihi: "2026-12-31", gorusmeAcildiMi: false, sorumluVar: true, gorevUretildi: false },
    icNotlar: [
      { tarih: "2026-03-01", user: "Ahmet B.", icerik: "Müşteri memnuniyet anketi olumlu." },
      { tarih: "2026-01-10", user: "Mehmet Y.", icerik: "Sözleşme imza süreci tamamlandı." },
    ],
    bagliGorevler: [
      { id: "g6", baslik: "Ek protokol taslağı hazırla", durum: "acik" },
    ],
    bagliRandevular: [
      { id: "r4", tarih: "2026-03-28", durum: "tamamlandi", sonuc: "Yıllık değerlendirme olumlu" },
      { id: "r2", tarih: "2026-04-10", durum: "planlandi" },
    ],
    ticariHazirlik: {
      adimlar: [
        { adim: "Teklif Hazırlandı", tarih: "2025-11-10", user: "Mehmet Y.", tamamlandi: true },
        { adim: "Teklif Gönderildi", tarih: "2025-11-15", user: "Mehmet Y.", not: "Müşteriye e-posta ile iletildi", tamamlandi: true },
        { adim: "Teklif Onaylandı", tarih: "2025-12-02", user: "Mehmet Y.", not: "Müşteri fiyat koşullarını kabul etti", tamamlandi: true },
        { adim: "Sözleşme Hazırlandı", tarih: "2025-12-15", user: "Ahmet B.", tamamlandi: true },
        { adim: "Sözleşme Gönderildi", tarih: "2025-12-20", user: "Ahmet B.", tamamlandi: true },
        { adim: "Sözleşme İmzalandı", tarih: "2026-01-05", user: "Yönetici", tamamlandi: true },
      ],
      imzaliPdfNotu: "İmzalı sözleşme dosyalar bölümünde: Lojistik_Hizmet_2026_v2.pdf",
    },
  },
  s2: {
    ...MOCK_SOZLESMELER.find((s) => s.id === "s2")!,
    dosyalar: [
      { ad: "Depo_Ek_Protokol_v1.pdf", versiyon: "v1", tarih: "2026-02-01" },
    ],
    kritikMaddeler: [
      "Ek personel ihtiyacı minimum 5 iş günü önceden bildirilecek",
      "Kış dönemi bitiminde protokol otomatik kapanır",
    ],
    yenileme: { bpisTarihi: "2026-06-30", gorusmeAcildiMi: false, sorumluVar: true, gorevUretildi: false },
    icNotlar: [
      { tarih: "2026-02-05", user: "Ahmet B.", icerik: "Personel atamaları tamamlandı." },
    ],
    bagliGorevler: [],
    bagliRandevular: [],
  },
  s5: {
    ...MOCK_SOZLESMELER.find((s) => s.id === "s5")!,
    dosyalar: [
      { ad: "Guvenlik_Ana_Sozlesme_v3.pdf", versiyon: "v3", tarih: "2025-05-01" },
      { ad: "Guvenlik_Ana_Sozlesme_v2.pdf", versiyon: "v2", tarih: "2024-12-10" },
      { ad: "Guvenlik_Ana_Sozlesme_v1.pdf", versiyon: "v1", tarih: "2024-05-01" },
    ],
    kritikMaddeler: [
      "7/24 güvenlik kapsamı kesintisiz sağlanacak",
      "Silahlı güvenlik personeli sertifika gerekliliği",
      "Bitiş tarihinden 30 gün önce yenileme görüşmesi yapılacak",
      "Fesih durumunda 60 gün önceden bildirim zorunlu",
    ],
    yenileme: { bpisTarihi: "2026-04-15", gorusmeAcildiMi: true, sorumluVar: true, gorevUretildi: true },
    icNotlar: [
      { tarih: "2026-03-30", user: "Mehmet Y.", icerik: "Yenileme koşulları görüşüldü, fiyat revizyonu bekleniyor." },
      { tarih: "2026-03-15", user: "Mehmet Y.", icerik: "Bitiş yaklaşıyor, yenileme süreci başlatıldı." },
      { tarih: "2025-06-01", user: "Ali K.", icerik: "Sözleşme yenileme v3 imzalandı." },
    ],
    bagliGorevler: [
      { id: "g1", baslik: "Sözleşme yenileme teklifi hazırla", durum: "gecikti" },
      { id: "g5", baslik: "Revize teklif hazırla", durum: "devam_ediyor" },
    ],
    bagliRandevular: [
      { id: "r6", tarih: "2026-03-30", durum: "tamamlandi", sonuc: "Yenileme koşulları görüşüldü" },
      { id: "r1", tarih: "2026-04-07", durum: "planlandi" },
    ],
    ticariHazirlik: {
      adimlar: [
        { adim: "Teklif Hazırlandı", tarih: "2024-03-10", user: "Mehmet Y.", tamamlandi: true },
        { adim: "Teklif Gönderildi", tarih: "2024-03-15", user: "Mehmet Y.", tamamlandi: true },
        { adim: "Teklif Onaylandı", tarih: "2024-04-01", user: "Mehmet Y.", not: "Güvenlik kapsamı ve personel sayısı üzerinde anlaşıldı", tamamlandi: true },
        { adim: "Sözleşme Hazırlandı", tarih: "2024-04-15", user: "Ali K.", tamamlandi: true },
        { adim: "Sözleşme İmzalandı", tarih: "2024-05-01", user: "Yönetici", tamamlandi: true },
      ],
    },
  },
};

/** Status summary counts for filter chips */
export function getSozlesmeStatusCounts() {
  const counts: Record<string, number> = {};
  for (const s of MOCK_SOZLESMELER) {
    counts[s.durum] = (counts[s.durum] || 0) + 1;
  }
  return counts;
}
