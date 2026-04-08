/**
 * BPS — Raw Supabase access for the `contracts` table.
 *
 * This file is the thin translator between the typed Supabase client
 * and the service layer. It performs NO business logic:
 *   - No partner scope re-verification (lives in services/contracts.ts)
 *   - No status-transition gating (lives in services/contracts.ts)
 *   - No remaining-day derivation (lives in services/contracts.ts;
 *     never persisted)
 *   - No content validation (services/contracts.ts trims, whitelists)
 *
 * Functions throw on supabase errors so the service layer can catch
 * and translate them to friendly Turkish messages.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Database,
  ContractRow,
  ContractInsert,
  ContractUpdate,
} from "@/types/database.types";

type Client = SupabaseClient<Database>;

/**
 * Read every contract visible to the caller, sorted "active first then
 * end_date asc, then name asc". The Sözleşmeler list page filters this
 * client-side via its existing filter chips and search input.
 */
export async function selectAllContracts(client: Client): Promise<ContractRow[]> {
  const { data, error } = await client
    .from("contracts")
    .select("*")
    .order("status", { ascending: true })
    .order("end_date", { ascending: true, nullsFirst: false })
    .order("name", { ascending: true });

  if (error) {
    throw new Error(`contracts select-all failed: ${error.message}`);
  }
  return data ?? [];
}

/**
 * Read a single contract by id. Used by the Sözleşme Detay core read
 * path. Returns null when the row doesn't exist or RLS hides it.
 */
export async function selectContractById(
  client: Client,
  contractId: string,
): Promise<ContractRow | null> {
  const { data, error } = await client
    .from("contracts")
    .select("*")
    .eq("id", contractId)
    .maybeSingle();

  if (error) {
    throw new Error(`contracts select-by-id failed: ${error.message}`);
  }
  return data ?? null;
}

/**
 * Read every contract for a single company. Used by the Firma Detay
 * Sözleşmeler tab and the Genel Bakış > Aktif Sözleşmeler card.
 *
 * Sort order: active rows first (so Aktif Sözleşmeler card naturally
 * shows the right rows when sliced), then end_date ascending so the
 * "kalan gün" badge surfaces the most-imminent renewals at the top.
 */
export async function selectContractsByCompanyId(
  client: Client,
  companyId: string,
): Promise<ContractRow[]> {
  const { data, error } = await client
    .from("contracts")
    .select("*")
    .eq("company_id", companyId)
    .order("status", { ascending: true })
    .order("end_date", { ascending: true, nullsFirst: false })
    .order("name", { ascending: true });

  if (error) {
    throw new Error(`contracts select-by-company failed: ${error.message}`);
  }
  return data ?? [];
}

/**
 * Batch helper for the Firmalar list "Aktif Sözleşme" column.
 *
 * Returns the count of contracts with status='aktif' grouped by
 * `company_id`, in a single round trip. Out-of-scope companies are
 * silently absent (count = 0 in the caller's fallback).
 *
 * Implementation: SELECT all active rows for the given companies, then
 * aggregate client-side. PostgREST does not support GROUP BY natively
 * without a view; the aggregation is small (≤ 8 firmas × dozens of
 * active rows) so the round trip stays well-bounded.
 */
export async function getActiveContractCountsByCompanyIds(
  client: Client,
  companyIds: string[],
): Promise<Record<string, number>> {
  if (companyIds.length === 0) return {};

  const { data, error } = await client
    .from("contracts")
    .select("company_id")
    .in("company_id", companyIds)
    .eq("status", "aktif");

  if (error) {
    throw new Error(`contracts active-count failed: ${error.message}`);
  }

  const counts: Record<string, number> = {};
  for (const row of data ?? []) {
    counts[row.company_id] = (counts[row.company_id] ?? 0) + 1;
  }
  return counts;
}

/**
 * Insert a single contract row exactly as provided. The service layer
 * is responsible for resolving company_id, defaulting status, stamping
 * created_by from the auth session, and validating shape.
 */
export async function insertContract(
  client: Client,
  input: ContractInsert,
): Promise<ContractRow> {
  const { data, error } = await client
    .from("contracts")
    .insert(input)
    .select()
    .single();

  if (error) {
    throw new Error(`contracts insert failed: ${error.message}`);
  }
  return data;
}

/**
 * Update a single contract row by id. The service layer is responsible
 * for narrowing the patch to the columns the caller is allowed to
 * change and for re-verifying scope.
 */
export async function updateContract(
  client: Client,
  contractId: string,
  patch: ContractUpdate,
): Promise<ContractRow> {
  const { data, error } = await client
    .from("contracts")
    .update(patch)
    .eq("id", contractId)
    .select()
    .single();

  if (error) {
    throw new Error(`contracts update failed: ${error.message}`);
  }
  return data;
}
