/**
 * BPS service layer — contracts (Faz 2 "Sözleşmeler" slice).
 *
 *     UI Component (Sözleşmeler list/detail, Firma Detay tab + Aktif kart,
 *                   Firmalar list aktif count column, NewContractModal)
 *         ↓
 *     src/lib/services/contracts.ts          ← THIS FILE — business logic
 *         ↓
 *     src/lib/supabase/contracts.ts          ← raw CRUD only
 *         ↓
 *     Supabase Postgres + RLS
 *
 * Invariants enforced here (mirrored by DB constraints / RLS):
 *   - Authorization = role capability + assigned scope
 *       → every mutation that targets a specific firma re-verifies scope
 *         via `requireCompanyByLegacyMockId`. Updates by contract id call
 *         `requireScopeForContract` which loads the row and checks
 *         `current_user_has_company_scope` indirectly via RLS visibility.
 *   - Status changes (per ROLE_MATRIX §5.2: "İmza / aktif / feshedildi
 *     gibi kararlar yönetsel kontrol altında olmalıdır") run through
 *     `updateContractStatus` which mirrors the broader UPDATE policy of
 *     yonetici + partner-scoped only. Operasyon does NOT receive a write
 *     path in Faz 2.
 *   - kalan gün and approaching signals are DERIVED via
 *     `computeRemainingDays` and `getApproachingLevel`. They are never
 *     persisted. The DB has no column for either, by design.
 *
 * Error surface:
 *   - ContractValidationError       — blank name, bad status, date order
 *   - ContractStatusPermissionError — non-yonetici/non-partner status flip
 *   - CompanyNotFoundOrOutOfScopeError — reused from services/companies
 *   - Generic Error for DB errors, caught by the UI's try/catch.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { SozlesmeDurumu } from "@/types/ui";
import type {
  Database,
  ContractRow,
  ContractInsert,
  ContractUpdate,
} from "@/types/database.types";
import {
  selectAllContracts,
  selectContractById,
  selectContractsByCompanyId,
  getActiveContractCountsByCompanyIds,
  insertContract,
  updateContract,
} from "@/lib/supabase/contracts";
import {
  requireCompanyByLegacyMockId,
  getCompanyIdMapByLegacyMockIds,
} from "@/lib/services/companies";

type Client = SupabaseClient<Database>;

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class ContractValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ContractValidationError";
  }
}

export class ContractStatusPermissionError extends Error {
  constructor() {
    super(
      "Sözleşme durumunu yalnızca yönetici veya portföyündeki partner değiştirebilir.",
    );
    this.name = "ContractStatusPermissionError";
  }
}

// ---------------------------------------------------------------------------
// Status whitelist (mirrors types/ui.ts SozlesmeDurumu and the DB CHECK)
// ---------------------------------------------------------------------------

export const CONTRACT_STATUSES: readonly SozlesmeDurumu[] = [
  "taslak",
  "imza_bekliyor",
  "aktif",
  "suresi_doldu",
  "feshedildi",
] as const;

const CONTRACT_STATUS_SET = new Set<SozlesmeDurumu>(CONTRACT_STATUSES);

function ensureStatus(value: string): SozlesmeDurumu {
  if (!CONTRACT_STATUS_SET.has(value as SozlesmeDurumu)) {
    throw new ContractValidationError(`Geçersiz sözleşme durumu: ${value}`);
  }
  return value as SozlesmeDurumu;
}

// ---------------------------------------------------------------------------
// UI-facing input shapes
// ---------------------------------------------------------------------------

export interface ContractCreateInput {
  /** Required. Trimmed and non-blank. */
  name: string;
  /** Required. Legacy mock id (e.g. "f1") until full Firmalar migration. */
  legacyCompanyId: string;
  /** Optional contract type label (e.g. "Hizmet", "Ek Protokol"). */
  contractType?: string;
  startDate?: string | null;
  endDate?: string | null;
  /**
   * Defaults to "taslak" when omitted. Drafts are the only status that
   * can be created without dates set; the DB CHECK enforces the rest.
   */
  status?: SozlesmeDurumu;
  contractValue?: string;
  scope?: string;
  responsible?: string;
  lastActionLabel?: string;
  criticalClauses?: string[];
}

export interface ContractContentUpdateInput {
  name?: string;
  contractType?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  contractValue?: string | null;
  scope?: string | null;
  responsible?: string | null;
  lastActionLabel?: string | null;
  criticalClauses?: string[];
}

