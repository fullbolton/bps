/**
 * Turkish currency formatting for BPS management-visibility surfaces.
 *
 * Parses a stored contract/financial string value (which may arrive as
 * raw-numeric "380000", Turkish-formatted "380.000,50", or already
 * ₺-prefixed "₺380.000,00") and returns a consistent ₺X.XXX,XX display.
 *
 * Contract values are stored as free-text in BPS, so this helper is
 * tolerant: on anything it cannot parse it returns the original string
 * so the user still sees their data — honest fallback over hidden loss.
 *
 * Presentation-only. Not a monetary-precision library.
 */

// Strict Turkish notation: "380.000,50" (grouped), "380000" / "380000,5"
// (raw numeric with optional decimal comma). Anything else — notably an
// EN-formatted "1,200,000.50" — must NOT be dot-stripped into a wrong
// amount; it falls through to the honest fallback instead.
const TR_NUMBER_SHAPE = /^(?:\d{1,3}(?:\.\d{3})*|\d+)(?:,\d+)?$/;

export function formatTRY(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "—";

  // A real number needs no string round-trip — the old String(n) path
  // dot-stripped the decimal point ("1234.56" → 123456).
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return "—";
    return (
      "₺" +
      value.toLocaleString("tr-TR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    );
  }

  const raw = value.trim();
  if (raw === "") return "—";

  // Strip currency symbol, whitespace, and any letters (e.g. a trailing
  // "TL"). Numeric-only remainder is what we try to parse.
  const cleaned = raw
    .replace(/₺/g, "")
    .replace(/[A-Za-zğüşıöçĞÜŞİÖÇ]/g, "")
    .trim();

  // BPS uses Turkish number notation end-to-end: "." groups thousands,
  // "," is the decimal separator. Only a string that fully matches that
  // shape is normalized — parseFloat's partial-parse ("12abc" → 12,
  // "1,200,000.50" → 1.2) silently produced wrong amounts before.
  if (cleaned === "" || !TR_NUMBER_SHAPE.test(cleaned)) {
    // Not unambiguously parseable — return the original string
    // unchanged so the user still sees what was stored.
    return value;
  }

  const num = Number.parseFloat(cleaned.replace(/\./g, "").replace(",", "."));
  if (!Number.isFinite(num)) {
    return value;
  }

  return (
    "₺" +
    num.toLocaleString("tr-TR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}
