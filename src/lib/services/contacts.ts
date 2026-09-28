/** Company-bound contact services. SQL enforces roles, ownership and field constraints. */

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Database,
  ContactRow,
} from "@/types/database.types";
import {
  selectContactsByCompanyId,
  selectPrimaryContactsByCompanyIds,
  selectContactByIdAndCompany,
  writeCompanyContact,
  executeContact,
  type ContactCommandScope,
} from "@/lib/supabase/contacts";
import { requireCompanyByLegacyMockId } from "@/lib/services/companies";

type Client = SupabaseClient<Database>;

// ---------------------------------------------------------------------------
// Invariant constants — kept in sync with ROLE_MATRIX.md §5.1.1
// ---------------------------------------------------------------------------

export const MAX_CONTACTS_PER_COMPANY = 5;

// ---------------------------------------------------------------------------
// Errors — distinct subclasses so the UI can branch (e.g. show the
// "Maksimum 5 yetkili" hint vs. the "telefon veya e-posta" hint)
// ---------------------------------------------------------------------------

export class ContactValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ContactValidationError";
  }
}

export class ContactLimitReachedError extends ContactValidationError {
  constructor() {
    super(`Bir firmaya en fazla ${MAX_CONTACTS_PER_COMPANY} yetkili kişi eklenebilir.`);
    this.name = "ContactLimitReachedError";
  }
}

// ---------------------------------------------------------------------------
// UI-facing input shapes — these intentionally do NOT include `id`,
// `company_id`, or DB-managed timestamps. The service synthesizes those.
// ---------------------------------------------------------------------------

export interface ContactCreateInput {
  fullName: string;
  title?: string;
  phone?: string;
  email?: string;
  isPrimary: boolean;
  contextNote?: string;
}

export interface ContactFullUpdateInput {
  fullName: string;
  title?: string;
  phone?: string;
  email?: string;
  isPrimary: boolean;
  contextNote?: string;
}

