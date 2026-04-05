/**
 * Mock data for Firmalar Liste and Firma Detay screens.
 * Display-only — no schema implied. Will be replaced by Supabase queries.
 */

import type { FirmaDurumu, RiskSeviyesi } from "@/types/ui";
import type { ActivityEvent } from "@/components/ui/ActivityFeed";

export interface MockFirma {
  id: string;
  firmaAdi: string;
  sektor: string;
  sehir: string;
  anaYetkili: string;
  aktifSozlesme: number;
  aktifIsGucu: number;
  sonGorusme: string;
  sonrakiRandevu: string;
  risk: RiskSeviyesi;
  durum: FirmaDurumu;
}

export interface MockFirmaDetay extends MockFirma {
  telefon: string;
  adres: string;
  vergiNo: string;
  kayitTarihi: string;
  // Ticari Özet fields
  acikBakiye: string;
  sonFaturaTarihi: string;
  sonFaturaTutari: string;
  kesilmemisBekleyen: string;
  ticariRisk: RiskSeviyesi;
  // Genel Bakış — documented 8-card backing data
  acikTalep: number;
  yaklaşanRandevu: number;
  eksikEvrak: number;
  /** Display-only placeholder for risk signals card */
  riskSinyalleri: string[];
  /** Display-only placeholder for latest notes card */
  sonNotlar: string[];
}

export const MOCK_FIRMALAR: MockFirma[] = [
  {
    id: "f1",
    firmaAdi: "Anadolu Lojistik A.Ş.",
    sektor: "Lojistik",
    sehir: "İstanbul",
    anaYetkili: "Mehmet Yılmaz",
    aktifSozlesme: 3,
    aktifIsGucu: 42,
    sonGorusme: "2026-03-28",
    sonrakiRandevu: "2026-04-10",
    risk: "dusuk",
    durum: "aktif",
  },
  {
    id: "f2",
    firmaAdi: "Ege Temizlik Hizmetleri",
    sektor: "Temizlik",
    sehir: "İzmir",
    anaYetkili: "Ayşe Demir",
    aktifSozlesme: 1,
    aktifIsGucu: 15,
    sonGorusme: "2026-03-20",
    sonrakiRandevu: "—",
    risk: "orta",
    durum: "aktif",
  },
  {
    id: "f3",
    firmaAdi: "Başkent Güvenlik Ltd.",
    sektor: "Güvenlik",
    sehir: "Ankara",
    anaYetkili: "Ali Kaya",
    aktifSozlesme: 2,
    aktifIsGucu: 68,
    sonGorusme: "2026-03-30",
    sonrakiRandevu: "2026-04-07",
    risk: "yuksek",
    durum: "aktif",
  },
  {
    id: "f4",
    firmaAdi: "Karadeniz İnşaat",
    sektor: "İnşaat",
    sehir: "Trabzon",
    anaYetkili: "Fatma Çelik",
    aktifSozlesme: 0,
    aktifIsGucu: 0,
    sonGorusme: "—",
    sonrakiRandevu: "—",
    risk: "dusuk",
    durum: "aday",
  },
  {
    id: "f5",
    firmaAdi: "Marmara Gıda San. Tic.",
    sektor: "Gıda",
    sehir: "Bursa",
    anaYetkili: "Hasan Öztürk",
    aktifSozlesme: 2,
    aktifIsGucu: 28,
    sonGorusme: "2026-03-25",
    sonrakiRandevu: "2026-04-15",
    risk: "dusuk",
    durum: "aktif",
  },
  {
    id: "f6",
    firmaAdi: "Akdeniz Turizm Otelcilik",
    sektor: "Turizm",
    sehir: "Antalya",
    anaYetkili: "Zeynep Arslan",
    aktifSozlesme: 0,
    aktifIsGucu: 0,
    sonGorusme: "2025-10-12",
    sonrakiRandevu: "—",
    risk: "orta",
    durum: "pasif",
  },
  {
    id: "f7",
    firmaAdi: "Trakya Tekstil A.Ş.",
    sektor: "Tekstil",
    sehir: "Edirne",
    anaYetkili: "Burak Şahin",
    aktifSozlesme: 1,
    aktifIsGucu: 12,
    sonGorusme: "2026-03-18",
    sonrakiRandevu: "—",
    risk: "dusuk",
    durum: "aktif",
  },
  {
    id: "f8",
    firmaAdi: "İç Anadolu Enerji",
    sektor: "Enerji",
    sehir: "Konya",
    anaYetkili: "Elif Yıldız",
    aktifSozlesme: 2,
    aktifIsGucu: 35,
    sonGorusme: "2026-03-22",
    sonrakiRandevu: "2026-04-12",
    risk: "orta",
    durum: "aktif",
  },
];

