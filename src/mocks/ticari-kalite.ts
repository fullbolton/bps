/**
 * Tahmini Ticari Kalite — flat position-type assumption table and helpers.
 * Management-visibility layer only. Not accounting truth. Not a pricing engine.
 *
 * Both cost and billed values are yönetim varsayımları (management assumptions)
 * per position type. They are INTERNAL to this mock — never exposed in any UI surface.
 * Only the resulting MarjBandi label reaches user-facing components.
 */

import type { MarjBandi } from "@/types/ticari-kalite";
import { MOCK_TALEPLER } from "./talepler";
import { MOCK_SOZLESMELER } from "./sozlesmeler";

// ---------------------------------------------------------------------------
// Internal: position-type assumption table (never exported to UI)
// ---------------------------------------------------------------------------

interface PozisyonVarsayimi {
  /** Approximate total employer cost per worker/month — management assumption */
  tahminiMaliyet: number;
  /** Approximate billed unit price per worker/month — management assumption */
  tahminiBirimFiyat: number;
  /** Pre-computed band from the two assumptions above */
  marjBandi: MarjBandi;
}

/**
 * Position-type → assumption mapping.
 * Keys match MOCK_TALEPLER pozisyon strings exactly.
 *
 * Band logic (internal, not exposed):
 *   margin ratio = (billed - cost) / billed
 *   >= 0.20 → saglikli
 *   >= 0.08 → dar
 *   < 0.08  → riskli
 */
const POZISYON_VARSAYIMLARI: Record<string, PozisyonVarsayimi> = {
  "Güvenlik Görevlisi": { tahminiMaliyet: 22000, tahminiBirimFiyat: 30000, marjBandi: "saglikli" },
  "Forklift Operatörü": { tahminiMaliyet: 24000, tahminiBirimFiyat: 33000, marjBandi: "saglikli" },
  "Saha Teknisyeni":    { tahminiMaliyet: 28000, tahminiBirimFiyat: 38000, marjBandi: "saglikli" },
  "Elektrik Teknisyeni": { tahminiMaliyet: 30000, tahminiBirimFiyat: 40000, marjBandi: "saglikli" },
  "Kamera Operatörü":   { tahminiMaliyet: 23000, tahminiBirimFiyat: 31000, marjBandi: "saglikli" },
  "Kalite Kontrol":     { tahminiMaliyet: 21000, tahminiBirimFiyat: 28000, marjBandi: "saglikli" },
  "Temizlik Personeli":  { tahminiMaliyet: 18000, tahminiBirimFiyat: 21000, marjBandi: "dar" },
  "Paketleme Operatörü": { tahminiMaliyet: 19000, tahminiBirimFiyat: 22000, marjBandi: "dar" },
  "Depo İşçisi":        { tahminiMaliyet: 18500, tahminiBirimFiyat: 21500, marjBandi: "dar" },
  "Garson":             { tahminiMaliyet: 17000, tahminiBirimFiyat: 18000, marjBandi: "riskli" },
};

// ---------------------------------------------------------------------------
// Contract-level margin band lookup
// ---------------------------------------------------------------------------

/**
 * Returns the estimated margin band for a contract.
 * Uses the contract's firmaId to find related demands (MOCK_TALEPLER),
 * collects position types, looks up each position's band, and returns
 * the **worst band** across all positions.
 *
 * Returns null if:
 * - Contract is not aktif
 * - Firm has no demands with known position types
 */
export function getContractMarjBandi(sozlesmeId: string): MarjBandi | null {
  const sozlesme = MOCK_SOZLESMELER.find((s) => s.id === sozlesmeId);
  if (!sozlesme || sozlesme.durum !== "aktif") return null;

  const firmaTalepler = MOCK_TALEPLER.filter((t) => t.firmaId === sozlesme.firmaId);
  if (firmaTalepler.length === 0) return null;

  const BAND_ORDER: Record<MarjBandi, number> = { riskli: 0, dar: 1, saglikli: 2 };
  let worstBand: MarjBandi | null = null;

  for (const talep of firmaTalepler) {
    const varsayim = POZISYON_VARSAYIMLARI[talep.pozisyon];
    if (!varsayim) continue;
    if (worstBand === null || BAND_ORDER[varsayim.marjBandi] < BAND_ORDER[worstBand]) {
      worstBand = varsayim.marjBandi;
    }
  }

  return worstBand;
}

// ---------------------------------------------------------------------------
// Firma-level commercial quality summary
// ---------------------------------------------------------------------------

export interface FirmaTicariKaliteOzeti {
  saglikli: number;
  dar: number;
  riskli: number;
  /** Worst band across all active contracts, or null if no data */
  enKotuBant: MarjBandi | null;
}

/**
 * Returns a summary of margin band distribution across a firm's active contracts.
 * Each active contract gets its band from getContractMarjBandi().
 */
export function getFirmaTicariKaliteOzeti(firmaId: string): FirmaTicariKaliteOzeti {
  const firmaSozlesmeler = MOCK_SOZLESMELER.filter(
    (s) => s.firmaId === firmaId && s.durum === "aktif"
  );

  const result: FirmaTicariKaliteOzeti = {
    saglikli: 0,
    dar: 0,
    riskli: 0,
    enKotuBant: null,
  };

  const BAND_ORDER: Record<MarjBandi, number> = { riskli: 0, dar: 1, saglikli: 2 };

  for (const s of firmaSozlesmeler) {
    const band = getContractMarjBandi(s.id);
    if (!band) continue;
    result[band]++;
    if (result.enKotuBant === null || BAND_ORDER[band] < BAND_ORDER[result.enKotuBant]) {
      result.enKotuBant = band;
    }
  }

  return result;
}
