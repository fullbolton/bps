"use server";

import { setCompanyStatus } from "@/lib/supabase/company-commands";
import { documentStatusForFile, isDocumentValidityDate } from "@/lib/document-validity";
import { recoverCompanyDocumentInsert } from "@/lib/services/company-document-recovery";

/** Company detail actions use the authenticated cookie client; no service role.
 * Company status changes use the scoped company command and reject missing targets.
 * Contact and note writes use database commands. Document/storage paths retain
 * their existing controls and remain a separate module cutover.
 */

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { assertCompanyIsActiveForNewOperation } from "@/lib/services/companies";
import { createContact, removeContact } from "@/lib/services/contacts";
import type { ContactCreateInput } from "@/lib/services/contacts";
import { createNote } from "@/lib/services/notes";
import type { NoteCreateInput } from "@/lib/services/notes";
import type { DocumentCategory } from "@/lib/document-categories";

// PDF only, 10 MB cap (matches existing UploadDocumentModal limit).
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const PDF_MIME = "application/pdf";

// Server-side allow-list for the documents.category column. Mirrors
// the DB CHECK constraint values.
const ALLOWED_CATEGORIES: ReadonlySet<DocumentCategory> = new Set<DocumentCategory>([
  "cerceve_sozlesme",
  "ek_protokol",
  "yetki_belgesi",
  "operasyon_evraki",
  "teklif_dosyasi",
  "ziyaret_tutanagi",
  "diger",
]);

// Role guard: mirrors the existing Evraklar / Company Detail upload
// boundary (yonetici, partner-scope, operasyon, ik). Partner scope is
// enforced at the DB layer by the documents INSERT policy.
const UPLOAD_ROLES: ReadonlySet<string> = new Set([
  "yonetici",
  "partner",
  "operasyon",
  "ik",
]);

export type UploadResult =
  | { ok: true; documentId: string }
  | { ok: false; error: string; reviewRequired?: boolean };

export type DownloadResult =
  | { ok: true; url: string }
  | { ok: false; error: string };

export type DeleteResult =
  | { ok: true; deleted: boolean; warning?: string }
  | { ok: false; error: string };

export type ContactDeleteResult =
  | { ok: true; deletedName?: string }
  | { ok: false; error: string };

export type PassivateResult =
  | { ok: true; name?: string }
  | { ok: false; error: string };

function readString(formData: FormData, key: string): string {
  const v = formData.get(key);
  return typeof v === "string" ? v.trim() : "";
}

function readOptionalString(formData: FormData, key: string): string | null {
  const v = readString(formData, key);
  return v.length > 0 ? v : null;
}

