/**
 * Types for Birimler Arası Koordinasyon / Yönlendirme Katmanı.
 *
 * A yönlendirme is a firma-attached coordination signal from one
 * organizational unit to another. It is not a task, not a mention,
 * and not a message.
 *
 * Unit (birim) is organizational affiliation, not authorization role.
 */

export type BirimKodu = "operasyon" | "satis" | "muhasebe" | "yonetim" | "ik";

export const BIRIM_LABELS: Record<BirimKodu, string> = {
  operasyon: "Operasyon",
  satis: "Satış",
  muhasebe: "Muhasebe",
  yonetim: "Yönetim",
  ik: "İK",
};

export type YonlendirmeDurumu = "bekliyor" | "tamamlandi";

export const YONLENDIRME_DURUM_LABELS: Record<YonlendirmeDurumu, string> = {
  bekliyor: "Bekliyor",
  tamamlandi: "Tamamlandı",
};
