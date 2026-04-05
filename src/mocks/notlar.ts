/**
 * Mock data for Firma Notlar tab.
 * Firm-scoped institutional memory. Not chat. Not CRM.
 * Display-only demo data — local state in page component.
 */

export type NotEtiketi = "genel" | "odeme" | "sozlesme" | "operasyon" | "evrak" | "gorusme";

export const NOT_ETIKET_LABELS: Record<NotEtiketi, string> = {
  genel: "Genel",
  odeme: "Ödeme",
  sozlesme: "Sözleşme",
  operasyon: "Operasyon",
  evrak: "Evrak",
  gorusme: "Görüşme",
};

export interface MockNot {
  id: string;
  firmaId: string;
  icerik: string;
  yazan: string;
  tarih: string;
  etiket?: NotEtiketi;
  sabitlendi: boolean;
}

export const MOCK_NOTLAR: MockNot[] = [
  // f1 — Anadolu Lojistik A.Ş.
  {
    id: "not1",
    firmaId: "f1",
    icerik: "Müşteri memnuniyet anketi olumlu sonuçlandı. Yenileme döneminde referans olarak kullanılabilir.",
    yazan: "Zeynep A.",
    tarih: "2026-03-30",
    etiket: "genel",
    sabitlendi: true,
  },
  {
    id: "not2",
    firmaId: "f1",
    icerik: "Yeni hat için kapasite değerlendirmesi yapıldı. Ek 5 forklift operatörü talebi bekleniyor.",
    yazan: "Ahmet B.",
    tarih: "2026-03-25",
    etiket: "operasyon",
    sabitlendi: false,
  },
  {
    id: "not3",
    firmaId: "f1",
    icerik: "Depo operasyon ek protokolü kış döneminde kapatılacak. Personel ataması tamamlandı.",
    yazan: "Ahmet B.",
    tarih: "2026-02-05",
    etiket: "sozlesme",
    sabitlendi: false,
  },

  // f2 — Ege Temizlik Hizmetleri
  {
    id: "not4",
    firmaId: "f2",
    icerik: "Ödeme gecikmesi hakkında müşteriden bilgi alındı. 15 gün içinde ödeme planı sunulacak.",
    yazan: "Burak Ş.",
    tarih: "2026-03-20",
    etiket: "odeme",
    sabitlendi: true,
  },
  {
    id: "not5",
    firmaId: "f2",
    icerik: "İş sağlığı sertifikası eksiklikleri için İK ile koordinasyon başlatıldı.",
    yazan: "Burak Ş.",
    tarih: "2026-03-15",
    etiket: "evrak",
    sabitlendi: false,
  },

  // f3 — Başkent Güvenlik Ltd.
  {
    id: "not6",
    firmaId: "f3",
    icerik: "Sözleşme yenileme görüşmesi planlandı. Fiyat revizyonu bekleniyor.",
    yazan: "Mehmet Y.",
    tarih: "2026-03-30",
    etiket: "sozlesme",
    sabitlendi: true,
  },
  {
    id: "not7",
    firmaId: "f3",
    icerik: "Ödeme planı talep edildi. Müşteri 30 gün içinde taksitli ödeme önerdi.",
    yazan: "Mehmet Y.",
    tarih: "2026-03-28",
    etiket: "odeme",
    sabitlendi: false,
  },
  {
    id: "not8",
    firmaId: "f3",
    icerik: "Personel eksikliği kritik seviyede. Acil güvenlik görevlisi ataması gerekiyor.",
    yazan: "Ali K.",
    tarih: "2026-03-25",
    etiket: "operasyon",
    sabitlendi: true,
  },
  {
    id: "not9",
    firmaId: "f3",
    icerik: "Evrak eksiklikleri konusunda müşteri bilgilendirildi. 1 hafta süre verildi.",
    yazan: "Mehmet Y.",
    tarih: "2026-03-20",
    etiket: "evrak",
    sabitlendi: false,
  },

  // f5 — Marmara Gıda San. Tic.
  {
    id: "not10",
    firmaId: "f5",
    icerik: "Yeni dönem paketleme personeli oryantasyonu tamamlandı.",
    yazan: "Zeynep A.",
    tarih: "2026-03-18",
    etiket: "operasyon",
    sabitlendi: false,
  },

  // f8 — İç Anadolu Enerji
  {
    id: "not11",
    firmaId: "f8",
    icerik: "Sözleşme uzatma görüşmeleri başlatıldı. Müşteri olumlu yaklaşıyor.",
    yazan: "Elif Y.",
    tarih: "2026-03-22",
    etiket: "gorusme",
    sabitlendi: false,
  },
  {
    id: "not12",
    firmaId: "f8",
    icerik: "Saha ekibi rotasyon planı güncellendi. 2 yeni teknisyen ataması yapıldı.",
    yazan: "Elif Y.",
    tarih: "2026-03-15",
    etiket: "operasyon",
    sabitlendi: false,
  },
];
