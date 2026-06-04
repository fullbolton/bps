"use server";

/**
 * BPS CSV Import — Server Actions
 *
 * Hardens the companies INSERT path in two layers:
 *
 *   1. Identity & authorization come from the same DB source RLS uses.
 *      - Role: `current_user_role()` via supabase.rpc. This function
 *        reads `profiles.role` keyed by `auth.uid()` — exactly what
 *        the policies on companies / contacts / contracts inspect.
 *        The previous `user.user_metadata.role` check is gone; that
 *        path can drift from the profiles truth and let the app and
 *        the DB disagree about who is allowed to write.
 *      - Active tenant: `current_user_active_tenant()` via supabase.rpc
 *        is the SINGLE source of truth. The DB helper reads the active
 *        tenant claim from the top-level JWT, and the SELECT policy
 *        chain uses the same helper. There is no second resolution
 *        path: a fallback that reads a different location than the
 *        helper would either re-introduce the two-truths drift this
 *        whole hardening pass removed or silently mask an RPC outage.
 *        If the RPC returns null / empty / errors, the action fails
 *        closed with `ImportResult.errors[0]` set; no insert attempted.
 *
 *   2. Payload control. Only `{name, sector, city, status, risk}` from
 *      `row.data` reach the insert. Every other key the client may have
 *      placed on the payload is dropped — explicitly including:
 *        - `id` → DB `gen_random_uuid()` default
 *        - `tenant_id` → server-resolved per (1)
 *        - `created_by` → stamped server-side from `auth.getUser()`
 *          inside `importCompanies` against the server client
 *        - `created_at`, `updated_at` → DB `now()` defaults
 *        - `legacy_mock_id` → never set on new rows; remains NULL
 *
 * Scope discipline (sprint hardening pass):
 *   - Companies INSERT only. Contacts and contracts continue to use
 *     the browser path; they were not flagged by the audit.
 *   - No UPDATE / UPSERT / DELETE actions added.
 *   - No DB migration, no RLS / policy change. The eventual
 *     `companies_insert_yonetici` policy is a separate, later gate.
 *     Until that lands, the action will surface RLS-deny errors via
 *     `ImportResult.errors[]` (rendered by the existing import UI).
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

  const needsDates =
    effectiveStatus === "aktif" || effectiveStatus === "imza_bekliyor";
  if (needsDates && (!allowed.start_date || !allowed.end_date)) {
    errors.push(
      `status "${effectiveStatus}" için başlangıç ve bitiş tarihi zorunlu (server)`,
    );
  }

  // If both dates are supplied, parse via the existing CSV convention
  // (DD.MM.YYYY → ISO) and enforce end_date >= start_date. ISO strings
  // (yyyy-mm-dd) compare correctly lexicographically.
  if (allowed.start_date && allowed.end_date) {
    const startIso = convertDateForDB(allowed.start_date);
    const endIso = convertDateForDB(allowed.end_date);
    if (!startIso || !endIso) {
      errors.push("tarih formatı geçersiz (server, GG.AA.YYYY bekleniyor)");
    } else if (endIso < startIso) {
      errors.push("bitiş tarihi başlangıç tarihinden önce olamaz (server)");
    }
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
