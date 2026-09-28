import { moduleAccessMessage } from '@/lib/modules/errors';
/**
 * Task reads use the existing role/tenant RLS plus the module fence.
 * Writes use task_execute_v1: module, live role, assignment and revision checks
 * run together in PostgreSQL. Requires the expand migration before frontend deploy.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { completePages } from "./complete-pages";
import { requireTaskRevision, TaskConflictError } from "@/lib/task-revision";
import type {
  Database,
  TaskRow,
  TaskInsert,
  TaskUpdate,
} from "@/types/database.types";

type Client = SupabaseClient<Database>;

/** Controlled command: module, live role, ownership and revision are checked in SQL. */
export async function completeScopedTask(client: Client, id: string, tenantId: string, revision: number, expectedActorId: string | null): Promise<TaskRow> {
  const { data, error } = await client.rpc('task_execute_v1', {
    p_action: 'complete', p_task_id: id, p_expected_tenant: tenantId,
    p_revision: requireTaskRevision(revision), ...(expectedActorId ? { p_expected_actor: expectedActorId } : {}),
  }).single();
  if (error) throw taskWriteError(error);
  if (!data) throw new TaskConflictError();
  return data;
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/**
 * Read every task for a single company, newest first.
 * Returns an empty array when none exist or the company is out of
 * the caller's RLS scope.
 */
export async function selectTasksByCompanyId(
  client: Client,
  companyId: string,
): Promise<TaskRow[]> {
  return completePages((from, to, signal) => client
    .from("tasks")
    .select("*", { count: "exact" })
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: true }).range(from, to).abortSignal(signal), "Görevler");
}

/**
 * Read every task visible to the caller, newest first.
 * Used by the global Gorevler list page.
 */
export async function selectAllTasks(
  client: Client,
): Promise<TaskRow[]> {
  return completePages((from, to, signal) => client
    .from("tasks")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .order("id", { ascending: true }).range(from, to).abortSignal(signal), "Görevler");
}

/**
 * Read a single task by id. Used by the Gorev Detay core read path.
 * Returns null when the row doesn't exist or RLS hides it.
 */
export async function selectTaskById(
  client: Client,
  id: string,
): Promise<TaskRow | null> {
  const { data, error } = await client
    .from("tasks")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(`tasks select-by-id failed: ${error.message}`);
  }
  return data ?? null;
}

/**
 * Read every task linked to a specific contract, newest first.
 * Used by the Sozlesme Detay > Gorevler tab.
 */
export async function selectTasksByContractId(
  client: Client,
  contractId: string,
): Promise<TaskRow[]> {
  return completePages((from, to, signal) => client
    .from("tasks")
    .select("*", { count: "exact" })
    .eq("contract_id", contractId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: true }).range(from, to).abortSignal(signal), "Görevler");
}

/**
 * Read every task linked to a specific appointment, newest first.
 * Used by the Randevu Detay > Gorevler tab.
 */
export async function selectTasksByAppointmentId(
  client: Client,
  appointmentId: string,
): Promise<TaskRow[]> {
  return completePages((from, to, signal) => client
    .from("tasks")
    .select("*", { count: "exact" })
    .eq("appointment_id", appointmentId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: true }).range(from, to).abortSignal(signal), "Görevler");
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

/**
 * Create through the controlled gateway. The service layer is
 * responsible for resolving company_id, contract_id and appointment_id,
 * defaulting priority/source_type and validating user input. The database
 * derives creator/assignee name and enforces the final authorization.
 */
function taskWriteError(error: {code?:string;message:string}): Error {
  if(error.code==='BT405')return new Error('Firma pasif olduğu için yeni görev oluşturulamaz.');
  if(error.code==='BT409')return new TaskConflictError();
  const moduleMessage=moduleAccessMessage(error);if(moduleMessage)return new Error(moduleMessage);
  if(error.code==='BT403')return new Error('Bu görev işlemi için erişiminiz yok. Çalışma alanınızı kontrol edin.');
  if(error.code==='BT400'||error.code==='22007'||error.code==='22008'||error.code==='22P02'||error.code==='23514')return new Error('Görev bilgilerini kontrol edin. Başlık, tarih veya seçimlerden biri geçersiz.');
  if(error.code==='BP004')return new Error("İşlem güvenli biçimde tamamlanamadı. Sayfayı yenileyip tekrar deneyin.");
  if(error.code==='BP002')return new Error("Atanan kişi artık bu çalışma alanının üyesi değil. Geçerli bir üye seçin.");
  if(error.code==='BP003')return new Error("Atanan kişinin görev erişimi yok. Yönetici, operasyon veya İK üyesi seçin.");
  return new Error('İşlem sonucu doğrulanamadı. Tekrar denemeden önce listeyi yenileyin.');
}

export async function insertTask(
  client: Client,
  input: TaskInsert,
): Promise<TaskRow> {
  // Names, creator and timestamps are derived in the database, never trusted input.
  const { company_id, contract_id, appointment_id, title, assigned_to_user_id,
    due_date, source_type, source_ref, priority } = input;
  const { data, error } = await client.rpc('task_execute_v1', {
    p_action: 'create', p_expected_tenant: input.tenant_id,
    p_input: { company_id, contract_id, appointment_id, title, assigned_to_user_id,
      due_date, source_type, source_ref, priority },
  }).single();

  if (error) {
    throw taskWriteError(error);
  }
  if (!data) throw new Error("Görev kaydı doğrulanamadı. Listeyi yenileyin.");
  return data;
}

/**
 * Update a single task row by id. The service layer is responsible
 * for narrowing the patch to the columns the caller is allowed to
 * change and for re-verifying scope.
 */
export async function updateTask(
  client: Client,
  id: string,
  patch: TaskUpdate,
  expectedRevision: number,
): Promise<TaskRow> {
  const revision = requireTaskRevision(expectedRevision);
  const allowed = new Set(['title','assigned_to_user_id','assigned_to','due_date','priority','status']);
  if (Object.keys(patch).some(key => !allowed.has(key))) throw new Error('Görev alanları doğrulanamadı.');
  const { assigned_to: _displayName, ...input } = patch;
  const { data, error } = await client.rpc('task_execute_v1', {
    p_action: 'update', p_task_id: id, p_revision: revision, p_input: input,
  }).single();

  if (error) {
    throw taskWriteError(error);
  }
  if (!data) throw new TaskConflictError();
  return data;
}

export async function selectTaskAssignmentHistory(client: Client, taskId: string) {
  const { data, error } = await client.from("task_assignment_history")
    .select("*").eq("task_id", taskId).order("revision", {ascending:false}).limit(21);
  if (error) throw new Error("Atama geçmişi yüklenemedi. Yeniden deneyin.");
  return { rows: (data ?? []).slice(0,20), hasMore: (data ?? []).length > 20 };
}

/** Revision and unassigned predicates execute under the same database row lock. */
export async function claimUnassignedTask(client:Client,id:string,tenantId:string,revision:number,actorId:string):Promise<TaskRow>{
  const {data,error}=await client.rpc('task_execute_v1',{
    p_action:'claim',p_task_id:id,p_expected_tenant:tenantId,p_expected_actor:actorId,
    p_revision:requireTaskRevision(revision),
  }).single();
  if(error)throw taskWriteError(error);
  if(!data)throw new TaskConflictError();
  return data;
}
