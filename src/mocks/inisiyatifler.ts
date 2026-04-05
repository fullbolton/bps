/**
 * Mock data for Yönetici İnisiyatifleri — bounded phase.
 * Yönetici-owned attention bookmarks. Not tasks. Not projects.
 * Display-only demo data — local state in page component.
 */

import type { InisiyatifDurumu } from "@/types/inisiyatif";

export interface Inisiyatif {
  id: string;
  baslik: string;
  kisaAmac?: string;
  ilgiliKisi?: string;
  hedefTarih?: string;
  /** Optional single firma link */
  firmaId?: string;
  firmaAdi?: string;
  yoneticiNotu?: string;
  durum: InisiyatifDurumu;
}

export const MOCK_INISIYATIFLER: Inisiyatif[] = [
  {
    id: "ini1",
    baslik: "Başkent Güvenlik yenileme sürecini bu hafta kapat",
    kisaAmac: "Sözleşme yenileme, ödeme planı ve personel eksikliği birlikte çözülmeli",
    ilgiliKisi: "Mehmet Y.",
    hedefTarih: "2026-04-07",
    firmaId: "f3",
    firmaAdi: "Başkent Güvenlik Ltd.",
    yoneticiNotu: "Ödeme planı görüşmesi yapıldı, revize teklif bekleniyor",
    durum: "aktif",
  },
  {
    id: "ini2",
    baslik: "Nisan sonu sözleşme yenilemelerini takip et",
    kisaAmac: "Süresi dolan sözleşmeler için yenileme durumları güncel olmalı",
    hedefTarih: "2026-04-30",
    yoneticiNotu: "Marmara Gıda ve İç Anadolu Enerji öncelikli",
    durum: "aktif",
  },
  {
    id: "ini3",
    baslik: "İç Anadolu Enerji ticari ilişkiyi izle",
    kisaAmac: "Ödeme davranışı ve personel istikrarı birlikte değerlendirilmeli",
    ilgiliKisi: "Elif Y.",
    firmaId: "f8",
    firmaAdi: "İç Anadolu Enerji",
    durum: "aktif",
  },
  {
    id: "ini4",
    baslik: "Evrak eksikliklerini Mart sonuna kadar kapat",
    kisaAmac: "Tüm firmalarda kritik evrak eksiklikleri giderilmeli",
    ilgiliKisi: "Zeynep A.",
    hedefTarih: "2026-03-31",
    durum: "tamamlandi",
  },
  {
    id: "ini5",
    baslik: "Ege Temizlik ödeme gecikmesi — satış takibi",
    kisaAmac: "Ödeme gecikmesi hakkında müşteri ile temas",
    ilgiliKisi: "Burak Ş.",
    firmaId: "f2",
    firmaAdi: "Ege Temizlik Hizmetleri",
    hedefTarih: "2026-03-25",
    durum: "iptal",
  },
];

/**
 * Helper: get active inisiyatifler linked to a specific firma.
 * Used for the Company Detail subtle cue.
 */
export function getAktifInisiyatiflerByFirma(firmaId: string): Inisiyatif[] {
  return MOCK_INISIYATIFLER.filter(
    (i) => i.firmaId === firmaId && i.durum === "aktif"
  );
}
