/**
 * Mock data for Kurumsal Kritik Tarihler / Belgeler Görünürlüğü V1.
 * Company-wide critical date/deadline visibility.
 * Not firm-scoped. Not document management. Not compliance software.
 */

export type KurumsalBelgeTuru = "lisans" | "izin" | "ruhsat" | "ihale" | "tescil" | "diger";

export const BELGE_TURU_LABELS: Record<KurumsalBelgeTuru, string> = {
  lisans: "Lisans",
  izin: "İzin",
  ruhsat: "Ruhsat",
  ihale: "İhale",
  tescil: "Tescil",
  diger: "Diğer",
};

export type KurumsalOncelik = "normal" | "yuksek" | "kritik";

export const ONCELIK_LABELS: Record<KurumsalOncelik, string> = {
  normal: "Normal",
  yuksek: "Yüksek",
  kritik: "Kritik",
};

export type KurumsalBelgeDurumu = "aktif" | "suresi_yaklsiyor" | "suresi_doldu";

export interface MockKurumsalBelge {
  id: string;
  baslik: string;
  tur: KurumsalBelgeTuru;
  bitisTarihi: string;
  durum: KurumsalBelgeDurumu;
  sorumlu: string;
  oncelik: KurumsalOncelik;
  kisaNot?: string;
}

/**
 * Compute remaining days from today to bitisTarihi.
 * Negative = overdue. Zero or positive = remaining.
 */
export function kalanGunHesapla(bitisTarihi: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const bitis = new Date(bitisTarihi);
  bitis.setHours(0, 0, 0, 0);
  return Math.ceil((bitis.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

/** Mutable: updated by kurumsal-tarihler page mutations for cross-surface consistency. */
export let MOCK_KURUMSAL_BELGELER: MockKurumsalBelge[] = [
  {
    id: "kb1",
    baslik: "İSG Yetki Belgesi",
    tur: "ruhsat",
    bitisTarihi: "2026-04-20",
    durum: "suresi_yaklsiyor",
    sorumlu: "Yönetici Kullanıcı",
    oncelik: "kritik",
    kisaNot: "Yenileme başvurusu yapılmalı, 15 gün kaldı",
  },
  {
    id: "kb2",
    baslik: "Özel İstihdam Bürosu Lisansı",
    tur: "lisans",
    bitisTarihi: "2026-06-30",
    durum: "aktif",
    sorumlu: "Yönetici Kullanıcı",
    oncelik: "kritik",
    kisaNot: "Çalışma ve Sosyal Güvenlik Bakanlığı onaylı",
  },
  {
    id: "kb3",
    baslik: "Ticaret Sicil Kaydı Yenileme",
    tur: "tescil",
    bitisTarihi: "2026-05-15",
    durum: "suresi_yaklsiyor",
    sorumlu: "Ahmet B.",
    oncelik: "yuksek",
  },
  {
    id: "kb4",
    baslik: "SGK İşyeri Tescil Belgesi",
    tur: "tescil",
    bitisTarihi: "2027-01-01",
    durum: "aktif",
    sorumlu: "Yönetici Kullanıcı",
    oncelik: "normal",
  },
  {
    id: "kb5",
    baslik: "Kamu İhale — Belediye Temizlik Hizmeti",
    tur: "ihale",
    bitisTarihi: "2026-04-10",
    durum: "suresi_yaklsiyor",
    sorumlu: "Mehmet Y.",
    oncelik: "kritik",
    kisaNot: "Son başvuru tarihi yaklaşıyor, dosya hazırlanmalı",
  },
  {
    id: "kb6",
    baslik: "İş Güvenliği Uzmanı Sertifikası",
    tur: "ruhsat",
    bitisTarihi: "2026-03-28",
    durum: "suresi_doldu",
    sorumlu: "Zeynep A.",
    oncelik: "yuksek",
    kisaNot: "Süresi dolmuş — acil yenileme gerekli",
  },
  {
    id: "kb7",
    baslik: "Çevre İzin Belgesi",
    tur: "izin",
    bitisTarihi: "2026-12-31",
    durum: "aktif",
    sorumlu: "Ahmet B.",
    oncelik: "normal",
  },
  {
    id: "kb8",
    baslik: "Yangın Güvenlik Sertifikası",
    tur: "ruhsat",
    bitisTarihi: "2026-04-25",
    durum: "suresi_yaklsiyor",
    sorumlu: "Elif Y.",
    oncelik: "yuksek",
    kisaNot: "İtfaiye denetimi sonrası yenilenmeli",
  },
  {
    id: "kb9",
    baslik: "Vergi Levhası Güncelleme",
    tur: "tescil",
    bitisTarihi: "2026-08-01",
    durum: "aktif",
    sorumlu: "Yönetici Kullanıcı",
    oncelik: "normal",
  },
];

/**
 * Sync helper: updates the shared module-level array so Dashboard and page read the same truth.
 */
export function updateKurumsalBelgeler(updated: MockKurumsalBelge[]) {
  MOCK_KURUMSAL_BELGELER = updated;
}
