/** Single-day planning rules. Not an authorization or database concurrency boundary. */
export type DemandLifecycle = "active" | "paused" | "cancelled";
export type DailyDemandInput = {
  companyId: string; locationId: string; serviceLine: string;
  position: string; workDate: string; requiredCount: number;
};
export type FieldErrors = Partial<Record<keyof DailyDemandInput, string>>;

export function isWorkDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  if (value.startsWith("0000-")) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function validateDailyDemand(input: unknown):
  | { ok: true; value: DailyDemandInput }
  | { ok: false; errors: FieldErrors } {
  const raw = input && typeof input === "object" ? input as Record<string, unknown> : {};
  const errors: FieldErrors = {};
  const labels = { companyId: "Firma", locationId: "Lokasyon", serviceLine: "Hizmet hattı", position: "Pozisyon" };
  const text = {} as Record<keyof typeof labels, string>;
  for (const field of Object.keys(labels) as (keyof typeof labels)[]) {
    const value = raw[field];
    text[field] = typeof value === "string" ? value.trim() : "";
    if (!text[field]) errors[field] = `${labels[field]} zorunludur.`;
  }
  if (!isWorkDate(raw.workDate)) errors.workDate = "Geçerli bir gün seçin.";
  if (typeof raw.requiredCount !== "number" || !Number.isSafeInteger(raw.requiredCount) || raw.requiredCount < 1) {
    errors.requiredCount = "Kişi sayısı pozitif bir tam sayı olmalıdır.";
  }
  if (Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, value: { ...text, workDate: raw.workDate as string, requiredCount: raw.requiredCount as number } };
}

export function deriveDailyCoverage(required: number, assigned: number, lifecycle: DemandLifecycle) {
  if (!Number.isSafeInteger(required) || required < 1 || !Number.isSafeInteger(assigned) || assigned < 0 || assigned > required) {
    throw new Error("Geçersiz günlük kapasite verisi.");
  }
  if (!["active", "paused", "cancelled"].includes(lifecycle)) throw new Error("Geçersiz talep yaşam durumu.");
  if (lifecycle === "cancelled" && assigned !== 0) throw new Error("İptal talebinde aktif atama bulunamaz.");
  const open = required - assigned;
  return {
    required, assigned, open,
    activeOpen: lifecycle === "active" ? open : 0,
    state: assigned === 0 ? "unassigned" as const : open === 0 ? "assigned" as const : "partial" as const,
  };
}

export type AssignmentCheck = {
  companyActive: boolean; locationActive: boolean; workerActive: boolean;
  workerBookedOnDay: boolean; lifecycle: DemandLifecycle;
  requiredCount: number; assignedCount: number;
};
export type AssignmentFailure = "UNVERIFIABLE" | "INACTIVE_COMPANY" | "INACTIVE_LOCATION" |
  "INACTIVE_WORKER" | "REQUEST_NOT_ACTIVE" | "WORKER_CONFLICT" | "CAPACITY_FULL";

export function checkAssignment(input: AssignmentCheck): { ok: true } | { ok: false; code: AssignmentFailure } {
  if (!input || [input.companyActive, input.locationActive, input.workerActive, input.workerBookedOnDay]
    .some(value => typeof value !== "boolean")) return { ok: false, code: "UNVERIFIABLE" };
  try { deriveDailyCoverage(input.requiredCount, input.assignedCount, input.lifecycle); }
  catch { return { ok: false, code: "UNVERIFIABLE" }; }
  if (!input.companyActive) return { ok: false, code: "INACTIVE_COMPANY" };
  if (!input.locationActive) return { ok: false, code: "INACTIVE_LOCATION" };
  if (!input.workerActive) return { ok: false, code: "INACTIVE_WORKER" };
  if (input.lifecycle !== "active") return { ok: false, code: "REQUEST_NOT_ACTIVE" };
  if (input.workerBookedOnDay) return { ok: false, code: "WORKER_CONFLICT" };
  if (input.assignedCount >= input.requiredCount) return { ok: false, code: "CAPACITY_FULL" };
  return { ok: true };
}
