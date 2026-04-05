/** Aktif İş Gücü risk levels per STATUS_DICTIONARY §8 */
export type IsGucuRiskSeviyesi = "stabil" | "takip_gerekli" | "kritik_acik";

/** Evrak categories per STATUS_DICTIONARY §15 */
export type EvrakKategorisi =
  | "cerceve_sozlesme"
  | "ek_protokol"
  | "yetki_belgesi"
  | "operasyon_evraki"
  | "teklif_dosyasi"
  | "ziyaret_tutanagi"
  | "diger";

export const KATEGORI_LABELS: Record<EvrakKategorisi, string> = {
  cerceve_sozlesme: "Çerçeve Sözleşme",
  ek_protokol: "Ek Protokol",
  yetki_belgesi: "Yetki Belgesi",
  operasyon_evraki: "Operasyon Evrakı",
  teklif_dosyasi: "Teklif Dosyası",
  ziyaret_tutanagi: "Ziyaret Tutanağı",
  diger: "Diğer",
};

export const IS_GUCU_RISK_LABELS: Record<IsGucuRiskSeviyesi, string> = {
  stabil: "Stabil",
  takip_gerekli: "Takip Gerekli",
  kritik_acik: "Kritik Açık",
};
