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

export function formatTRY(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "—";

  const raw = typeof value === "number" ? String(value) : value.trim();
  if (raw === "") return "—";

  // Strip currency symbol, whitespace, and any letters (e.g. a trailing
  // "TL"). Numeric-only remainder is what we try to parse.
  const cleaned = raw
    .replace(/₺/g, "")
    .replace(/[A-Za-zğüşıöçĞÜŞİÖÇ]/g, "")
    .trim();

  if (cleaned === "") return "—";

  // BPS uses Turkish number notation end-to-end: "." groups thousands,
  // "," is the decimal separator. Normalize to JS-parseable form.
  const normalized = cleaned.replace(/\./g, "").replace(",", ".");

  const num = Number.parseFloat(normalized);
  if (!Number.isFinite(num)) {
    // Input was not a parseable number — return the original string
    // unchanged so the user still sees what was stored.
    return typeof value === "number" ? String(value) : value;
  }

  return (
    "₺" +
    num.toLocaleString("tr-TR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}
