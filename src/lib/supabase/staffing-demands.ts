/**
 * BPS — Raw Supabase access for the `staffing_demands` table.
 *
 * This file is the thin translator between the typed Supabase client
 * and the service layer. It performs NO business logic:
 *   - No partner scope re-verification (lives in the service layer)
 *   - No status-transition gating (lives in the service layer)
 *   - No priority normalization (lives in the service layer)
 *   - No content validation (the service layer trims, whitelists)
 *
 * Functions throw on supabase errors so the service layer can catch
 * and translate them to friendly Turkish messages.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Database,
  StaffingDemandRow,
  StaffingDemandInsert,
  StaffingDemandUpdate,
} from "@/types/database.types";

type Client = SupabaseClient<Database>;

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/**
 * Read every staffing demand for a single company, newest first.
 * Returns an empty array when none exist or the company is out of
 * the caller's RLS scope.
 */
export async function selectStaffingDemandsByCompanyId(
  client: Client,
  companyId: string,
): Promise<StaffingDemandRow[]> {
  const { data, error } = await client
    .from("staffing_demands")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`staffing_demands select-by-company failed: ${error.message}`);
  }
  return data ?? [];
}

/**
 * Read every staffing demand visible to the caller, newest first.
 * Used by the global Personel Talepleri list page.
 */
export async function selectAllStaffingDemands(
  client: Client,
): Promise<StaffingDemandRow[]> {
  const { data, error } = await client
    .from("staffing_demands")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`staffing_demands select-all failed: ${error.message}`);
  }
  return data ?? [];
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

/**
 * Insert a single staffing demand row exactly as provided. The service
 * layer is responsible for resolving company_id, defaulting status and
 * priority, stamping created_by from the auth session, and validating
 * shape.
 */
export async function insertStaffingDemand(
  client: Client,
  input: StaffingDemandInsert,
): Promise<StaffingDemandRow> {
  const { data, error } = await client
    .from("staffing_demands")
    .insert(input)
    .select()
    .single();

  if (error) {
    throw new Error(`staffing_demands insert failed: ${error.message}`);
  }
  return data;
}

/**
 * Update a single staffing demand row by id. The service layer is
 * responsible for narrowing the patch to the columns the caller is
 * allowed to change and for re-verifying scope.
 */
export async function updateStaffingDemand(
  client: Client,
  id: string,
  patch: StaffingDemandUpdate,
): Promise<StaffingDemandRow> {
  const { data, error } = await client
    .from("staffing_demands")
    .update(patch)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw new Error(`staffing_demands update failed: ${error.message}`);
  }
  return data;
}