export async function uploadCompanyDocumentAction(
  formData: FormData,
): Promise<UploadResult> {
  // 1. Authenticated server context.
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "Oturum geçersiz: lütfen tekrar giriş yapın." };
  }

  // 2. Role guard via DB truth (matches RLS).
  const { data: roleData, error: roleError } = await supabase.rpc(
    "current_user_role",
  );
  if (roleError || typeof roleData !== "string" || !UPLOAD_ROLES.has(roleData)) {
    return {
      ok: false,
      error: "Yetkisiz: bu işlem için yetkiniz yok.",
    };
  }

  // 3. Active tenant resolution. Single source — RPC. Fail closed.
  const { data: tenantId, error: tenantError } = await supabase.rpc(
    "current_user_active_tenant",
  );
  if (
    tenantError ||
    typeof tenantId !== "string" ||
    tenantId.length === 0
  ) {
    return {
      ok: false,
      error: "Aktif kiracı çözümlenemedi.",
    };
  }

  // 4. Allow-list inputs.
  const companyId = readString(formData, "company_id");
  const name = readString(formData, "name");
  const categoryRaw = readString(formData, "category");
  const contractId = readOptionalString(formData, "contract_id");
  const validityDate = readOptionalString(formData, "validity_date");
  const fileEntry = formData.get("file");

  if (!companyId) {
    return { ok: false, error: "Firma kimliği eksik." };
  }
  if (!name) {
    return { ok: false, error: "Belge adı zorunlu." };
  }
  const category = categoryRaw as DocumentCategory;
  if (!ALLOWED_CATEGORIES.has(category)) {
    return { ok: false, error: "Geçersiz kategori." };
  }
  if (!(fileEntry instanceof File)) {
    return { ok: false, error: "Dosya alınamadı." };
  }
  if (fileEntry.size === 0) {
    return { ok: false, error: "Boş dosya yüklenemez." };
  }
  if (fileEntry.type !== PDF_MIME) {
    return { ok: false, error: "Sadece PDF dosyası yüklenebilir." };
  }
  if (fileEntry.size > MAX_FILE_BYTES) {
    return { ok: false, error: "Dosya 10 MB'dan büyük olamaz." };
  }

  // Client-declared MIME is caller-controlled; verify the "%PDF-" magic
  // bytes so arbitrary content cannot be stored (and later served) as a
  // compliance document.
  const head = new Uint8Array(await fileEntry.slice(0, 5).arrayBuffer());
  const isPdfMagic =
    head.length === 5 &&
    head[0] === 0x25 && // %
    head[1] === 0x50 && // P
    head[2] === 0x44 && // D
    head[3] === 0x46 && // F
    head[4] === 0x2d; // -
  if (!isPdfMagic) {
    return { ok: false, error: "Sadece PDF dosyası yüklenebilir." };
  }

  // A supplied validity_date must be a real ISO (YYYY-MM-DD) date. The
  // raw string is written into a date column at step 9 — a malformed
  // value would pass every guard, upload the file at step 8, then fail
  // the insert and orphan the storage object on every retry.
  if (validityDate && !isDocumentValidityDate(validityDate)) {
    return { ok: false, error: "Geçerlilik tarihi biçimi geçersiz (YYYY-AA-GG bekleniyor)." };
  }

  // 5. Contract PDFs use the versioned/reserved upload workflow on the
  // contract page. This legacy company action creates unlinked documents only;
  // reject before Storage rather than orphaning a file on schema/RLS failure.
  if (contractId) {
    return { ok: false, error: "Sözleşmeye bağlı belgeleri sözleşme sayfasındaki Dosyalar bölümünden yükleyin." };
  }

  // 6. Passive-company guard. A pasif firma cannot receive new
  //    documents. Done BEFORE the storage upload so a rejected attempt
  //    creates neither a storage object nor a DB row. Tenant-scoped and
  //    fail-closed (absent row → error).
  const activeCheck = await assertCompanyIsActiveForNewOperation(
    supabase,
    companyId,
    tenantId,
  );
  if (!activeCheck.ok) {
    return activeCheck;
  }

  // 7. Build storage path. The storage RLS policy parses the company
  //    UUID from the first path segment, so this format is required.
  const documentId = crypto.randomUUID();
  const storagePath = `${companyId}/${documentId}.pdf`;

  // 8. Storage upload. If this fails, no DB row is created.
  const upload = await supabase.storage
    .from("documents")
    .upload(storagePath, fileEntry, {
      contentType: PDF_MIME,
      upsert: false,
    });
  if (upload.error) {
    console.error("company_document_storage_review", { documentId, companyId, storagePath, code: upload.error.name });
    return {
      ok: false,
      error: `Dosya yükleme sonucu doğrulanamadı. Yeniden yüklemeden önce belge listesini ve işlemi yöneticinizle kontrol edin. İşlem: ${documentId}`,
      reviewRequired: true,
    };
  }

  // 9. DB row insert. tenant_id, company_id, contract_id,
  //    storage_path are server-controlled; created_by / uploaded_by
  //    derive from auth. Reconcile a failed response by the generated ID;
  //    only definite SQL rejection permits caller-authorized cleanup.
  // Display provenance from DB truth (profiles.display_name), not
  // user_metadata — any user can rewrite their own metadata via
  // auth.updateUser(), so the uploader label was spoofable. created_by
  // (user.id) remains the authoritative provenance either way.
  const { data: profileRow } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .maybeSingle();
  const uploadedBy = profileRow?.display_name ?? user.email ?? null;

  const insert = await supabase
    .from("documents")
    .insert({
      id: documentId,
      tenant_id: tenantId,
      company_id: companyId,
      contract_id: contractId,
      name,
      category,
      status: documentStatusForFile(validityDate),
      validity_date: validityDate,
      storage_path: storagePath,
      uploaded_by: uploadedBy,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (insert.error || !insert.data) {
    return recoverCompanyDocumentInsert(supabase, {
      id: documentId, companyId, tenantId, userId: user.id, storagePath,
    }, insert.error?.code);
  }

  return { ok: true, documentId: insert.data.id };
}

export async function getCompanyDocumentDownloadUrlAction(
  documentId: string,
): Promise<DownloadResult> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "Oturum geçersiz: lütfen tekrar giriş yapın." };
  }

  if (!documentId || typeof documentId !== "string") {
    return { ok: false, error: "Belge kimliği geçersiz." };
  }

  // RLS-bounded read. If the user lacks SELECT on this row (wrong
  // tenant, partner-out-of-scope, muhasebe/goruntuleyici), the lookup
  // returns null and we fail closed with a generic message — no
  // storage_path leakage.
  const { data: doc, error: fetchError } = await supabase
    .from("documents")
    .select("storage_path")
    .eq("id", documentId)
    .maybeSingle();

  if (fetchError) {
    return {
      ok: false,
      error: "Belge bilgisi alınamadı.",
    };
  }
  if (!doc) {
    return { ok: false, error: "Belge bulunamadı veya erişim yok." };
  }
  if (!doc.storage_path) {
    return { ok: false, error: "Bu belge için dosya yok." };
  }

  const signed = await supabase.storage
    .from("documents")
    .createSignedUrl(doc.storage_path, 60);
  if (signed.error || !signed.data?.signedUrl) {
    return {
      ok: false,
      error: "İndirme bağlantısı oluşturulamadı. Tekrar deneyin.",
    };
  }

  return { ok: true, url: signed.data.signedUrl };
}

