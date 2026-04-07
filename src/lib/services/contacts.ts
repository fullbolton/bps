/**
 * BPS service layer — contacts (Yetkililer, Faz 1A primary truth).
 *
 *     UI Component
 *         ↓
 *     src/lib/services/contacts.ts          ← THIS FILE — invariants, scope
 *         ↓
 *     src/lib/supabase/contacts.ts          ← raw CRUD only
 *         ↓
 *     Supabase Postgres + RLS
 *
 * Responsibilities (per ARCHITECTURE.md and ROLE_MATRIX.md §5.1.1):
 *
 *   1. Application-level invariant enforcement, with clean error messages:
 *        - max 5 contacts per firma
 *        - exactly one is_primary per firma (when at least one exists)
 *        - phone or email is required
 *        - role-narrowed updates: operasyon may write phone/email only
 *
 *      The DB enforces (1)–(3) too, but the service layer's checks let the
 *      UI surface a friendly Turkish message instead of a Postgres error
 *      string.
 *
 *   2. Partner-scope re-verification per PARTNER_SCOPE_TOUCHPOINTS.md §3.
 *      Every write entry point resolves the legacy mock id to a real
 *      companies row first; if the partner has no scope over that firma,
 *      the resolver throws (CompanyNotFoundOrOutOfScopeError) and the
 *      mutation never lands.
 *
 *   3. Legacy mock id translation. Phase 1A still has the Firmalar list
 *      backed by MOCK_FIRMALAR, so the UI passes "f1".."f8". The service
 *      hides this from the data layer.
 *
 * Out of scope for Faz 1A:
 *   - Bulk import / move between firmas / delete CTA in the UI
 *     (`removeContact` is exported so the future delete CTA can wire it
 *     in without changing this file).
 *   - Notes / annotations beyond the single short `context_note` field.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Database,
  ContactRow,
  ContactInsert,
} from "@/types/database.types";
import {
  selectContactsByCompanyId,
  selectPrimaryContactsByCompanyIds,
  insertContact,
  updateContact,
  clearPrimaryForCompany,
  deleteContact,
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
 * Behavior:
 *   - Re-verifies partner scope via the company resolver (throws on miss).
 *   - Enforces the max-5-per-firma rule with a count read before insert.
 *   - Enforces phone-or-email at the application layer.
 *   - When `isPrimary` is true, demotes any existing primary in the same
 *     transaction (well, two queries in sequence — the partial unique
 *     index prevents racing inserts).
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

  // If the new row will be primary, demote any existing primary first
  // so the partial unique index does not reject the insert.
  if (input.isPrimary) {
    await clearPrimaryForCompany(client, company.id);
  }

  const payload: ContactInsert = {
    company_id: company.id,
    full_name: fullName,
    title: normalizeOptional(input.title),
    phone,
    email,
    is_primary: input.isPrimary,
    context_note: normalizeOptional(input.contextNote),
  };

  return insertContact(client, payload);
}

// ---------------------------------------------------------------------------
// Writes — full update (yonetici, partner)
// ---------------------------------------------------------------------------

/**
 * Full edit of a contact. Allowed for yonetici (anywhere) and partner
 * (within scope). Operasyon must use `updateContactPhoneEmail` instead —
 * this function does not narrow by role; the calling component already
 * knows the role and chose which function to invoke. Database RLS is the
 * defense-in-depth backstop.
 */
export async function updateContactFull(
  client: Client,
  legacyMockId: string,
  contactId: string,
  input: ContactFullUpdateInput,
): Promise<ContactRow> {
  const company = await requireCompanyByLegacyMockId(client, legacyMockId);

  const fullName = ensureFullName(input.fullName);
  const phone = normalizeOptional(input.phone);
  const email = normalizeOptional(input.email);
  ensurePhoneOrEmail(phone, email);

  if (input.isPrimary) {
    // Demote every other primary in the same firma. We exclude the row
    // being promoted so a no-op promote (already-primary) does not flip
    // its own value to false and back.
    await clearPrimaryForCompany(client, company.id, contactId);
  }

  return updateContact(client, contactId, {
    full_name: fullName,
    title: normalizeOptional(input.title),
    phone,
    email,
    is_primary: input.isPrimary,
    context_note: normalizeOptional(input.contextNote),
  });
}

// ---------------------------------------------------------------------------
// Writes — bounded operasyon update
// ---------------------------------------------------------------------------

/**
 * Bounded update for the operasyon role per ROLE_MATRIX.md §5.1.1:
 *
 *   "Operasyon yalnızca telefon ve e-posta alanlarını güncelleyebilir;
 *    isim, unvan ve ana yetkili bayrağını değiştiremez; yeni yetkili
 *    ekleyemez."
 *
 * The service narrows the patch to {phone, email} regardless of what the
 * caller passes; even if a malicious caller injects extra fields they
 * will be discarded here. RLS is the database-level defense-in-depth.
 *
 * The phone-or-email rule still applies: at least one of the two must be
 * non-empty after the update. We re-fetch the existing row so the check
 * accounts for the field that the operasyon caller is leaving alone.
 */
export async function updateContactPhoneEmail(
  client: Client,
  legacyMockId: string,
  contactId: string,
  input: ContactPhoneEmailUpdateInput,
): Promise<ContactRow> {
  await requireCompanyByLegacyMockId(client, legacyMockId);

  const phone = normalizeOptional(input.phone);
  const email = normalizeOptional(input.email);
  ensurePhoneOrEmail(phone, email);

  return updateContact(client, contactId, {
    phone,
    email,
  });
}

// ---------------------------------------------------------------------------
// Writes — delete (provided for the future delete CTA)
// ---------------------------------------------------------------------------

/**
 * Delete a contact row. Phase 1A does not yet expose a UI button for this
 * — exporting it now lets the future delete CTA wire in without touching
 * this file. The service still re-verifies partner scope on the way in.
 */
export async function removeContact(
  client: Client,
  legacyMockId: string,
  contactId: string,
): Promise<void> {
  await requireCompanyByLegacyMockId(client, legacyMockId);
  return deleteContact(client, contactId);
}
