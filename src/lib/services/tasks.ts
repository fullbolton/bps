/**
 * BPS service layer — tasks (Faz 3C "Gorevler" slice).
 *
 *     UI Component (Gorevler list, Firma Detay tab, Sozlesme/Randevu Detay)
 *         ↓
 *     src/lib/services/tasks.ts                 ← THIS FILE — business logic
 *         ↓
 *     src/lib/supabase/tasks.ts                 ← raw CRUD only
 *         ↓
 *     Supabase Postgres + RLS
 *
 * Invariants enforced here (mirrored by DB constraints / RLS):
 *   - Authorization = role capability + assigned scope
 *       → every mutation that targets a specific firma re-verifies scope
 *         via `requireCompanyByLegacyMockId`. If RLS hides the firma,
 *         that throws and the mutation is short-circuited.
 *   - title must be non-blank on create.
 *   - Status changes are gated by the GorevDurumu whitelist.
 *   - Per ROLE_MATRIX: ik can create tasks and change status but CANNOT
 *     reassign (change assigned_to). goruntuleyici is similarly restricted.
 *     The service layer `updateTask` is the gate for this; RLS allows
 *     the broader UPDATE.
 *
 * Error surface:
 *   - TaskValidationError              — blank title, invalid status
 *   - TaskReassignPermissionError      — ik/goruntuleyici reassign attempt
 *   - CompanyNotFoundOrOutOfScopeError — reused from services/companies
 *   - Generic Error for DB errors, caught by the UI's try/catch.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { GorevDurumu, OncelikSeviyesi } from "@/types/ui";
import type { UserRole } from "@/context/AuthContext";
import type {
  Database,
  TaskRow,
  TaskInsert,
  TaskUpdate,
} from "@/types/database.types";
import type { TaskSourceType } from "@/lib/task-sources";
import {
  selectTasksByCompanyId,
  selectAllTasks,
  selectTasksByContractId,
  selectTasksByAppointmentId,
  insertTask,
  updateTask as updateTaskRaw,
} from "@/lib/supabase/tasks";
import { requireCompanyByLegacyMockId } from "@/lib/services/companies";

type Client = SupabaseClient<Database>;

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class TaskValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TaskValidationError";
  }
}

export class TaskReassignPermissionError extends Error {
  constructor() {
    super(
      "Bu rol ile görev atama değişikliği yapılamaz. Yalnızca yönetici veya partner atama değiştirebilir.",
    );
    this.name = "TaskReassignPermissionError";
  }
}

// ---------------------------------------------------------------------------
// Status whitelist (mirrors types/ui.ts GorevDurumu and the DB CHECK)
// ---------------------------------------------------------------------------

export const TASK_STATUSES: readonly GorevDurumu[] = [
  "acik",
  "devam_ediyor",
  "tamamlandi",
  "gecikti",
  "iptal",
] as const;

const TASK_STATUS_SET = new Set<GorevDurumu>(TASK_STATUSES);

function ensureStatus(value: string): GorevDurumu {
  if (!TASK_STATUS_SET.has(value as GorevDurumu)) {
    throw new TaskValidationError(`Geçersiz görev durumu: ${value}`);
  }
  return value as GorevDurumu;
}

// ---------------------------------------------------------------------------
// Roles that CANNOT reassign tasks (per ROLE_MATRIX)
// ---------------------------------------------------------------------------

const REASSIGN_BLOCKED_ROLES: ReadonlySet<UserRole> = new Set([
  "ik",
  "goruntuleyici",
]);

// ---------------------------------------------------------------------------
// UI-facing input shapes
// ---------------------------------------------------------------------------

export interface TaskCreateInput {
  legacyCompanyId: string;
  title: string;
  assignedTo?: string;
  dueDate?: string;
  sourceType?: string;
  sourceRef?: string;
  contractId?: string;
  appointmentId?: string;
  priority?: string;
}

export interface TaskUpdateInput {
  title?: string;
  assignedTo?: string;
  dueDate?: string;
  priority?: string;
  status?: string;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function ensureTitle(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new TaskValidationError("Görev başlığı boş bırakılamaz.");
  }
  return trimmed;
}

function nullableTrim(value: string | undefined): string | null {
  if (value === undefined || value === null) return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

/**
 * Resolve the calling user's role from `profiles`. Used to gate the
 * service-layer reassign writer. The DB RLS UPDATE policy already
 * covers the broader case; this check exists so the UI can show a
 * clean Turkish error before the SQL fires.
 */
