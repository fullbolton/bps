/**
 * BPS — Raw Supabase access for the `critical_dates` table.
 *
 * Thin translator between the typed Supabase client and the service layer.
 * No business logic, no status derivation, no role gating.
 * Functions throw on supabase errors so the service layer can catch
 * and translate them to friendly Turkish messages.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Database,
  CriticalDateRow,
  CriticalDateInsert,
  CriticalDateUpdate,
} from "@/types/database.types";

type Client = SupabaseClient<Database>;

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/**
 * Read every critical date, ordered by deadline ascending (most urgent first).
 */
export async function selectAllCriticalDates(
  client: Client,
): Promise<CriticalDateRow[]> {
  const { data, error } = await client
    .from("critical_dates")
    .select("*")
    .order("deadline_date", { ascending: true });

  if (error) {
    throw new Error(`critical_dates select-all failed: ${error.message}`);
  }
  return data ?? [];
}

/**
 * Read a single critical date by id.
 */
export async function selectCriticalDateById(
  client: Client,
  id: string,
): Promise<CriticalDateRow | null> {
  const { data, error } = await client
    .from("critical_dates")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(`critical_dates select-by-id failed: ${error.message}`);
  }
  return data ?? null;
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

/**
 * Insert a single critical date row.
 */
export async function insertCriticalDate(
  client: Client,
  input: CriticalDateInsert,
): Promise<CriticalDateRow> {
  const { data, error } = await client
    .from("critical_dates")
    .insert(input)
    .select()
    .single();

  if (error) {
    throw new Error(`critical_dates insert failed: ${error.message}`);
  }
  return data;
}

/**
 * Update a single critical date row by id.
 */
export async function updateCriticalDate(
  client: Client,
  id: string,
  patch: CriticalDateUpdate,
): Promise<CriticalDateRow> {
  const { data, error } = await client
    .from("critical_dates")
    .update(patch)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw new Error(`critical_dates update failed: ${error.message}`);
  }
  return data;
}
