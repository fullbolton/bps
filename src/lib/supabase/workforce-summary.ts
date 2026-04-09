/**
 * BPS — Raw Supabase access for the `workforce_summary` table.
 *
 * This file is the thin translator between the typed Supabase client
 * and the service layer. It performs NO business logic:
 *   - No partner scope re-verification (lives in the service layer)
 *   - No count derivation or delta computation (lives in the service layer)
 *   - No content validation (the service layer validates)
 *
 * Functions throw on supabase errors so the service layer can catch
 * and translate them to friendly Turkish messages.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Database,
  WorkforceSummaryRow,
  WorkforceSummaryInsert,
} from "@/types/database.types";

type Client = SupabaseClient<Database>;

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/**
 * Read the workforce summary row for a single company. Returns null
 * when no summary exists or the company is out of the caller's RLS
 * scope. Each company has at most one summary row.
 */
export async function selectWorkforceSummaryByCompanyId(
  client: Client,
  companyId: string,
): Promise<WorkforceSummaryRow | null> {
  const { data, error } = await client
    .from("workforce_summary")
    .select("*")
    .eq("company_id", companyId)
    .maybeSingle();

  if (error) {
    throw new Error(`workforce_summary select-by-company failed: ${error.message}`);
  }
  return data ?? null;
}

/**
 * Read every workforce summary visible to the caller. Used by the
 * global dashboard aggregate cards.
 */
export async function selectAllWorkforceSummaries(
  client: Client,
): Promise<WorkforceSummaryRow[]> {
  const { data, error } = await client
    .from("workforce_summary")
    .select("*");

  if (error) {
    throw new Error(`workforce_summary select-all failed: ${error.message}`);
  }
  return data ?? [];
}

/**
 * Batch-fetch workforce summaries for many companies in one round trip.
 * Used by the Firmalar list for the workforce columns. Companies with
 * no summary row are silently absent from the result.
 */
export async function selectWorkforceSummariesByCompanyIds(
  client: Client,
  companyIds: string[],
): Promise<WorkforceSummaryRow[]> {
  if (companyIds.length === 0) return [];

  const { data, error } = await client
    .from("workforce_summary")
    .select("*")
    .in("company_id", companyIds);

  if (error) {
    throw new Error(`workforce_summary select-by-company-ids failed: ${error.message}`);
  }
  return data ?? [];
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

/**
 * Upsert a workforce summary row. If a row for the given company_id
 * already exists it is updated; otherwise a new row is inserted.
 *
 * The service layer is responsible for computing the counts before
 * calling this function.
 */
export async function upsertWorkforceSummary(
  client: Client,
  input: WorkforceSummaryInsert,
): Promise<WorkforceSummaryRow> {
  const { data, error } = await client
    .from("workforce_summary")
    .upsert(input, { onConflict: "company_id" })
    .select()
    .single();

  if (error) {
    throw new Error(`workforce_summary upsert failed: ${error.message}`);
  }
  return data;
}
