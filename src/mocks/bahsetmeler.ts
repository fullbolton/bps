/**
 * Batch 10 Phase 1 — Record-context mentions (bahsetmeler).
 * A mention is a directed coordination signal attached to a company record.
 * Not a conversation thread. Not a note. Not a task.
 */

export interface Bahsetme {
  id: string;
  firmaId: string;
  gonderen: string;
  alici: string;
  mesaj: string;
  tarih: string;
  /** Optional: linked record context (e.g., contract name, task title) */
  bagliKayit?: string;
}

export const MOCK_BAHSETMELER: Bahsetme[] = [
  {
    id: "bhs1",
    firmaId: "f1",
    gonderen: "Ahmet B.",
    alici: "Mehmet Y.",
    mesaj: "Sözleşme yenileme teklifi hazır, müşteriyle paylaşalım mı?",
    tarih: "2 saat önce",
    bagliKayit: "Lojistik Hizmet Sözleşmesi 2026",
  },
  {
    id: "bhs2",
    firmaId: "f1",
    gonderen: "Zeynep A.",
    alici: "Elif K.",
    mesaj: "SGK bildirge evrakları tamamlandı, kontrol eder misin?",
    tarih: "1 gün önce",
  },
  {
    id: "bhs3",
    firmaId: "f3",
    gonderen: "Mehmet Y.",
    alici: "Ali K.",
    mesaj: "Ödeme planı görüşmesi sonrası revize teklif bugün gitmeli.",
    tarih: "3 saat önce",
    bagliKayit: "Ana Güvenlik Sözleşmesi",
  },
  {
    id: "bhs4",
    firmaId: "f3",
    gonderen: "Yönetici",
    alici: "Mehmet Y.",
    mesaj: "Başkent Güvenlik yenileme sürecini bu hafta kapatmamız gerekiyor.",
    tarih: "1 gün önce",
  },
  {
    id: "bhs5",
    firmaId: "f2",
    gonderen: "Burak Ş.",
    alici: "Ayşe D.",
    mesaj: "Ödeme gecikmesi hakkında müşteriden dönüş geldi, not ekledim.",
    tarih: "2 gün önce",
  },
];
