/**
 * BPS — Raw Supabase access for the `notes` table.
 *
 * This file is the thin translator between the typed Supabase client
 * and the service layer. It performs NO business logic:
 *   - No partner scope re-verification (that lives in services/notes.ts
 *     via requireCompanyByLegacyMockId).
 *   - No ownership enforcement (that lives in services/notes.ts; RLS
 *     is the DB-level safety net).
 *   - No content validation (services/notes.ts trims, rejects blanks,
 *     whitelists tags via normalizeNoteTag).
 *
 * Functions throw on supabase errors so the service layer can catch
 * and translate them to friendly Turkish messages.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, NoteRow, NoteInsert, NoteUpdate } from "@/types/database.types";

type Client = SupabaseClient<Database>;

/**
 * Read every note for a single company, pinned first then newest first.
 *
 * Ordering matches the compound index `notes_company_sort_idx` so the
 * query plan is index-only for the hot path.
 *
 * The Firma Detay Notlar tab uses this directly. The Genel Bakış
 * Son Notlar card re-uses the same state and slices the first three
 * rows — no separate "recent" query is needed.
 */
export async function selectNotesByCompanyId(
  client: Client,
  companyId: string,
): Promise<NoteRow[]> {
  const { data, error } = await client
    .from("notes")
    .select("*")
    .eq("company_id", companyId)
    .order("is_pinned", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`notes select failed: ${error.message}`);
  }
  return data ?? [];
}

/**
 * Insert a single note row. The service layer is responsible for:
 *   - Resolving company_id from legacy mock id (RLS-checked resolve)
 *   - Setting author_id to auth.uid() and author_name from profiles
 *   - Trimming content and normalizing tag
 */
export async function insertNote(
  client: Client,
  input: NoteInsert,
): Promise<NoteRow> {
  const { data, error } = await client
    .from("notes")
    .insert(input)
    .select()
    .single();

  if (error) {
    throw new Error(`notes insert failed: ${error.message}`);
  }
  return data;
}

/**
 * Update a single note row by id. The service layer is responsible for:
 *   - Narrowing the patch to the columns the caller is allowed to change
 *   - Re-verifying partner scope via requireCompanyByLegacyMockId
 *   - Enforcing ownership (author_id) for the operasyon / ik self-edit path
 *
 * RLS is the database-level safety net for ownership and scope.
 */
export async function updateNote(
  client: Client,
  noteId: string,
  patch: NoteUpdate,
): Promise<NoteRow> {
  const { data, error } = await client
    .from("notes")
    .update(patch)
    .eq("id", noteId)
    .select()
    .single();

  if (error) {
    throw new Error(`notes update failed: ${error.message}`);
  }
  return data;
}

/**
 * Delete a single note row. Only yonetici (globally) and partner
 * (scoped) reach this path at the UI / service layer — RLS enforces
 * the same rule.
 */
export async function deleteNote(
  client: Client,
  noteId: string,
): Promise<void> {
  const { error } = await client
    .from("notes")
    .delete()
    .eq("id", noteId);

  if (error) {
    throw new Error(`notes delete failed: ${error.message}`);
  }
}
