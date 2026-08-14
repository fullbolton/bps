"use server";

/**
 * BPS Kurumsal Kritik Tarihler — Server Actions
 *
 * `createCriticalDateAction` replaces the previous browser-context
 * `createCriticalDate` call. Reason: `critical_dates.tenant_id` is NOT NULL
 * with no DEFAULT and the production INSERT policy carries a tenant
 * condition, but the value must come from `current_user_active_tenant()` —
 * server-resolved, never read from a client payload. The browser client had
 * no way to supply it, so every create attempt would have been rejected.
 * The table is empty in production, which is why nobody hit it.
 *
 * Same shape as `createNoteAction` and the görev / randevu / talep creates.
 *
 * NO app-level role guard, on purpose: RLS is the authority here exactly as
 * it was on the browser path (critical_dates writes are yonetici-only at the
 * DB layer). Adding one would narrow behaviour beyond this fix.
 *
 * `critical_dates` has no company_id — it is a corporate-level table, so
 * there is no company to resolve and no passive-company guard to run.
 *
 * Update and delete paths are unchanged — create only. service_role is never
 * used.
 */

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createCriticalDate } from "@/lib/services/critical-dates";
import type { CriticalDateCreateInput } from "@/lib/services/critical-dates";

export type CriticalDateCreateResult =
  | { ok: true }
  | { ok: false; error: string };

export async function createCriticalDateAction(
  input: CriticalDateCreateInput,
): Promise<CriticalDateCreateResult> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "Oturum geçersiz: lütfen tekrar giriş yapın." };
  }

  const { data: tenantId, error: tenantError } = await supabase.rpc(
    "current_user_active_tenant",
  );
  if (tenantError || typeof tenantId !== "string" || tenantId.length === 0) {
    return { ok: false, error: "Aktif kiracı çözümlenemedi." };
  }

  try {
    await createCriticalDate(supabase, input, { tenantId });
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Kritik tarih eklenemedi.",
    };
  }
}
