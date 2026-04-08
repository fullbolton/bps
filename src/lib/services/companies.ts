/**
 * BPS service layer — companies (Faz 1A minimal anchor).
 *
 *     UI Component
 *         ↓
 *     src/lib/services/companies.ts          ← THIS FILE — business logic
 *         ↓
 *     src/lib/supabase/companies.ts          ← raw CRUD only
 *         ↓
 *     Supabase Postgres + RLS
 *
 * Faz 1A scope:
 *   - The Yetkililer cutover needs a way to translate "f1".."f8" (the
 *     legacy mock ids hard-coded in MOCK_FIRMALAR) into real
 *     `companies.id` UUID values so contact reads/writes can target the
 *     correct firma.
 *   - The Firmalar list Ana Yetkili column needs a batched lookup that
 *     joins legacy ids → companies → primary contact in one round trip.
 *
 * Both flows live here as service functions instead of leaking into the
 * UI components, so the eventual full Firmalar migration only needs to
 * touch this file when `legacy_mock_id` is finally dropped.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, CompanyRow } from "@/types/database.types";
import {
  selectCompanyByLegacyMockId,
  selectCompaniesByLegacyMockIds,
  selectCompaniesByIds,
} from "@/lib/supabase/companies";

type Client = SupabaseClient<Database>;

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

/**
 * Thrown when a legacy mock id has no corresponding companies row, OR when
 * the calling user has no RLS access to it. The two cases are intentionally
 * indistinguishable from the service-layer surface so callers cannot probe
 * scope by id existence.
 */
export class CompanyNotFoundOrOutOfScopeError extends Error {
  readonly legacyMockId: string;
  constructor(legacyMockId: string) {
    super(
      `Firma bulunamadı veya bu firmaya erişim yetkiniz yok (legacy id=${legacyMockId})`,
    );
    this.name = "CompanyNotFoundOrOutOfScopeError";
    this.legacyMockId = legacyMockId;
  }
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/**
 * Resolve a legacy mock id (e.g. "f1") to its real companies row.
 *
 * Returns null when:
 *   - The legacy id has no row in the companies table, OR
 *   - The row exists but RLS hides it from the caller (e.g. a partner
 *     viewing a firma not in their scope).
 *
 * Both cases are handled the same way by callers — the slice currently
 * does not need to distinguish them.
 */
export async function getCompanyByLegacyMockId(
  client: Client,
  legacyMockId: string,
): Promise<CompanyRow | null> {
  if (!legacyMockId) {
    throw new Error("getCompanyByLegacyMockId: legacyMockId is required");
  }
  return selectCompanyByLegacyMockId(client, legacyMockId);
}

/**
 * Resolve a legacy mock id and throw if no scoped row is found.
 *
 * Used by every contact-mutation entry point that takes a legacy id, so
 * the partner-scope re-verification rule from PARTNER_SCOPE_TOUCHPOINTS.md
 * §3 happens automatically: if RLS hides the firma, this throws and the
 * mutation never reaches the contacts table.
 */
export async function requireCompanyByLegacyMockId(
  client: Client,
  legacyMockId: string,
): Promise<CompanyRow> {
  const company = await getCompanyByLegacyMockId(client, legacyMockId);
  if (!company) {
    throw new CompanyNotFoundOrOutOfScopeError(legacyMockId);
  }
  return company;
}

/**
 * Batch helper: takes a set of legacy mock ids and returns a map of
 *   { legacyMockId → real companies.id (uuid) }
 *
 * Used by the Firmalar list cutover to translate the still-mock-backed
 * row ids into real ids in a single query. Out-of-scope rows are silently
 * absent from the returned map (consistent with the rest of this layer).
 */
export async function getCompanyIdMapByLegacyMockIds(
  client: Client,
  legacyMockIds: string[],
): Promise<Record<string, string>> {
  if (legacyMockIds.length === 0) return {};

  const rows = await selectCompaniesByLegacyMockIds(client, legacyMockIds);
  const map: Record<string, string> = {};
  for (const row of rows) {
    if (row.legacy_mock_id) {
      map[row.legacy_mock_id] = row.id;
    }
  }
  return map;
}

/**
 * Batch helper: returns a map of `{ companyId (uuid) → display name }`
 * AND a parallel map of `{ companyId → legacy_mock_id }` (when set).
 *
 * Added in Faz 2 so the Sözleşmeler list page can render the firma
 * column and route to the firma detail page (which still uses legacy
 * mock ids in its URL until the full Firmalar migration). Out-of-scope
 * rows are silently absent.
 */
export async function getCompanyDisplayMapByIds(
  client: Client,
  companyIds: string[],
): Promise<{
  nameById: Record<string, string>;
  legacyById: Record<string, string>;
}> {
  if (companyIds.length === 0) return { nameById: {}, legacyById: {} };

  const rows = await selectCompaniesByIds(client, companyIds);
  const nameById: Record<string, string> = {};
  const legacyById: Record<string, string> = {};
  for (const row of rows) {
    nameById[row.id] = row.name;
    if (row.legacy_mock_id) {
      legacyById[row.id] = row.legacy_mock_id;
    }
  }
  return { nameById, legacyById };
}
