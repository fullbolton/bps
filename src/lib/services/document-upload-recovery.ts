import type {SupabaseClient} from "@supabase/supabase-js";
import type {Database} from "@/types/database.types";

export async function cancelPendingDocumentUpload(client: SupabaseClient<Database>, tenantId: string, documentId: string) {
  try {
    const result = await client.rpc("document_cancel_upload_v1", {p_tenant: tenantId, p_id: documentId});
    if (!result.error && result.data === true) return {ok: true, message: "Yükleme iptal edildi. Dosya temizliği yöneticinin temizlik listesine alındı."};
  } catch { /* A missing receipt is not confirmation of cancellation. */ }
  return {ok: false, message: "İptal doğrulanamadı. İşlem tamamlanmış veya yetkiniz değişmiş olabilir. Listeyi yenileyin."};
}

/** No new upload or deletion: verify the original reserved object, then finalize once. */
export async function resumeDocumentUpload(client: SupabaseClient<Database>, tenantId: string, documentId: string) {
  const uncertain = {ok: false, message: "Yükleme tamamlandığı doğrulanamadı. Listeyi yenileyip tekrar kontrol edin; dosyayı yeniden yüklemeyin."};
  try {
    const target = await client.rpc("document_upload_recovery_target_v1", {p_tenant: tenantId, p_id: documentId});
    const data = target.data;
    if (target.error || !data || typeof data !== "object" || Array.isArray(data)
      || data.document_id !== documentId || typeof data.storage_path !== "string"
      || !data.storage_path.endsWith(`/${documentId}.pdf`)
      || typeof data.file_size !== "number" || !Number.isSafeInteger(data.file_size)
      || data.file_size < 5 || data.file_size > 10 * 1024 * 1024) {
      return {ok: false, message: "Bu yükleme bulunamadı veya tamamlama yetkiniz yok. Yalnız kendi yüklemenizi tamamlayabilirsiniz."};
    }
    const file = await client.storage.from("documents").download(data.storage_path);
    if (file.error || !file.data) return {ok: false, message: "Dosya okunamadı. Yükleme sürüyor olabilir; daha sonra tekrar kontrol edin."};
    if (file.data.size !== data.file_size || await file.data.slice(0, 5).text() !== "%PDF-") {
      return {ok: false, message: "Dosya, yükleme bilgileriyle eşleşmiyor veya PDF olarak tanınamadı. Belge kaydı oluşturulmadı."};
    }
    // Storage UPDATE/DELETE fences protect reserved objects. The RPC rechecks
    // tenant, current permissions, owner, MIME and size under database locks.
    const receipt = await client.rpc("document_finalize_upload_v1", {p_tenant: tenantId, p_id: documentId});
    if (receipt.error || receipt.data !== documentId) return uncertain;
    return {ok: true, message: "Yükleme tamamlandı. Belge evrak listesine eklendi."};
  } catch {return uncertain;}
}
