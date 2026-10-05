/**
 * BPS — Supabase access for the `announcements` table.
 *
 * Thin translator between the typed Supabase client and the service layer.
 * Reads use RLS; writes use the module-aware, manager-only database command.
 * Functions throw on supabase errors so the service layer can catch
 * and translate them to friendly Turkish messages.
 *
 * There is no update function: announcements have no edit path (the migration
 * ships no UPDATE policy).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Database,
  AnnouncementRow,
  AnnouncementInsert,
} from "@/types/database.types";

type Client = SupabaseClient<Database>;

function commandError(error: {code?: string}): Error {
  if (error.code === "BM001") return new Error("Duyurular modülü kapalı. Çalışma alanı ayarlarını kontrol edin.");
  if (error.code === "42501") return new Error("Duyuruya erişiminiz veya bu işlem için yetkiniz yok. Listeyi yenileyin.");
  if (error.code === "22023") return new Error("Duyuru metni 1–500 karakter olmalıdır.");
  return new Error("İşlemin sonucu doğrulanamadı. Tekrar denemeden önce duyuru listesini yenileyin.");
}


// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/**
 * Read the most recent announcements, newest first.
 *
 * `limit` is passed by the caller rather than fixed here — this layer holds no
 * policy. The tenant filter is NOT applied in the query: RLS scopes the rows.
 */
export async function selectRecentAnnouncements(
  client: Client,
  limit: number,
): Promise<AnnouncementRow[]> {
  const { data, error } = await client
    .from("announcements")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`announcements select-recent failed: ${error.message}`);
  }
  return data ?? [];
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

/**
 * Insert a single announcement row.
 */
export async function insertAnnouncement(
  client: Client,
  input: Pick<AnnouncementInsert, "tenant_id" | "body">,
): Promise<AnnouncementRow> {
  const { data, error } = await client.rpc("announcement_execute_v1", {
    p_action: "create", p_id: null, p_tenant: input.tenant_id, p_body: input.body,
  }).single();

  if (error) {
    throw commandError(error);
  }
  if (!data || data.tenant_id !== input.tenant_id || data.body !== input.body.trim()) {
    throw new Error("Duyuru kaydının sonucu doğrulanamadı. Tekrar denemeden önce listeyi yenileyin.");
  }
  return data;
}

/**
 * Delete a single announcement by id.
 *
 * Deletion is the only correction path — announcements cannot be edited.
 * Manager-only command; missing or inaccessible records are rejected.
 */
export async function deleteAnnouncement(
  client: Client,
  id: string,
): Promise<void> {
  const { data, error } = await client.rpc("announcement_execute_v1", {
    p_action: "delete", p_id: id, p_tenant: null, p_body: null,
  }).single();

  if (error) {
    throw commandError(error);
  }
  if (!data || data.id !== id) {
    throw new Error("Duyurunun silindiği doğrulanamadı. Listeyi yenileyin.");
  }
}
