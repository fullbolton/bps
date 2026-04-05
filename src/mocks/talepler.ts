/**
 * Mock data for Personel Talepleri screen.
 * Display-only — no schema implied. Will be replaced by Supabase queries.
 */

import type { TalepDurumu, OncelikSeviyesi } from "@/types/ui";

export interface MockTalep {
  id: string;
  firmaId: string;
  firmaAdi: string;
  pozisyon: string;
  talepEdilen: number;
  saglanan: number;
  acikKalan: number;
  lokasyon: string;
  baslangicTarihi: string;
  oncelik: OncelikSeviyesi;
  durum: TalepDurumu;
  sorumlu: string;
}

/** Mutable: updated by Talepler page mutations for cross-surface consistency. */
export let MOCK_TALEPLER: MockTalep[] = [
  {
    id: "tlp1",
    firmaId: "f3",
    firmaAdi: "Başkent Güvenlik Ltd.",
    pozisyon: "Güvenlik Görevlisi",
    talepEdilen: 8,
    saglanan: 4,
    acikKalan: 4,
    lokasyon: "Ankara",
    baslangicTarihi: "2026-04-01",
    oncelik: "kritik",
    durum: "kismi_doldu",
    sorumlu: "Mehmet Y.",
  },
  {
    id: "tlp2",
    firmaId: "f1",
    firmaAdi: "Anadolu Lojistik A.Ş.",
    pozisyon: "Forklift Operatörü",
    talepEdilen: 5,
    saglanan: 0,
    acikKalan: 5,
    lokasyon: "İstanbul",
    baslangicTarihi: "2026-04-15",
    oncelik: "yuksek",
    durum: "degerlendiriliyor",
    sorumlu: "Ahmet B.",
  },
  {
    id: "tlp3",
    firmaId: "f8",
    firmaAdi: "İç Anadolu Enerji",
    pozisyon: "Saha Teknisyeni",
    talepEdilen: 3,
    saglanan: 1,
    acikKalan: 2,
    lokasyon: "Konya",
    baslangicTarihi: "2026-03-20",
    oncelik: "yuksek",
    durum: "kismi_doldu",
    sorumlu: "Elif Y.",
  },
  {
    id: "tlp4",
    firmaId: "f2",
    firmaAdi: "Ege Temizlik Hizmetleri",
    pozisyon: "Temizlik Personeli",
    talepEdilen: 3,
    saglanan: 3,
    acikKalan: 0,
    lokasyon: "İzmir",
    baslangicTarihi: "2026-02-01",
    oncelik: "normal",
    durum: "tamamen_doldu",
    sorumlu: "Burak Ş.",
  },
  {
    id: "tlp5",
    firmaId: "f5",
    firmaAdi: "Marmara Gıda San. Tic.",
    pozisyon: "Paketleme Operatörü",
    talepEdilen: 4,
    saglanan: 4,
    acikKalan: 0,
    lokasyon: "Bursa",
    baslangicTarihi: "2026-01-15",
    oncelik: "normal",
    durum: "tamamen_doldu",
    sorumlu: "Zeynep A.",
  },
  {
    id: "tlp6",
    firmaId: "f1",
    firmaAdi: "Anadolu Lojistik A.Ş.",
    pozisyon: "Depo İşçisi",
    talepEdilen: 6,
    saglanan: 6,
    acikKalan: 0,
    lokasyon: "İstanbul",
    baslangicTarihi: "2026-01-10",
    oncelik: "dusuk",
    durum: "tamamen_doldu",
    sorumlu: "Ahmet B.",
  },
  {
    id: "tlp7",
    firmaId: "f3",
    firmaAdi: "Başkent Güvenlik Ltd.",
    pozisyon: "Kamera Operatörü",
    talepEdilen: 2,
    saglanan: 0,
    acikKalan: 2,
    lokasyon: "Ankara",
    baslangicTarihi: "2026-04-16",
    oncelik: "yuksek",
    durum: "yeni",
    sorumlu: "Mehmet Y.",
  },
  {
    id: "tlp8",
    firmaId: "f8",
    firmaAdi: "İç Anadolu Enerji",
    pozisyon: "Elektrik Teknisyeni",
    talepEdilen: 2,
    saglanan: 0,
    acikKalan: 2,
    lokasyon: "Konya",
    baslangicTarihi: "2026-04-10",
    oncelik: "normal",
    durum: "yeni",
    sorumlu: "",
  },
  {
    id: "tlp9",
    firmaId: "f5",
    firmaAdi: "Marmara Gıda San. Tic.",
    pozisyon: "Kalite Kontrol",
    talepEdilen: 2,
    saglanan: 0,
    acikKalan: 0,
    lokasyon: "Bursa",
    baslangicTarihi: "2026-03-01",
    oncelik: "dusuk",
    durum: "beklemede",
    sorumlu: "Zeynep A.",
  },
  {
    id: "tlp10",
    firmaId: "f6",
    firmaAdi: "Akdeniz Turizm Otelcilik",
    pozisyon: "Garson",
    talepEdilen: 5,
    saglanan: 0,
    acikKalan: 0,
    lokasyon: "Antalya",
    baslangicTarihi: "2025-03-01",
    oncelik: "dusuk",
    durum: "iptal",
    sorumlu: "Burak Ş.",
  },
];

export function updateTalepler(updated: MockTalep[]) {
  MOCK_TALEPLER = updated;
}

export function getTalepStatusCounts() {
  const counts: Record<string, number> = {};
  for (const t of MOCK_TALEPLER) {
    counts[t.durum] = (counts[t.durum] || 0) + 1;
  }
  return counts;
}
