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
  selectCompaniesByExactName,
  insertCompany,
} from "@/lib/supabase/companies";
import type { CompanyInsert } from "@/types/database.types";
import type { FirmaDurumu, RiskSeviyesi } from "@/types/ui";

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

// UUID shape gate for the fallback lookup — a garbage `/firmalar/[id]`
// param passed straight into `.eq("id", …)` would otherwise raise
// Postgres 22P02 (invalid uuid syntax) instead of the domain error the
// callers branch on.
const UUID_SHAPE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Resolve a company by legacy mock id OR real UUID.
 * Tries legacy lookup first, falls back to UUID lookup.
 * Returns the company row or throws CompanyNotFoundOrOutOfScopeError.
 *
 * This enables both legacy-era (f1..f8) and imported (UUID) companies
 * to be opened in the detail view.
 */
export async function resolveCompanyByIdOrLegacy(
  client: Client,
  idOrLegacy: string,
): Promise<CompanyRow> {
  // Try legacy lookup first
  const byLegacy = await getCompanyByLegacyMockId(client, idOrLegacy);
  if (byLegacy) return byLegacy;

  // UUID fallback only for uuid-shaped input (see UUID_SHAPE note).
  if (UUID_SHAPE.test(idOrLegacy)) {
    const { selectCompanyById } = await import("@/lib/supabase/companies");
    const byId = await selectCompanyById(client, idOrLegacy);
    if (byId) return byId;
  }

  throw new CompanyNotFoundOrOutOfScopeError(idOrLegacy);
}

/**
 * Resolve a legacy mock id and throw if no scoped row is found.
 *
 * Used by every contact-mutation entry point that takes a legacy id, so
 * the partner-scope re-verification rule from PARTNER_SCOPE_TOUCHPOINTS.md
 * §3 happens automatically: if RLS hides the firma, this throws and the
 * mutation never reaches the contacts table.
 *
 * Same resolution semantics as `resolveCompanyByIdOrLegacy` — the two
 * were byte-identical copies and have been merged to stop them drifting.
 */
export async function requireCompanyByLegacyMockId(
  client: Client,
  legacyMockId: string,
): Promise<CompanyRow> {
  return resolveCompanyByIdOrLegacy(client, legacyMockId);
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

// ---------------------------------------------------------------------------
// Passive-company guard (read-only) — shared by the new-operation server
// actions (document upload, contact create). Reads the company's status
// tenant-scoped (id + tenant_id) and fails closed when the row is absent
// (out of scope / not found) or the company is `pasif`. No write. Callers
// MUST invoke this BEFORE any side-effecting step so a pasif company
// cannot produce a row or a storage object.
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Writes — inline create (B batch)
// ---------------------------------------------------------------------------

export type CompanyCreateInput = {
  name: string;
  sector?: string;
  city?: string;
};

/**
 * Thrown when the supplied name is blank after trimming. Name is the only
 * genuinely required field — the production schema leaves sector and city
 * nullable, so the application must not invent a stricter contract.
 */
export class CompanyValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CompanyValidationError";
  }
}

/**
 * Find companies already carrying this exact name, so a caller can warn
 * before creating a second one.
 *
 * Deliberately NOT a uniqueness rule: the database has no unique constraint
 * on companies.name and two real firms can legitimately share a name. This
 * is a "did you mean the existing one?" prompt, and blocking on it would
 * make a legal case impossible to enter.
 */
export async function findCompaniesByExactName(
  client: Client,
  name: string,
): Promise<CompanyRow[]> {
  const trimmed = name.trim();
  if (!trimmed) return [];
  return selectCompaniesByExactName(client, trimmed);
}

/**
 * Create a company from the inline (randevu / talep) create path.
 *
 * Behavior:
 *   - Trims and requires `name`; `sector` / `city` are optional and become
 *     NULL when blank.
 *   - Status is `aday`, NOT the `aktif` default the Excel import uses. A
 *     firma entered mid-conversation is a prospect, not an active customer,
 *     and `aday` is already in STATUS_DICTIONARY. It also stays usable
 *     immediately: the passive-company guard rejects only `pasif`, so the
 *     new firma can receive the randevu or talep being created alongside it.
 *   - `risk` defaults to `dusuk`, matching the import path.
 *   - `created_by` comes from the session; id / created_at / updated_at /
 *     legacy_mock_id are never written.
 *   - `options.tenantId` is REQUIRED and must be server-resolved via
 *     `current_user_active_tenant()`. Production `companies.tenant_id` is
 *     NOT NULL and `companies_insert_yonetici` checks it, so an insert
 *     without it fails. Never read it from a client payload.
 *
 * No role check here — the server action holds the yonetici gate and RLS
 * enforces the same boundary. Duplicate-name detection is the CALLER's
 * business (see findCompaniesByExactName); this function writes.
 */
export async function createCompany(
  client: Client,
  input: CompanyCreateInput,
  options: { tenantId: string },
): Promise<CompanyRow> {
  const name = input.name?.trim() ?? "";
  if (!name) {
    throw new CompanyValidationError("Firma adı zorunludur.");
  }

  const {
    data: { user },
  } = await client.auth.getUser();

  const payload: CompanyInsert = {
    tenant_id: options.tenantId,
    name,
    sector: input.sector?.trim() || null,
    city: input.city?.trim() || null,
    status: "aday" as FirmaDurumu,
    risk: "dusuk" as RiskSeviyesi,
    created_by: user?.id ?? null,
  };

  return insertCompany(client, payload);
}

export async function assertCompanyIsActiveForNewOperation(
  client: Client,
  companyId: string,
  tenantId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data, error } = await client
    .from("companies")
    .select("status")
    .eq("id", companyId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (error) {
    return { ok: false, error: "Firma durumu doğrulanamadı." };
  }
  if (!data) {
    return { ok: false, error: "Firma bulunamadı veya erişim yok." };
  }
  if (data.status === "pasif") {
    return { ok: false, error: "Firma pasif olduğu için yeni işlem oluşturulamaz." };
  }
  return { ok: true };
}
