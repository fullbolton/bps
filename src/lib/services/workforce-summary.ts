/**
 * BPS service layer — workforce summary (Faz 3D "Aktif Is Gucu" slice).
 *
 *     UI Component (Firmalar list workforce column, Firma Detay overview)
 *         ↓
 *     src/lib/services/workforce-summary.ts     ← THIS FILE — business logic
 *         ↓
 *     src/lib/supabase/workforce-summary.ts     ← raw CRUD only
 *         ↓
 *     Supabase Postgres + RLS
 *
 * Invariants enforced here (mirrored by DB constraints / RLS):
 *   - Authorization = role capability + assigned scope
 *       → every mutation that targets a specific firma re-verifies scope
 *         via `requireCompanyByLegacyMockId`. If RLS hides the firma,
 *         that throws and the mutation is short-circuited.
 *   - Count values must be non-negative on upsert.
 *   - open_gap (target - current) and risk_level are DERIVED via
 *     `deriveOpenGap` and `deriveRiskLevel`. They are never persisted.
 *     The DB has no columns for them, by design.
 *
 * Error surface:
 *   - WorkforceValidationError          — negative counts
 *   - CompanyNotFoundOrOutOfScopeError  — reused from services/companies
 *   - Generic Error for DB errors, caught by the UI's try/catch.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Database,
  WorkforceSummaryRow,
  WorkforceSummaryInsert,
} from "@/types/database.types";
import {
  selectWorkforceSummaryByCompanyId,
  selectAllWorkforceSummaries,
  selectWorkforceSummariesByCompanyIds,
  upsertWorkforceSummary,
} from "@/lib/supabase/workforce-summary";
import {
  requireCompanyByLegacyMockId,
  getCompanyIdMapByLegacyMockIds,
} from "@/lib/services/companies";

type Client = SupabaseClient<Database>;

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class WorkforceValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorkforceValidationError";
  }
}

// ---------------------------------------------------------------------------
// UI-facing input shapes
// ---------------------------------------------------------------------------

export interface WorkforceUpsertInput {
  targetCount: number;
  currentCount: number;
  hiresLast30d?: number;
  exitsLast30d?: number;
  location?: string;
}

// ---------------------------------------------------------------------------
// Risk level type (DERIVED, never stored)
// ---------------------------------------------------------------------------

export type WorkforceRiskLevel = "stabil" | "takip_gerekli" | "kritik_acik";

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function ensureNonNegative(value: number, fieldLabel: string): number {
  if (value < 0) {
    throw new WorkforceValidationError(
      `${fieldLabel} negatif olamaz.`,
    );
  }
  return value;
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
 * Get the workforce summary for the firma identified by a legacy mock id.
 *
 * Returns null when no summary exists for the firma or when the firma is
 * out of the caller's RLS scope.
 */
export async function getWorkforceSummaryByLegacyCompanyId(
  client: Client,
  legacyMockId: string,
): Promise<WorkforceSummaryRow | null> {
  const company = await requireCompanyByLegacyMockId(client, legacyMockId);
  return selectWorkforceSummaryByCompanyId(client, company.id);
}

/**
 * List every workforce summary visible to the caller. Used by the
 * global dashboard aggregate cards.
 */
export async function listAllWorkforceSummaries(
  client: Client,
): Promise<WorkforceSummaryRow[]> {
  return selectAllWorkforceSummaries(client);
}

/**
 * Batch helper for the Firmalar list workforce column.
 *
 * Returns a map of `{ legacyMockId → WorkforceSummaryRow }`. Out-of-scope
 * firmas and firmas without a summary row are silently absent from the
 * result; the caller renders a placeholder.
 *
 * Implementation: two queries, both batched, no N+1.
 *   1. Resolve legacy ids → real company rows
 *   2. Fetch every workforce summary whose company_id is in that set
 */
