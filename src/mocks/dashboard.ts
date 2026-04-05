/**
 * Mock data for Dashboard screen.
 * Display-only — no schema implied. Will be replaced by Supabase queries.
 */

import type { ActivityEvent } from "@/components/ui/ActivityFeed";
import type { ExpiringContract } from "@/components/ui/ContractExpiryCard";

// --- KPI values ---
export const DASHBOARD_KPIS = {
  toplamFirma: 8,
  aktifSozlesme: 9,
  acikTalep: 11,
  aktifPersonel: 125,
  bekleyenGorev: 14,
  yaklasanRandevu: 3,
};

// --- Signal cards data ---

export interface TodayTask {
  id: string;
  baslik: string;
  firma: string;
  gecikme?: boolean;
}

export const MOCK_TODAY_TASKS: TodayTask[] = [
  { id: "g1", baslik: "Sözleşme yenileme hazırlığı", firma: "Başkent Güvenlik Ltd.", gecikme: true },
  { id: "g2", baslik: "SGK bildirge kontrolü", firma: "Anadolu Lojistik A.Ş." },
  { id: "g3", baslik: "Yeni personel oryantasyon takibi", firma: "Marmara Gıda San. Tic." },
  { id: "g4", baslik: "Müşteri ziyareti notu yazılacak", firma: "Ege Temizlik Hizmetleri" },
];

export const MOCK_EXPIRING_CONTRACTS: ExpiringContract[] = [
  { id: "s5", sozlesmeAdi: "Ana Güvenlik Sözleşmesi", firmaAdi: "Başkent Güvenlik Ltd.", kalanGun: 12, durum: "aktif" },
  { id: "s7", sozlesmeAdi: "Gıda Üretim Personeli Sözleşmesi", firmaAdi: "Marmara Gıda San. Tic.", kalanGun: 27, durum: "aktif" },
  { id: "s2", sozlesmeAdi: "Depo Operasyon Ek Protokolü", firmaAdi: "Anadolu Lojistik A.Ş.", kalanGun: 88, durum: "aktif" },
  { id: "s10", sozlesmeAdi: "Enerji Saha Personeli", firmaAdi: "İç Anadolu Enerji", kalanGun: 88, durum: "aktif" },
];

export interface OpenDemand {
  id: string;
  firma: string;
  pozisyon: string;
  adet: number;
}

export const MOCK_OPEN_DEMANDS: OpenDemand[] = [
  { id: "d1", firma: "Başkent Güvenlik Ltd.", pozisyon: "Güvenlik Görevlisi", adet: 4 },
  { id: "d2", firma: "Anadolu Lojistik A.Ş.", pozisyon: "Forklift Operatörü", adet: 5 },
  { id: "d3", firma: "İç Anadolu Enerji", pozisyon: "Saha Teknisyeni", adet: 3 },
  { id: "d4", firma: "Ege Temizlik Hizmetleri", pozisyon: "Temizlik Personeli", adet: 3 },
];

export interface MissingDoc {
  id: string;
  firma: string;
  evrak: string;
  gecenGun: number;
}

export const MOCK_MISSING_DOCS: MissingDoc[] = [
  { id: "e1", firma: "Başkent Güvenlik Ltd.", evrak: "Özel güvenlik yetki belgesi", gecenGun: 7 },
  { id: "e2", firma: "Ege Temizlik Hizmetleri", evrak: "İş sağlığı sertifikası", gecenGun: 3 },
  { id: "e3", firma: "Başkent Güvenlik Ltd.", evrak: "SGK işe giriş bildirgeleri (2 kişi)", gecenGun: 2 },
];

export interface RiskyCompany {
  id: string;
  firmaAdi: string;
  sebep: string;
}

export const MOCK_RISKY_COMPANIES: RiskyCompany[] = [
  { id: "f3", firmaAdi: "Başkent Güvenlik Ltd.", sebep: "Ödeme gecikmesi + sözleşme bitiş yaklaşıyor" },
  { id: "f8", firmaAdi: "İç Anadolu Enerji", sebep: "3 açık talep + evrak eksikleri" },
];

// --- Recent activity for dashboard feed ---
export const MOCK_DASHBOARD_ACTIVITY: ActivityEvent[] = [
  { id: "a1", type: "sozlesme", title: "Yeni sözleşme oluşturuldu", description: "Lojistik Hizmet Sözleşmesi 2026 — Anadolu Lojistik", timestamp: "2 saat önce", user: "Ahmet B." },
  { id: "a2", type: "firma", title: "Risk seviyesi yükseltildi", description: "Başkent Güvenlik Ltd. — orta → yüksek", timestamp: "3 saat önce", user: "Yönetici" },
  { id: "a3", type: "talep", title: "Personel talebi açıldı", description: "5 forklift operatörü — Anadolu Lojistik", timestamp: "5 saat önce", user: "Ahmet B." },
  { id: "a4", type: "randevu", title: "Randevu tamamlandı", description: "Yıllık değerlendirme — Anadolu Lojistik", timestamp: "1 gün önce", user: "Mehmet Y." },
  { id: "a5", type: "evrak", title: "Evrak süresi doldu", description: "Özel güvenlik yetki belgesi — Başkent Güvenlik", timestamp: "1 gün önce", user: "Sistem" },
  { id: "a6", type: "gorev", title: "Görev gecikti", description: "Evrak toplama — Başkent Güvenlik", timestamp: "2 gün önce", user: "Ali K." },
  { id: "a7", type: "not", title: "Not eklendi", description: "Ödeme gecikmesi bilgisi — Ege Temizlik", timestamp: "3 gün önce", user: "Burak Ş." },
  { id: "a8", type: "sozlesme", title: "Sözleşme süresi yaklaşıyor", description: "Ana Güvenlik Sözleşmesi — 12 gün kaldı", timestamp: "3 gün önce", user: "Sistem" },
];
