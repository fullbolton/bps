"use server";

/**
 * BPS Company Detail — Server Actions
 *
 * Server-side entry points reached from the firma detail surface. Every
 * action runs in server context: the Supabase client is always built via
 * `createServerSupabaseClient()` (anon key + cookie session) — there is
 * NO service_role usage anywhere in this file — and authorization comes
 * from the same DB source RLS uses (`current_user_role()`), with
 * `current_user_active_tenant()` resolving the tenant where needed.
 *
 *   1. `uploadCompanyDocumentAction(formData)` — upload a PDF for a firma.
 *      Client allow-list `{file, name, category, contract_id?,
 *      validity_date?}`; server sets tenant_id / company_id / created_by
 *      / uploaded_by / storage_path. Verifies contract↔company binding
 *      before upload. Storage first → DB row second; a DB failure after
 *      a successful upload returns a clear orphan-warning error (orphan
 *      cleanup is out of scope).
 *
 *   2. `getCompanyDocumentDownloadUrlAction(documentId)` — short-lived
 *      (60s) signed URL for an existing document. RLS-bounded lookup; no
 *      public URL, `storage_path` never exposed.
 *
 *   3. `deleteCompanyDocumentAction(documentId)` — hard delete a document
 *      (yonetici-only). DB-first delete + RETURNING guard, then storage
 *      remove of the actually-deleted row's path.
 *
 *   4. `deleteContactAction(contactId)` — hard delete a contact
 *      (yonetici-only; app guard narrower than the partner-capable
 *      contacts DELETE RLS). DB-first delete + RETURNING guard, no storage.
 *
 *   5. `passivateCompanyAction(companyId)` — set company status='pasif'
 *      and NOTHING else (yonetici-only). The update payload is the literal
 *      `{ status: "pasif" }`; the only client input is companyId (WHERE).
 *      See that action's own header for the field-discipline rationale.
 *
 * Guards shared by the mutating actions: yonetici-only role check, and a
 * RETURNING/returned-row guard so a zero-row outcome is an idempotent
 * no-op rather than a misleading success. RLS is the final boundary in
 * every case.
 *
 * Not in scope: reactivate, company delete, bulk operations, storage
 * backfill/cleanup, DB migration or policy change.
 */

import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { EvrakDurumu } from "@/types/ui";
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

// 30-day soft window — matches `getApproachingLevel("approaching")`
// semantics elsewhere in the codebase.
const APPROACHING_WINDOW_DAYS = 30;

export type UploadResult =
  | { ok: true; documentId: string }
  | { ok: false; error: string };

export type DownloadResult =
  | { ok: true; url: string }
  | { ok: false; error: string };

export type DeleteResult =
  | { ok: true; warning?: string }
  | { ok: false; error: string };

export type ContactDeleteResult =
  | { ok: true; deletedName?: string }
  | { ok: false; error: string };

export type PassivateResult =
  | { ok: true; name?: string }
  | { ok: false; error: string };

function deriveStatus(validityDate: string | null): EvrakDurumu {
  // A file is being attached, so the row will not be `eksik`. The
  // expiry buckets only matter when validity_date is set; missing dates
  // fall through to "tam" — file present, no expiry tracked yet.
  if (!validityDate) return "tam";

  const expiry = new Date(`${validityDate.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(expiry.getTime())) return "tam";

  const now = new Date();
  const today = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const diffDays = Math.floor(
    (expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
  );
  if (diffDays < 0) return "suresi_doldu";
  if (diffDays <= APPROACHING_WINDOW_DAYS) return "suresi_yaklsiyor";
  return "tam";
}

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

  // 5. Contract↔company binding check. If a contract_id is supplied,
  //    verify it actually belongs to this company — never trust the
  //    client-submitted relationship. Done BEFORE the storage upload so
  //    a mismatched payload cannot orphan an object. RLS also scopes
  //    this read, so an out-of-scope contract returns no row.
  if (contractId) {
    const { data: contractRow, error: contractError } = await supabase
      .from("contracts")
      .select("id")
      .eq("id", contractId)
      .eq("company_id", companyId)
      .maybeSingle();
    if (contractError) {
      return { ok: false, error: "Sözleşme doğrulanamadı." };
    }
    if (!contractRow) {
      return {
        ok: false,
        error: "Seçilen sözleşme bu firmaya ait değil.",
      };
    }
  }

  // 6. Build storage path. The storage RLS policy parses the company
  //    UUID from the first path segment, so this format is required.
  const storagePath = `${companyId}/${crypto.randomUUID()}.pdf`;

  // 7. Storage upload. If this fails, no DB row is created.
  const upload = await supabase.storage
    .from("documents")
    .upload(storagePath, fileEntry, {
      contentType: PDF_MIME,
      upsert: false,
    });
  if (upload.error) {
    return {
      ok: false,
      error: `Yükleme başarısız: ${upload.error.message}`,
    };
  }

  // 8. DB row insert. tenant_id, company_id, contract_id,
  //    storage_path are server-controlled; created_by / uploaded_by
  //    derive from auth. If this fails, the storage object is orphaned
  //    and we surface that explicitly (no silent failure).
  const uploadedBy =
    (user.user_metadata?.display_name as string | undefined) ??
    user.email ??
    null;

  const insert = await supabase
    .from("documents")
    .insert({
      tenant_id: tenantId,
      company_id: companyId,
      contract_id: contractId,
      name,
      category,
      status: deriveStatus(validityDate),
      validity_date: validityDate,
      storage_path: storagePath,
      uploaded_by: uploadedBy,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (insert.error || !insert.data) {
    return {
      ok: false,
      error: `Belge kaydı oluşturulamadı: ${insert.error?.message ?? "bilinmeyen"}. (Storage'da ${storagePath} yolu orphan olabilir — orphan temizliği bu işlem kapsamında değil.)`,
    };
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
      error: `İndirme bağlantısı oluşturulamadı: ${signed.error?.message ?? "bilinmeyen"}.`,
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
    return { ok: true };
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
      error: `Belge silinemedi: ${del.error.message}`,
    };
  }

  const deletedRows = del.data ?? [];
  if (deletedRows.length === 0) {
    // Nothing was actually deleted (already gone / concurrent delete /
    // RLS-filtered). Idempotent no-op — storage is NOT touched.
    return { ok: true };
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
        warning: `DB kaydı silindi, storage dosyası silinemedi (orphan): ${deletedPath}`,
      };
    }
  }

  return { ok: true };
}

