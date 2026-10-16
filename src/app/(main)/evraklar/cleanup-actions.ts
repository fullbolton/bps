"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { removeDeletedDocumentFile } from "@/lib/services/company-document-cleanup";

export async function retryDocumentCleanup(tenantId: string, documentId: string): Promise<{ok: boolean; message: string}> {
  try {
    const client = await createServerSupabaseClient();
    // Resolve from the durable job, never from a browser-supplied Storage path.
    const target = await client.rpc("document_cleanup_target_v1", {p_tenant: tenantId, p_document_id: documentId});
    if (target.error || typeof target.data !== "string" || !target.data) {
      return {ok: false, message: "Bu işlem bulunamadı veya yetkiniz değişti. Listeyi yenileyin."};
    }
    // A previous delete may have succeeded while its acknowledgement was lost.
    const ack = await client.rpc("document_ack_cleanup_v1", {p_document_id: documentId});
    if (ack.error) return {ok: false, message: "Dosya durumu doğrulanamadı. Daha sonra tekrar deneyin."};
    if (ack.data === true) return {ok: true, message: "Dosya temizliği tamamlandı."};
    if (ack.data !== false) return {ok: false, message: "Dosya durumu doğrulanamadı. Daha sonra tekrar deneyin."};
    const result = await removeDeletedDocumentFile(client, documentId, target.data);
    return result.confirmed
      ? {ok: true, message: "Dosya temizliği tamamlandı."}
      : {ok: false, message: "Temizlik tamamlanamadı. Dosya başka bir kayıtta kullanılıyor olabilir veya depoya ulaşılamıyor. İşlem listede korunuyor."};
  } catch {
    return {ok: false, message: "İşlemin sonucu doğrulanamadı. Listeyi yenileyip tekrar kontrol edin."};
  }
}
