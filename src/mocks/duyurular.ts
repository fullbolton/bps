/**
 * Batch 10 Phase 2 — Management announcements (yönetici duyuruları).
 * One-directional. Not a conversation. Not a task assignment.
 */

export interface Duyuru {
  id: string;
  baslik: string;
  icerik: string;
  tarih: string;
  bagliKayit?: string;
}

export const MOCK_DUYURULAR: Duyuru[] = [
  {
    id: "duy1",
    baslik: "Bu hafta evrak eksikliklerini kapatın",
    icerik: "Tüm firmalardaki eksik evraklar cuma gününe kadar tamamlanmalı. Öncelikli firmalar: Başkent Güvenlik, Ege Temizlik.",
    tarih: "1 gün önce",
  },
  {
    id: "duy2",
    baslik: "Başkent Güvenlik ödeme takibi öncelikli",
    icerik: "Ödeme planı bu hafta netleştirilmeli. Satış ekibi müşteriyle temasa geçsin.",
    tarih: "2 gün önce",
    bagliKayit: "Başkent Güvenlik Ltd.",
  },
  {
    id: "duy3",
    baslik: "Yeni dönem sözleşme yenilemeleri başlıyor",
    icerik: "Nisan ayında süresi dolan sözleşmeler için yenileme süreçlerini başlatın.",
    tarih: "3 gün önce",
  },
];
