/**
 * BPS service layer — critical dates (Phase 4B "Kurumsal Kritik Tarihler").
 *
 *     UI Component (Kurumsal Tarihler page)
 *         |
 *     src/lib/services/critical-dates.ts     <- THIS FILE -- business logic
 *         |
 *     src/lib/supabase/critical-dates.ts     <- raw CRUD only
 *         |
 *     Supabase Postgres + RLS
 *
 * Invariants enforced here (mirrored by DB constraints / RLS):
 *   - NOT firm-scoped. Partner scope does NOT apply.
 *   - Broad-read for all authenticated roles.
 *   - Create/edit is yonetici-only (enforced by RLS + UI role gate).
 *   - Status is DERIVED from deadline_date via `deriveDeadlineStatus`.
 *     It is NEVER stored in the database.
 *   - title and deadline_date must be non-blank on create/update.
 *
 * Error surface:
 *   - CriticalDateValidationError -- blank title, blank deadline
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Database,
  CriticalDateRow,
  CriticalDateInsert,
  CriticalDateUpdate,
} from "@/types/database.types";
import type { CriticalDateType, CriticalDatePriority } from "@/lib/critical-date-types";
import {
  selectAllCriticalDates,
  selectCriticalDateById,
  insertCriticalDate,
  updateCriticalDate,
} from "@/lib/supabase/critical-dates";

type Client = SupabaseClient<Database>;

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class CriticalDateValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CriticalDateValidationError";
  }
}

// ---------------------------------------------------------------------------
// UI-facing input shapes
// ---------------------------------------------------------------------------

export interface CriticalDateCreateInput {
  title: string;
  dateType: CriticalDateType;
  deadlineDate: string;
  priority?: CriticalDatePriority;
  responsible?: string;
  note?: string;
}

export interface CriticalDateUpdateInput {
  title?: string;
  dateType?: CriticalDateType;
  deadlineDate?: string;
  priority?: CriticalDatePriority;
  responsible?: string;
  note?: string;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function ensureNonBlank(value: string, fieldLabel: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new CriticalDateValidationError(`${fieldLabel} bos birakilamaz.`);
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
 * List every critical date visible to the caller, ordered by deadline
 * ascending (most urgent first). Used by the Kurumsal Tarihler page.
 */
export async function listAllCriticalDates(
  client: Client,
): Promise<CriticalDateRow[]> {
  return selectAllCriticalDates(client);
}

/**
 * Fetch a single critical date by id.
 */
export async function getCriticalDateById(
  client: Client,
  id: string,
): Promise<CriticalDateRow | null> {
  return selectCriticalDateById(client, id);
}

// ---------------------------------------------------------------------------
// Writes -- create (yonetici-only, enforced by RLS)
// ---------------------------------------------------------------------------

/**
 * Create a new critical date record.
 *
 * Behavior:
 *   - Validates title (non-blank) and deadlineDate (non-blank).
 *   - Defaults priority to 'normal' and date_type to 'diger'.
 *   - Stamps created_by from the auth session.
 */
export async function createCriticalDate(
  client: Client,
  input: CriticalDateCreateInput,
): Promise<CriticalDateRow> {
  const title = ensureNonBlank(input.title, "Baslik");
  const deadlineDate = ensureNonBlank(input.deadlineDate, "Son tarih");

  const {
    data: { user },
  } = await client.auth.getUser();

  const payload: CriticalDateInsert = {
    title,
    date_type: input.dateType ?? "diger",
    deadline_date: deadlineDate,
    priority: input.priority ?? "normal",
    responsible: nullableTrim(input.responsible) ?? "Atanmadi",
    note: nullableTrim(input.note),
    created_by: user?.id ?? null,
  };

  return insertCriticalDate(client, payload);
}

// ---------------------------------------------------------------------------
// Writes -- update (yonetici-only, enforced by RLS)
// ---------------------------------------------------------------------------

/**
 * Update an existing critical date record.
 *
 * Behavior:
 *   - Validates title (non-blank if provided) and deadlineDate (non-blank
 *     if provided).
 *   - Only patches the fields that are provided.
 */
export async function updateCriticalDateRecord(
  client: Client,
  id: string,
  input: CriticalDateUpdateInput,
): Promise<CriticalDateRow> {
  // Verify the record exists and is visible
  const existing = await selectCriticalDateById(client, id);
  if (!existing) {
    throw new CriticalDateValidationError(
      "Kayit bulunamadi veya bu kayda erisim yetkiniz yok.",
    );
  }

  const patch: CriticalDateUpdate = {
    updated_at: new Date().toISOString(),
  };

  if (input.title !== undefined) {
    patch.title = ensureNonBlank(input.title, "Baslik");
  }
  if (input.deadlineDate !== undefined) {
    patch.deadline_date = ensureNonBlank(input.deadlineDate, "Son tarih");
  }
  if (input.dateType !== undefined) {
    patch.date_type = input.dateType;
  }
  if (input.priority !== undefined) {
    patch.priority = input.priority;
  }
  if (input.responsible !== undefined) {
    patch.responsible = nullableTrim(input.responsible);
  }
  if (input.note !== undefined) {
    patch.note = nullableTrim(input.note);
  }

  return updateCriticalDate(client, id, patch);
}