export interface ContactPhoneEmailUpdateInput {
  phone?: string;
  email?: string;
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

function normalizeOptional(value: string | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed.length === 0 ? null : trimmed;
}

function ensurePhoneOrEmail(phone: string | null, email: string | null): void {
  if (!phone && !email) {
    throw new ContactValidationError(
      "Telefon veya e-posta alanlarından en az biri zorunludur.",
    );
  }
}

function ensureFullName(fullName: string): string {
  const trimmed = fullName.trim();
  if (trimmed.length === 0) {
    throw new ContactValidationError("Ad soyad boş bırakılamaz.");
  }
  return trimmed;
}

/**
 * Bind a contact mutation to the firma the caller resolved. Without this
 * check a mismatched (legacyMockId, contactId) pair would mutate a
 * contact in a DIFFERENT company than the one whose scope was verified —
 * e.g. demote firma A's primaries while promoting a contact of firma B.
 * Returns the existing row so callers can merge partial updates.
 */
async function requireContactInCompany(
  client: Client,
  companyId: string,
  contactId: string,
): Promise<ContactRow> {
  const existing = await selectContactByIdAndCompany(client, contactId, companyId);
  if (!existing) {
    throw new ContactValidationError(
      "Yetkili bulunamadı veya bu firmaya ait değil.",
    );
  }
  return existing;
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/**
 * List the contacts for a firma identified by legacy mock id.
 *
 * Resolution flow:
 *   legacy id → companies row (RLS-checked) → contacts.company_id query
 *
 * If RLS hides the firma from the caller, the resolver throws
 * CompanyNotFoundOrOutOfScopeError and no contacts are returned. This
 * matches the partner-scope rule from PARTNER_SCOPE_TOUCHPOINTS.md §2.1.
 */
export async function listContactsByLegacyCompanyId(
  client: Client,
  legacyMockId: string,
): Promise<ContactRow[]> {
  const company = await requireCompanyByLegacyMockId(client, legacyMockId);
  return selectContactsByCompanyId(client, company.id);
}

/**
 * Batch helper for the Firmalar list Ana Yetkili column.
 *
 * Returns a map of `{ legacyMockId → primary contact full name }`.
 *
 * Out-of-scope firmas and firmas with no primary contact are silently
 * absent from the result; the caller renders an em-dash placeholder.
 *
 * Implementation: two queries, both batched, no N+1.
 *
 *   1. Resolve legacy ids → real company rows
 *   2. Fetch every primary contact whose company_id is in that set
 */
export async function getPrimaryContactNamesByLegacyIds(
  client: Client,
  legacyMockIds: string[],
): Promise<Record<string, string>> {
  if (legacyMockIds.length === 0) return {};

  // Step 1: legacy ids → real companies.id (subject to RLS)
  const { selectCompaniesByLegacyMockIds } = await import(
    "@/lib/supabase/companies"
  );
  const companies = await selectCompaniesByLegacyMockIds(client, legacyMockIds);

  if (companies.length === 0) return {};

  const idToLegacy: Record<string, string> = {};
  for (const c of companies) {
    if (c.legacy_mock_id) idToLegacy[c.id] = c.legacy_mock_id;
  }

  // Step 2: primary contacts for those companies
  const primaryContacts = await selectPrimaryContactsByCompanyIds(
    client,
    Object.keys(idToLegacy),
  );

  const result: Record<string, string> = {};
  for (const contact of primaryContacts) {
    const legacy = idToLegacy[contact.company_id];
    if (legacy) {
      result[legacy] = contact.full_name;
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Writes — create
// ---------------------------------------------------------------------------

/**
 * Create a new yetkili for a firma identified by legacy mock id.
 *
 * Lower-level service: relies on the caller-supplied Supabase client and
 * the database command for authorization/scope. The
 * active app create path is guarded by `createContactAction` (currently
 * yonetici-only at the app level). Company scope is resolved here and
 * ultimately enforced by the database command.
 *
 * Service-level validations (unchanged):
 *   - Resolves the company via the company resolver (throws on miss).
 *   - Enforces the max-5-per-firma rule with a count read before insert.
 *   - Enforces phone-or-email at the application layer.
 *   - The RPC locks the company, rechecks the count, and atomically
 *     demotes/promotes the primary. A failed target write rolls back both.
 *   - Returns the inserted ContactRow so the caller can update local
 *     state without a refetch.
 */
export async function createContact(
  client: Client,
  legacyMockId: string,
  input: ContactCreateInput,
): Promise<ContactRow> {
  const company = await requireCompanyByLegacyMockId(client, legacyMockId);

  const fullName = ensureFullName(input.fullName);
  const phone = normalizeOptional(input.phone);
  const email = normalizeOptional(input.email);
  ensurePhoneOrEmail(phone, email);

  // Application-level max-5 check (DB also enforces via constraint trigger).
  const existing = await selectContactsByCompanyId(client, company.id);
  if (existing.length >= MAX_CONTACTS_PER_COMPANY) {
    throw new ContactLimitReachedError();
  }

  return writeCompanyContact(client, {
    p_company_id: company.id, p_contact_id: null,
    p_full_name: fullName, p_title: normalizeOptional(input.title),
    p_phone: phone, p_email: email, p_is_primary: input.isPrimary,
    p_context_note: normalizeOptional(input.contextNote),
  });
}

// ---------------------------------------------------------------------------
// Writes — full update (manager only)
// ---------------------------------------------------------------------------

/**
 * Full edit is a manager-only RPC command in the verified tenant.
 * Operasyon uses updateContactPhoneEmail; that bounded path preserves omitted fields under the SQL row lock.
 */
export async function updateContactFull(
  client: Client,
  legacyMockId: string,
  contactId: string,
  input: ContactFullUpdateInput,
): Promise<ContactRow> {
  const company = await requireCompanyByLegacyMockId(client, legacyMockId);
  // Bind the target row to the resolved firma BEFORE any write — a
  // mismatched pair must not demote this firma's primaries.
  await requireContactInCompany(client, company.id, contactId);

  const fullName = ensureFullName(input.fullName);
  const phone = normalizeOptional(input.phone);
  const email = normalizeOptional(input.email);
  ensurePhoneOrEmail(phone, email);

  return writeCompanyContact(client, {
    p_company_id: company.id, p_contact_id: contactId,
    p_full_name: fullName, p_title: normalizeOptional(input.title),
    p_phone: phone, p_email: email, p_is_primary: input.isPrimary,
    p_context_note: normalizeOptional(input.contextNote),
  });
}

// ---------------------------------------------------------------------------
// Writes — bounded operasyon update
// ---------------------------------------------------------------------------

/** Resolve identity once; SQL rechecks it after acquiring configuration/profile locks. */
async function commandScope(client: Client, companyId: string): Promise<ContactCommandScope> {
  const company = await requireCompanyByLegacyMockId(client, companyId);
  const {data, error} = await client.auth.getUser();
  if (error || !data.user) throw new ContactValidationError("Oturum bulunamadı. Lütfen tekrar giriş yapın.");
  return {companyId: company.id, tenantId: company.tenant_id, actorId: data.user.id};
}

/** Omitted fields stay untouched; SQL merges with the locked current row. */
export async function updateContactPhoneEmail(
  client: Client, companyId: string, contactId: string, input: ContactPhoneEmailUpdateInput,
): Promise<ContactRow> {
  const patch: Record<string, string | null> = {};
  if (input.phone !== undefined) patch.phone = normalizeOptional(input.phone);
  if (input.email !== undefined) patch.email = normalizeOptional(input.email);
  if (!Object.keys(patch).length) throw new ContactValidationError("Güncellenecek telefon veya e-posta girin.");
  return executeContact(client, await commandScope(client, companyId), "communication", contactId, patch);
}

/** Missing or mismatched targets fail rather than acknowledge a deletion. */
export async function removeContact(client: Client, companyId: string, contactId: string): Promise<ContactRow> {
  return executeContact(client, await commandScope(client, companyId), "delete", contactId, {});
}