async function getCurrentUserRole(client: Client): Promise<UserRole | null> {
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

  return (profile?.role as UserRole) ?? null;
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/**
 * List every task for the firma identified by a legacy mock id,
 * newest first.
 *
 * Resolution flow:
 *   legacy id → companies row (RLS-checked) → tasks.company_id query
 *
 * If RLS hides the firma from the caller, the resolver throws
 * CompanyNotFoundOrOutOfScopeError and no tasks are returned.
 */
export async function listTasksByLegacyCompanyId(
  client: Client,
  legacyMockId: string,
): Promise<TaskRow[]> {
  const company = await requireCompanyByLegacyMockId(client, legacyMockId);
  return selectTasksByCompanyId(client, company.id);
}

/**
 * List every task visible to the caller. Used by the global Gorevler
 * list page.
 */
export async function listAllTasks(client: Client): Promise<TaskRow[]> {
  return selectAllTasks(client);
}

/**
 * List every task linked to a specific contract, newest first.
 * Used by the Sozlesme Detay > Gorevler tab.
 */
export async function listTasksByContractId(
  client: Client,
  contractId: string,
): Promise<TaskRow[]> {
  return selectTasksByContractId(client, contractId);
}

/**
 * List every task linked to a specific appointment, newest first.
 * Used by the Randevu Detay > Gorevler tab.
 */
export async function listTasksByAppointmentId(
  client: Client,
  appointmentId: string,
): Promise<TaskRow[]> {
  return selectTasksByAppointmentId(client, appointmentId);
}

// ---------------------------------------------------------------------------
// Writes — create
// ---------------------------------------------------------------------------

/**
 * Create a new task for the firma identified by a legacy mock id.
 *
 * Behavior:
 *   - Re-verifies partner scope via `requireCompanyByLegacyMockId`.
 *   - Trims and validates title (non-blank).
 *   - Defaults status to "acik", priority to "normal", source_type to
 *     "manuel" when omitted.
 *   - Stamps created_by from the auth session.
 */
export async function createTask(
  client: Client,
  input: TaskCreateInput,
): Promise<TaskRow> {
  const company = await requireCompanyByLegacyMockId(
    client,
    input.legacyCompanyId,
  );

  const title = ensureTitle(input.title);

  const {
    data: { user },
  } = await client.auth.getUser();

  const payload: TaskInsert = {
    company_id: company.id,
    title,
    assigned_to: nullableTrim(input.assignedTo),
    due_date: nullableTrim(input.dueDate),
    source_type: (input.sourceType as TaskSourceType) ?? "manuel",
    source_ref: nullableTrim(input.sourceRef),
    contract_id: nullableTrim(input.contractId),
    appointment_id: nullableTrim(input.appointmentId),
    priority: (input.priority as OncelikSeviyesi) ?? "normal",
    status: "acik",
    created_by: user?.id ?? null,
  };

  return insertTask(client, payload);
}

// ---------------------------------------------------------------------------
// Writes — status change
// ---------------------------------------------------------------------------

/**
 * Change a task's status. Validates the new status against the
 * GorevDurumu whitelist.
 */
export async function updateTaskStatus(
  client: Client,
  taskId: string,
  nextStatus: GorevDurumu,
): Promise<TaskRow> {
  const validatedStatus = ensureStatus(nextStatus);
  return updateTaskRaw(client, taskId, { status: validatedStatus });
}

// ---------------------------------------------------------------------------
// Writes — general update (with reassign gate)
// ---------------------------------------------------------------------------

/**
 * Update an existing task. Validates title non-blank when included,
 * status against the whitelist when included.
 *
 * IMPORTANT per ROLE_MATRIX: ik and goruntuleyici can create tasks and
 * change status but CANNOT reassign (change assigned_to). If the
 * caller's role is in the blocked set and the input includes an
 * assignedTo change, this function throws `TaskReassignPermissionError`.
 * This is the service-layer gate; RLS allows the broader UPDATE.
 */
export async function updateTask(
  client: Client,
  taskId: string,
  input: TaskUpdateInput,
): Promise<TaskRow> {
  // Gate: if assignedTo is being changed, check the caller's role.
  if (input.assignedTo !== undefined) {
    const role = await getCurrentUserRole(client);
    if (role && REASSIGN_BLOCKED_ROLES.has(role)) {
      throw new TaskReassignPermissionError();
    }
  }

  const patch: TaskUpdate = {};

  if (input.title !== undefined) {
    patch.title = ensureTitle(input.title);
  }
  if (input.assignedTo !== undefined) {
    patch.assigned_to = nullableTrim(input.assignedTo);
  }
  if (input.dueDate !== undefined) {
    patch.due_date = nullableTrim(input.dueDate);
  }
  if (input.priority !== undefined) {
    patch.priority = input.priority as OncelikSeviyesi;
  }
  if (input.status !== undefined) {
    patch.status = ensureStatus(input.status);
  }

  return updateTaskRaw(client, taskId, patch);
}
