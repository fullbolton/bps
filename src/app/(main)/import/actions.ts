"use server";

/**
 * BPS CSV Import — Server Actions
 *
 * The three confirm-time import writes — companies, contacts, contracts —
 * all run server-side here (`importCompaniesAction`,
 * `importContactsAction`, `importContractsAction`). None uses the browser
 * write path any more; the page only previews client-side and delegates
 * the final write to these actions. No service_role anywhere — the client
 * is always `createServerSupabaseClient()` (anon key + cookie session),
 * RLS enforced.
 *
 *   1. Identity & authorization come from the same DB source RLS uses.
 *      - Role: `current_user_role()` (reads `profiles.role` by
 *        `auth.uid()`) — yonetici-only for every import action, narrower
 *        than the partner-capable contacts/contracts INSERT RLS.
 *        `user.user_metadata.role` is intentionally never consulted.
 *      - Active tenant: `current_user_active_tenant()` is the SINGLE
 *        source. Used to set companies/contracts `tenant_id` and as a
 *        fail-closed gate. NOTE: contacts has no tenant_id column — its
 *        tenant scope is enforced by RLS via company_id → companies, so
 *        the contacts action does not write tenant_id.
 *
 *   2. Payload control. Each action strips `row.data` to a per-entity
 *      allow-list and re-validates against the DB CHECK constraints
 *      (status/risk whitelists, contacts phone-or-email, contracts date
 *      rules). Client-supplied id / tenant_id / created_by / created_at /
 *      updated_at / legacy_mock_id are never written; created_by is
 *      stamped server-side and tenant_id is server-resolved. Company
 *      name → id resolution runs server-side via `buildCompanyNameMap`.
 *
 * RLS is the final write boundary; any rejection surfaces per-row in
 * `ImportResult.errors[]` (rendered by the import UI). No UPDATE / UPSERT
 * / DELETE, no DB migration or policy change here.
 */

import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildCompanyNameMap,
  importCompanies,
  importContacts,
  importContracts,
} from "@/lib/import/import-service";
import type { ImportResult } from "@/lib/import/import-service";
import type { ParsedRow } from "@/lib/import/csv-parser";
import { convertDateForDB } from "@/lib/import/csv-parser";
import type { Database } from "@/types/database.types";

type ServerClient = SupabaseClient<Database>;

// Server-side allow-lists. Duplicated from `csv-parser.ts` on purpose
// — that file's checks live in the browser and can be bypassed by a
// tampered client. These guard the DB write directly.
const ALLOWED_STATUS = new Set(["aday", "aktif", "pasif"]);
const ALLOWED_RISK = new Set(["dusuk", "orta", "yuksek"]);

// Only these keys from `row.data` are passed to the insert. Anything
// else the client put on the payload (id, tenant_id, created_by,
// created_at, updated_at, legacy_mock_id, …) is dropped before the row
// reaches `importCompanies`.
const ALLOWED_COMPANY_FIELDS = ["name", "sector", "city", "status", "risk"] as const;

function sanitizeCompanyRow(row: ParsedRow): ParsedRow {
  const allowed: Record<string, string> = {};
  for (const key of ALLOWED_COMPANY_FIELDS) {
    const raw = row.data[key]?.trim();
    if (raw) allowed[key] = raw;
  }

  const errors = [...row.errors];

  // Re-validate status/risk on the server (defense in depth).
  if (allowed.status && !ALLOWED_STATUS.has(allowed.status)) {
    errors.push(`status reddedildi: "${allowed.status}"`);
    delete allowed.status;
  }
  if (allowed.risk && !ALLOWED_RISK.has(allowed.risk)) {
    errors.push(`risk reddedildi: "${allowed.risk}"`);
    delete allowed.risk;
  }

  // `name` is required at the application layer too.
  if (!allowed.name) {
    errors.push("name zorunlu (server)");
  }

  return {
    rowIndex: row.rowIndex,
    data: allowed,
    errors,
    valid: errors.length === 0,
  };
}