export interface ContractRenewalUpdateInput {
  renewalTargetDate?: string | null;
  renewalDiscussionOpened?: boolean;
  renewalResponsibleSet?: boolean;
  renewalTaskCreated?: boolean;
}

// ---------------------------------------------------------------------------
// Derivation helpers — kalan gün + approaching signal (NEVER persisted)
// ---------------------------------------------------------------------------

/**
 * Compute days remaining until the contract's end_date.
 *
 *   - Returns null when end_date is missing (taslak / draft).
 *   - Returns 0 or a negative integer if the contract is past its end.
 *
 * The result is intentionally floor-rounded against UTC midnight so the
 * derived value is stable across the day rather than ticking down hour
 * by hour. This matches the visual semantics of the existing UI.
 */
export function computeRemainingDays(
  endDate: string | null | undefined,
  now: Date = new Date(),
): number | null {
  if (!endDate) return null;
  const end = new Date(`${endDate.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(end.getTime())) return null;
  const today = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const diffMs = end.getTime() - today.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

export type ApproachingLevel = "ok" | "approaching" | "critical" | "expired";

/**
 * Derive the approaching-signal level from the remaining-days value.
 *
 *   - critical:    ≤ 15 days remaining (red badge in the existing UI)
 *   - approaching: ≤ 30 days remaining (amber badge)
 *   - expired:     end_date is in the past
 *   - ok:          everything else (no badge)
 *
 * Thresholds match the existing inline ternaries in
 * `src/app/(main)/sozlesmeler/page.tsx` and Firma Detay so the cutover
 * preserves visual parity exactly.
 */
export function getApproachingLevel(
  remainingDays: number | null,
): ApproachingLevel {
  if (remainingDays === null) return "ok";
  if (remainingDays < 0) return "expired";
  if (remainingDays <= 15) return "critical";
  if (remainingDays <= 30) return "approaching";
  return "ok";
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function ensureName(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new ContractValidationError("Sözleşme adı boş olamaz.");
  }
  return trimmed;
}

function ensureDateOrder(
  startDate: string | null | undefined,
  endDate: string | null | undefined,
): void {
  if (!startDate || !endDate) return;
  if (endDate < startDate) {
    throw new ContractValidationError(
      "Bitiş tarihi başlangıç tarihinden önce olamaz.",
    );
  }
}

function nullableTrim(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

/**
 * Resolve the calling user's role from `profiles`. Used to gate the
 * service-layer status writer (`updateContractStatus`). The DB RLS
 * UPDATE policy already enforces the same predicate; this redundant
 * application-layer check exists so the UI can show a clean Turkish
 * error before the SQL fires.
 */
async function getCurrentUserRole(client: Client): Promise<string | null> {
  const {
    data: { user },
    error: userError,
  } = await client.auth.getUser();
  if (userError || !user) return null;

  const { data: profile } = await client
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  return profile?.role ?? null;
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/**
 * List every contract visible to the caller. Used by the global
 * Sözleşmeler list page. The returned rows are sorted by status, then
 * end_date asc, then name asc — the existing list page does its own
 * client-side filter / search on top of this.
 */
export async function listAllContracts(client: Client): Promise<ContractRow[]> {
  return selectAllContracts(client);
}

/**
 * Fetch a single contract by id. Returns null when missing or hidden
 * by RLS. Used by the Sözleşme Detay core read path.
 */
export async function getContractById(
  client: Client,
  contractId: string,
): Promise<ContractRow | null> {
  return selectContractById(client, contractId);
}

/**
 * List every contract for the firma identified by a legacy mock id.
 * Used by both the Firma Detay Sözleşmeler tab AND the Genel Bakış
 * Aktif Sözleşmeler card — one fetch, two views.
 */
export async function listContractsByLegacyCompanyId(
  client: Client,
  legacyMockId: string,
): Promise<ContractRow[]> {
  const company = await requireCompanyByLegacyMockId(client, legacyMockId);
  return selectContractsByCompanyId(client, company.id);
}

/**
 * Batch helper for the Firmalar list "Aktif Sözleşme" column.
 *
 * Returns a map of `{ legacyMockId → active-contract count }`. Out-of-scope
 * firmas and firmas without contracts are silently absent; the caller
 * renders 0 in those cases.
 */
export async function getActiveContractCountsByLegacyIds(
  client: Client,
  legacyMockIds: string[],
): Promise<Record<string, number>> {
  if (legacyMockIds.length === 0) return {};

  const idMap = await getCompanyIdMapByLegacyMockIds(client, legacyMockIds);
  const realIds = Object.values(idMap);
  if (realIds.length === 0) return {};

  const realCounts = await getActiveContractCountsByCompanyIds(client, realIds);

  // Translate real ids back to legacy ids for the UI's row.id key.
  const result: Record<string, number> = {};
  for (const [legacyId, realId] of Object.entries(idMap)) {
    if (realCounts[realId]) {
      result[legacyId] = realCounts[realId];
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Writes — create
// ---------------------------------------------------------------------------

/**
 * Create a new contract for the firma identified by a legacy mock id.
 *
 * Behavior:
 *   - Re-verifies partner scope via `requireCompanyByLegacyMockId`.
 *   - Trims and validates name, scope, responsible.
 *   - Defaults status to "taslak" when omitted.
 *   - Validates date order if both dates are present.
 *   - Stamps created_by from the auth session.
 *   - last_action_label defaults to a friendly Turkish "draft created"
 *     marker so the list-row Son İşlem column has something to render.
 */
export async function createContract(
  client: Client,
  input: ContractCreateInput,
): Promise<ContractRow> {
  const company = await requireCompanyByLegacyMockId(
    client,
    input.legacyCompanyId,
  );

  const name = ensureName(input.name);
  const status = input.status ? ensureStatus(input.status) : "taslak";
  const startDate = nullableTrim(input.startDate ?? null);
  const endDate = nullableTrim(input.endDate ?? null);
  ensureDateOrder(startDate, endDate);

  // Mirror the DB CHECK at the application layer for a clean Turkish
  // error rather than a raw "violates check constraint" surface.
  if (
    (status === "aktif" || status === "imza_bekliyor") &&
    (!startDate || !endDate)
  ) {
    throw new ContractValidationError(
      "Aktif veya imza bekliyor durumundaki sözleşmeler için başlangıç ve bitiş tarihi zorunludur.",
    );
  }

  const {
    data: { user },
  } = await client.auth.getUser();

  const payload: ContractInsert = {
    company_id: company.id,
    name,
    contract_type: nullableTrim(input.contractType ?? null),
    start_date: startDate,
    end_date: endDate,
    status,
    contract_value: nullableTrim(input.contractValue ?? null),
    scope: nullableTrim(input.scope ?? null),
    responsible: nullableTrim(input.responsible ?? null),
    last_action_label:
      nullableTrim(input.lastActionLabel ?? null) ?? "Sözleşme oluşturuldu",
    critical_clauses: input.criticalClauses ?? [],
    created_by: user?.id ?? null,
  };

  return insertContract(client, payload);
}

// ---------------------------------------------------------------------------
// Writes — content update
// ---------------------------------------------------------------------------

/**
 * Update non-status content of an existing contract. Status changes
 * MUST go through `updateContractStatus`; this function strips status
 * from the patch as a defense-in-depth measure.
 *
 * Capability gate: yonetici + partner-scoped (mirrored at DB via
 * `contracts_update_role_or_scope` RLS). Operasyon's "Sınırlı" cell on
 * Sözleşme oluşturma is NOT extended to updates here — see unresolved.
 */
export async function updateContractContent(
  client: Client,
  contractId: string,
  input: ContractContentUpdateInput,
): Promise<ContractRow> {
  // Defense-in-depth: ensure the row is visible to the caller. RLS
  // already filters; this returns null with a friendly message instead
  // of letting the UPDATE silently affect zero rows.
  const existing = await selectContractById(client, contractId);
  if (!existing) {
    throw new ContractValidationError(
      "Sözleşme bulunamadı veya bu sözleşmeye erişim yetkiniz yok.",
    );
  }

  const patch: ContractUpdate = {};

  if (input.name !== undefined) {
    patch.name = ensureName(input.name);
  }
  if (input.contractType !== undefined) {
    patch.contract_type = nullableTrim(input.contractType);
  }
  if (input.startDate !== undefined) {
    patch.start_date = nullableTrim(input.startDate);
  }
  if (input.endDate !== undefined) {
    patch.end_date = nullableTrim(input.endDate);
  }
  if (input.contractValue !== undefined) {
    patch.contract_value = nullableTrim(input.contractValue);
  }
  if (input.scope !== undefined) {
    patch.scope = nullableTrim(input.scope);
  }
  if (input.responsible !== undefined) {
    patch.responsible = nullableTrim(input.responsible);
  }
  if (input.lastActionLabel !== undefined) {
    patch.last_action_label = nullableTrim(input.lastActionLabel);
  }
  if (input.criticalClauses !== undefined) {
    patch.critical_clauses = input.criticalClauses;
  }

  // Date order check on the merged row (use the patch value if set,
  // otherwise the existing row value).
  ensureDateOrder(
    patch.start_date !== undefined ? patch.start_date : existing.start_date,
    patch.end_date !== undefined ? patch.end_date : existing.end_date,
  );

  return updateContract(client, contractId, patch);
}

// ---------------------------------------------------------------------------
// Writes — status transitions
// ---------------------------------------------------------------------------

/**
 * Change a contract's status. Per ROLE_MATRIX.md §5.2, this is the
 * single most-controlled write path on the contracts table. Both the
 * RLS UPDATE policy AND this service function gate it to yonetici and
 * partner (scoped). Operasyon CANNOT change status under any flow.
 *
 * Optionally records a custom `lastActionLabel`; otherwise stamps a
 * default Turkish marker matching the existing mock UI vocabulary so
 * the Sözleşmeler list "Son İşlem" column has something to render.
 */
export async function updateContractStatus(
  client: Client,
  contractId: string,
  nextStatus: SozlesmeDurumu,
  options?: { lastActionLabel?: string },
): Promise<ContractRow> {
  ensureStatus(nextStatus);

  const role = await getCurrentUserRole(client);
  if (role !== "yonetici" && role !== "partner") {
    throw new ContractStatusPermissionError();
  }

  // Visibility / scope check.
  const existing = await selectContractById(client, contractId);
  if (!existing) {
    throw new ContractValidationError(
      "Sözleşme bulunamadı veya bu sözleşmeye erişim yetkiniz yok.",
    );
  }

  // Validate the active-dates rule before sending the patch so we
  // surface a Turkish error rather than the raw CHECK violation.
  if (
    (nextStatus === "aktif" || nextStatus === "imza_bekliyor") &&
    (!existing.start_date || !existing.end_date)
  ) {
    throw new ContractValidationError(
      "Aktif veya imza bekliyor durumuna geçmek için sözleşmenin başlangıç ve bitiş tarihi tanımlı olmalıdır.",
    );
  }

  const patch: ContractUpdate = {
    status: nextStatus,
    last_action_label:
      options?.lastActionLabel ?? defaultStatusActionLabel(nextStatus),
  };

  return updateContract(client, contractId, patch);
}

function defaultStatusActionLabel(status: SozlesmeDurumu): string {
  switch (status) {
    case "taslak":
      return "Taslak olarak kaydedildi";
    case "imza_bekliyor":
      return "İmza için gönderildi";
    case "aktif":
      return "Sözleşme aktifleştirildi";
    case "suresi_doldu":
      return "Süre doldu — yenileme bekleniyor";
    case "feshedildi":
      return "Sözleşme feshedildi";
  }
}

// ---------------------------------------------------------------------------
// Writes — bounded renewal tracking (scope item 5)
// ---------------------------------------------------------------------------

/**
 * Update the four-signal renewal tracking truth on a contract. This is
 * the only writer for `renewal_*` columns. Capability gate is the same
 * as the broader UPDATE policy (yonetici + partner-scoped) — it does
 * not require the stricter status-change gate because flipping a
 * renewal-tracking checkbox is operational, not a managerial decision.
 */
export async function updateContractRenewal(
  client: Client,
  contractId: string,
  input: ContractRenewalUpdateInput,
): Promise<ContractRow> {
  const existing = await selectContractById(client, contractId);
  if (!existing) {
    throw new ContractValidationError(
      "Sözleşme bulunamadı veya bu sözleşmeye erişim yetkiniz yok.",
    );
  }

  const patch: ContractUpdate = {};
  if (input.renewalTargetDate !== undefined) {
    patch.renewal_target_date = nullableTrim(input.renewalTargetDate);
  }
  if (input.renewalDiscussionOpened !== undefined) {
    patch.renewal_discussion_opened = input.renewalDiscussionOpened;
  }
  if (input.renewalResponsibleSet !== undefined) {
    patch.renewal_responsible_set = input.renewalResponsibleSet;
  }
  if (input.renewalTaskCreated !== undefined) {
    patch.renewal_task_created = input.renewalTaskCreated;
  }

  return updateContract(client, contractId, patch);
}
