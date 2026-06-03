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
import { importCompanies } from "@/lib/import/import-service";
import type { ImportResult } from "@/lib/import/import-service";
import type { ParsedRow } from "@/lib/import/csv-parser";
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
