/**
 * BPS service layer — documents (Phase 4A "Evraklar" slice).
 *
 *     UI Component (Evraklar list, Firma Detay tab, Firma Detay Genel Bakis)
 *         |
 *     src/lib/services/documents.ts          <- THIS FILE -- business logic
 *         |
 *     src/lib/supabase/documents.ts          <- raw CRUD only
 *         |
 *     Supabase Postgres + RLS
 *
 * Invariants enforced here (mirrored by DB constraints / RLS):
 *   - Authorization = role capability + assigned scope
 *       -> every mutation that targets a specific firma re-verifies scope
 *         via `requireCompanyByLegacyMockId`.
 *   - Document name must be non-blank.
 *   - storage_path is an object key, never a public URL.
 *   - Manual status changes remain explicit. File upload and validity-date
 *     updates share the Istanbul-day expiry classification in document-validity.
 *
 * Error surface:
 *   - DocumentValidationError        -- blank name
 *   - CompanyNotFoundOrOutOfScopeError -- reused from services/companies
 */

import { isDocumentValidityDate, withCurrentDocumentStatus } from "@/lib/document-validity";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Database,
  DocumentRow,
} from "@/types/database.types";
import type { DocumentCategory } from "@/lib/document-categories";
import {
  selectDocumentsByCompanyId,
  selectDocumentsByCompanyIds,
  selectAllDocuments,
  selectDocumentById,
} from "@/lib/supabase/documents";
import {
  requireCompanyByLegacyMockId,
  getCompanyIdMapByLegacyMockIds,
} from "@/lib/services/companies";

type Client = SupabaseClient<Database>;

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class DocumentValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DocumentValidationError";
  }
}

// ---------------------------------------------------------------------------
// UI-facing input shapes
// ---------------------------------------------------------------------------

export interface DocumentCreateInput {
  legacyCompanyId: string;
  name: string;
  category?: DocumentCategory;
  validityDate?: string;
  storagePath?: string;
  contractId?: string;
}