// ---------------------------------------------------------------------------
// Contacts allow-list + server-side validation (mirrors the contacts DB
// CHECK: full_name not blank, at least one of phone/email).
// ---------------------------------------------------------------------------
const ALLOWED_CONTACT_FIELDS = [
  "company_name",
  "full_name",
  "title",
  "phone",
  "email",
  "is_primary",
  "context_note",
] as const;

// Deliberately permissive single-line email shape — "basic format if
// supplied" per the brief, not a full RFC validator.
const BASIC_EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function sanitizeContactRow(row: ParsedRow): ParsedRow {
  const allowed: Record<string, string> = {};
  for (const key of ALLOWED_CONTACT_FIELDS) {
    const raw = row.data[key]?.trim();
    if (raw) allowed[key] = raw;
  }

  const errors = [...row.errors];

  if (!allowed.company_name) errors.push("firma adı zorunlu (server)");
  if (!allowed.full_name) errors.push("ad soyad zorunlu (server)");
  // contacts CHECK: at least one of phone / email.
  if (!allowed.phone && !allowed.email) {
    errors.push("telefon veya e-posta zorunlu (server)");
  }
  if (allowed.email && !BASIC_EMAIL.test(allowed.email)) {
    errors.push(`e-posta formatı geçersiz: "${allowed.email}" (server)`);
  }

  return {
    rowIndex: row.rowIndex,
    data: allowed,
    errors,
    valid: errors.length === 0,
  };
}

// ---------------------------------------------------------------------------
// Contracts allow-list + server-side validation (mirrors the contracts
// DB CHECK: name not blank; status whitelist; aktif/imza_bekliyor require
// both dates; end_date >= start_date).
// ---------------------------------------------------------------------------
const ALLOWED_CONTRACT_FIELDS = [
  "company_name",
  "name",
  "contract_type",
  "start_date",
  "end_date",
  "status",
  "contract_value",
  "scope",
  "responsible",
  "last_action_label",
  "renewal_target_date",
] as const;

const ALLOWED_CONTRACT_STATUS = new Set([
  "taslak",
  "imza_bekliyor",
  "aktif",
  "suresi_doldu",
  "feshedildi",
]);

function sanitizeContractRow(row: ParsedRow): ParsedRow {
  const allowed: Record<string, string> = {};
  for (const key of ALLOWED_CONTRACT_FIELDS) {
    const raw = row.data[key]?.trim();
    if (raw) allowed[key] = raw;
  }

  const errors = [...row.errors];

  if (!allowed.company_name) errors.push("firma adı zorunlu (server)");
  if (!allowed.name) errors.push("sözleşme adı zorunlu (server)");

  // Effective status mirrors the insert default in importContracts
  // (`status || "taslak"`). Date requirements key off the effective value.
  const effectiveStatus = allowed.status ?? "taslak";
  if (allowed.status && !ALLOWED_CONTRACT_STATUS.has(allowed.status)) {
    errors.push(`status reddedildi: "${allowed.status}"`);
  }

  // Per-field date validation. A date the user actually supplied must
  // parse via the existing CSV convention (DD.MM.YYYY → ISO); otherwise
  // the row is invalid. This closes the silent-null gap where a present
  // but malformed start/end/renewal date used to fall through to
  // `convertDateForDB(...) === null` at insert time and import as NULL.
  // Empty date fields are absent from `allowed`, so they pass here and
  // are only required where the status demands them (checked below).
  const startIso = allowed.start_date ? convertDateForDB(allowed.start_date) : null;
  const endIso = allowed.end_date ? convertDateForDB(allowed.end_date) : null;

  if (allowed.start_date && !startIso) {
    errors.push("başlangıç tarihi formatı geçersiz (server, GG.AA.YYYY bekleniyor)");
  }
  if (allowed.end_date && !endIso) {
    errors.push("bitiş tarihi formatı geçersiz (server, GG.AA.YYYY bekleniyor)");
  }
  if (allowed.renewal_target_date && !convertDateForDB(allowed.renewal_target_date)) {
    errors.push("yenileme hedef tarihi formatı geçersiz (server, GG.AA.YYYY bekleniyor)");
  }

  // status aktif/imza_bekliyor → start_date and end_date are required.
  // (When present they must also parse — already enforced above.)
  const needsDates =
    effectiveStatus === "aktif" || effectiveStatus === "imza_bekliyor";
  if (needsDates && (!allowed.start_date || !allowed.end_date)) {
    errors.push(
      `status "${effectiveStatus}" için başlangıç ve bitiş tarihi zorunlu (server)`,
    );
  }

  // end_date >= start_date — only when both parsed to valid ISO. ISO
  // strings (yyyy-mm-dd) compare correctly lexicographically.
  if (startIso && endIso && endIso < startIso) {
    errors.push("bitiş tarihi başlangıç tarihinden önce olamaz (server)");
  }

  return {
    rowIndex: row.rowIndex,
    data: allowed,
    errors,
    valid: errors.length === 0,
  };
}

