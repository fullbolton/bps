"use server";

/**
 * BPS Randevular — Server Actions
 *
 * `createAppointmentAction` wraps the previous browser-context
 * `createAppointment` call with the passive-company guard: a pasif firma
 * cannot receive a new randevu. Mirrors the contract-create action
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
import {
  createAppointment,
  completeAppointment,
} from "@/lib/services/appointments";
import type {
  AppointmentCreateInput,
  AppointmentCompleteInput,
} from "@/lib/services/appointments";
import {
  requireCompanyByLegacyMockId,
  assertCompanyIsActiveForNewOperation,
} from "@/lib/services/companies";

export type CreateAppointmentActionResult =
  | { ok: true }
  | { ok: false; error: string };

export async function createAppointmentAction(
  input: AppointmentCreateInput,
): Promise<CreateAppointmentActionResult> {
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
    await createAppointment(supabase, input, { tenantId });
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Randevu oluşturulamadı.",
    };
  }
}

export type CompleteAppointmentActionResult =
  | { ok: true; taskCreated: boolean; taskSkippedReason: string | null }
  | { ok: false; error: string };

/**
 * Complete an appointment server-side. Completing (closing existing work)
 * is ALLOWED for a pasif firma; the passive-company guard is applied ONLY
 * to the optional follow-up task side-effect (a NEW operation) inside
 * `completeAppointment`. When the firma is pasif the handoff task is
 * skipped and the reason is returned — never silently swallowed — so the
 * UI can tell the user. No app-level role guard; RLS stays the authority.
 */
export async function completeAppointmentAction(
  appointmentId: string,
  input: AppointmentCompleteInput,
): Promise<CompleteAppointmentActionResult> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "Oturum geçersiz: lütfen tekrar giriş yapın." };
  }
  if (!appointmentId || typeof appointmentId !== "string") {
    return { ok: false, error: "Randevu kimliği geçersiz." };
  }

  const { data: tenantId, error: tenantError } = await supabase.rpc(
    "current_user_active_tenant",
  );
  if (tenantError || typeof tenantId !== "string" || tenantId.length === 0) {
    return { ok: false, error: "Aktif kiracı çözümlenemedi." };
  }

  try {
    const { task, taskSkippedReason } = await completeAppointment(
      supabase,
      appointmentId,
      input,
      { tenantId },
    );
    return { ok: true, taskCreated: task !== null, taskSkippedReason };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Randevu tamamlanamadı.",
    };
  }
}
