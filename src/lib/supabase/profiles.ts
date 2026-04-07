/**
 * Supabase data access layer — profiles.
 *
 * This is the bottom of the architecture stack:
 *
 *     UI Component
 *         ↓
 *     src/lib/services/profiles.ts          ← business logic, validation
 *         ↓
 *     src/lib/supabase/profiles.ts          ← THIS FILE — raw CRUD only
 *         ↓
 *     Supabase Postgres + RLS
 *
 * Rules for files in this directory:
 *   - Only raw CRUD against the database. No business logic.
 *   - No role checks here — RLS is the database-level guarantee, and the
 *     service layer is the application-level guarantee.
 *   - Each function returns either the typed row(s) or throws on error.
 *   - Functions take a Supabase client as the first argument so the caller
 *     can pick the right context (server vs browser).
 *
 * This file is the canonical example for future per-domain access modules
 * (`src/lib/supabase/companies.ts`, `src/lib/supabase/contacts.ts`, etc.).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Database,
  ProfileRow,
  ProfileUpdate,
} from "@/types/database.types";

type Client = SupabaseClient<Database>;

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/**
 * Fetch a profile row by id (which is the auth.users.id).
 * Returns null when no profile exists for that id.
 */
export async function selectProfileById(
  client: Client,
  id: string,
): Promise<ProfileRow | null> {
  const { data, error } = await client
    .from("profiles")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(`profiles select failed: ${error.message}`);
  }

  return data;
}

/**
 * Fetch all profiles. Phase 0 only allows authenticated reads (per RLS policy
 * profiles_select_authenticated). Phase 1+ may add scope filtering.
 */
export async function selectAllProfiles(
  client: Client,
): Promise<ProfileRow[]> {
  const { data, error } = await client
    .from("profiles")
    .select("*")
    .order("display_name", { ascending: true });

  if (error) {
    throw new Error(`profiles select failed: ${error.message}`);
  }

  return data ?? [];
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

/**
 * Update a profile row by id. Per RLS, the calling user can only update their
 * own profile, and only the display_name column. Role and unit updates are
 * managed via Supabase dashboard (or a future yonetici-only Ayarlar surface).
 */
export async function updateProfile(
  client: Client,
  id: string,
  patch: Pick<ProfileUpdate, "display_name">,
): Promise<ProfileRow> {
  const { data, error } = await client
    .from("profiles")
    .update(patch)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw new Error(`profiles update failed: ${error.message}`);
  }

  return data;
}
