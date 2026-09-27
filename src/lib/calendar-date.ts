import { istanbulDay } from "./istanbul-day";

export function isIsoDate(value: string | null | undefined): value is string {
  if (!value) return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const t = Date.parse(`${value}T00:00:00Z`);
  if (!Number.isFinite(t)) return false;
  // ROUND-TRIP ZORUNLU. `Date.parse` takvimde olmayan günleri reddetmez,
  // SESSİZCE KAYDIRIR: "2026-02-30" NaN değil, 2026-03-02 olur (ölçüldü).
  // Yalnız `Number.isFinite` bakan bir kontrol, olmayan bir tarihi geçerli
  // sayar ve o görevi iki gün geç "gecikmiş" gösterirdi.
  return new Date(t).toISOString().slice(0, 10) === value;
}

/** Completed calendar-day difference in the application's Istanbul timezone. */
export function computeRemainingDays(endDate: string | null | undefined, now = new Date()): number | null {
  if (!isIsoDate(endDate) || !Number.isFinite(now.getTime())) return null;
  return Math.round((Date.parse(`${endDate}T00:00:00Z`) - Date.parse(`${istanbulDay(now)}T00:00:00Z`)) / 86_400_000);
}
