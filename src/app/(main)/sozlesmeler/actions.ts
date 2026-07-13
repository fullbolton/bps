"use server";

/**
 * BPS Sözleşmeler — Server Actions
 *
 * `createContractAction` replaces the previous browser-context
 * `createContract(supabase, payload)` call from the Sözleşmeler page.
 * That path was broken at runtime: production `contracts.tenant_id` is
 * NOT NULL and the browser path never supplied it, so every UI-created
 * contract failed on insert. Tenant resolution requires the server-side
 * `current_user_active_tenant()` chokepoint — hence this action
 * (mirrors Patch 2's `createContactAction`).
 *
 * Order: cookie auth → current_user_role() guard (yonetici-only) →
 * current_user_active_tenant() → resolve firma (legacy id or UUID) →
 * passive-company guard (fail-closed on pasif, BEFORE any write) →
 * delegate to the existing `createContract` service with the SERVER
 * client and the server-resolved tenantId. The service keeps name /
 * date-order / active-dates validation. RLS stays the final boundary.
 *
 * Contract create is yonetici-only at the app level (partner is
 * FROZEN/HOLD per the ROLE_MATRIX refresh; operasyon "Sınırlı" is an
 * open question and is NOT enabled here). service_role is never used.
 */

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createContract } from "@/lib/services/contracts";
import type { ContractCreateInput } from "@/lib/services/contracts";
import {
  requireCompanyByLegacyMockId,
  assertCompanyIsActiveForNewOperation,
} from "@/lib/services/companies";

export type ContractCreateActionResult =
  | { ok: true }
  | { ok: false; error: string };

export async function createContractAction(
  input: ContractCreateInput,
): Promise<ContractCreateActionResult> {
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

  // yonetici-only (partner FROZEN/HOLD; operasyon Sınırlı = open question).
  const { data: roleData, error: roleError } = await supabase.rpc(
    "current_user_role",
  );
  if (roleError || roleData !== "yonetici") {
    return { ok: false, error: "Yetkisiz: sözleşme oluşturma yetkiniz yok." };
  }

  const { data: tenantId, error: tenantError } = await supabase.rpc(
    "current_user_active_tenant",
  );
  if (tenantError || typeof tenantId !== "string" || tenantId.length === 0) {
    return { ok: false, error: "Aktif kiracı çözümlenemedi." };
  }

  try {
    // Resolve first (legacy "f1" or real UUID) so the passive guard can
    // run against the real company id — BEFORE any write.
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

    await createContract(supabase, input, { tenantId });
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Sözleşme oluşturulamadı.",
    };
  }
}
