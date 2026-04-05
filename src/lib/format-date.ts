/**
 * Turkish date display formatter.
 * Converts ISO date strings (YYYY-MM-DD) to Turkish DD.MM.YYYY format.
 * Display-only — does not change underlying stored values.
 */

/**
 * Format an ISO date string to Turkish DD.MM.YYYY.
 * Returns "—" for empty/null/undefined/invalid values.
 */
export function formatDateTR(dateStr: string | null | undefined): string {
  if (!dateStr || dateStr === "—" || dateStr === "") return "—";
  const parts = dateStr.split("-");
  if (parts.length !== 3) return dateStr; // Not ISO format, return as-is
  const [year, month, day] = parts;
  return `${day}.${month}.${year}`;
}
