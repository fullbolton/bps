/**
 * Supabase data access layer — contacts (Yetkililer, Faz 1A primary truth).
 *
 *     UI Component
 *         ↓
 *     src/lib/services/contacts.ts          ← business logic, invariants
 *         ↓
 *     src/lib/supabase/contacts.ts          ← THIS FILE — raw CRUD only
 *         ↓
 *     Supabase Postgres + RLS
 *
 * Rules (mirrors `companies.ts` and `profiles.ts`):
 *   - Raw CRUD only. No business logic, no invariant enforcement,
 *     no role checks. The service layer is responsible for those.
 *   - Functions take a Supabase client as the first argument so the
 *     caller chooses the right context (server vs browser).
 *   - Errors are normalized into Error instances with the Supabase
 *     message preserved for the service layer to translate.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Database,
  ContactRow,
  ContactInsert,
  ContactUpdate,
} from "@/types/database.types";

type Client = SupabaseClient<Database>;

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/**
 * List contacts for one firma. Returns an empty array when none exist or
 * the firma is out of the caller's RLS scope.
 *
 * Sort: primary first, then by created_at ascending. The "primary first"
 * sort matches the Firma Detay > Yetkililer tab presentation.
 */
export async function selectContactsByCompanyId(
  client: Client,
  companyId: string,
): Promise<ContactRow[]> {
  const { data, error } = await client
    .from("contacts")
    .select("*")
    .eq("company_id", companyId)
    .order("is_primary", { ascending: false })
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`contacts select failed: ${error.message}`);
  }
  return data ?? [];
}

/**
 * Batch-fetch the primary contact for many companies in one round trip.
 * Used by the Firmalar list cutover for the Ana Yetkili column.
 *
 * Returns one row per company that has a primary contact and is within
 * the caller's RLS scope. Companies with no primary, or with no contacts
 * at all, are silently absent from the result.
 */
export async function selectPrimaryContactsByCompanyIds(
  client: Client,
  companyIds: string[],
): Promise<ContactRow[]> {
  if (companyIds.length === 0) return [];

  const { data, error } = await client
    .from("contacts")
    .select("*")
    .in("company_id", companyIds)
    .eq("is_primary", true);

  if (error) {
    throw new Error(`contacts select failed: ${error.message}`);
  }
  return data ?? [];
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

/**
 * Insert a contact row exactly as provided. The service layer is
 * responsible for:
 *   - Resolving the company_id (legacy mock id → uuid)
 *   - Enforcing the max-5 / phone-or-email / single-primary invariants
 *     before calling this function (the database also enforces them as
 *     a safety net via constraint trigger + partial unique index)
 *   - Re-verifying partner scope per PARTNER_SCOPE_TOUCHPOINTS.md §3
 */
export async function insertContact(
  client: Client,
  input: ContactInsert,
): Promise<ContactRow> {
  const { data, error } = await client
    .from("contacts")
    .insert(input)
    .select()
    .single();

  if (error) {
    throw new Error(`contacts insert failed: ${error.message}`);
  }
  return data;
}

/**
 * Update an existing contact row. The service layer is responsible for:
 *   - Narrowing the patch to the columns the caller's role may write
 *     (e.g. operasyon → only phone/email)
 *   - Promoting/demoting the is_primary flag in tandem with other rows
 *     when the caller is reassigning the ana yetkili
 *   - Re-verifying partner scope before calling this function
 */
export async function updateContact(
  client: Client,
  id: string,
  patch: ContactUpdate,
): Promise<ContactRow> {
  const { data, error } = await client
    .from("contacts")
    .update(patch)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw new Error(`contacts update failed: ${error.message}`);
  }
  return data;
}

/**
 * Demote every primary contact for a given company to is_primary = false.
 * Used by the service layer in the same transaction as a promote — without
 * this, the partial unique index `contacts_one_primary_per_company` would
 * reject the new primary row.
 *
 * The exclude_id parameter lets the caller skip a row (e.g. the row that
 * is about to be promoted).
 */
export async function clearPrimaryForCompany(
  client: Client,
  companyId: string,
  excludeId?: string,
): Promise<void> {
  let query = client
    .from("contacts")
    .update({ is_primary: false })
    .eq("company_id", companyId)
    .eq("is_primary", true);

  if (excludeId) {
    query = query.neq("id", excludeId);
  }

  const { error } = await query;
  if (error) {
    throw new Error(`contacts clear-primary failed: ${error.message}`);
  }
}

/**
 * Delete a contact row. The service layer is responsible for partner
 * scope re-verification before calling this function.
 *
 * Phase 1A does not yet expose a "delete contact" UI action — this
 * function is provided so the service layer can shape its full surface
 * area now and the future delete CTA does not require schema changes.
 */
export async function deleteContact(
  client: Client,
  id: string,
): Promise<void> {
  const { error } = await client
    .from("contacts")
    .delete()
    .eq("id", id);

  if (error) {
    throw new Error(`contacts delete failed: ${error.message}`);
  }
}
