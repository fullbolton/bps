import type { EvrakDurumu } from "@/types/ui";

export function isDocumentValidityDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith("0000-")) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/** Preserve the upload flow's UTC-day / inclusive 30-day warning convention. */
export function documentStatusForFile(validityDate: string | null, now = new Date()): EvrakDurumu {
  if (!validityDate) return "tam";
  if (!isDocumentValidityDate(validityDate)) throw new Error("Geçersiz belge tarihi.");
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const days = (new Date(`${validityDate}T00:00:00Z`).getTime() - today) / 86400000;
  return days < 0 ? "suresi_doldu" : days <= 30 ? "suresi_yaklsiyor" : "tam";
}
