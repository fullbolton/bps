/**
 * BPS — Raw Supabase access for the `announcements` table.
 *
 * Thin translator between the typed Supabase client and the service layer.
 * No business logic, no role gating, no limit policy.
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
  input: AnnouncementInsert,
): Promise<AnnouncementRow> {
  const { data, error } = await client
    .from("announcements")
    .insert(input)
    .select()
    .single();

  if (error) {
    throw new Error(`announcements insert failed: ${error.message}`);
  }
  return data;
}

/**
 * Delete a single announcement by id.
 *
 * Deletion is the only correction path — announcements cannot be edited.
 * yonetici-only at the DB layer.
 */
export async function deleteAnnouncement(
  client: Client,
  id: string,
): Promise<void> {
  const { error } = await client.from("announcements").delete().eq("id", id);

  if (error) {
    throw new Error(`announcements delete failed: ${error.message}`);
  }
}
