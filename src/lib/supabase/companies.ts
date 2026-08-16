/**
 * Supabase data access layer — companies (Faz 1A minimal anchor).
 *
 *     UI Component
 *         ↓
 *     src/lib/services/companies.ts          ← business logic, validation
 *         ↓
 *     src/lib/supabase/companies.ts          ← THIS FILE — raw CRUD only
 *         ↓
 *     Supabase Postgres + RLS
 *
 * Faz 1A scope: only the reads needed by the Yetkililer slice live here.
 * The full Firmalar batch will add CRUD (insert/update, list with filters,
 * group hierarchy queries, etc.). Keeping this file minimal makes the
 * eventual file diff straightforward to review.
 *
 * Rules for this directory (mirrors `profiles.ts`):
 *   - Raw CRUD only. No business logic.
 *   - No role checks here — RLS is the database guarantee, the service
 *     layer is the application guarantee.
 *   - Functions take a Supabase client as the first argument so the
 *     caller chooses the right context (server vs browser).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, CompanyRow, CompanyInsert } from "@/types/database.types";

type Client = SupabaseClient<Database>;

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/**
 * Resolve a single company row by its real UUID id.
 * Returns null when no row exists or RLS hides it from the caller.
 */
export async function selectCompanyById(
  client: Client,
  id: string,
): Promise<CompanyRow | null> {
  const { data, error } = await client
    .from("companies")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(`companies select failed: ${error.message}`);
  }
  return data;
}

/**
 * Resolve a single company row by its legacy mock id (e.g. "f1").
 * Used during the Yetkililer cutover to bridge between the still-mock-backed
 * Firmalar list and the real contacts table.
 *
 * Returns null when no row matches or RLS hides it. Returning null (rather
 * than throwing) lets the caller decide whether the empty result is an
 * error condition or an expected "out of scope for this user" case.
 */
export async function selectCompanyByLegacyMockId(
  client: Client,
  legacyMockId: string,
): Promise<CompanyRow | null> {
  const { data, error } = await client
    .from("companies")
    .select("*")
    .eq("legacy_mock_id", legacyMockId)
    .maybeSingle();

  if (error) {
    throw new Error(`companies select failed: ${error.message}`);
  }
  return data;
}

/**
 * Batch-resolve multiple company rows by legacy mock id.
 * Used by the Firmalar list cutover to fetch the Ana Yetkili column for
 * many firmas in a single query.
 *
 * Returns only rows the caller can read per RLS — out-of-scope rows are
 * silently dropped. The caller should treat a missing legacy_mock_id in
 * the result as "this firma is not visible to me right now".
 */
export async function selectCompaniesByLegacyMockIds(
  client: Client,
  legacyMockIds: string[],
): Promise<CompanyRow[]> {
  if (legacyMockIds.length === 0) return [];

  const { data, error } = await client
    .from("companies")
    .select("*")
    .in("legacy_mock_id", legacyMockIds);

  if (error) {
    throw new Error(`companies select failed: ${error.message}`);
  }
  return data ?? [];
}

/**
 * Batch-resolve multiple company rows by their real UUID ids.
 * Added in Faz 2 (Sözleşmeler) so the Sözleşmeler list page can show
 * the firma name column without doing a per-row join.
 */
/**
 * Read every company visible to the caller. RLS-filtered.
 */
export async function selectAllCompanies(
  client: Client,
): Promise<CompanyRow[]> {
  const { data, error } = await client
    .from("companies")
    .select("*");

  if (error) {
    throw new Error(`companies select-all failed: ${error.message}`);
  }
  return data ?? [];
}

/**
 * Read companies whose name matches `name` case-insensitively, within the
 * caller's visible set. Used by the inline-create path to warn about a
 * probable duplicate before writing — never to block.
 *
 * Exact match, not fuzzy: this exists to catch "the firma is already in the
 * list and you did not notice", not to guess at near-misses.
 */
export async function selectCompaniesByExactName(
  client: Client,
  name: string,
): Promise<CompanyRow[]> {
  const { data, error } = await client
    .from("companies")
    .select("*")
    .ilike("name", name);

  if (error) {
    throw new Error(`companies select-by-name failed: ${error.message}`);
  }
  return data ?? [];
}

/**
 * Insert one company row and return it.
 *
 * Raw CRUD: the caller supplies the whole payload, including the
 * server-resolved `tenant_id`. No defaulting and no role check here — the
 * service layer owns those, RLS (`companies_insert_yonetici`) is the
 * database boundary.
 */
export async function insertCompany(
  client: Client,
  payload: CompanyInsert,
): Promise<CompanyRow> {
  const { data, error } = await client
    .from("companies")
    .insert(payload)
    .select()
    .single();

  if (error || !data) {
    throw new Error(
      `companies insert failed: ${error?.message ?? "no row returned"}`,
    );
  }
  return data;
}

export async function selectCompaniesByIds(
  client: Client,
  companyIds: string[],
): Promise<CompanyRow[]> {
  if (companyIds.length === 0) return [];

  const { data, error } = await client
    .from("companies")
    .select("*")
    .in("id", companyIds);

  if (error) {
    throw new Error(`companies select failed: ${error.message}`);
  }
  return data ?? [];
}
