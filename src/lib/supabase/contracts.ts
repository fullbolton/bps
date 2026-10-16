import { completePages } from "./complete-pages";
/**
 * BPS — Raw Supabase access for the `contracts` table.
 *
 * This file is the thin translator between the typed Supabase client
 * and the service layer. It performs NO business logic:
 *   - No partner scope re-verification (lives in services/contracts.ts)
 *   - No status-transition gating (lives in services/contracts.ts)
 *   - No remaining-day derivation (lives in services/contracts.ts;
 *     never persisted)
 *   - No content validation (services/contracts.ts trims, whitelists)
 *
 * Functions throw on supabase errors so the service layer can catch
 * and translate them to friendly Turkish messages.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Database,
  ContractRow,
  ContractInsert,
  ContractUpdate,
} from "@/types/database.types";

type Client = SupabaseClient<Database>;

function commandError(error: {code?: string}): Error {
  if(error.code==='23503') return new Error('Bağlı kayıtları veya işlem geçmişi bulunan sözleşme silinemez. Geçmişi korumak için sözleşme durumunu güncelleyin.');
  if(error.code==='BM001') return new Error('Sözleşmeler modülü kapalı. Çalışma alanı ayarlarını kontrol edin.');
  if((error.code==='40001'||error.code==='PT409')) return new Error('Sözleşme siz düzenlerken değişti. Güncel kaydı açıp değişikliklerinizi karşılaştırın.');
  if(error.code==='42501') return new Error('Bu sözleşmede işlem yapma yetkiniz yok.');
  if(['22023','22007','22008','22P02','23514'].includes(error.code??'')) return new Error('Sözleşme bilgilerini ve tarih aralığını kontrol edin.');
  return new Error('İşlemin sonucu doğrulanamadı. İşlemi tekrarlamadan önce sözleşme listesini yenileyin.');
}

export async function deleteContractScoped(client:Client,id:string,expected:Pick<ContractRow,'tenant_id'|'revision'>):Promise<ContractRow> {
  if(!Number.isSafeInteger(expected.revision)||expected.revision<0) throw new Error('Sözleşme sürümü doğrulanamadı. Sayfayı yenileyin.');
  const {data,error}=await client.rpc('contract_delete_v1',{p_id:id,p_tenant:expected.tenant_id,p_revision:expected.revision}).single();
  if(error)throw commandError(error);
  if(!data||data.id!==id||data.tenant_id!==expected.tenant_id||data.revision!==expected.revision||typeof data.name!=='string'||!data.name) throw new Error('Sözleşmenin silindiği doğrulanamadı. Listeyi yenileyin.');
  return data;
}

/**
 * Read every contract visible to the caller, sorted "active first then
 * end_date asc, then name asc". The Sözleşmeler list page filters this
 * client-side via its existing filter chips and search input.
 */
export async function selectAllContracts(client: Client): Promise<ContractRow[]> {
  return completePages((from, to, signal) => client
    .from("contracts")
    .select("*", {count:"exact"})
    .order("status", { ascending: true })
    .order("end_date", { ascending: true, nullsFirst: false })
    .order("name", { ascending: true })
    .order("id", { ascending: true }).range(from, to).abortSignal(signal), "Sözleşmeler");
}

/**
 * Read a single contract by id. Used by the Sözleşme Detay core read
 * path. Returns null when the row doesn't exist or RLS hides it.
 */
export async function selectContractById(
  client: Client,
  contractId: string,
): Promise<ContractRow | null> {
  const { data, error } = await client
    .from("contracts")
    .select("*")
    .eq("id", contractId)
    .maybeSingle();

  if (error) {
    throw new Error(`contracts select-by-id failed: ${error.message}`);
  }
  return data ?? null;
}

/**
 * Read every contract for a single company. Used by the Firma Detay
 * Sözleşmeler tab and the Genel Bakış > Aktif Sözleşmeler card.
 *
 * Sort order: active rows first (so Aktif Sözleşmeler card naturally
 * shows the right rows when sliced), then end_date ascending so the
 * "kalan gün" badge surfaces the most-imminent renewals at the top.
 */
export async function selectContractsByCompanyId(
  client: Client,
  companyId: string,
): Promise<ContractRow[]> {
  return completePages((from, to, signal) => client
    .from("contracts")
    .select("*", {count:"exact"})
    .eq("company_id", companyId)
    .order("status", { ascending: true })
    .order("end_date", { ascending: true, nullsFirst: false })
    .order("name", { ascending: true })
    .order("id", { ascending: true }).range(from, to).abortSignal(signal), "Sözleşmeler");
}

/**
 * Batch helper for the Firmalar list "Aktif Sözleşme" column.
 *
 * Returns the count of contracts with status='aktif' grouped by
 * `company_id`, in a single round trip. Out-of-scope companies are
 * silently absent (count = 0 in the caller's fallback).
 *
 * Implementation: SELECT all active rows for the given companies, then
 * aggregate client-side. PostgREST does not support GROUP BY natively
 * without a view; the aggregation is small (≤ 8 firmas × dozens of
 * active rows) so the round trip stays well-bounded.
 */
export async function getActiveContractCountsByCompanyIds(
  client: Client,
  companyIds: string[],
): Promise<Record<string, number>> {
  if (companyIds.length === 0) return {};

  const rows = await completePages((from, to, signal) => client
    .from("contracts")
    .select("id, company_id", {count:"exact"})
    .in("company_id", companyIds)
    .eq("status", "aktif")
    .order("id", {ascending:true}).range(from, to).abortSignal(signal), "Sözleşmeler");

  const counts: Record<string, number> = {};
  for (const row of rows) {
    counts[row.company_id] = (counts[row.company_id] ?? 0) + 1;
  }
  return counts;
}

/**
 * Create through the module-aware manager command. Audit fields and legacy
 * renewal task flags are excluded; the database derives the author.
 */
export async function insertContract(
  client: Client,
  input: ContractInsert,
): Promise<ContractRow> {
  const {tenant_id,created_by,id,created_at,updated_at,renewal_responsible_set,renewal_task_created,...payload}=input;
  const {data,error}=await client.rpc('contract_write_v1',{p_id:null,p_tenant:tenant_id,p_revision:null,p_input:payload}).single();
  if(error) throw commandError(error);
  if(!data||data.tenant_id!==tenant_id||data.company_id!==input.company_id||data.name!==input.name.trim()||data.revision!==0) throw new Error('Sözleşme kaydının sonucu doğrulanamadı. Listeyi yenileyin.');
  return data;
}

/**
 * Update only the expected revision. The database owns the field allowlist,
 * module/role checks, merged-row validation and revision increment.
 */
export async function updateContract(
  client: Client,
  contractId: string,
  patch: ContractUpdate,
  expected: Pick<ContractRow,'tenant_id'|'revision'>,
): Promise<ContractRow> {
  if(!Number.isSafeInteger(expected.revision)||expected.revision<0) throw new Error('Sözleşme sürümü doğrulanamadı. Sayfayı yenileyin.');
  const {data,error}=await client.rpc('contract_write_v1',{p_id:contractId,p_tenant:expected.tenant_id,p_revision:expected.revision,p_input:patch}).single();
  if(error) throw commandError(error);
  if(!data||data.id!==contractId||data.tenant_id!==expected.tenant_id||data.revision!==expected.revision+1) throw new Error('Sözleşme değişikliğinin sonucu doğrulanamadı. Sayfayı yenileyin.');
  return data;
}
