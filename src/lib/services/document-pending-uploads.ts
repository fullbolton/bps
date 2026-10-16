import type {SupabaseClient} from "@supabase/supabase-js";
import type {Database} from "@/types/database.types";

export type PendingDocumentUpload = Database["public"]["Functions"]["document_pending_uploads_v1"]["Returns"][number];
export async function listPendingDocumentUploads(client: SupabaseClient<Database>, tenantId: string, offset: number) {
  if (!Number.isSafeInteger(offset) || offset < 0 || offset > 10000000 || offset % 50 !== 0) throw Error("UPLOAD_LIST_OFFSET");
  const result = await client.rpc("document_pending_uploads_v1", {p_tenant: tenantId, p_offset: offset});
  if (result.error || !Array.isArray(result.data) || result.data.length > 51) throw Error("UPLOAD_LIST_RESPONSE");
  const seen = new Set<string>();
  for (const row of result.data) {
    if (!row || typeof row.document_id !== "string" || !row.document_id || seen.has(row.document_id)
      || row.tenant_id !== tenantId || typeof row.document_name !== "string" || !row.document_name.trim()
      || (row.company_name !== null && typeof row.company_name !== "string")
      || typeof row.created_at !== "string" || !Number.isFinite(Date.parse(row.created_at))
      || typeof row.can_resume !== "boolean" || typeof row.file_present !== "boolean") throw Error("UPLOAD_LIST_RESPONSE");
    seen.add(row.document_id);
  }
  return {rows: result.data.slice(0,50), hasMore: result.data.length === 51};
}
