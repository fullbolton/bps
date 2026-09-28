import { completePages } from "./complete-pages";
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
  return completePages((from, to, signal) => client
    .from("critical_dates")
    .select("*", {count:"exact"})
    .order("deadline_date", { ascending: true })
    .order("id", { ascending: true }).range(from, to).abortSignal(signal), "Kritik tarihler");
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
export class CriticalDateConflictError extends Error {
  constructor() {
    super("Kayıt değişmiş veya artık erişilemiyor. Taslağınız korunuyor; güncel kaydı kontrol ederek yeniden açın.");
    this.name = "CriticalDateConflictError";
  }
}

export async function updateCriticalDate(
  client: Client,
  id: string,
  patch: CriticalDateUpdate,
  expectedUpdatedAt: string,
): Promise<CriticalDateRow> {
  if (typeof expectedUpdatedAt !== "string" || !/^\d{4}-\d{2}-\d{2}T/.test(expectedUpdatedAt) || !Number.isFinite(Date.parse(expectedUpdatedAt))) {
    throw new Error("Kayıt sürümü doğrulanamadı. Sayfayı yenileyin.");
  }
  const { data, error } = await client
    .from("critical_dates")
    .update(patch)
    .eq("id", id)
    .eq("updated_at", expectedUpdatedAt)
    .select()
    .maybeSingle();

  if (error) {
    throw new Error(`critical_dates update failed: ${error.message}`);
  }
  if (!data) throw new CriticalDateConflictError();
  return data;
}
