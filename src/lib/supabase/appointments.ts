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
import type {
  Database,
  AppointmentRow,
  AppointmentInsert,
  AppointmentUpdate,
} from "@/types/database.types";

type Client = SupabaseClient<Database>;

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
  const { data, error } = await client
    .from("appointments")
    .select("*")
    .eq("company_id", companyId)
    .order("meeting_date", { ascending: false });

  if (error) {
    throw new Error(`appointments select-by-company failed: ${error.message}`);
  }
  return data ?? [];
}

/**
 * Read every appointment visible to the caller, most recent meeting first.
 * Used by the global Randevular list page.
 */
export async function selectAllAppointments(
  client: Client,
): Promise<AppointmentRow[]> {
  const { data, error } = await client
    .from("appointments")
    .select("*")
    .order("meeting_date", { ascending: false });

  if (error) {
    throw new Error(`appointments select-all failed: ${error.message}`);
  }
  return data ?? [];
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
  const { data, error } = await client
    .from("appointments")
    .select("*")
    .eq("contract_id", contractId)
    .order("meeting_date", { ascending: false });

  if (error) {
    throw new Error(`appointments select-by-contract failed: ${error.message}`);
  }
  return data ?? [];
}

/**
 * Read every appointment for a set of company ids in one round trip.
 * Used by the batched Firmalar list reader to derive Son Görüşme /
 * Sonraki Randevu columns without N+1 queries.
 */
export async function selectAppointmentsByCompanyIds(
  client: Client,
  companyIds: string[],
): Promise<AppointmentRow[]> {
  if (companyIds.length === 0) return [];

  const { data, error } = await client
    .from("appointments")
    .select("*")
    .in("company_id", companyIds)
    .order("meeting_date", { ascending: false });

  if (error) {
    throw new Error(`appointments select-by-companies failed: ${error.message}`);
  }
  return data ?? [];
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

/**
 * Insert a single appointment row exactly as provided. The service layer
 * is responsible for resolving company_id and contract_id, defaulting
 * status and meeting_type, stamping created_by from the auth session,
 * and validating shape.
 */
export async function insertAppointment(
  client: Client,
  input: AppointmentInsert,
): Promise<AppointmentRow> {
  const { data, error } = await client
    .from("appointments")
    .insert(input)
    .select()
    .single();

  if (error) {
    throw new Error(`appointments insert failed: ${error.message}`);
  }
  return data;
}

/**
 * Update a single appointment row by id. The service layer is responsible
 * for narrowing the patch to the columns the caller is allowed to change
 * and for re-verifying scope.
 */
export async function updateAppointment(
  client: Client,
  id: string,
  patch: AppointmentUpdate,
): Promise<AppointmentRow> {
  const { data, error } = await client
    .from("appointments")
    .update(patch)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw new Error(`appointments update failed: ${error.message}`);
  }
  return data;
}
