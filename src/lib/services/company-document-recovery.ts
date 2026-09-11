import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

interface Attempt { id: string; companyId: string; tenantId: string; userId: string; storagePath: string }
export type DocumentRecoveryResult = { ok: true; documentId: string } | { ok: false; error: string; reviewRequired: boolean };
// Only explicit PostgreSQL transaction rejections prove the insert did not commit.
// PostgREST cardinality/transport errors and missing responses are not rollback evidence.
const REJECTED_INSERT_CODES = new Set(["23502", "23503", "23505", "23514", "42501", "P0001"]);

export async function recoverCompanyDocumentInsert(
  supabase: SupabaseClient<Database>, attempt: Attempt, code?: string,
): Promise<DocumentRecoveryResult> {
  const review = (): DocumentRecoveryResult => {
    // Correlation only; do not log file contents, auth credentials or raw DB messages.
    console.error("company_document_upload_review", { documentId: attempt.id, companyId: attempt.companyId, storagePath: attempt.storagePath, code: code ?? "unknown" });
    return { ok: false, reviewRequired: true, error: `Yükleme tamamlanamadı veya sonucu doğrulanamadı. Yeniden yüklemeden önce belge listesini ve bu işlemi yöneticinizle kontrol edin. İşlem: ${attempt.id}` };
  };
  try {
    const existing = await supabase.from("documents").select("id,storage_path,company_id,tenant_id,created_by").eq("id", attempt.id).maybeSingle();
    if (existing.error) return review();
    if (existing.data) {
      const row = existing.data;
      return row.storage_path === attempt.storagePath && row.company_id === attempt.companyId && row.tenant_id === attempt.tenantId && row.created_by === attempt.userId
        ? { ok: true, documentId: row.id } : review();
    }
    if (!code || !REJECTED_INSERT_CODES.has(code)) return review();
    // Never remove a file already referenced by a visible document, even if
    // this attempt was rejected. Use caller RLS for reads and Storage removal.
    const references = await supabase.from("documents").select("id").eq("storage_path", attempt.storagePath).limit(1);
    if (references.error || !references.data || references.data.length > 0) return review();
    const removed = await supabase.storage.from("documents").remove([attempt.storagePath]);
    if (removed.error || !removed.data?.some(object => object.name === attempt.storagePath)) return review();
    return { ok: false, reviewRequired: false, error: "Belge kaydedilemedi. Bu denemede yüklenen dosya kaldırıldı; form bilgilerinizi koruduk. Tekrar deneyebilirsiniz." };
  } catch { return review(); }
}
