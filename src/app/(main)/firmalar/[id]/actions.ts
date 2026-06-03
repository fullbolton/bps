"use server";

/**
 * BPS Company Detail — Documents Server Actions
 *
 * Two server-side entry points for the firma evrak lifecycle:
 *
 *   1. `uploadCompanyDocumentAction(formData)`
 *      Authenticated user uploads a PDF for a given firma. The action
 *      runs in server context, so:
 *        - Identity comes from the cookie session, not from the client.
 *        - Role guard reads `current_user_role()` (same source as RLS).
 *        - `tenant_id` is resolved server-side via
 *          `current_user_active_tenant()` — same source as RLS.
 *        - `company_id` is taken from the action payload (the page knows
 *          which firma the user is on); RLS still enforces the user can
 *          insert under that company per the documents INSERT policy.
 *        - `created_by` / `uploaded_by` are stamped from auth, never
 *          read from client payload.
 *        - `storage_path` is built server-side as `{company_id}/{uuid}.pdf`
 *          and only set after the storage upload succeeds.
 *        - The client payload allow-list is strictly
 *          `{file, name, category, contract_id?, validity_date?}`.
 *
 *      Order: storage upload first → DB row second. If the DB insert
 *      fails after storage upload succeeded, the storage object is
 *      orphaned. We return a clear error rather than silently hiding
 *      this — orphan cleanup is explicitly out of this task's scope.
 *
 *   2. `getCompanyDocumentDownloadUrlAction(documentId)`
 *      Returns a short-lived signed URL (60s) for an existing document
 *      row. The query runs through RLS, so an unauthorized user (or a
 *      partner outside scope) gets `null` back from the lookup and the
 *      action surfaces a clean "not found / no access" error. No public
 *      URL is ever generated; `storage_path` is never exposed.
 *
 * No service_role usage anywhere in this file. The Supabase client is
 * always built via `createServerSupabaseClient()` (anon key + cookie
 * session); RLS is fully enforced.
 *
 * Scope discipline (implementation pass):
 *   - Upload + download lifecycle only.
 *   - No update / no replace / no hard delete.
 *   - No bulk upload.
 *   - No backfill or orphan cleanup.
 *   - No DB migration / policy change.
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

  // 5. Build storage path. The storage RLS policy parses the company
  //    UUID from the first path segment, so this format is required.
  const storagePath = `${companyId}/${crypto.randomUUID()}.pdf`;

  // 6. Storage upload — first. If this fails, no DB row is created.
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

  // 7. DB row insert — second. tenant_id, company_id, contract_id,
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