/**
 * Hard-delete a single document (Faz 1 — no trash, no soft-delete).
 *
 * yonetici-only at three layers: the app role guard below, the
 * documents DELETE RLS policy, and the storage.objects DELETE policy
 * (both yonetici-only). service_role is never used.
 *
 * Order: DB row first → storage object second.
 *   - If the DB delete fails (RLS reject / error), storage is left
 *     untouched and the action fails. This avoids deleting the file
 *     while the row still points at it.
 *   - If the DB delete succeeds but the storage remove fails, the row
 *     is already gone; we return ok:true with an explicit `warning`
 *     naming the orphaned object path. No silent hiding.
 *
 * Idempotency: if the row does not exist (already deleted / never
 * existed / RLS-hidden), the action returns ok:true as a no-op —
 * re-clicking delete on a stale UI row does not surface an error.
 */
export async function deleteCompanyDocumentAction(
  documentId: string,
): Promise<DeleteResult> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "Oturum geçersiz: lütfen tekrar giriş yapın." };
  }

  if (!documentId || typeof documentId !== "string") {
    return { ok: false, error: "Belge kimliği geçersiz." };
  }

  // Role guard via DB truth. Delete is yonetici-only (mirrors the
  // documents + storage.objects DELETE RLS policies).
  const { data: roleData, error: roleError } = await supabase.rpc(
    "current_user_role",
  );
  if (roleError || roleData !== "yonetici") {
    return { ok: false, error: "Yetkisiz: belge silme yalnızca yöneticiye açıktır." };
  }

  // Read the row first to obtain storage_path. RLS-bounded: a hidden
  // row returns null → treat as idempotent no-op success.
  const { data: doc, error: fetchError } = await supabase
    .from("documents")
    .select("storage_path")
    .eq("id", documentId)
    .maybeSingle();
  if (fetchError) {
    return { ok: false, error: "Belge bilgisi alınamadı." };
  }
  if (!doc) {
    // Already gone or not visible — idempotent success.
    return { ok: true, deleted: false };
  }

  // DB-first delete with RETURNING. RLS enforces yonetici. `.select()`
  // returns the rows actually deleted, so we can confirm a row was
  // removed before touching storage — guards against a concurrent
  // delete or RLS-filtered zero-row outcome between the read above and
  // this delete. If it errors, do NOT touch storage.
  const del = await supabase
    .from("documents")
    .delete()
    .eq("id", documentId)
    .select("storage_path");
  if (del.error) {
    return {
      ok: false,
      error: del.error.message.includes('contract_document_versions_document_id_fkey')
        ? 'Sürüm geçmişi bulunan sözleşme PDF’i silinemez. Yeni sürüm yükleyerek geçmişi koruyun.'
        : `Belge silinemedi: ${del.error.message}`,
    };
  }

  const deletedRows = del.data ?? [];
  if (deletedRows.length === 0) {
    // Nothing was actually deleted (already gone / concurrent delete /
    // RLS-filtered). Idempotent no-op — storage is NOT touched.
    return { ok: true, deleted: false };
  }

  // Storage remove — second. Use the path from the row that was
  // actually deleted (not the earlier read), in case the row's path
  // changed concurrently. DB row is confirmed gone at this point.
  const deletedPath = deletedRows[0].storage_path;
  if (deletedPath) {
    const remove = await supabase.storage
      .from("documents")
      .remove([deletedPath]);
    if (remove.error) {
      return {
        ok: true,
        deleted: true,
        warning: `DB kaydı silindi, storage dosyası silinemedi (orphan): ${deletedPath}`,
      };
    }
  }

  return { ok: true, deleted: true };
}

