/**
 * BPS service layer — appointments (Faz 3B "Randevular" slice).
 *
 *     UI Component (Randevular list, Firma Detay tab, Sozlesme Detay tab)
 *         ↓
 *     src/lib/services/appointments.ts          ← THIS FILE — business logic
 *         ↓
 *     src/lib/supabase/appointments.ts          ← raw CRUD only
 *         ↓
 *     Supabase Postgres + RLS
 *
 * Invariants enforced here (mirrored by DB constraints / RLS):
 *   - Authorization = role capability + assigned scope
 *       → every mutation that targets a specific firma re-verifies scope
 *         via `requireCompanyByLegacyMockId`. If RLS hides the firma,
 *         that throws and the mutation is short-circuited.
 *   - meeting_date must be non-blank on create.
 *   - `completeAppointment` is the appointment→task handoff (item 21):
 *     when completing an appointment, the caller can optionally create a
 *     linked task (source_type='randevu') in the same service call. This
 *     is the single writer for that cross-entity lifecycle transition.
 *   - last_completed_date and next_planned_date are DERIVED via
 *     `deriveLastCompletedDate` and `deriveNextPlannedDate`. They are
 *     never persisted.
 *
 * Error surface:
 *   - AppointmentValidationError        — blank date, missing result
 *   - CompanyNotFoundOrOutOfScopeError  — reused from services/companies
 *   - Generic Error for DB errors, caught by the UI's try/catch.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { RandevuDurumu } from "@/types/ui";
import type {
  Database,
  AppointmentRow,
  AppointmentInsert,
  AppointmentUpdate,
  TaskRow,
  TaskInsert,
} from "@/types/database.types";
import {
  selectAppointmentsByCompanyId,
  selectAppointmentsByCompanyIds,
  selectAllAppointments,
  selectAppointmentById,
  selectAppointmentsByContractId,
  insertAppointment,
  updateAppointment,
} from "@/lib/supabase/appointments";
import { getCompanyIdMapByLegacyMockIds } from "@/lib/services/companies";
import { insertTask } from "@/lib/supabase/tasks";
import { requireCompanyByLegacyMockId } from "@/lib/services/companies";

type Client = SupabaseClient<Database>;

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class AppointmentValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AppointmentValidationError";
  }
}

// ---------------------------------------------------------------------------
// Status whitelist (mirrors types/ui.ts RandevuDurumu and the DB CHECK)
// ---------------------------------------------------------------------------

export const APPOINTMENT_STATUSES: readonly RandevuDurumu[] = [
  "planlandi",
  "tamamlandi",
  "iptal",
  "ertelendi",
] as const;

const APPOINTMENT_STATUS_SET = new Set<RandevuDurumu>(APPOINTMENT_STATUSES);

function ensureStatus(value: string): RandevuDurumu {
  if (!APPOINTMENT_STATUS_SET.has(value as RandevuDurumu)) {
    throw new AppointmentValidationError(`Geçersiz randevu durumu: ${value}`);
  }
  return value as RandevuDurumu;
}

// ---------------------------------------------------------------------------
// UI-facing input shapes
// ---------------------------------------------------------------------------

export interface AppointmentCreateInput {
  legacyCompanyId: string;
  contractId?: string;
  meetingDate: string;
  meetingTime?: string;
  meetingType?: string;
  attendee?: string;
}

export interface AppointmentCompleteInput {
  result: string;
  nextAction: string;
  createTask?: boolean;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function ensureMeetingDate(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new AppointmentValidationError("Toplantı tarihi boş bırakılamaz.");
  }
  return trimmed;
}

function ensureNonBlank(value: string, fieldLabel: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new AppointmentValidationError(`${fieldLabel} boş bırakılamaz.`);
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
 * List every appointment for the firma identified by a legacy mock id,
 * most recent meeting first.
 *
 * Resolution flow:
 *   legacy id → companies row (RLS-checked) → appointments.company_id query
 *
 * If RLS hides the firma from the caller, the resolver throws
 * CompanyNotFoundOrOutOfScopeError and no appointments are returned.
 */
export async function listAppointmentsByLegacyCompanyId(
  client: Client,
  legacyMockId: string,
): Promise<AppointmentRow[]> {
  const company = await requireCompanyByLegacyMockId(client, legacyMockId);
  return selectAppointmentsByCompanyId(client, company.id);
}

/**
 * List every appointment visible to the caller. Used by the global
 * Randevular list page.
 */
export async function listAllAppointments(
  client: Client,
): Promise<AppointmentRow[]> {
  return selectAllAppointments(client);
}

