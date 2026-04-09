/**
 * BPS — Critical date type extraction module (Phase 4B).
 *
 * Mirrors the CHECK constraints on critical_dates.date_type and
 * critical_dates.priority in
 * supabase/migrations/20260407001100_create_critical_dates.sql.
 *
 * Status (KritikTarihDurumu) is DERIVED — it is never stored in the DB.
 * The derivation helper `deriveDeadlineStatus` computes it from
 * deadline_date at read time.
 */

export type CriticalDateType =
  | "lisans"
  | "izin"
  | "ruhsat"
  | "ihale"
  | "tescil"
  | "diger";

export const CRITICAL_DATE_TYPE_LABELS: Record<CriticalDateType, string> = {
  lisans: "Lisans",
  izin: "Izin",
  ruhsat: "Ruhsat",
  ihale: "Ihale",
  tescil: "Tescil",
  diger: "Diger",
};

export type CriticalDatePriority = "normal" | "yuksek" | "kritik";

export const CRITICAL_DATE_PRIORITY_LABELS: Record<CriticalDatePriority, string> = {
  normal: "Normal",
  yuksek: "Yuksek",
  kritik: "Kritik",
};

/** Derived status — NEVER persisted. */
export type CriticalDateStatus = "aktif" | "suresi_yaklsiyor" | "suresi_doldu";

/**
 * Compute remaining days from today to a deadline date.
 * Negative = overdue. Zero or positive = remaining.
 */
export function computeRemainingDays(deadlineDate: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const deadline = new Date(deadlineDate);
  deadline.setHours(0, 0, 0, 0);
  return Math.ceil((deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Derive the status from the deadline date. This is NEVER stored.
 *   - < 0 days remaining → suresi_doldu
 *   - 0..30 days remaining → suresi_yaklsiyor
 *   - > 30 days remaining → aktif
 */
export function deriveDeadlineStatus(deadlineDate: string): CriticalDateStatus {
  const remaining = computeRemainingDays(deadlineDate);
  if (remaining < 0) return "suresi_doldu";
  if (remaining <= 30) return "suresi_yaklsiyor";
  return "aktif";
}
