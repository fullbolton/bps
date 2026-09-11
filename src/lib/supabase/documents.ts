/**
 * BPS — Raw Supabase access for the `documents` table.
 *
 * Thin translator between the typed Supabase client and the service layer.
 * Caller/RLS authorization is unchanged; paginated reads verify response scope.
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
const COMPANY_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
  if (typeof companyId !== "string" || !COMPANY_UUID.test(companyId)) throw new Error("documents scope invalid");
  return readDocumentPages(client, [companyId]);
}

/**
 * Read every document visible to the caller, most recent first.
 * Used by the global Evraklar list page.
 */
export async function selectAllDocuments(
  client: Client,
): Promise<DocumentRow[]> {
  return readDocumentPages(client);
}

/** Fixed UUID batches bound URLs; undefined alone means all visible to the caller. */
async function readDocumentPages(client: Client, companyIds?: string[]): Promise<DocumentRow[]> {
  const ids = companyIds === undefined ? undefined : [...new Set(companyIds.map(id => id.toLowerCase()))];
  if (ids?.length === 0) return [];
  const groups: (string[] | undefined)[] = [];
  if (ids === undefined) groups.push(undefined);
  else for (let offset = 0; offset < ids.length; offset += 60) groups.push(ids.slice(offset, offset + 60));
  const rows: DocumentRow[] = [], seen = new Set<string>();
  for (const keys of groups) {
    const allowedCompanies = keys ? new Set(keys) : null;
    let cursor: string | null = null;
    // Follow immutable IDs. Only an empty page ends each scan, even with a short server cap.
    for (let page = 0; page <= 200; page++) {
      let query = client.from("documents").select("*").order("id", { ascending: true }).limit(500);
      if (keys?.length === 1) query = query.eq("company_id", keys[0]);
      else if (keys) query = query.in("company_id", keys);
      if (cursor) query = query.gt("id", cursor);
      const { data, error } = await query;
      if (error) throw new Error("documents scan page failed");
      if (!Array.isArray(data)) throw new Error("documents scan invalid page");
      if (data.length === 0) break;
      if (page === 200) throw new Error("documents scan limit exceeded");
      for (const row of data) {
        if (!row || typeof row.id !== "string" || !row.id || (cursor !== null && row.id <= cursor) || seen.has(row.id)) {
          throw new Error("documents scan page did not advance");
        }
        if (allowedCompanies && !allowedCompanies.has(row.company_id)) throw new Error("documents scan scope mismatch");
        seen.add(row.id);
        cursor = row.id;
        rows.push(row);
      }
    }
  }
  // Sort across the entire result, not separately per company batch.
  return rows.sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at) || a.id.localeCompare(b.id));
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
 * Read every document for a fixed set of company ids, following all pages.
 * Used by the Firmalar list batched compliance reader.
 */
export async function selectDocumentsByCompanyIds(
  client: Client,
  companyIds: string[],
): Promise<DocumentRow[]> {
  if (!Array.isArray(companyIds) || Array.from(companyIds).some(id => typeof id !== "string" || !COMPANY_UUID.test(id))) throw new Error("documents scope invalid");
  return readDocumentPages(client, companyIds);
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

/** PDF replacement must use the exact revision shown to the user. */
export async function replaceDocumentFile(client:Client,id:string,revision:number,patch:DocumentUpdate):Promise<DocumentRow>{
  const {data,error}=await client.from('documents').update(patch).eq('id',id).eq('revision',revision).select().maybeSingle();
  if(error)throw error;
  if(!data)throw new Error('Belge değişmiş veya erişiminiz kaldırılmış. Güncel kaydı yükleyin.');
  return data;
}