export const MOCK_FIRMA_DETAY: Record<string, MockFirmaDetay> = {
  f1: {
    id: "f1",
    firmaAdi: "Anadolu Lojistik A.Ş.",
    sektor: "Lojistik",
    sehir: "İstanbul",
    anaYetkili: "Mehmet Yılmaz",
    aktifSozlesme: 3,
    aktifIsGucu: 42,
    sonGorusme: "2026-03-28",
    sonrakiRandevu: "2026-04-10",
    risk: "dusuk",
    durum: "aktif",
    telefon: "0212 555 0001",
    adres: "Ataşehir, Kadıköy / İstanbul",
    vergiNo: "1234567890",
    kayitTarihi: "2024-03-15",
    acikBakiye: "₺245.000",
    sonFaturaTarihi: "2026-03-01",
    sonFaturaTutari: "₺78.500",
    kesilmemisBekleyen: "₺32.000",
    ticariRisk: "dusuk",
    acikTalep: 2,
    yaklaşanRandevu: 1,
    eksikEvrak: 2,
    riskSinyalleri: [],
    sonNotlar: ["Müşteri memnuniyet anketi olumlu sonuçlandı", "Yeni hat için kapasite değerlendirmesi yapıldı"],
  },
  f2: {
    id: "f2",
    firmaAdi: "Ege Temizlik Hizmetleri",
    sektor: "Temizlik",
    sehir: "İzmir",
    anaYetkili: "Ayşe Demir",
    aktifSozlesme: 1,
    aktifIsGucu: 15,
    sonGorusme: "2026-03-20",
    sonrakiRandevu: "—",
    risk: "orta",
    durum: "aktif",
    telefon: "0232 444 0002",
    adres: "Alsancak, Konak / İzmir",
    vergiNo: "9876543210",
    kayitTarihi: "2024-06-10",
    acikBakiye: "₺128.000",
    sonFaturaTarihi: "2026-02-15",
    sonFaturaTutari: "₺45.200",
    kesilmemisBekleyen: "₺18.500",
    ticariRisk: "orta",
    acikTalep: 1,
    yaklaşanRandevu: 0,
    eksikEvrak: 4,
    riskSinyalleri: ["Ödeme gecikmesi bildirimi alındı"],
    sonNotlar: ["Ödeme gecikmesi hakkında bilgi alındı"],
  },
  f3: {
    id: "f3",
    firmaAdi: "Başkent Güvenlik Ltd.",
    sektor: "Güvenlik",
    sehir: "Ankara",
    anaYetkili: "Ali Kaya",
    aktifSozlesme: 2,
    aktifIsGucu: 68,
    sonGorusme: "2026-03-30",
    sonrakiRandevu: "2026-04-07",
    risk: "yuksek",
    durum: "aktif",
    telefon: "0312 333 0003",
    adres: "Çankaya / Ankara",
    vergiNo: "5678901234",
    kayitTarihi: "2023-11-20",
    acikBakiye: "₺510.000",
    sonFaturaTarihi: "2026-01-10",
    sonFaturaTutari: "₺120.000",
    kesilmemisBekleyen: "₺95.000",
    ticariRisk: "yuksek",
    acikTalep: 4,
    yaklaşanRandevu: 2,
    eksikEvrak: 7,
    riskSinyalleri: ["Ödeme gecikmesi + sözleşme bitiş yaklaşıyor", "Evrak eksikleri kritik seviyede"],
    sonNotlar: ["Sözleşme yenileme görüşmesi planlandı", "Ödeme planı talep edildi"],
  },
};