/** Manager-only deletion; database checks the expected company and rejects missing rows. */
export async function deleteContactAction(companyId: string, contactId: string): Promise<ContactDeleteResult> {
  try {
    const supabase = await createServerSupabaseClient();
    const row = await removeContact(supabase, companyId, contactId);
    return {ok: true, deletedName: row.full_name};
  } catch (error) {
    return {ok: false, error: error instanceof Error ? error.message : "Yetkili silinemedi. Listeyi yenileyin."};
  }
}

/** Both actions use the same scoped database command; status is the only writable field. */
export async function passivateCompanyAction(companyId: string): Promise<PassivateResult> {
  return changeCompanyStatus(companyId, "pasif");
}

export async function reactivateCompanyAction(companyId: string): Promise<PassivateResult> {
  return changeCompanyStatus(companyId, "aktif");
}

async function changeCompanyStatus(companyId: string, status: "aktif" | "pasif"): Promise<PassivateResult> {
  const supabase = await createServerSupabaseClient();
  const identity = await supabase.auth.getUser();
  if (identity.error || !identity.data.user) return {ok:false,error:"Oturum geçersiz: lütfen tekrar giriş yapın."};
  const tenant = await supabase.rpc("current_user_verified_tenant");
  if (tenant.error || typeof tenant.data !== "string") return {ok:false,error:"Çalışma alanı doğrulanamadı."};
  try {
    const company = await setCompanyStatus(supabase,companyId,tenant.data,identity.data.user.id,status);
    return {ok:true,name:company.name};
  } catch (error) {
    return {ok:false,error:error instanceof Error ? error.message : "Firma durumu değiştirilemedi."};
  }
}

