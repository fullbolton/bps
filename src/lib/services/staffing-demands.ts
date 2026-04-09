/**
 * BPS service layer — staffing demands (Faz 3A "Personel Talepleri" slice).
 *
 *     UI Component (Personel Talepleri list, Firma Detay tab)
 *         ↓
 *     src/lib/services/staffing-demands.ts      ← THIS FILE — business logic
 *         ↓
 *     src/lib/supabase/staffing-demands.ts      ← raw CRUD only
 *         ↓
 *     Supabase Postgres + RLS
 *
 * Invariants enforced here (mirrored by DB constraints / RLS):
 *   - Authorization = role capability + assigned scope
 *       → every mutation that targets a specific firma re-verifies scope
 *         via `requireCompanyByLegacyMockId`. If RLS hides the firma,
 *         that throws and the mutation is short-circuited.
 *   - position must be non-blank on create.
 *   - open_count (requested - provided) is DERIVED via `computeOpenCount`.
 *     It is never persisted. The DB has no column for it, by design.
 *
 * Error surface:
 *   - DemandValidationError             — blank position, invalid counts
 *   - CompanyNotFoundOrOutOfScopeError  — reused from services/companies
 *   - Generic Error for DB errors, caught by the UI's try/catch.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { TalepDurumu, OncelikSeviyesi } from "@/types/ui";
import type {
  Database,
  StaffingDemandRow,
  StaffingDemandInsert,
  StaffingDemandUpdate,
} from "@/types/database.types";
import {
  selectStaffingDemandsByCompanyId,
  selectAllStaffingDemands,
  insertStaffingDemand,
  updateStaffingDemand,
} from "@/lib/supabase/staffing-demands";
import { requireCompanyByLegacyMockId } from "@/lib/services/companies";

type Client = SupabaseClient<Database>;

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class DemandValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DemandValidationError";
  }
}

// ---------------------------------------------------------------------------
// Status whitelist (mirrors types/ui.ts TalepDurumu and the DB CHECK)
// ---------------------------------------------------------------------------

export const DEMAND_STATUSES: readonly TalepDurumu[] = [
  "yeni",
  "degerlendiriliyor",
  "kismi_doldu",
  "tamamen_doldu",
  "beklemede",
  "iptal",
] as const;

const DEMAND_STATUS_SET = new Set<TalepDurumu>(DEMAND_STATUSES);

function ensureStatus(value: string): TalepDurumu {
  if (!DEMAND_STATUS_SET.has(value as TalepDurumu)) {
    throw new DemandValidationError(`Geçersiz talep durumu: ${value}`);
  }
  return value as TalepDurumu;
}

// ---------------------------------------------------------------------------
// UI-facing input shapes
// ---------------------------------------------------------------------------

export interface DemandCreateInput {
  legacyCompanyId: string;
  position: string;
  requestedCount?: number;
  providedCount?: number;
  location?: string;
  startDate?: string;
  priority?: string;
  responsible?: string;
}

export interface DemandUpdateInput {
  position?: string;
  requestedCount?: number;
  providedCount?: number;
  location?: string;
  startDate?: string;
  priority?: string;
  status?: string;
  responsible?: string;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function ensurePosition(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new DemandValidationError("Pozisyon adı boş bırakılamaz.");
  }
  return trimmed;
}

function nullableTrim(value: string | undefined): string | null {
  if (value === undefined || value === null) return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/**
 * List every staffing demand for the firma identified by a legacy mock id,
 * newest first.
 *
 * Resolution flow:
 *   legacy id → companies row (RLS-checked) → staffing_demands.company_id query
 *
 * If RLS hides the firma from the caller, the resolver throws
 * CompanyNotFoundOrOutOfScopeError and no demands are returned.
 */
export async function listDemandsByLegacyCompanyId(
  client: Client,
  legacyMockId: string,
): Promise<StaffingDemandRow[]> {
  const company = await requireCompanyByLegacyMockId(client, legacyMockId);
  return selectStaffingDemandsByCompanyId(client, company.id);
}

/**
 * List every staffing demand visible to the caller. Used by the global
 * Personel Talepleri list page.
 */
export async function listAllDemands(
  client: Client,
): Promise<StaffingDemandRow[]> {
  return selectAllStaffingDemands(client);
}

// ---------------------------------------------------------------------------
// Writes — create
// ---------------------------------------------------------------------------

/**
 * Create a new staffing demand for the firma identified by a legacy mock id.
 *
 * Behavior:
 *   - Re-verifies partner scope via `requireCompanyByLegacyMockId`.
 *   - Trims and validates position (non-blank).
 *   - Defaults requested_count to 1 and provided_count to 0 when omitted.
 *   - Stamps created_by from the auth session.
 */
export async function createDemand(
  client: Client,
  input: DemandCreateInput,
): Promise<StaffingDemandRow> {
  const company = await requireCompanyByLegacyMockId(
    client,
    input.legacyCompanyId,
  );

  const position = ensurePosition(input.position);

  const {
    data: { user },
  } = await client.auth.getUser();

  const payload: StaffingDemandInsert = {
    company_id: company.id,
    position,
    requested_count: input.requestedCount ?? 1,
    provided_count: input.providedCount ?? 0,
    location: nullableTrim(input.location),
    start_date: nullableTrim(input.startDate),
    priority: (input.priority as OncelikSeviyesi) ?? "normal",
    responsible: nullableTrim(input.responsible),
    created_by: user?.id ?? null,
  };

  return insertStaffingDemand(client, payload);
}

// ---------------------------------------------------------------------------
// Writes — update
// ---------------------------------------------------------------------------

/**
 * Update an existing staffing demand. Validates status against the
 * whitelist when provided. Position is trimmed and checked for non-blank
 * when included in the patch.
 */
export async function updateDemand(
  client: Client,
  demandId: string,
  input: DemandUpdateInput,
): Promise<StaffingDemandRow> {
  const patch: StaffingDemandUpdate = {};

  if (input.position !== undefined) {
    patch.position = ensurePosition(input.position);
  }
  if (input.requestedCount !== undefined) {
    patch.requested_count = input.requestedCount;
  }
  if (input.providedCount !== undefined) {
    patch.provided_count = input.providedCount;
  }
  if (input.location !== undefined) {
    patch.location = nullableTrim(input.location);
  }
  if (input.startDate !== undefined) {
    patch.start_date = nullableTrim(input.startDate);
  }
  if (input.priority !== undefined) {
    patch.priority = input.priority as OncelikSeviyesi;
  }
  if (input.status !== undefined) {
    patch.status = ensureStatus(input.status);
  }
  if (input.responsible !== undefined) {
    patch.responsible = nullableTrim(input.responsible);
  }

  return updateStaffingDemand(client, demandId, patch);
}

// ---------------------------------------------------------------------------
// Derivation helpers — open count (NEVER persisted)
// ---------------------------------------------------------------------------

/**
 * Compute the number of unfilled positions for a staffing demand.
 *
 *   open_count = requested_count - provided_count
 *
 * This value is DERIVED and never stored in the database. The DB has no
 * column for it, by design — the service layer computes it on the fly
 * to avoid a second truth.
 */
export function computeOpenCount(row: StaffingDemandRow): number {
  return row.requested_count - row.provided_count;
}
