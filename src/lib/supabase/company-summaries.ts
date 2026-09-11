import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

type Client = SupabaseClient<Database>;
type SummaryRow = { id: string; company_id: string; full_name?: string; is_primary?: boolean; status?: string };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Caller/RLS reads only. UUID batches bound URLs; each batch must reach an empty page. */
async function readSummaryRows(client: Client, table: "contacts" | "contracts", requested: string[]): Promise<SummaryRow[]> {
  if (!Array.isArray(requested) || requested.some(id => typeof id !== "string" || !UUID.test(id))) {
    throw new Error("company summary invalid scope");
  }
  const ids = [...new Set(requested.map(id => id.toLowerCase()))];
  const rows: SummaryRow[] = [], seen = new Set<string>();
  for (let offset = 0; offset < ids.length; offset += 60) {
    const keys = ids.slice(offset, offset + 60), allowed = new Set(keys);
    let cursor: string | null = null;
    for (let page = 0; page <= 200; page++) {
      const base = table === "contacts"
        ? client.from("contacts").select("id, company_id, full_name, is_primary").eq("is_primary", true)
        : client.from("contracts").select("id, company_id, status").eq("status", "aktif");
      let query = base.in("company_id", keys).order("id", { ascending: true }).limit(500);
      if (cursor) query = query.gt("id", cursor);
      const { data, error }: { data: SummaryRow[] | null; error: unknown } = await query;
      if (error) throw new Error("company summary page failed");
      if (!Array.isArray(data)) throw new Error("company summary invalid page");
      if (!data.length) break;
      if (page === 200) throw new Error("company summary scan limit exceeded");
      for (const row of data) {
        if (!row || typeof row.id !== "string" || !UUID.test(row.id) || (cursor !== null && row.id <= cursor) || seen.has(row.id)) {
          throw new Error("company summary did not advance");
        }
        if (!allowed.has(row.company_id)) throw new Error("company summary scope mismatch");
        if (table === "contacts") {
          if (!("is_primary" in row) || row.is_primary !== true || !("full_name" in row) || typeof row.full_name !== "string") {
            throw new Error("company summary invalid contact");
          }
        } else if (!("status" in row) || row.status !== "aktif") {
          throw new Error("company summary invalid contract");
        }
        seen.add(row.id);
        cursor = row.id;
        rows.push(row);
      }
    }
  }
  return rows;
}

export async function selectPrimaryContactNames(client: Client, companyIds: string[]): Promise<Record<string, string>> {
  const rows = await readSummaryRows(client, "contacts", companyIds);
  const names: Record<string, string> = {};
  for (const row of rows) {
    // The DB enforces one primary; never choose an arbitrary name if reads disagree.
    if (row.company_id in names) throw new Error("company summary multiple primary contacts");
    names[row.company_id] = row.full_name!;
  }
  return names;
}

export async function selectActiveContractCounts(client: Client, companyIds: string[]): Promise<Record<string, number>> {
  const rows = await readSummaryRows(client, "contracts", companyIds);
  const counts: Record<string, number> = {};
  for (const row of rows) counts[row.company_id] = (counts[row.company_id] ?? 0) + 1;
  return counts;
}