/**
 * Hard-delete a single contact (Faz 1 — no trash, no soft-delete).
 * contacts has no soft-state column, so hard delete is the only path.
 *
 * yonetici-only at the app layer (rpc current_user_role). The contacts
 * DELETE RLS also permits partner company-scope, but this action is
 * deliberately narrower — only yonetici. service_role is never used.
 *
 * DB-first delete with RETURNING so we confirm a row was actually
 * removed (returned-row guard). Zero rows (already gone / RLS-hidden /
 * concurrent delete) is an idempotent no-op success — no misleading
 * "deleted" feedback for a row that wasn't there. No storage involved.
 */
export async function deleteContactAction(
  contactId: string,
): Promise<ContactDeleteResult> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "Oturum geçersiz: lütfen tekrar giriş yapın." };
  }

  if (!contactId || typeof contactId !== "string") {
    return { ok: false, error: "Yetkili kimliği geçersiz." };
  }

  const { data: roleData, error: roleError } = await supabase.rpc(
    "current_user_role",
  );
  if (roleError || roleData !== "yonetici") {
    return {
      ok: false,
      error: "Yetkisiz: yetkili kişi silme yalnızca yöneticiye açıktır.",
    };
  }

  const del = await supabase
    .from("contacts")
    .delete()
    .eq("id", contactId)
    .select("id, full_name");
  if (del.error) {
    return { ok: false, error: `Yetkili silinemedi: ${del.error.message}` };
  }

  const deletedRows = del.data ?? [];
  if (deletedRows.length === 0) {
    // Already gone / not visible — idempotent no-op success.
    return { ok: true };
  }

  return { ok: true, deletedName: deletedRows[0].full_name };
}

/**
 * Passivate a single company — set status='pasif' and NOTHING else.
 *
 * The companies_update_yonetici RLS policy lets a yonetici update ANY
 * company column. The policy is NOT a column allow-list. The field
 * discipline that makes this action a "passivate-only" capability lives
 * ENTIRELY HERE: the update payload is the literal `{ status: "pasif" }`
 * and the only client input is `companyId`, used solely in the WHERE.
 *
 * The payload NEVER contains name / risk / sector / city / tenant_id /
 * id / created_by / legacy_mock_id / created_at / updated_at or any
 * other field. No FormData, no client-provided company fields beyond
 * the id. The single effect is: target company's status becomes 'pasif'.
 *
 * Guards:
 *   - yonetici-only via current_user_role() (RLS also enforces yonetici).
 *   - active tenant via current_user_active_tenant(), used as an extra
 *     `.eq("tenant_id", …)` WHERE so the update can only touch a row in
 *     the caller's tenant (RLS enforces the same).
 *   - DB-first .update(...).select() with a returned-row guard; zero
 *     rows (wrong tenant / absent / RLS-filtered) is an idempotent
 *     no-op success.
 *
 * Not in scope: no reactivate, no hard delete, no other status value.
 * service_role is never used.
 */
export async function passivateCompanyAction(
  companyId: string,
): Promise<PassivateResult> {
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

  const { data: roleData, error: roleError } = await supabase.rpc(
    "current_user_role",
  );
  if (roleError || roleData !== "yonetici") {
    return {
      ok: false,
      error: "Yetkisiz: firma pasife alma yalnızca yöneticiye açıktır.",
    };
  }

  const { data: tenantId, error: tenantError } = await supabase.rpc(
    "current_user_active_tenant",
  );
  if (tenantError || typeof tenantId !== "string" || tenantId.length === 0) {
    return { ok: false, error: "Aktif kiracı çözümlenemedi." };
  }

  // FIELD DISCIPLINE — payload is EXACTLY { status: "pasif" }. Do not
  // add any other key to this object.
  const upd = await supabase
    .from("companies")
    .update({ status: "pasif" })
    .eq("id", companyId)
    .eq("tenant_id", tenantId)
    .select("id, name, status");
  if (upd.error) {
    return { ok: false, error: `Firma pasife alınamadı: ${upd.error.message}` };
  }

  const rows = upd.data ?? [];
  if (rows.length === 0) {
    // No row matched id+tenant (absent / wrong tenant / RLS-filtered).
    // Idempotent no-op — nothing was changed.
    return { ok: true };
  }

  return { ok: true, name: rows[0].name };
}
