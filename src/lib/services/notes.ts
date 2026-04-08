/**
 * BPS service layer — notes (Faz 1B "Notlar" slice).
 *
 *     UI Component (Firma Detay Notlar tab + Genel Bakış Son Notlar card)
 *         ↓
 *     src/lib/services/notes.ts              ← THIS FILE — business logic
 *         ↓
 *     src/lib/supabase/notes.ts              ← raw CRUD only
 *         ↓
 *     Supabase Postgres + RLS
 *
 * Invariants enforced here (mirrored by DB constraints / RLS):
 *   - Authorization = role capability + assigned scope
 *       → every mutation calls `requireCompanyByLegacyMockId` first so
 *         partner scope is re-verified before the write lands. If RLS
 *         hides the firma, that throws and the mutation is short-circuited.
 *   - Ownership comes from `author_id`, not from any visible author
 *     text. Self-edit paths (operasyon, ik) use author_id = auth.uid()
 *     as the authoritative ownership check. The DB RLS is the safety
 *     net; the service layer throws a Turkish error before the SQL runs
 *     so the UI can show a clean message.
 *   - yonetici is the only role that may pin / unpin. This file exposes
 *     `pinNote` / `unpinNote` as distinct functions so the capability
 *     gate is obvious. The DB has no column-level gate for is_pinned;
 *     the service layer is the sanctioned writer.
 *   - author_name is denormalized from profiles.display_name at write
 *     time. It is used only for display. Authorization never reads it.
 *
 * Error surface:
 *   - NoteValidationError         — blank content, tag whitelist miss
 *   - NoteOwnershipError          — self-edit path rejected (not author)
 *   - NotePinPermissionError      — pin/unpin by non-yonetici
 *   - CompanyNotFoundOrOutOfScopeError — reused from services/companies
 *   - Generic Error for DB errors, caught by the UI's try/catch.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { UserRole } from "@/context/AuthContext";
import type {
  Database,
  NoteRow,
  NoteInsert,
  NoteUpdate,
} from "@/types/database.types";
import {
  selectNotesByCompanyId,
  insertNote,
  updateNote,
  deleteNote,
} from "@/lib/supabase/notes";
import { requireCompanyByLegacyMockId } from "@/lib/services/companies";
import { normalizeNoteTag, type NoteTagKey } from "@/lib/note-tags";

type Client = SupabaseClient<Database>;

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class NoteValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NoteValidationError";
  }
}

export class NoteOwnershipError extends Error {
  constructor() {
    super("Bu notu yalnızca yazarı veya yönetici düzenleyebilir.");
    this.name = "NoteOwnershipError";
  }
}

export class NotePinPermissionError extends Error {
  constructor() {
    super("Notları yalnızca yönetici sabitleyebilir veya sabitlemeyi kaldırabilir.");
    this.name = "NotePinPermissionError";
  }
}

// ---------------------------------------------------------------------------
// UI-facing input shapes — intentionally narrow
// ---------------------------------------------------------------------------

export interface NoteCreateInput {
  content: string;
  /** Empty string "" from the modal select is normalized to null. */
  tag?: NoteTagKey | "" | null;
}

export interface NoteContentUpdateInput {
  content: string;
  tag?: NoteTagKey | "" | null;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function ensureContent(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new NoteValidationError("Not içeriği boş olamaz.");
  }
  return trimmed;
}

/**
 * Resolve the calling user's id + display_name in a single round trip.
 * Throws if there is no authenticated user or no profiles row (that state
 * is a Phase 0 invariant — `handle_new_user` materializes a profile row
 * for every signup).
 */
async function requireCurrentAuthor(
  client: Client,
): Promise<{ id: string; displayName: string; role: UserRole }> {
  const {
    data: { user },
    error: userError,
  } = await client.auth.getUser();
  if (userError || !user) {
    throw new NoteValidationError("Oturum bulunamadı. Lütfen tekrar giriş yapın.");
  }

  const { data: profile, error: profileError } = await client
    .from("profiles")
    .select("id, display_name, role")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    throw new NoteValidationError(
      "Profil bilgileri yüklenemedi. Lütfen tekrar deneyin.",
    );
  }

  return {
    id: profile.id,
    displayName: profile.display_name,
    role: profile.role,
  };
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/**
 * List every note for the firma identified by a legacy mock id, pinned
 * first then newest first.
 *
 * Used by both the Firma Detay Notlar tab (full list) and the Genel
 * Bakış Son Notlar card (which reuses the same state and slices the
 * top three) — see `notes_company_sort_idx` on the DB side.
 */
export async function listNotesByLegacyCompanyId(
  client: Client,
  legacyMockId: string,
): Promise<NoteRow[]> {
  const company = await requireCompanyByLegacyMockId(client, legacyMockId);
  return selectNotesByCompanyId(client, company.id);
}

// ---------------------------------------------------------------------------
// Writes — create
// ---------------------------------------------------------------------------

/**
 * Create a note for the firma identified by a legacy mock id.
 *
 * Behavior:
 *   - Re-verifies partner scope via `requireCompanyByLegacyMockId`.
 *   - Trims content and enforces non-blank.
 *   - Normalizes tag: "" and invalid keys become null.
 *   - Stamps author_id = auth.uid() and author_name = profiles.display_name.
 *     author_name is denormalized so future renames don't mutate history.
 *   - `is_pinned` defaults to false (pin is a separate function).
 */
