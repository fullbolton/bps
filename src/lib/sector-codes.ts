/**
 * BPS — Sector code type extraction module (Sector Templates V1).
 *
 * Mirrors the sector_code UNIQUE constraint on sector_templates table.
 * Used by the company form sector dropdown and service layer.
 */

export type SectorCode =
  | "guvenlik"
  | "temizlik"
  | "personel_temin"
  | "osgb"
  | "lojistik"
  | "danismanlik"
  | "tesis_yonetimi"
  | "insaat";

export const SECTOR_LABELS: Record<SectorCode, string> = {
  guvenlik: "Ozel Guvenlik",
  temizlik: "Temizlik Hizmetleri",
  personel_temin: "Personel Temin",
  osgb: "OSGB / ISG",
  lojistik: "Lojistik",
  danismanlik: "Danismanlik",
  tesis_yonetimi: "Tesis Yonetimi",
  insaat: "Insaat Taseronu",
};

export const SECTOR_CODES = Object.keys(SECTOR_LABELS) as SectorCode[];
