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
 *   - status is set by the caller (tam/eksik/suresi_yaklsiyor/suresi_doldu).
 *     Expiry derivation from validity_date is optional and happens in the
 *     service layer, but status itself is a human-driven classification.
 *
 * Error surface:
 *   - DocumentValidationError        -- blank name
 *   - CompanyNotFoundOrOutOfScopeError -- reused from services/companies
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { EvrakDurumu } from "@/types/ui";
import type {
  Database,
  DocumentRow,
  DocumentInsert,
  DocumentUpdate,
} from "@/types/database.types";
import type { DocumentCategory } from "@/lib/document-categories";
import {
  selectDocumentsByCompanyId,
  selectDocumentsByCompanyIds,
  selectAllDocuments,
  selectDocumentById,
  insertDocument,
  updateDocument,
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

function ensureNonBlankName(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new DocumentValidationError("Evrak adi bos birakilamaz.");
  }
  return trimmed;
}

function nullableTrim(value: string | undefined): string | null {
  if (value === undefined || value === null) return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/**
 * List every document for the firma identified by a legacy mock id.
 */
export async function listDocumentsByLegacyCompanyId(
  client: Client,
  legacyMockId: string,
): Promise<DocumentRow[]> {
  const company = await requireCompanyByLegacyMockId(client, legacyMockId);
  return selectDocumentsByCompanyId(client, company.id);
}

/**
 * List every document visible to the caller. Used by the global
 * Evraklar list page.
 */
export async function listAllDocuments(
  client: Client,
): Promise<DocumentRow[]> {
  return selectAllDocuments(client);
}

/**
 * Fetch a single document by id.
 */
export async function getDocumentById(
  client: Client,
  id: string,
): Promise<DocumentRow | null> {
  return selectDocumentById(client, id);
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

  const documents = await selectDocumentsByCompanyIds(client, realIds);

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
 * Create a new document for the firma identified by a legacy mock id.
 *
 * Behavior:
 *   - Re-verifies partner scope via `requireCompanyByLegacyMockId`.
 *   - Validates name (non-blank).
 *   - Defaults category to 'diger', status to 'eksik' (or 'tam' if
 *     validity date is provided).
 *   - Stamps created_by from the auth session.
 */
export async function createDocument(
  client: Client,
  input: DocumentCreateInput,
): Promise<DocumentRow> {
  const company = await requireCompanyByLegacyMockId(
    client,
    input.legacyCompanyId,
  );

  const name = ensureNonBlankName(input.name);
  const validityDate = nullableTrim(input.validityDate);

  const {
    data: { user },
  } = await client.auth.getUser();

  // Determine initial status
  const status: EvrakDurumu = validityDate ? "tam" : "eksik";

  const payload: DocumentInsert = {
    company_id: company.id,
    contract_id: input.contractId ?? null,
    name,
    category: input.category ?? "diger",
    status,
    validity_date: validityDate,
    storage_path: nullableTrim(input.storagePath),
    uploaded_by: user?.user_metadata?.display_name ?? user?.email ?? null,
    created_by: user?.id ?? null,
  };

  return insertDocument(client, payload);
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
    .maybeSingle();
  if (error) {
    throw new Error(`active contract document fetch failed: ${error.message}`);
  }
  return data ?? null;
}

/**
 * Replace-flow update for a contract PDF document row.
 *
 * The caller (contract detail page) has already uploaded the new
 * storage object and is now patching the existing row to point at it.
 * Old storage object is intentionally not deleted here — orphan risk
 * is consistent with the Storage Foundation pattern (see closeout
 * report). DELETE on storage.objects is yonetici-only by RLS, so
 * partner-replace would fail cleanup anyway; skipping cleanup keeps
 * the code path uniform across roles.
 */
export async function updateContractDocumentFile(
  client: Client,
  documentId: string,
  patch: { name: string; storagePath: string; uploadedBy: string | null },
): Promise<DocumentRow> {
  const trimmed = ensureNonBlankName(patch.name);
  const dbPatch: DocumentUpdate = {
    name: trimmed,
    storage_path: patch.storagePath,
    status: "tam",
    uploaded_by: patch.uploadedBy,
    updated_at: new Date().toISOString(),
  };
  return updateDocument(client, documentId, dbPatch);
}

// ---------------------------------------------------------------------------
// Writes -- update validity
// ---------------------------------------------------------------------------

/**
 * Update a document's validity date and mark it as 'tam'.
 * Used by the "Gecerlilik Guncelle" flow.
 */
export async function updateDocumentValidity(
  client: Client,
  documentId: string,
  input: DocumentValidityUpdateInput,
): Promise<DocumentRow> {
  const trimmedDate = input.validityDate.trim();
  if (!trimmedDate) {
    throw new DocumentValidationError("Gecerlilik tarihi bos birakilamaz.");
  }

  // Verify the document exists and is visible
  const existing = await selectDocumentById(client, documentId);
  if (!existing) {
    throw new DocumentValidationError(
      "Evrak bulunamadi veya bu evraka erisim yetkiniz yok.",
    );
  }

  const patch: DocumentUpdate = {
    validity_date: trimmedDate,
    status: "tam",
    updated_at: new Date().toISOString(),
  };

  return updateDocument(client, documentId, patch);
}

// ---------------------------------------------------------------------------
// Writes -- update status
// ---------------------------------------------------------------------------

/**
 * Update a document's status directly.
 */
export async function updateDocumentStatus(
  client: Client,
  documentId: string,
  newStatus: EvrakDurumu,
): Promise<DocumentRow> {
  const existing = await selectDocumentById(client, documentId);
  if (!existing) {
    throw new DocumentValidationError(
      "Evrak bulunamadi veya bu evraka erisim yetkiniz yok.",
    );
  }

  const patch: DocumentUpdate = {
    status: newStatus,
    updated_at: new Date().toISOString(),
  };

  return updateDocument(client, documentId, patch);
}
