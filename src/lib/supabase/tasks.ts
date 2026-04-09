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
import type {
  Database,
  TaskRow,
  TaskInsert,
  TaskUpdate,
} from "@/types/database.types";

type Client = SupabaseClient<Database>;

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
  const { data, error } = await client
    .from("tasks")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`tasks select-by-company failed: ${error.message}`);
  }
  return data ?? [];
}

/**
 * Read every task visible to the caller, newest first.
 * Used by the global Gorevler list page.
 */
export async function selectAllTasks(
  client: Client,
): Promise<TaskRow[]> {
  const { data, error } = await client
    .from("tasks")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`tasks select-all failed: ${error.message}`);
  }
  return data ?? [];
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
  const { data, error } = await client
    .from("tasks")
    .select("*")
    .eq("contract_id", contractId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`tasks select-by-contract failed: ${error.message}`);
  }
  return data ?? [];
}

/**
 * Read every task linked to a specific appointment, newest first.
 * Used by the Randevu Detay > Gorevler tab.
 */
export async function selectTasksByAppointmentId(
  client: Client,
  appointmentId: string,
): Promise<TaskRow[]> {
  const { data, error } = await client
    .from("tasks")
    .select("*")
    .eq("appointment_id", appointmentId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`tasks select-by-appointment failed: ${error.message}`);
  }
  return data ?? [];
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
    throw new Error(`tasks insert failed: ${error.message}`);
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
): Promise<TaskRow> {
  const { data, error } = await client
    .from("tasks")
    .update(patch)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw new Error(`tasks update failed: ${error.message}`);
  }
  return data;
}
