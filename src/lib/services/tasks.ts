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
import { selectProfileById } from "@/lib/supabase/profiles";

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
  /**
   * Assignee identity (profiles.id), or null to leave unassigned. This is the
   * ONLY assignee input: the display name is resolved from profiles server-side
   * (see resolveAssignee). There is deliberately no name field — a caller that
   * could supply one could write an arbitrary name into every task list, and
   * these inputs are reachable through a server action.
   */
  assignedToUserId?: string | null;
  dueDate?: string;
  sourceType?: string;
  sourceRef?: string;
  contractId?: string;
  appointmentId?: string;
  priority?: string;
}

export interface TaskUpdateInput {
  title?: string;
  /** Assignee identity (profiles.id), or null to unassign. Sole assignee input
   *  — the display name is derived server-side; see TaskCreateInput. */
  assignedToUserId?: string | null;
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

// Accepts null as well as undefined: an explicit null means "unassign", and
// the body already collapsed both to null — only the signature was narrower.
function nullableTrim(value: string | undefined | null): string | null {
  if (value === undefined || value === null) return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

const UUID_SHAPE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Resolve the assignee PAIR (identity + display name) from a user id.
 *
 * The display name is read from `profiles` here rather than taken from the
 * caller: a client that sent a mismatched (id, name) pair would otherwise
 * have the wrong name rendered in every task list. The id is the truth; the
 * name is derived from it.
 *
 * Returns both as null for an explicit unassign, so callers that go through
 * this service cannot leave the identity cleared while a stale name lingers on
 * screen. That is an APPLICATION-level guarantee only — see the scope note in
 * `updateTask`: the tasks RLS UPDATE policy is broad, so a direct PostgREST
 * write can still set the two columns independently until the STEP 3 rewrite
 * constrains it.
 *
 * NOTE — tenant scope: `profiles` carries no tenant_id today, so this cannot
 * yet verify that the assignee belongs to the caller's tenant. Same gap as the
 * child-table RLS work; closing it belongs to the role/RLS rewrite, which must
 * add tenant membership to profiles and constrain assignment accordingly.
 */
async function resolveAssignee(
  client: Client,
  userId: string | null | undefined,
): Promise<{ id: string | null; name: string | null }> {
  const id = nullableTrim(userId);
  if (!id) return { id: null, name: null };

  // Shape-check before querying: a malformed id would otherwise reach
  // `.eq("id", …)` and surface Postgres 22P02 (invalid uuid syntax) instead of
  // the domain error the UI knows how to show.
  if (!UUID_SHAPE.test(id)) {
    throw new TaskValidationError("Atanan kullanıcı kimliği geçersiz.");
  }

  const profile = await selectProfileById(client, id);
  if (!profile) {
    throw new TaskValidationError(
      "Atanan kullanıcı bulunamadı. Listeyi yenileyip tekrar deneyin.",
    );
  }
  return { id: profile.id, name: profile.display_name };
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
 *   - `options.tenantId` is REQUIRED: production `tasks_insert` checks
 *     `tenant_id = current_user_active_tenant()`, so an insert without it
 *     is rejected by RLS. The value must be server-resolved
 *     (`current_user_active_tenant()`); the server action is the
 *     chokepoint — never read it from the client. Mirrors createContract.
 */
export async function createTask(
  client: Client,
  input: TaskCreateInput,
  options: { tenantId: string },
): Promise<TaskRow> {
  const company = await requireCompanyByLegacyMockId(
    client,
    input.legacyCompanyId,
  );

  const title = ensureTitle(input.title);

  // The id is the sole assignee input; both columns are derived from it.
  const assignee = await resolveAssignee(client, input.assignedToUserId);

  const {
    data: { user },
  } = await client.auth.getUser();

  const payload: TaskInsert = {
    tenant_id: options.tenantId,
    company_id: company.id,
    title,
    assigned_to: assignee.name,
    assigned_to_user_id: assignee.id,
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
 * change status but CANNOT reassign. If the caller's role is in the
 * blocked set and the input includes an `assignedToUserId` change, this
 * function throws `TaskReassignPermissionError`.
 * This is the service-layer gate; RLS allows the broader UPDATE.
 */
export async function updateTask(
  client: Client,
  taskId: string,
  input: TaskUpdateInput,
): Promise<TaskRow> {
  // Gate: if the assignee is being changed, check the caller's role.
  // Fail closed: an unresolved role (profiles read failure / missing
  // row) must NOT skip the block — the tasks RLS UPDATE policy is
  // deliberately broader, so this service gate is the only enforcement
  // of the ROLE_MATRIX reassign rule.
  // `assignedToUserId` is now the only way to change the assignee, so gating
  // on it covers every reassignment path.
  if (input.assignedToUserId !== undefined) {
    const role = await getCurrentUserRole(client);
    if (role === null || REASSIGN_BLOCKED_ROLES.has(role)) {
      throw new TaskReassignPermissionError();
    }
  }

  const patch: TaskUpdate = {};

  if (input.title !== undefined) {
    patch.title = ensureTitle(input.title);
  }
  // An assignee id (including an explicit null) rewrites BOTH columns
  // together. There is no name-only path: patching them independently is what
  // let an unassign clear the identity while the stale name stayed on screen,
  // and it would also let a caller point the name at someone other than the
  // person the task is actually assigned to.
  //
  // SCOPE OF THIS GUARANTEE: it holds for the application paths, which all go
  // through this service. It is NOT a database boundary — the tasks RLS UPDATE
  // policy is deliberately broad, so a direct PostgREST write can still set
  // assigned_to alone. Closing that belongs to the STEP 3 RLS rewrite, which
  // must constrain direct task writes before anything relies on
  // assigned_to_user_id as an ownership signal.
  if (input.assignedToUserId !== undefined) {
    const assignee = await resolveAssignee(client, input.assignedToUserId);
    patch.assigned_to_user_id = assignee.id;
    patch.assigned_to = assignee.name;
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
