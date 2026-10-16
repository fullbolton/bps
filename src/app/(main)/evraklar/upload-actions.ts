"use server";

import {createServerSupabaseClient} from "@/lib/supabase/server";
import {cancelPendingDocumentUpload, resumeDocumentUpload} from "@/lib/services/document-upload-recovery";
import {revalidatePath} from "next/cache";

export async function cancelDocumentUpload(tenantId: string, documentId: string) {
  try {
    return await cancelPendingDocumentUpload(await createServerSupabaseClient(12_000), tenantId, documentId);
  } catch {
    return {ok: false, message: "İptal doğrulanamadı. Listeyi yenileyerek kontrol edin."};
  }
}

export async function recoverDocumentUpload(tenantId: string, documentId: string) {
  try {
    const result = await resumeDocumentUpload(await createServerSupabaseClient(12_000), tenantId, documentId);
    if (result.ok) revalidatePath("/evraklar");
    return result;
  } catch {
    return {ok: false, message: "Sonuç doğrulanamadı. Listeyi yenileyerek kontrol edin."};
  }
}
