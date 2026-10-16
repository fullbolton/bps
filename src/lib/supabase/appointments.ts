import { completePages } from "./complete-pages";
/**
 * BPS — Raw Supabase access for the `appointments` table.
 *
 * This file is the thin translator between the typed Supabase client
 * and the service layer. It performs NO business logic:
 *   - No partner scope re-verification (lives in the service layer)
 *   - No status-transition gating (lives in the service layer)
 *   - No meeting-type normalization (lives in the service layer)
 *   - No content validation (the service layer trims, whitelists)
 *
 * Functions throw on supabase errors so the service layer can catch
 * and translate them to friendly Turkish messages.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { CompletionInput } from "@/lib/appointment-completion";
import type {
  Database,
  AppointmentRow,
  AppointmentInsert,
  AppointmentUpdate,
} from "@/types/database.types";

type Client = SupabaseClient<Database>;

function appointmentCommandError(error: {code?: string}): Error {
  if (error.code === 'BM001') return new Error('Bu işlem için gereken modül kapalı. Çalışma alanı ayarlarını kontrol edin.');
  if (error.code === '40001' || error.code === 'PT409') return new Error('Randevu başka bir işlemde değişti. Listeyi yenileyin.');
  if (error.code === '42501') return new Error('Randevuya veya bağlı kayda erişim yetkiniz yok. Listeyi yenileyin.');
  return new Error('İşlemin sonucu doğrulanamadı. Tekrar denemeden önce randevu listesini yenileyin.');
}

export async function completeAppointmentScoped(client:Client,appointmentId:string,input:Required<CompletionInput>,scope:{actorId:string;tenantId:string}) {
  const {data,error}=await client.rpc("complete_appointment_scoped",{
    p_actor_id:scope.actorId,p_tenant_id:scope.tenantId,p_appointment_id:appointmentId,
    p_result:input.result,p_next_action:input.nextAction,p_create_task:input.createTask,
  });
  if(error)throw error;
  return data;
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/**
 * Read every appointment for a single company, most recent meeting first.
 * Returns an empty array when none exist or the company is out of the
 * caller's RLS scope.
 */
export async function selectAppointmentsByCompanyId(
  client: Client,
  companyId: string,
): Promise<AppointmentRow[]> {
  return completePages((from, to, signal) => client
    .from("appointments")
    .select("*", {count:"exact"})
    .eq("company_id", companyId)
    .order("meeting_date", { ascending: false })
    .order("id", { ascending: true }).range(from, to).abortSignal(signal), "Randevular");
}

/**
 * Read every appointment visible to the caller, most recent meeting first.
 * Used by the global Randevular list page.
 */
export async function selectAllAppointments(
  client: Client,
): Promise<AppointmentRow[]> {
  return completePages((from, to, signal) => client
    .from("appointments")
    .select("*", { count: "exact" })
    .order("meeting_date", { ascending: false })
    .order("id", { ascending: true }).range(from, to).abortSignal(signal), "Randevular");
}

/**
 * Read a single appointment by id. Used by the Randevu Detay core read
 * path. Returns null when the row doesn't exist or RLS hides it.
 */
export async function selectAppointmentById(
  client: Client,
  id: string,
): Promise<AppointmentRow | null> {
  const { data, error } = await client
    .from("appointments")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(`appointments select-by-id failed: ${error.message}`);
  }
  return data ?? null;
}

/**
 * Read every appointment linked to a specific contract, most recent
 * meeting first. Used by the Sozlesme Detay > Randevular tab.
 */
export async function selectAppointmentsByContractId(
  client: Client,
  contractId: string,
): Promise<AppointmentRow[]> {
  return completePages((from, to, signal) => client
    .from("appointments")
    .select("*", {count:"exact"})
    .eq("contract_id", contractId)
    .order("meeting_date", { ascending: false })
    .order("id", { ascending: true }).range(from, to).abortSignal(signal), "Randevular");
}

/**
 * Read every appointment for a set of company ids in bounded pages.
 * Used by the batched Firmalar list reader to derive Son Görüşme /
 * Sonraki Randevu columns without N+1 queries.
 */
export async function selectAppointmentsByCompanyIds(
  client: Client,
  companyIds: string[],
): Promise<AppointmentRow[]> {
  if (companyIds.length === 0) return [];

  return completePages((from, to, signal) => client
    .from("appointments")
    .select("*", {count:"exact"})
    .in("company_id", companyIds)
    .order("meeting_date", { ascending: false })
    .order("id", { ascending: true }).range(from, to).abortSignal(signal), "Randevular");
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

/**
 * Create through the scoped database command. The database verifies relations,
 * locks module configuration and derives the author from the session.
 */
export async function insertAppointment(
  client: Client,
  input: AppointmentInsert,
): Promise<AppointmentRow> {
  const { data, error } = await client.rpc('appointment_execute_v1', {
    p_action: 'create', p_id: null, p_tenant: input.tenant_id,
    p_input: {company_id: input.company_id, contract_id: input.contract_id ?? null,
      meeting_date: input.meeting_date, meeting_time: input.meeting_time ?? null,
      meeting_type: input.meeting_type ?? 'ziyaret', attendee: input.attendee ?? null},
  }).single();
  if (error) throw appointmentCommandError(error);
  if (!data || data.tenant_id !== input.tenant_id || data.company_id !== input.company_id
    || data.contract_id !== (input.contract_id ?? null) || data.status !== 'planlandi'
    || data.meeting_date !== input.meeting_date) {
    throw new Error('Randevu kaydının sonucu doğrulanamadı. Listeyi yenileyin.');
  }
  return data;
}

/**
 * Change status only if the previously read status still matches. Completion
 * uses its separate atomic appointment/task workflow.
 */
export async function updateAppointment(
  client: Client,
  id: string,
  patch: AppointmentUpdate,
  expected: Pick<AppointmentRow, 'tenant_id' | 'status'>,
): Promise<AppointmentRow> {
  if (Object.keys(patch).some(key => key !== 'status') || !patch.status) throw new Error('Geçersiz randevu değişikliği.');
  const { data, error } = await client.rpc('appointment_execute_v1', {
    p_action: 'status', p_id: id, p_tenant: expected.tenant_id,
    p_input: {status: patch.status, expected_status: expected.status},
  }).single();
  if (error) throw appointmentCommandError(error);
  if (!data || data.id !== id || data.tenant_id !== expected.tenant_id || data.status !== patch.status) {
    throw new Error('Randevu değişikliğinin sonucu doğrulanamadı. Listeyi yenileyin.');
  }
  return data;
}