/**
 * Fetch a single appointment by id. Returns null when missing or hidden
 * by RLS. Used by the Randevu Detay core read path.
 */
export async function getAppointmentById(
  client: Client,
  id: string,
): Promise<AppointmentRow | null> {
  return selectAppointmentById(client, id);
}

/**
 * List every appointment linked to a specific contract, most recent
 * meeting first. Used by the Sozlesme Detay > Randevular tab.
 */
export async function listAppointmentsByContractId(
  client: Client,
  contractId: string,
): Promise<AppointmentRow[]> {
  return selectAppointmentsByContractId(client, contractId);
}

// ---------------------------------------------------------------------------
// Writes — create
// ---------------------------------------------------------------------------

/**
 * Create a new appointment for the firma identified by a legacy mock id.
 *
 * Behavior:
 *   - Re-verifies partner scope via `requireCompanyByLegacyMockId`.
 *   - Trims and validates meeting_date (non-blank).
 *   - Defaults status to "planlandi" and meeting_type to "ziyaret".
 *   - Stamps created_by from the auth session.
 */
export async function createAppointment(
  client: Client,
  input: AppointmentCreateInput,
): Promise<AppointmentRow> {
  const company = await requireCompanyByLegacyMockId(
    client,
    input.legacyCompanyId,
  );

  const meetingDate = ensureMeetingDate(input.meetingDate);

  const {
    data: { user },
  } = await client.auth.getUser();

  const payload: AppointmentInsert = {
    company_id: company.id,
    contract_id: nullableTrim(input.contractId),
    meeting_date: meetingDate,
    meeting_time: nullableTrim(input.meetingTime),
    meeting_type: (input.meetingType as AppointmentRow["meeting_type"]) ?? "ziyaret",
    attendee: nullableTrim(input.attendee),
    status: "planlandi",
    created_by: user?.id ?? null,
  };

  return insertAppointment(client, payload);
}

// ---------------------------------------------------------------------------
// Writes — complete (appointment→task handoff, item 21)
// ---------------------------------------------------------------------------

/**
 * Complete an appointment and optionally create a linked task.
 *
 * This is the appointment→task handoff (item 21). The function:
 *   1. Sets status='tamamlandi' on the appointment.
 *   2. Sets result + next_action (both required, non-blank).
 *   3. If createTask is true, inserts a new task row with:
 *      - company_id from the appointment
 *      - title = next_action
 *      - source_type = 'randevu'
 *      - appointment_id = appointmentId
 *      - status = 'acik'
 *   4. Returns both the updated appointment and the (optional) newly
 *      created task.
 *
 * The caller does NOT need to separately call `updateAppointmentStatus`
 * — this function handles the complete lifecycle transition.
 */
export async function completeAppointment(
  client: Client,
  appointmentId: string,
  input: AppointmentCompleteInput,
): Promise<{ appointment: AppointmentRow; task: TaskRow | null }> {
  const result = ensureNonBlank(input.result, "Sonuç");
  const nextAction = ensureNonBlank(input.nextAction, "Sonraki adım");

  // Verify the appointment exists and is visible to the caller.
  const existing = await selectAppointmentById(client, appointmentId);
  if (!existing) {
    throw new AppointmentValidationError(
      "Randevu bulunamadı veya bu randevuya erişim yetkiniz yok.",
    );
  }

  // Update the appointment: status → tamamlandi, set result + next_action.
  const appointmentPatch: AppointmentUpdate = {
    status: "tamamlandi",
    result,
    next_action: nextAction,
  };
  const updatedAppointment = await updateAppointment(
    client,
    appointmentId,
    appointmentPatch,
  );

  // Optionally create a linked task (the handoff).
  let task: TaskRow | null = null;
  if (input.createTask) {
    const {
      data: { user },
    } = await client.auth.getUser();

    const taskPayload: TaskInsert = {
      company_id: existing.company_id,
      title: nextAction,
      source_type: "randevu",
      appointment_id: appointmentId,
      status: "acik",
      created_by: user?.id ?? null,
    };
    task = await insertTask(client, taskPayload);
  }

  return { appointment: updatedAppointment, task };
}

// ---------------------------------------------------------------------------
// Writes — status transitions
// ---------------------------------------------------------------------------

/**
 * Change an appointment's status. Validates the new status against the
 * whitelist. When the target status is 'tamamlandi', the caller MUST
 * supply result and nextAction in options — use `completeAppointment`
 * for the full handoff flow, or pass them here for a lower-level path.
 */
