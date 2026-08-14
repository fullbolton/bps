"use server";

/**
 * BPS Talepler — Server Actions
 *
 * `createDemandAction` wraps the previous browser-context `createDemand`
 * call with the passive-company guard: a pasif firma cannot receive a new
 * personel talebi. Mirrors the contract-create action
 * (`sozlesmeler/actions.ts`); the guard runs BEFORE the service insert so
 * a rejected attempt produces no row.
 *
 * NO app-level role guard here, on purpose: role enforcement stays with
 * RLS exactly as on the previous browser path (operasyon keeps its
 * current create access). Partner is frozen at the product/UI level, but
 * RLS still permits partner-scope inserts — a known drift recorded in
 * ROLE_MATRIX §11 (RLS drift memo), NOT enforced here. This action adds
 * no role guard, so RLS stays the sole authority and behavior is
 * unchanged from the browser path. The ONLY added behavior is the
 * passive-company guard. service_role is never used.
 */

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createDemand } from "@/lib/services/staffing-demands";
import type { DemandCreateInput } from "@/lib/services/staffing-demands";
import {
  requireCompanyByLegacyMockId,
  assertCompanyIsActiveForNewOperation,
} from "@/lib/services/companies";

export type CreateDemandActionResult =
  | { ok: true }
  | { ok: false; error: string };

export async function createDemandAction(
  input: DemandCreateInput,
): Promise<CreateDemandActionResult> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "Oturum geçersiz: lütfen tekrar giriş yapın." };
  }
  if (!input?.legacyCompanyId || typeof input.legacyCompanyId !== "string") {
    return { ok: false, error: "Firma kimliği geçersiz." };
  }

  const { data: tenantId, error: tenantError } = await supabase.rpc(
    "current_user_active_tenant",
  );
  if (tenantError || typeof tenantId !== "string" || tenantId.length === 0) {
    return { ok: false, error: "Aktif kiracı çözümlenemedi." };
  }

  try {
    // Resolve the firma (legacy "f1" or real UUID) so the passive guard
    // runs against the real company id — BEFORE any insert.
    const company = await requireCompanyByLegacyMockId(
      supabase,
      input.legacyCompanyId,
    );
    const activeCheck = await assertCompanyIsActiveForNewOperation(
      supabase,
      company.id,
      tenantId,
    );
    if (!activeCheck.ok) {
      return activeCheck;
    }
    await createDemand(supabase, input, { tenantId });
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Personel talebi oluşturulamadı.",
    };
  }
}
