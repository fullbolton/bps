/**
 * Mock data for Firma Yetkili Kişileri.
 * Firm-scoped contact records. Not a CRM. Not a people directory.
 * Max 5 per firma. Exactly one anaYetkili per firma.
 * Display-only demo data — local state in page component.
 */

export interface MockYetkili {
  id: string;
  firmaId: string;
  adSoyad: string;
  unvan?: string;
  telefon?: string;
  eposta?: string;
  anaYetkili: boolean;
  kisaNotlar?: string;
}

/** Mutable: updated by Firma Detay yetkili mutations for cross-surface consistency. */
export let MOCK_YETKILILER: MockYetkili[] = [
  // f1 — Anadolu Lojistik A.Ş. (3 contacts)
  {
    id: "ytk1",
    firmaId: "f1",
    adSoyad: "Mehmet Yılmaz",
    unvan: "Genel Müdür",
    telefon: "0532 111 0001",
    eposta: "mehmet.yilmaz@anadolulojistik.com",
    anaYetkili: true,
    kisaNotlar: "Sözleşme yenileme ve fiyatlama kararlarında muhatap",
  },
  {
    id: "ytk2",
    firmaId: "f1",
    adSoyad: "Selin Arslan",
    unvan: "Operasyon Müdürü",
    telefon: "0533 111 0002",
    eposta: "selin.arslan@anadolulojistik.com",
    anaYetkili: false,
    kisaNotlar: "Personel ataması ve saha koordinasyonu",
  },
  {
    id: "ytk3",
    firmaId: "f1",
    adSoyad: "Kemal Doğan",
    unvan: "İK Sorumlusu",
    telefon: "0534 111 0003",
    anaYetkili: false,
  },

  // f2 — Ege Temizlik Hizmetleri (2 contacts)
  {
    id: "ytk4",
    firmaId: "f2",
    adSoyad: "Ayşe Demir",
    unvan: "Genel Müdür",
    telefon: "0535 222 0001",
    eposta: "ayse.demir@egetemizlik.com",
    anaYetkili: true,
    kisaNotlar: "Ödeme konularında doğrudan muhatap",
  },
  {
    id: "ytk5",
    firmaId: "f2",
    adSoyad: "Hakan Çetin",
    unvan: "Saha Amiri",
    telefon: "0536 222 0002",
    anaYetkili: false,
  },

  // f3 — Başkent Güvenlik Ltd. (4 contacts)
  {
    id: "ytk6",
    firmaId: "f3",
    adSoyad: "Ali Kaya",
    unvan: "Yönetim Kurulu Üyesi",
    telefon: "0537 333 0001",
    eposta: "ali.kaya@baskentguvenlik.com",
    anaYetkili: true,
    kisaNotlar: "Stratejik kararlar ve sözleşme onayı",
  },
  {
    id: "ytk7",
    firmaId: "f3",
    adSoyad: "Derya Öztürk",
    unvan: "Operasyon Direktörü",
    telefon: "0538 333 0002",
    eposta: "derya.ozturk@baskentguvenlik.com",
    anaYetkili: false,
    kisaNotlar: "Günlük operasyon koordinasyonu",
  },
  {
    id: "ytk8",
    firmaId: "f3",
    adSoyad: "Murat Şen",
    unvan: "Güvenlik Müdürü",
    telefon: "0539 333 0003",
    anaYetkili: false,
  },
  {
    id: "ytk9",
    firmaId: "f3",
    adSoyad: "Fatma Aydın",
    unvan: "Muhasebe Sorumlusu",
    eposta: "fatma.aydin@baskentguvenlik.com",
    anaYetkili: false,
    kisaNotlar: "Fatura ve ödeme takibi",
  },

  // f5 — Marmara Gıda San. Tic. (2 contacts)
  {
    id: "ytk10",
    firmaId: "f5",
    adSoyad: "Hasan Öztürk",
    unvan: "Fabrika Müdürü",
    telefon: "0540 555 0001",
    eposta: "hasan.ozturk@marmaragida.com",
    anaYetkili: true,
  },
  {
    id: "ytk11",
    firmaId: "f5",
    adSoyad: "Elif Koç",
    unvan: "Üretim Sorumlusu",
    telefon: "0541 555 0002",
    anaYetkili: false,
    kisaNotlar: "Paketleme hattı personel koordinasyonu",
  },

  // f7 — Trakya Tekstil A.Ş. (1 contact)
  {
    id: "ytk12",
    firmaId: "f7",
    adSoyad: "Burak Şahin",
    unvan: "Patron",
    telefon: "0542 777 0001",
    eposta: "burak@trakyatekstil.com",
    anaYetkili: true,
  },

  // f8 — İç Anadolu Enerji (3 contacts)
  {
    id: "ytk13",
    firmaId: "f8",
    adSoyad: "Elif Yıldız",
    unvan: "İş Geliştirme Müdürü",
    telefon: "0543 888 0001",
    eposta: "elif.yildiz@icanadoluenerji.com",
    anaYetkili: true,
    kisaNotlar: "Sözleşme uzatma görüşmeleri",
  },
  {
    id: "ytk14",
    firmaId: "f8",
    adSoyad: "Okan Demir",
    unvan: "Saha Mühendisi",
    telefon: "0544 888 0002",
    anaYetkili: false,
  },
  {
    id: "ytk15",
    firmaId: "f8",
    adSoyad: "Gül Aksoy",
    unvan: "İK Uzmanı",
    eposta: "gul.aksoy@icanadoluenerji.com",
    anaYetkili: false,
    kisaNotlar: "Personel evrak takibi",
  },
];

export function replaceFirmaYetkililer(firmaId: string, updatedFirmaYetkilileri: MockYetkili[]) {
  MOCK_YETKILILER = [
    ...MOCK_YETKILILER.filter((y) => y.firmaId !== firmaId),
    ...updatedFirmaYetkilileri,
  ];
}

/**
 * Lookup helper: get the ana yetkili name for a firma from the yetkililer source.
 * Returns null if no yetkili data exists for the firma.
 */
export function getAnaYetkiliByFirma(firmaId: string): string | null {
  const yetkili = MOCK_YETKILILER.find((y) => y.firmaId === firmaId && y.anaYetkili);
  return yetkili?.adSoyad ?? null;
}
