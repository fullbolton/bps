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
 * Profiles that are members of the caller's ACTIVE TENANT, ordered by
 * display_name.
 *
 * This replaced an unscoped `select *` (2026-09-04). That reader was the
 * cross-tenant leak: `profiles` has no tenant_id and its SELECT policy was
 * `using (true)`, so the assignee picker listed every tenant's users and let a
 * yonetici assign a task to another tenant's staff. It was "the filter the
 * developer forgot" — except there was nothing to filter BY from the browser:
 * membership lives in `tenant_memberships`, which is closed to PostgREST.
 *
 * So the scope is resolved server-side inside the RPC, from the caller's own
 * claim, with no tenant argument to get wrong. The unscoped reader is gone
 * rather than deprecated: a function that cannot be called cannot be
 * forgotten. qa:static R14 fails if it comes back.
 *
 * This is an application-layer guarantee INDEPENDENT of the profiles RLS
 * policy (which is narrowed by the same migration, 20260904000100). Either
 * layer alone closes the read leak; both are kept on purpose.
 */
export async function selectActiveTenantProfiles(
  client: Client,
): Promise<ProfileRow[]> {
  const { data, error } = await client.rpc("active_tenant_profiles");

  if (error) {
    throw new Error(`profiles select failed: ${error.message}`);
  }

  return (data ?? []) as ProfileRow[];
}

/**
 * Is the given profile a member of the caller's active tenant?
 *
 * Same SECURITY DEFINER function the tasks RLS WITH CHECK calls, so the
 * service-layer answer and the database's answer cannot disagree. Used before
 * writing an assignee, to turn a would-be RLS rejection into a Turkish message.
 * Fail-closed: an RPC error is reported as "not a member".
 */
export async function isActiveTenantMember(
  client: Client,
  userId: string,
): Promise<boolean> {
  const { data, error } = await client.rpc("is_active_tenant_member", {
    p_user_id: userId,
  });
  if (error) return false;
  return data === true;
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
