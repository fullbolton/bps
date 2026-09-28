/**
 * BPS — Raw Supabase access for the `tasks` table.
 *
 * This file is the thin translator between the typed Supabase client
 * and the service layer. It performs NO business logic:
 *   - No partner scope re-verification (lives in the service layer)
 *   - No status-transition gating (lives in the service layer)
 *   - No priority normalization (lives in the service layer)
 *   - No source_type validation (the service layer whitelists)
 *   - No content validation (the service layer trims, validates)
 *
 * Functions throw on supabase errors so the service layer can catch
 * and translate them to friendly Turkish messages.
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

/** Conditional close: revision, tenant and (for operators) ownership stay in SQL. */
export async function completeScopedTask(client: Client, id: string, tenantId: string, revision: number, ownerId: string | null): Promise<TaskRow> {
  requireTaskRevision(revision);
  let query = client.from('tasks').update({ status: 'tamamlandi' })
    .eq('id', id).eq('tenant_id', tenantId).eq('revision', revision)
    .in('status', ['acik', 'devam_ediyor', 'gecikti']);
  if (ownerId) query = query.eq('assigned_to_user_id', ownerId);
  const { data, error } = await query.select('*').maybeSingle();
  if (error) throw new Error('İşlem sonucu doğrulanamadı. Tekrar denemeden önce listeyi yenileyin.');
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
 * Insert a single task row exactly as provided. The service layer is
 * responsible for resolving company_id, contract_id and appointment_id,
 * defaulting status, priority and source_type, stamping created_by from
 * the auth session, and validating shape.
 */
function taskWriteError(error: {code?:string;message:string}, action:string): Error {
  if(error.code==='BP004')return new Error("İşlem güvenli biçimde tamamlanamadı. Sayfayı yenileyip tekrar deneyin.");
  if(error.code==='BP002')return new Error("Atanan kişi artık bu çalışma alanının üyesi değil. Geçerli bir üye seçin.");
  if(error.code==='BP003')return new Error("Atanan kişinin görev erişimi yok. Yönetici, operasyon veya İK üyesi seçin.");
  return new Error(`tasks ${action} failed: ${error.message}`);
}

export async function insertTask(
  client: Client,
  input: TaskInsert,
): Promise<TaskRow> {
  const { data, error } = await client
    .from("tasks")
    .insert(input)
    .select()
    .single();

  if (error) {
    throw taskWriteError(error,"insert");
  }
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
  const { data, error } = await client
    .from("tasks")
    .update(patch)
    .eq("id", id)
    .eq("revision", revision)
    .select()
    .maybeSingle();

  if (error) {
    throw taskWriteError(error,"update");
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

/** Atomic compare-and-set: a simultaneous winner makes the other update match zero rows. */
export async function claimUnassignedTask(client:Client,id:string,tenantId:string,revision:number,actorId:string,name:string|null):Promise<TaskRow>{
  const {data,error}=await client.from('tasks').update({assigned_to_user_id:actorId,assigned_to:name})
    .eq('id',id).eq('tenant_id',tenantId).eq('revision',requireTaskRevision(revision))
    .is('assigned_to_user_id',null).is('assigned_to',null)
    .in('status',['acik','devam_ediyor','gecikti']).select().maybeSingle();
  if(error)throw taskWriteError(error,'update');
  if(!data)throw new TaskConflictError();
  return data;
}