export async function updateAppointmentStatus(
  client: Client,
  appointmentId: string,
  nextStatus: string,
  options?: { result?: string; nextAction?: string },
): Promise<AppointmentRow> {
  const validatedStatus = ensureStatus(nextStatus);

  // When completing, require result + next_action.
  if (validatedStatus === "tamamlandi") {
    if (!options?.result?.trim() || !options?.nextAction?.trim()) {
      throw new AppointmentValidationError(
        "Tamamlanan randevu için sonuç ve sonraki adım zorunludur.",
      );
    }
  }

  // Verify the appointment exists and is visible.
  const existing = await selectAppointmentById(client, appointmentId);
  if (!existing) {
    throw new AppointmentValidationError(
      "Randevu bulunamadı veya bu randevuya erişim yetkiniz yok.",
    );
  }

  const patch: AppointmentUpdate = {
    status: validatedStatus,
  };
  if (validatedStatus === "tamamlandi" && options) {
    patch.result = options.result!.trim();
    patch.next_action = options.nextAction!.trim();
  }

  return updateAppointment(client, appointmentId, patch);
}

// ---------------------------------------------------------------------------
// Batched readers — Firmalar list (legacy id keyed)
// ---------------------------------------------------------------------------

/**
 * Batch helper: takes a set of legacy mock ids and returns derived
 * appointment dates keyed by legacy id:
 *   - lastCompleted: most recent meeting_date with status='tamamlandi'
 *   - nextPlanned: earliest future meeting_date with status='planlandi'
 *
 * Follows the same pattern as `getPrimaryContactNamesByLegacyIds` and
 * `getActiveContractCountsByLegacyIds`:
 *   legacy ids → real company UUIDs → batch query → derive → re-key by legacy
 *
 * Out-of-scope or appointment-less firmas are silently absent from the
 * returned maps.
 */
export async function getAppointmentDatesByLegacyIds(
  client: Client,
  legacyMockIds: string[],
): Promise<{
  lastCompleted: Record<string, string>;
  nextPlanned: Record<string, string>;
}> {
  if (legacyMockIds.length === 0) return { lastCompleted: {}, nextPlanned: {} };

  const idMap = await getCompanyIdMapByLegacyMockIds(client, legacyMockIds);
  const realIds = Object.values(idMap);
  if (realIds.length === 0) return { lastCompleted: {}, nextPlanned: {} };

  const appointments = await selectAppointmentsByCompanyIds(client, realIds);

  // Group by company_id
  const byCompany = new Map<string, AppointmentRow[]>();
  for (const a of appointments) {
    const arr = byCompany.get(a.company_id) ?? [];
    arr.push(a);
    byCompany.set(a.company_id, arr);
  }

  // Derive dates per legacy id
  const lastCompleted: Record<string, string> = {};
  const nextPlanned: Record<string, string> = {};
  for (const [legacyId, realId] of Object.entries(idMap)) {
    const appts = byCompany.get(realId) ?? [];
    const last = deriveLastCompletedDate(appts);
    const next = deriveNextPlannedDate(appts);
    if (last) lastCompleted[legacyId] = last;
    if (next) nextPlanned[legacyId] = next;
  }

  return { lastCompleted, nextPlanned };
}

// ---------------------------------------------------------------------------
// Derivation helpers — dates (NEVER persisted)
// ---------------------------------------------------------------------------

/**
 * Derive the most recent meeting_date where status='tamamlandi' from a
 * list of appointments.
 *
 * Returns null when no completed appointment exists. This is DERIVED and
 * never stored in the database — the service layer computes it on the fly.
 */
export function deriveLastCompletedDate(
  appointments: AppointmentRow[],
): string | null {
  const completed = appointments
    .filter((a) => a.status === "tamamlandi")
    .sort((a, b) => b.meeting_date.localeCompare(a.meeting_date));

  return completed.length > 0 ? completed[0].meeting_date : null;
}

/**
 * Derive the earliest future meeting_date where status='planlandi' from
 * a list of appointments.
 *
 * Returns null when no planned future appointment exists. This is DERIVED
 * and never stored in the database.
 */
export function deriveNextPlannedDate(
  appointments: AppointmentRow[],
): string | null {
  const today = new Date().toISOString().slice(0, 10);
  const planned = appointments
    .filter((a) => a.status === "planlandi" && a.meeting_date >= today)
    .sort((a, b) => a.meeting_date.localeCompare(b.meeting_date));

  return planned.length > 0 ? planned[0].meeting_date : null;
}