/**
 * Resolve the caller's role using the same source the DB policies use.
 * `current_user_role()` reads `profiles.role` by `auth.uid()`.
 */
async function resolveAuthenticatedRole(
  supabase: ServerClient,
): Promise<string | null> {
  const { data, error } = await supabase.rpc("current_user_role");
  if (error || typeof data !== "string") return null;
  return data;
}

/**
 * Resolve the caller's active tenant. Single source: the DB helper
 * `current_user_active_tenant()`, which reads the active tenant claim
 * from the top-level JWT and is the same function the SELECT policy
 * chain uses. No fallback path — if the RPC returns null / empty /
 * errors, the caller's `if (!tenantId)` branch fails closed with a
 * clean error result. (An earlier draft consulted a second JWT
 * location, but that location is NOT the source the helper reads, so
 * the fallback could resolve a value the RLS layer would not accept
 * and produce NOT NULL violation or silent mis-tenant inserts.
 * Removed.)
 *
 * UUID-shape gate is intentionally permissive: any non-empty string is
 * accepted here. If the value is structurally wrong, the downstream
 * INSERT will fail via the DB type system and surface as a normal
 * per-row error in `ImportResult.errors[]`.
 */
async function resolveActiveTenantId(
  supabase: ServerClient,
): Promise<string | null> {
  const { data, error } = await supabase.rpc("current_user_active_tenant");
  if (error) return null;
  if (typeof data !== "string" || data.length === 0) return null;
  return data;
}

export async function importCompaniesAction(
  rows: ParsedRow[],
): Promise<ImportResult> {
  // 1. Authenticated server context. `createServerSupabaseClient`
  //    reads the user's JWT from cookies via `next/headers`. There is
  //    no client-controlled identity input here.
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      imported: 0,
      skipped: rows.length,
      errors: ["Oturum geçersiz: import için yönetici girişi gerekir."],
    };
  }

  // 2. Role guard via DB truth (matches RLS). `user.user_metadata.role`
  //    is intentionally NOT consulted — it can drift from profiles.role.
  const role = await resolveAuthenticatedRole(supabase);
  if (role !== "yonetici") {
    return {
      imported: 0,
      skipped: rows.length,
      errors: ["Yetkisiz: bu işlem yalnızca yöneticiler tarafından yapılabilir."],
    };
  }

  // 3. Active tenant resolution. Server-set; never read from payload.
  const tenantId = await resolveActiveTenantId(supabase);
  if (!tenantId) {
    return {
      imported: 0,
      skipped: rows.length,
      errors: [
        "Aktif kiracı çözümlenemedi. Lütfen yönetim ekibine bildirin.",
      ],
    };
  }

  // 4. Strip client payload to the allow-list. Rows that lose their
  //    `name` or fail the status/risk allow-list become invalid and
  //    will be counted as `skipped` by `importCompanies`.
  const sanitized = rows.map(sanitizeCompanyRow);

  // 5. Delegate to the existing service with the SERVER client and
  //    the server-resolved tenant_id. `importCompanies` stamps
  //    `created_by` from this client's `auth.getUser()` (same
  //    authenticated user as above) and never sets id / created_at /
  //    updated_at / legacy_mock_id.
  //
  //    Note: if the `companies` INSERT RLS policy is missing or
  //    misaligned, the insert returns an error per row. Those errors
  //    are captured in `result.errors[]` and surfaced in the existing
  //    import UI. That is the expected state until the
  //    `companies_insert_yonetici` policy gate lands.
  return importCompanies(supabase, sanitized, { tenantId });
}