export async function getWorkforceSummariesByLegacyIds(
  client: Client,
  legacyMockIds: string[],
): Promise<Record<string, WorkforceSummaryRow>> {
  if (legacyMockIds.length === 0) return {};

  // Step 1: legacy ids → real company ids (subject to RLS)
  const idMap = await getCompanyIdMapByLegacyMockIds(client, legacyMockIds);
  const realIds = Object.values(idMap);
  if (realIds.length === 0) return {};

  // Step 2: workforce summaries for those companies
  const summaries = await selectWorkforceSummariesByCompanyIds(client, realIds);

  // Build reverse map: realId → legacyId
  const realToLegacy: Record<string, string> = {};
  for (const [legacyId, realId] of Object.entries(idMap)) {
    realToLegacy[realId] = legacyId;
  }

  // Build the result keyed by legacy mock id
  const result: Record<string, WorkforceSummaryRow> = {};
  for (const summary of summaries) {
    const legacyId = realToLegacy[summary.company_id];
    if (legacyId) {
      result[legacyId] = summary;
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Writes — upsert
// ---------------------------------------------------------------------------

/**
 * Upsert a workforce summary for the firma identified by a legacy mock id.
 *
 * Behavior:
 *   - Re-verifies partner scope via `requireCompanyByLegacyMockId`.
 *   - Validates all count values as non-negative.
 *   - Delegates to the raw upsert (on conflict = company_id).
 */
export async function upsertWorkforceSummaryByLegacyId(
  client: Client,
  legacyMockId: string,
  input: WorkforceUpsertInput,
): Promise<WorkforceSummaryRow> {
  const company = await requireCompanyByLegacyMockId(client, legacyMockId);

  ensureNonNegative(input.targetCount, "Hedef kadro");
  ensureNonNegative(input.currentCount, "Mevcut kadro");
  if (input.hiresLast30d !== undefined) {
    ensureNonNegative(input.hiresLast30d, "Son 30 gün giriş");
  }
  if (input.exitsLast30d !== undefined) {
    ensureNonNegative(input.exitsLast30d, "Son 30 gün çıkış");
  }

  const payload: WorkforceSummaryInsert = {
    company_id: company.id,
    target_count: input.targetCount,
    current_count: input.currentCount,
    hires_last_30d: input.hiresLast30d ?? 0,
    exits_last_30d: input.exitsLast30d ?? 0,
    location: nullableTrim(input.location),
  };

  return upsertWorkforceSummary(client, payload);
}

// ---------------------------------------------------------------------------
// Derivation helpers — gap + risk level (NEVER persisted)
// ---------------------------------------------------------------------------

/**
 * Compute the open staffing gap for a workforce summary row.
 *
 *   open_gap = target_count - current_count
 *
 * This value is DERIVED and never stored in the database. A positive
 * value means the firma is under-staffed; zero or negative means at
 * capacity or over-staffed.
 */
export function deriveOpenGap(row: WorkforceSummaryRow): number {
  return row.target_count - row.current_count;
}

/**
 * Derive the risk level from the workforce gap ratio.
 *
 *   - stabil:         gap <= 0 (at capacity or over-staffed)
 *   - takip_gerekli:  gap > 0 AND gap/target < 0.15 (minor shortfall)
 *   - kritik_acik:    gap/target >= 0.15 (significant shortfall)
 *
 * Edge case: when target_count is 0 and current_count is 0, the firma
 * is considered "stabil" (no target means no gap).
 *
 * This value is DERIVED and never stored in the database. The DB has no
 * column for risk_level, by design — the service layer computes it on
 * the fly to avoid a second truth.
 */
export function deriveRiskLevel(row: WorkforceSummaryRow): WorkforceRiskLevel {
  const gap = row.target_count - row.current_count;

  if (gap <= 0) return "stabil";

  // Guard against division by zero (target_count > 0 is guaranteed here
  // because gap > 0 implies target_count > current_count >= 0).
  const ratio = gap / row.target_count;

  if (ratio < 0.15) return "takip_gerekli";
  return "kritik_acik";
}