/** Timeline events for Firma Detay > Zaman Çizgisi tab */
export const MOCK_FIRMA_TIMELINE: Record<string, ActivityEvent[]> = {
  f1: [
    { id: "t1", type: "sozlesme", title: "Yeni sözleşme oluşturuldu", description: "Lojistik Hizmet Sözleşmesi 2026", timestamp: "2 saat önce", user: "Ahmet B.", linkedRecord: { label: "SÖZ-2026-003", href: "/sozlesmeler" } },
    { id: "t2", type: "randevu", title: "Randevu tamamlandı", description: "Yıllık değerlendirme toplantısı", timestamp: "1 gün önce", user: "Mehmet Y." },
    { id: "t3", type: "evrak", title: "Evrak yüklendi", description: "SGK bildirge — Mart 2026", timestamp: "2 gün önce", user: "Elif K." },
    { id: "t4", type: "talep", title: "Personel talebi açıldı", description: "5 forklift operatörü", timestamp: "3 gün önce", user: "Ahmet B.", linkedRecord: { label: "TLP-2026-012" } },
    { id: "t5", type: "not", title: "Not eklendi", description: "Müşteri memnuniyet anketi olumlu sonuçlandı", timestamp: "5 gün önce", user: "Zeynep A." },
    { id: "t6", type: "gorev", title: "Görev tamamlandı", description: "Sözleşme yenileme hazırlığı", timestamp: "1 hafta önce", user: "Mehmet Y." },
    { id: "t7", type: "firma", title: "Risk seviyesi güncellendi", description: "orta → düşük", timestamp: "2 hafta önce", user: "Yönetici" },
    { id: "t16", type: "sozlesme", title: "Teklif gönderildi", description: "Lojistik Hizmet Sözleşmesi 2026 — müşteriye iletildi", timestamp: "2025-11-15", user: "Mehmet Y." },
    { id: "t17", type: "sozlesme", title: "Teklif onaylandı", description: "Lojistik Hizmet Sözleşmesi 2026 — müşteri kabul etti", timestamp: "2025-12-02", user: "Mehmet Y." },
  ],
  f2: [
    { id: "t8", type: "talep", title: "Personel talebi açıldı", description: "3 temizlik personeli", timestamp: "1 gün önce", user: "Ayşe D." },
    { id: "t9", type: "evrak", title: "Evrak eksik bildirimi", description: "İş sağlığı sertifikası eksik", timestamp: "3 gün önce", user: "Sistem" },
    { id: "t10", type: "not", title: "Not eklendi", description: "Ödeme gecikmesi hakkında bilgi alındı", timestamp: "1 hafta önce", user: "Burak Ş." },
  ],
  f3: [
    { id: "t11", type: "firma", title: "Risk seviyesi yükseltildi", description: "orta → yüksek (ödeme gecikmesi)", timestamp: "3 saat önce", user: "Yönetici" },
    { id: "t12", type: "sozlesme", title: "Sözleşme süresi yaklaşıyor", description: "Ana Güvenlik Sözleşmesi — 12 gün kaldı", timestamp: "1 gün önce", user: "Sistem" },
    { id: "t13", type: "gorev", title: "Görev gecikti", description: "Evrak toplama — son tarih geçti", timestamp: "2 gün önce", user: "Ali K." },
    { id: "t14", type: "randevu", title: "Randevu planlandı", description: "Sözleşme yenileme görüşmesi", timestamp: "4 gün önce", user: "Mehmet Y.", linkedRecord: { label: "RND-2026-045" } },
    { id: "t15", type: "evrak", title: "Evrak süresi doldu", description: "Özel güvenlik yetki belgesi", timestamp: "1 hafta önce", user: "Sistem" },
    { id: "t18", type: "sozlesme", title: "Teklif onaylandı", description: "Ana Güvenlik Sözleşmesi — müşteri kabul etti", timestamp: "2024-04-01", user: "Mehmet Y." },
    { id: "t19", type: "sozlesme", title: "Sözleşme imzalandı", description: "Ana Güvenlik Sözleşmesi v1 — imza tamamlandı", timestamp: "2024-05-01", user: "Yönetici" },
  ],
};
