/**
 * BPS service layer — profiles.
 *
 * Architecture position (per TECH_STACK_DECISION.md §4 and ARCHITECTURE.md):
 *
 *     UI Component
 *         ↓
 *     src/lib/services/profiles.ts          ← THIS FILE — business logic
 *         ↓
 *     src/lib/supabase/profiles.ts          ← raw CRUD only
 *         ↓
 *     Supabase Postgres + RLS
 *
 * Rules for files in this directory:
 *   - Business logic, validation, transformation, and visibility decisions live here.
 *   - UI components import from this file, NEVER from `src/lib/supabase/*` directly.
 *   - Each function takes a Supabase client (server or browser) so the caller
 *     can choose the right context. Service functions are runtime-agnostic.
 *   - Errors are normalized — callers see `Error` with a clear message,
 *     not raw Postgres error codes.
 *   - Phase 0+ services do NOT enforce role/scope here yet (RLS handles it
 *     at the DB layer). Faz 1A+ adds explicit partner-scope re-verification
 *     on every write path per PARTNER_SCOPE_TOUCHPOINTS.md §3.
 *
 * This file is the canonical example for future per-domain service modules
 * (`src/lib/services/companies.ts`, `src/lib/services/contacts.ts`, etc.).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, ProfileRow } from "@/types/database.types";
import {
  selectProfileById,
  selectAllProfiles,
  updateProfile,
} from "@/lib/supabase/profiles";

type Client = SupabaseClient<Database>;

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/**
 * Resolve the currently authenticated user's profile.
 * Returns null when there is no authenticated user, or when the auth user has
 * no matching profile row yet (which should be impossible after the
 * `handle_new_user` trigger fires, but is handled defensively).
 */
export async function getCurrentProfile(
  client: Client,
): Promise<ProfileRow | null> {
  const {
    data: { user },
    error: authError,
  } = await client.auth.getUser();

  if (authError) {
    throw new Error(`auth.getUser failed: ${authError.message}`);
  }

  if (!user) {
    return null;
  }

  return selectProfileById(client, user.id);
}

/**
 * Fetch a single profile by id.
 * Wraps the data-access function with consistent error normalization.
 */
export async function getProfileById(
  client: Client,
  id: string,
): Promise<ProfileRow | null> {
  if (!id) {
    throw new Error("getProfileById: id is required");
  }
  return selectProfileById(client, id);
}

/**
 * List all profiles visible to the caller per RLS.
 * Used by future Ayarlar > Kullanici Yonetimi (yonetici-only) and by author
 * lookup helpers in notes / tasks / etc. once those domains migrate.
 */
export async function listProfiles(client: Client): Promise<ProfileRow[]> {
  return selectAllProfiles(client);
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

/**
 * Update the current user's display name.
 * Role and unit changes are intentionally not supported here in Phase 0 —
 * they require yonetici action via Supabase dashboard.
 */
export async function updateOwnDisplayName(
  client: Client,
  newDisplayName: string,
): Promise<ProfileRow> {
  const trimmed = newDisplayName.trim();
  if (trimmed.length === 0) {
    throw new Error("updateOwnDisplayName: display_name cannot be empty");
  }
  if (trimmed.length > 80) {
    throw new Error("updateOwnDisplayName: display_name must be <= 80 chars");
  }

  const {
    data: { user },
    error: authError,
  } = await client.auth.getUser();

  if (authError) {
    throw new Error(`auth.getUser failed: ${authError.message}`);
  }
  if (!user) {
    throw new Error("updateOwnDisplayName: not authenticated");
  }

  return updateProfile(client, user.id, { display_name: trimmed });
}