export async function createNote(
  client: Client,
  legacyMockId: string,
  input: NoteCreateInput,
): Promise<NoteRow> {
  const company = await requireCompanyByLegacyMockId(client, legacyMockId);
  const author = await requireCurrentAuthor(client);

  const content = ensureContent(input.content);
  const tag = normalizeNoteTag(input.tag ?? null);

  const payload: NoteInsert = {
    company_id: company.id,
    author_id: author.id,
    author_name: author.displayName,
    content,
    tag,
    is_pinned: false,
  };

  return insertNote(client, payload);
}

// ---------------------------------------------------------------------------
// Writes — update content
// ---------------------------------------------------------------------------

/**
 * Update the body (content + tag) of an existing note.
 *
 * Capability gate:
 *   - yonetici / partner-scoped → any note (broad edit, per ROLE_MATRIX
 *     §4 row "Başkasının notunu geniş düzenleme")
 *   - operasyon / ik → only their own notes (per ROLE_MATRIX §4 row
 *     "Not ekleme / kendi notunu düzenleme"). Ownership is read from
 *     the authoritative `author_id` column, never from any display text.
 *   - muhasebe / goruntuleyici → rejected before the DB call
 *
 * The partner scope check runs first via `requireCompanyByLegacyMockId`,
 * so if RLS hides the firma from the caller this throws a
 * CompanyNotFoundOrOutOfScopeError before any ownership logic runs.
 *
 * Only `content` and `tag` are patched — author_id / is_pinned / author_name
 * are never touched by this path. Pin changes go through `pinNote` / `unpinNote`.
 */
export async function updateNoteContent(
  client: Client,
  legacyMockId: string,
  noteId: string,
  input: NoteContentUpdateInput,
): Promise<NoteRow> {
  // Scope re-verification — throws if the firma is hidden from the caller.
  await requireCompanyByLegacyMockId(client, legacyMockId);

  const author = await requireCurrentAuthor(client);
  const role = author.role;

  if (role === "muhasebe" || role === "goruntuleyici") {
    throw new NoteOwnershipError();
  }

  // Self-edit roles must own the note. Broad-edit roles (yonetici,
  // partner) skip this gate because RLS + scope already cover them.
  if (role === "operasyon" || role === "ik") {
    const existing = await fetchNoteById(client, noteId);
    if (!existing || existing.author_id !== author.id) {
      throw new NoteOwnershipError();
    }
  }

  const content = ensureContent(input.content);
  const tag = normalizeNoteTag(input.tag ?? null);

  const patch: NoteUpdate = {
    content,
    tag,
  };

  return updateNote(client, noteId, patch);
}

// ---------------------------------------------------------------------------
// Writes — pin / unpin
// ---------------------------------------------------------------------------

/**
 * Mark a note as pinned.
 *
 * yonetici-only per user rules for this slice. The DB cannot
 * column-gate `is_pinned` via RLS without a security-definer wrapper,
 * so this service function is the sanctioned writer — the UI should
 * never call the raw `updateNote` for pin flips.
 */
export async function pinNote(
  client: Client,
  legacyMockId: string,
  noteId: string,
): Promise<NoteRow> {
  return togglePin(client, legacyMockId, noteId, true);
}

/**
 * Clear the pinned flag on a note. yonetici-only.
 */
export async function unpinNote(
  client: Client,
  legacyMockId: string,
  noteId: string,
): Promise<NoteRow> {
  return togglePin(client, legacyMockId, noteId, false);
}

async function togglePin(
  client: Client,
  legacyMockId: string,
  noteId: string,
  nextValue: boolean,
): Promise<NoteRow> {
  await requireCompanyByLegacyMockId(client, legacyMockId);
  const author = await requireCurrentAuthor(client);

  if (author.role !== "yonetici") {
    throw new NotePinPermissionError();
  }

  return updateNote(client, noteId, { is_pinned: nextValue });
}

// ---------------------------------------------------------------------------
// Writes — delete
// ---------------------------------------------------------------------------

/**
 * Delete a note. yonetici / partner-scoped only (same shape as
 * "broad edit"). The UI for Faz 1B does not expose a delete affordance;
 * this function is here so the capability exists at the service layer
 * for out-of-band cleanup without bypassing the service boundary.
 */
export async function deleteNoteById(
  client: Client,
  legacyMockId: string,
  noteId: string,
): Promise<void> {
  await requireCompanyByLegacyMockId(client, legacyMockId);
  const author = await requireCurrentAuthor(client);

  if (author.role !== "yonetici" && author.role !== "partner") {
    throw new NoteOwnershipError();
  }

  await deleteNote(client, noteId);
}

// ---------------------------------------------------------------------------
// Internal: single-row fetch for ownership checks
// ---------------------------------------------------------------------------

async function fetchNoteById(
  client: Client,
  noteId: string,
): Promise<NoteRow | null> {
  const { data, error } = await client
    .from("notes")
    .select("*")
    .eq("id", noteId)
    .maybeSingle();

  if (error) {
    throw new Error(`notes fetch-by-id failed: ${error.message}`);
  }
  return data ?? null;
}
