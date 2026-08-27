"use server";

/**
 * BPS Dashboard — Server Actions (Duyurular)
 *
 * Announcement writes go through the server, not the browser client, for the
 * same reason `createCriticalDateAction` does: `announcements.tenant_id` is
 * NOT NULL with no DEFAULT and the INSERT policy carries a tenant condition,
 * but the value must come from `current_user_active_tenant()` — server-
 * resolved, never read from a client payload. The browser client has no way
 * to supply it, so every create attempt would be rejected.
 *
 * NO app-level role guard, on purpose: RLS is the authority here, exactly as
 * it is on the critical-dates path (announcements writes are yonetici-only at
 * the DB layer). The Dashboard hides the compose control for other roles, but
 * that is presentation — the DB is what actually refuses.
 *
 * `announcements` has no company_id — it is a corporate-level table, so there
 * is no company to resolve and no passive-company guard to run.
 *
 * There is no update action: announcements have no edit path. Delete is the
 * only correction route. service_role is never used.
 */

import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  createAnnouncement,
  removeAnnouncement,
} from "@/lib/services/announcements";
import type { AnnouncementCreateInput } from "@/lib/services/announcements";

export type AnnouncementActionResult =
  | { ok: true }
  | { ok: false; error: string };

export async function createAnnouncementAction(
  input: AnnouncementCreateInput,
): Promise<AnnouncementActionResult> {
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
    await createAnnouncement(supabase, input, { tenantId });
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Duyuru eklenemedi.",
    };
  }
}

/**
 * Delete an announcement.
 *
 * No tenant resolution needed: the DELETE policy already carries both the
 * yonetici gate and the tenant condition, so a cross-tenant id simply matches
 * no row.
 */
export async function deleteAnnouncementAction(
  id: string,
): Promise<AnnouncementActionResult> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "Oturum geçersiz: lütfen tekrar giriş yapın." };
  }

  try {
    await removeAnnouncement(supabase, id);
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Duyuru kaldırılamadı.",
    };
  }
}
