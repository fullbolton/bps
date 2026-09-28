/**
 * Ticari Hesap Motoru — Teklif Hesaplayıcı engine.
 *
 * Black-box decision-support calculation:
 *   Net Ücret (günlük) + Hedef Kâr Oranı → Önerilen Teklif Bedeli
 *
 * The active parameter set is hardcoded (2026 rates).
 * No parameter UI. No admin panel. No effective-date logic.
 * Parameters are updated in code when government rates change.
 *
 * Formula backbone follows the existing spreadsheet assumptions (not re-verified here):
 *   Net → Brüt (reverse tax formula)
 *   Brüt → İşveren Maliyeti (+ SGK İşveren + İşsizlik İşveren)
 *   İşveren Maliyeti + ek kalemler → Toplam Maliyet
 *   Toplam Maliyet × (1 + Kâr %) → Teklif Bedeli
 *
 * Not payroll software. Not accounting software. Not a formula editor.
 */

// ---------------------------------------------------------------------------
// Active parameter set — 2026 (hardcoded, admin-maintained in code)
// ---------------------------------------------------------------------------

/** SGK İşveren toplam oranı (%) — from SGK Primleri 2026 reference */
const SGK_ISVEREN_TOPLAM = 23.75;

/** İşsizlik İşveren oranı (%) — counted separately in the SGK table */
const ISSIZLIK_ISVEREN = 2.0;

/** 5510 İndirimi (%) — employer SGK discount */
const INDIRIM_5510 = 2.0;

/**
 * Effective SGK İşveren rate applied to brüt:
 * Total employer SGK - İşsizlik (counted separately) - 5510 discount
 */
const SGK_ISVEREN_EFEKTIF = SGK_ISVEREN_TOPLAM - ISSIZLIK_ISVEREN - INDIRIM_5510;

/**
 * Net-to-Gross reverse formula constants.
 * These encode the combined effect of:
 *   - Employee SGK (14%)
 *   - Employee İşsizlik (1%)
 *   - Gelir Vergisi (15% on matrah, with asgari ücret istisnası)
 *   - Damga Vergisi (0.759%, with asgari ücret istisnası)
 *
 * When underlying rates or exemptions change, these must be recalculated.
 */
const BRUT_BASE = 1101;        // Daily gross minimum wage (brüt asgari ücret günlük)
const NET_FLOOR = 935.85;      // Net minimum wage after all deductions (net asgari ücret günlük)
const REVERSE_COEFF = 0.71491; // Combined employee deduction rate inverse

/** İSG/OSGB daily cost — regulatory, ₺300/month ÷ 30 */
const ISG_OSGB_GUNLUK = 10;

/** Default hedef kâr oranı (%) */
export const DEFAULT_KAR_ORANI = 16.5;
/** Applicability baseline of this stored model, not a claim about legal minimum pay. */
export const MIN_MODEL_NET_GUNLUK = NET_FLOOR;
export const TEKLIF_MODEL_NOTE = "Kodda 2026 olarak etiketlenmiş mevcut hesap varsayımları kullanılır; güncel oran/kaynak doğrulaması yapılmamıştır. Bordro hesabı veya kesin teklif değildir.";

/** Empty optional costs mean zero; malformed or missing required input stays invalid. */
export function parseTeklifAmount(value: string, optional = false): number {
  const trimmed = value.trim();
  if (!trimmed) return optional ? 0 : Number.NaN;
  return Number(trimmed);
}

// ---------------------------------------------------------------------------
// Calculation interface
// ---------------------------------------------------------------------------

export interface TeklifHesaplamaInput {
  /** Daily net amount to be paid to the worker (₺) */
  netUcretGunluk: number;
  /** Markup on total cost (%) */
  hedefKarOrani: number;
  /** Optional additional net payment per day (₺) */
  ekOdeme?: number;
  /** Optional daily meal cost (₺) */
  yemek?: number;
  /** Optional daily transport cost (₺) */
  servis?: number;
  /** Optional daily uniform/clothing cost (₺) */
  kiyafet?: number;
}

export interface TeklifHesaplamaOutput {
  /** Estimated total employer cost per day (₺) */
  tahminiIsverenMaliyeti: number;
  /** Profit amount per day (₺) */
  karTutari: number;
  /** Recommended offer amount per person per day, KDV hariç (₺) */
  onerilenTeklifBedeli: number;
}

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

/**
 * Calculate recommended offer price from net worker payment and cost markup.
 * Returns null outside the existing reverse-formula baseline or for invalid costs.
 */
export function hesaplaTeklifBedeli(
  input: TeklifHesaplamaInput,
): TeklifHesaplamaOutput | null {
  const { netUcretGunluk, hedefKarOrani, ekOdeme = 0, yemek = 0, servis = 0, kiyafet = 0 } = input;

  if (![netUcretGunluk, hedefKarOrani, ekOdeme, yemek, servis, kiyafet]
    .every(value => Number.isFinite(value) && value >= 0)) return null;
  if (netUcretGunluk < MIN_MODEL_NET_GUNLUK) return null;

  // Step 1: Net → Brüt (reverse tax formula)
  const brutUcret = BRUT_BASE + ((netUcretGunluk - NET_FLOOR) / REVERSE_COEFF);

  // Step 2: Gross up additional net payment if any
  const ekOdemeBrut = ekOdeme > 0 ? ekOdeme / REVERSE_COEFF : 0;

  // Step 3: Total gross
  const toplamBrut = brutUcret + ekOdemeBrut;

  // Step 4: Employer cost = Brüt + SGK İşveren + İşsizlik İşveren
  const sgkIsveren = toplamBrut * (SGK_ISVEREN_EFEKTIF / 100);
  const issizlikIsveren = toplamBrut * (ISSIZLIK_ISVEREN / 100);
  const isverenMaliyeti = toplamBrut + sgkIsveren + issizlikIsveren;

  // Step 5: Additional cost items
  const ekKalemler = yemek + servis + kiyafet + ISG_OSGB_GUNLUK;

  // Step 6: Total employer cost
  const toplamMaliyet = isverenMaliyeti + ekKalemler;

  // Step 7: Profit and offer price
  const karTutari = toplamMaliyet * (hedefKarOrani / 100);
  const teklifBedeli = toplamMaliyet + karTutari;

  // A finite input can still overflow multiplication or lose cent precision.
  if (![toplamMaliyet, karTutari, teklifBedeli].every(value =>
    Number.isFinite(value) && value >= 0 && value <= Number.MAX_SAFE_INTEGER / 100)) return null;

  return {
    tahminiIsverenMaliyeti: Math.round(toplamMaliyet * 100) / 100,
    karTutari: Math.round(karTutari * 100) / 100,
    onerilenTeklifBedeli: Math.round(teklifBedeli * 100) / 100,
  };
}
