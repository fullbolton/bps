import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

/** Call only after DELETE RETURNING confirmed the metadata deletion.
 * Storage is a separate transaction: its failure must not imply the document
 * row still exists. No automatic retry, and no claim that an empty reply proves
 * removal. The DELETE trigger persists a cleanup job before this call starts.
 */
export async function removeDeletedDocumentFile(
  client: SupabaseClient<Database>, documentId: string, storagePath: string,
): Promise<{ confirmed: true } | { confirmed: false; warning: string }> {
  try {
    const result = await client.storage.from("documents").remove([storagePath]);
    if (!result.error && result.data?.some(object => object.name === storagePath)) {
      const receipt = await client.rpc("document_ack_cleanup_v1", { p_document_id: documentId });
      if (!receipt.error && receipt.data === true) return { confirmed: true };
    }
  } catch {
    // Network errors can happen after Storage committed. Do not retry blindly.
  }
  console.error("company_document_cleanup_review", { documentId, storagePath });
  return {
    confirmed: false,
    warning: `Belge listeden kaldırıldı. Dosyanın depodan silindiği doğrulanamadı; yöneticinizin kontrol etmesi gerekiyor. İşlem: ${documentId}`,
  };
}