export interface DocumentValidityUpdateInput {
  validityDate: string;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/**
 * List every document for the firma identified by a legacy mock id.
 */
export async function listDocumentsByLegacyCompanyId(
  client: Client,
  legacyMockId: string,
  options?: {includeContractDocuments: boolean},
): Promise<DocumentRow[]> {
  const company = await requireCompanyByLegacyMockId(client, legacyMockId);
  const now = new Date();
  return (await selectDocumentsByCompanyId(client, company.id, options)).map(row => withCurrentDocumentStatus(row, now));
}

/**
 * List every document visible to the caller. Used by the global
 * Evraklar list page.
 */
export async function listAllDocuments(
  client: Client,
): Promise<DocumentRow[]> {
  const now = new Date();
  return (await selectAllDocuments(client)).map(row => withCurrentDocumentStatus(row, now));
}

/**
 * Fetch a single document by id.
 */
export async function getDocumentById(
  client: Client,
  id: string,
): Promise<DocumentRow | null> {
  const row = await selectDocumentById(client, id);
  return row ? withCurrentDocumentStatus(row) : null;
}

// ---------------------------------------------------------------------------
// Batched readers -- Firmalar list (legacy id keyed)
// ---------------------------------------------------------------------------

/**
 * Batch helper: takes a set of legacy mock ids and returns document
 * compliance counts keyed by legacy id:
 *   { legacyId -> { total, tam, eksik, suresiYaklsiyor, suresiDoldu } }
 *
 * Follows the same pattern as `getPrimaryContactNamesByLegacyIds`.
 */
export async function getDocumentComplianceByLegacyIds(
  client: Client,
  legacyMockIds: string[],
): Promise<Record<string, { total: number; tam: number; eksik: number; suresiYaklsiyor: number; suresiDoldu: number }>> {
  if (legacyMockIds.length === 0) return {};

  const idMap = await getCompanyIdMapByLegacyMockIds(client, legacyMockIds);
  const realIds = Object.values(idMap);
  if (realIds.length === 0) return {};

  const now = new Date();
  const documents = (await selectDocumentsByCompanyIds(client, realIds)).map(row => withCurrentDocumentStatus(row, now));

  // Group by company_id and count
  const byCompany = new Map<string, DocumentRow[]>();
  for (const d of documents) {
    const arr = byCompany.get(d.company_id) ?? [];
    arr.push(d);
    byCompany.set(d.company_id, arr);
  }

  const result: Record<string, { total: number; tam: number; eksik: number; suresiYaklsiyor: number; suresiDoldu: number }> = {};
  for (const [legacyId, realId] of Object.entries(idMap)) {
    const docs = byCompany.get(realId) ?? [];
    const counts = { total: docs.length, tam: 0, eksik: 0, suresiYaklsiyor: 0, suresiDoldu: 0 };
    for (const d of docs) {
      if (d.status === "tam") counts.tam++;
      else if (d.status === "eksik") counts.eksik++;
      else if (d.status === "suresi_yaklsiyor") counts.suresiYaklsiyor++;
      else if (d.status === "suresi_doldu") counts.suresiDoldu++;
    }
    result[legacyId] = counts;
  }

  return result;
}

// ---------------------------------------------------------------------------
// Writes -- create
// ---------------------------------------------------------------------------

/**
 * DISABLED (Codex must-fix, 2026-05).
 *
 * This browser-context creator inserted a `documents` row WITHOUT the
 * production-required `tenant_id`, and did its storage upload + insert
 * outside any server-side role guard — a tenant-less-insert + orphan
 * risk. All real callers now route through the tenant-aware server
 * action `uploadCompanyDocumentAction` (src/app/(main)/firmalar/[id]/
 * actions.ts), which sets tenant_id from `current_user_active_tenant()`
 * and stamps the other server-controlled fields.
 *
 * Kept as a fail-closed stub so that any future caller wired to this
 * path fails loudly instead of silently creating an invalid row. To
 * restore document creation, call the server action.
 */
export async function createDocument(
  _client: Client,
  _input: DocumentCreateInput,
): Promise<DocumentRow> {
  throw new Error(
    "createDocument devre dışı: belge oluşturma tenant-aware server action (uploadCompanyDocumentAction) üzerinden yapılmalıdır.",
  );
}

// ---------------------------------------------------------------------------
// Reads / writes -- contract PDF attachment (Hafta 2 batch)
// ---------------------------------------------------------------------------

/**
 * Look up the single active contract document, if any.
 *
 * One row per contract is enforced at the DB layer by a partial unique
 * index on `documents.contract_id` (`WHERE contract_id IS NOT NULL`).
 * The query is small and only used by `/sozlesmeler/[id]`, so it is
 * intentionally inlined here rather than added to the raw layer to
 * keep this batch within its 3-code-file cap. Documented as a micro
 * layer-break in the closeout report.
 */
export async function getActiveContractDocument(
  client: Client,
  contractId: string,
): Promise<DocumentRow | null> {
  const { data, error } = await client
    .from("documents")
    .select("*")
    .eq("contract_id", contractId)
    .eq("contract_document_role", "main")
    .maybeSingle();
  if (error) {
    throw new Error(`active contract document fetch failed: ${error.message}`);
  }
  return data ?? null;
}

type MetadataSnapshot = Pick<DocumentRow, 'id' | 'tenant_id' | 'company_id' | 'revision' | 'contract_id'>;

async function editMetadata(client:Client,row:MetadataSnapshot,kind:'category'|'validity',value:string):Promise<DocumentRow> {
  if(!row.tenant_id || !Number.isSafeInteger(row.revision) || row.revision<0 || row.revision>=Number.MAX_SAFE_INTEGER) throw new DocumentValidationError('Belge sürümü doğrulanamadı. Listeyi yenileyin.');
  const {data,error}=await client.rpc('document_edit_metadata_v1',{p_tenant:row.tenant_id,p_id:row.id,p_company:row.company_id,p_revision:row.revision,p_kind:kind,p_value:value});
  if(error)throw new DocumentValidationError((error.code==='40001'||error.code==='PT409')?'Belge başka biri tarafından değiştirilmiş. Listeyi yenileyip tekrar deneyin.':'Belge güncellenemedi. Yetkinizi kontrol edip listeyi yenileyin.');
  if(!data || typeof data!=='object' || Array.isArray(data) || data.id!==row.id || data.tenant_id!==row.tenant_id || data.company_id!==row.company_id || data.contract_id!==row.contract_id || data.revision!==row.revision+1 || (kind==='category'?data.category!==value:data.validity_date!==value)) throw new DocumentValidationError('Güncelleme sonucu doğrulanamadı. Listeyi yenileyin.');
  return data as unknown as DocumentRow;
}

/** Use the revision shown when the dialog opened, never a freshly fetched revision. */
export async function updateDocumentValidity(client:Client,row:MetadataSnapshot,input:DocumentValidityUpdateInput):Promise<DocumentRow> {
  const value=input.validityDate.trim();
  if(!isDocumentValidityDate(value))throw new DocumentValidationError('Geçerli bir tarih girin (YYYY-AA-GG).');
  return editMetadata(client,row,'validity',value);
}

export async function changeDocumentCategory(client:Client,row:MetadataSnapshot,category:DocumentCategory):Promise<DocumentRow> {
  const valid=['cerceve_sozlesme','ek_protokol','yetki_belgesi','operasyon_evraki','teklif_dosyasi','ziyaret_tutanagi','diger'];
  if(!valid.includes(category)||row.contract_id!==null)throw new DocumentValidationError('Belge türü değiştirilemez.');
  return editMetadata(client,row,'category',category);
}
