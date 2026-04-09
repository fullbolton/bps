/**
 * BPS — Raw Supabase access for the `documents` table.
 *
 * Thin translator between the typed Supabase client and the service layer.
 * No business logic, no scope verification, no content validation.
 * Functions throw on supabase errors so the service layer can catch
 * and translate them to friendly Turkish messages.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Database,
  DocumentRow,
  DocumentInsert,
  DocumentUpdate,
} from "@/types/database.types";

type Client = SupabaseClient<Database>;

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/**
 * Read every document for a single company, most recent first.
 */
export async function selectDocumentsByCompanyId(
  client: Client,
  companyId: string,
): Promise<DocumentRow[]> {
  const { data, error } = await client
    .from("documents")
    .select("*")
    .eq("company_id", companyId)
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error(`documents select-by-company failed: ${error.message}`);
  }
  return data ?? [];
}

/**
 * Read every document visible to the caller, most recent first.
 * Used by the global Evraklar list page.
 */
export async function selectAllDocuments(
  client: Client,
): Promise<DocumentRow[]> {
  const { data, error } = await client
    .from("documents")
    .select("*")
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error(`documents select-all failed: ${error.message}`);
  }
  return data ?? [];
}

/**
 * Read a single document by id. Returns null when missing or RLS hides it.
 */
export async function selectDocumentById(
  client: Client,
  id: string,
): Promise<DocumentRow | null> {
  const { data, error } = await client
    .from("documents")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(`documents select-by-id failed: ${error.message}`);
  }
  return data ?? null;
}

/**
 * Read every document for a set of company ids in one round trip.
 * Used by the Firmalar list batched compliance reader.
 */
export async function selectDocumentsByCompanyIds(
  client: Client,
  companyIds: string[],
): Promise<DocumentRow[]> {
  if (companyIds.length === 0) return [];

  const { data, error } = await client
    .from("documents")
    .select("*")
    .in("company_id", companyIds)
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error(`documents select-by-companies failed: ${error.message}`);
  }
  return data ?? [];
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

/**
 * Insert a single document row exactly as provided.
 */
export async function insertDocument(
  client: Client,
  input: DocumentInsert,
): Promise<DocumentRow> {
  const { data, error } = await client
    .from("documents")
    .insert(input)
    .select()
    .single();

  if (error) {
    throw new Error(`documents insert failed: ${error.message}`);
  }
  return data;
}

/**
 * Update a single document row by id.
 */
export async function updateDocument(
  client: Client,
  id: string,
  patch: DocumentUpdate,
): Promise<DocumentRow> {
  const { data, error } = await client
    .from("documents")
    .update(patch)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw new Error(`documents update failed: ${error.message}`);
  }
  return data;
}
