/**
 * Mock data for Birimler Arası Yönlendirme — Phase 1.
 * Firma-attached coordination signals between organizational units.
 * Not tasks. Not mentions. Not messages.
 * Display-only demo data — local state in page component.
 */

import type { BirimKodu, YonlendirmeDurumu } from "@/types/yonlendirme";

export interface Yonlendirme {
  id: string;
  firmaId: string;
  kaynakBirim: BirimKodu;
  hedefBirim: BirimKodu;
  gonderen: string;
  aciklama: string;
  tarih: string;
  durum: YonlendirmeDurumu;
  /** Who resolved it, if tamamlandi */
  tamamlayanKisi?: string;
}

export const MOCK_YONLENDIRMELER: Yonlendirme[] = [
  {
    id: "yon1",
    firmaId: "f3",
    kaynakBirim: "satis",
    hedefBirim: "muhasebe",
    gonderen: "Mehmet Y.",
    aciklama: "Sözleşme yenileme fiyatlandırması için maliyet bilgisi gerekiyor",
    tarih: "1 gün önce",
    durum: "bekliyor",
  },
  {
    id: "yon2",
    firmaId: "f3",
    kaynakBirim: "operasyon",
    hedefBirim: "satis",
    gonderen: "Ali K.",
    aciklama: "Personel eksikliği kritik seviyede — müşteri ile görüşme gerekli",
    tarih: "2 gün önce",
    durum: "bekliyor",
  },
  {
    id: "yon3",
    firmaId: "f1",
    kaynakBirim: "operasyon",
    hedefBirim: "muhasebe",
    gonderen: "Ahmet B.",
    aciklama: "Mart dönemi puantajlar tamamlandı, faturalama başlayabilir",
    tarih: "3 gün önce",
    durum: "bekliyor",
  },
  {
    id: "yon4",
    firmaId: "f1",
    kaynakBirim: "satis",
    hedefBirim: "operasyon",
    gonderen: "Mehmet Y.",
    aciklama: "Ek protokol onaylandı, personel ataması başlatılabilir",
    tarih: "5 gün önce",
    durum: "tamamlandi",
    tamamlayanKisi: "Ahmet B.",
  },
  {
    id: "yon5",
    firmaId: "f8",
    kaynakBirim: "yonetim",
    hedefBirim: "satis",
    gonderen: "Yönetici",
    aciklama: "Ödeme durumu netleştirilmeli, müşteri ile temas kurulmalı",
    tarih: "2 gün önce",
    durum: "bekliyor",
  },
];

/**
 * Helper: derive organizational unit from BPS role.
 * In production this would come from user profile; in demo it maps directly.
 */
export function birimFromRole(role: string): BirimKodu {
  switch (role) {
    case "operasyon": return "operasyon";
    case "satis": return "satis";
    case "ik": return "ik";
    case "muhasebe": return "muhasebe";
    case "yonetici": return "yonetim";
    default: return "yonetim";
  }
}
