"use server";

/**
 * BPS Contract Detail — Server Actions
 *
 * Hard-delete for a single contract (Faz 1 — no trash, no soft-delete,
 * no status=feshedildi conversion). Deletion is a real lifecycle
 * capability, used (among other things) to clean up post-smoke test
 * contracts via the app path rather than manual SQL.
 *
 * yonetici-only at the app layer (rpc current_user_role). The contracts
 * DELETE RLS is also yonetici-only, so the app guard and RLS agree; the
 * app guard is the first gate, RLS the last. service_role is never used
 * — the client is the cookie-session server client, RLS enforced.
 *
 * DB-first delete with RETURNING so the returned-row guard confirms a
 * row was actually removed before reporting success. Zero rows (already
 * gone / RLS-hidden / concurrent delete) is an idempotent no-op — no
 * misleading "deleted" feedback. Contracts carry no storage object, so
 * there is no second (storage) step.
 */

import { createServerSupabaseClient } from "@/lib/supabase/server";

export type ContractDeleteResult =
  | { ok: true; deletedName?: string }
  | { ok: false; error: string };

export async function deleteContractAction(
  contractId: string,
): Promise<ContractDeleteResult> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "Oturum geçersiz: lütfen tekrar giriş yapın." };
  }

  if (!contractId || typeof contractId !== "string") {
    return { ok: false, error: "Sözleşme kimliği geçersiz." };
  }

  const { data: roleData, error: roleError } = await supabase.rpc(
    "current_user_role",
  );
  if (roleError || roleData !== "yonetici") {
    return {
      ok: false,
      error: "Yetkisiz: sözleşme silme yalnızca yöneticiye açıktır.",
    };
  }

  const del = await supabase
    .from("contracts")
    .delete()
    .eq("id", contractId)
    .select("id, name");
  if (del.error) {
    return { ok: false, error: `Sözleşme silinemedi: ${del.error.message}` };
  }

  const deletedRows = del.data ?? [];
  if (deletedRows.length === 0) {
    // Already gone / not visible — idempotent no-op success.
    return { ok: true };
  }

  return { ok: true, deletedName: deletedRows[0].name };
}