export type ContactCreateResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Create a contact for a company via a server action (Patch 2 — Option
 * 2a). Replaces the previous browser-context `createContact` call path,
 * which ran RLS-only and — because the contacts INSERT RLS is status-
 * blind — allowed new contacts on a pasif company. This action adds the
 * server-side passive-company guard the browser path could not.
 *
 * Order: cookie auth → current_user_role() guard (yonetici-only) →
 * current_user_active_tenant() → passive-company guard (fail-closed on
 * pasif) → delegate to the existing `createContact` service with the
 * SERVER client. The service preserves the max-5 / phone-or-email /
 * single-primary validation and resolves companyId (UUID) via
 * requireCompanyByLegacyMockId. RLS stays the final boundary.
 *
 * Contact create is currently yonetici-only by app-level product
 * decision; partner role boundary is pending follow-up.
 *
 * Edit/delete contact paths are unchanged — this is the create path only.
 * service_role is never used.
 */
export async function createContactAction(
  companyId: string,
  input: ContactCreateInput,
): Promise<ContactCreateResult> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "Oturum geçersiz: lütfen tekrar giriş yapın." };
  }

  if (!companyId || typeof companyId !== "string") {
    return { ok: false, error: "Firma kimliği geçersiz." };
  }

  // yonetici-only (app-level product decision; partner is HOLD / pending
  // follow-up — see ROLE_MATRIX refresh, not edited in this patch).
  const { data: roleData, error: roleError } = await supabase.rpc(
    "current_user_role",
  );
  if (roleError || roleData !== "yonetici") {
    return {
      ok: false,
      error: "Yetkisiz: yetkili kişi ekleme yetkiniz yok.",
    };
  }

  const { data: tenantId, error: tenantError } = await supabase.rpc(
    "current_user_active_tenant",
  );
  if (tenantError || typeof tenantId !== "string" || tenantId.length === 0) {
    return { ok: false, error: "Aktif kiracı çözümlenemedi." };
  }

  // Passive-company guard — BEFORE any insert.
  const activeCheck = await assertCompanyIsActiveForNewOperation(
    supabase,
    companyId,
    tenantId,
  );
  if (!activeCheck.ok) {
    return activeCheck;
  }

  // Delegate to the existing service (server client). Preserves
  // max-5 / phone-or-email / single-primary validation.
  try {
    await createContact(supabase, companyId, input);
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Yetkili kişi eklenemedi.",
    };
  }
}

export type NoteCreateResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Create a note via a server action.
 *
 * Reason this exists: `notes.tenant_id` is NOT NULL with no DEFAULT and the
 * notes policies scope on it, but the previous browser-context `createNote`
 * call had no way to obtain a tenant — the value must come from
 * `current_user_active_tenant()`, which is server-resolved and must never be
 * read from a client payload. So the call moves here, exactly as the
 * görev / randevu / talep creates did.
 *
 * NO app-level role guard, on purpose: note creation is open to more roles
 * than contact creation (ROLE_MATRIX §4, "Not ekleme / kendi notunu
 * düzenleme"), and RLS is already the authority. Adding one here would
 * narrow behaviour beyond this fix.
 *
 * NO passive-company guard either: the 9370032 guard line covers randevu /
 * görev / talep, and notes were deliberately outside it. This action changes
 * where the tenant comes from, nothing else.
 *
 * Update and delete note paths are unchanged — create only. service_role is
 * never used.
 */
export async function createNoteAction(
  companyId: string,
  input: NoteCreateInput,
): Promise<NoteCreateResult> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "Oturum geçersiz: lütfen tekrar giriş yapın." };
  }

  if (!companyId || typeof companyId !== "string") {
    return { ok: false, error: "Firma kimliği geçersiz." };
  }

  const { data: tenantId, error: tenantError } = await supabase.rpc(
    "current_user_verified_tenant",
  );
  if (tenantError || typeof tenantId !== "string" || tenantId.length === 0) {
    return { ok: false, error: "Aktif kiracı çözümlenemedi." };
  }

  try {
    await createNote(supabase, companyId, input, { tenantId });
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Not eklenemedi.",
    };
  }
}