// ---------------------------------------------------------------------------
// Shared guard for the contacts/contracts actions: authenticated context,
// yonetici-only role guard (narrower than the contacts/contracts INSERT
// RLS, which also allows partner company-scope), and tenant resolution.
// Returns either a failed ImportResult or the resolved tenantId.
// ---------------------------------------------------------------------------
async function guardImport(
  supabase: ServerClient,
  rowCount: number,
): Promise<{ tenantId: string } | { fail: ImportResult }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      fail: {
        imported: 0,
        skipped: rowCount,
        errors: ["Oturum geçersiz: import için yönetici girişi gerekir."],
      },
    };
  }

  const role = await resolveAuthenticatedRole(supabase);
  if (role !== "yonetici") {
    return {
      fail: {
        imported: 0,
        skipped: rowCount,
        errors: ["Yetkisiz: bu işlem yalnızca yöneticiler tarafından yapılabilir."],
      },
    };
  }

  const tenantId = await resolveActiveTenantId(supabase);
  if (!tenantId) {
    return {
      fail: {
        imported: 0,
        skipped: rowCount,
        errors: ["Aktif kiracı çözümlenemedi. Lütfen yönetim ekibine bildirin."],
      },
    };
  }

  return { tenantId };
}

export async function importContactsAction(
  rows: ParsedRow[],
): Promise<ImportResult> {
  const supabase = await createServerSupabaseClient();
  const guard = await guardImport(supabase, rows.length);
  if ("fail" in guard) return guard.fail;

  // Company name → id resolution happens SERVER-SIDE with the server
  // client (RLS-scoped). Never trust a client-supplied company id.
  let companyMap: Map<string, string>;
  try {
    companyMap = await buildCompanyNameMap(supabase);
  } catch (err) {
    return {
      imported: 0,
      skipped: rows.length,
      errors: [`Firma eşlemesi alınamadı: ${err instanceof Error ? err.message : "bilinmeyen"}`],
    };
  }

  // contacts has NO tenant_id column — tenant scope is enforced by RLS
  // (company_id → companies.tenant_id). tenant_id is neither read from
  // the client nor written by the server here. The yonetici-only role
  // guard above still narrows the partner-capable INSERT RLS.
  const sanitized = rows.map(sanitizeContactRow);
  return importContacts(supabase, sanitized, companyMap);
}

export async function importContractsAction(
  rows: ParsedRow[],
): Promise<ImportResult> {
  const supabase = await createServerSupabaseClient();
  const guard = await guardImport(supabase, rows.length);
  if ("fail" in guard) return guard.fail;

  let companyMap: Map<string, string>;
  try {
    companyMap = await buildCompanyNameMap(supabase);
  } catch (err) {
    return {
      imported: 0,
      skipped: rows.length,
      errors: [`Firma eşlemesi alınamadı: ${err instanceof Error ? err.message : "bilinmeyen"}`],
    };
  }

  const sanitized = rows.map(sanitizeContractRow);
  return importContracts(supabase, sanitized, companyMap, {
    tenantId: guard.tenantId,
  });
}
