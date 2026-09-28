import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, CompanyInsert, CompanyRow } from '@/types/database.types';
import { moduleAccessMessage } from '@/lib/modules/errors';

type Client = SupabaseClient<Database>;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const uncertain = 'Firma işleminin sonucu doğrulanamadı. Tekrar denemeden önce firma listesini kontrol edin.';

async function execute(client: Client, action: 'create' | 'status', companyId: string | null, tenantId: string, actorId: string, input: Record<string, string | null>): Promise<CompanyRow> {
  if (!UUID.test(tenantId) || !UUID.test(actorId) || (companyId !== null && !UUID.test(companyId))) throw Error('Firma işleminin çalışma alanı doğrulanamadı.');
  let response;
  try {
    response = await client.rpc('company_execute_v1', {p_action:action,p_company_id:companyId,p_tenant_id:tenantId,p_actor_id:actorId,p_input:input});
  } catch { throw Error(uncertain); }
  if (response.error) throw Error(moduleAccessMessage(response.error) ?? (response.error.code === 'BC400' ? 'Firma bilgileri geçersiz. Alanları kontrol edin.' : uncertain));
  const rows = response.data;
  if (!Array.isArray(rows) || rows.length !== 1) throw Error(uncertain);
  const row = rows[0];
  if (!row || !UUID.test(row.id) || row.tenant_id !== tenantId || typeof row.name !== 'string' || !row.name.trim()
    || !['aday','aktif','pasif'].includes(row.status) || (companyId !== null && row.id !== companyId)
    || (action === 'create' && row.created_by !== actorId) || (action === 'status' && row.status !== input.status)) throw Error(uncertain);
  return row;
}

/** No automatic retry: creation does not yet have a durable idempotency receipt. */
export function createCompanyRecord(client: Client, payload: CompanyInsert): Promise<CompanyRow> {
  if (!payload.created_by) return Promise.reject(Error('Firma işleminin hesabı doğrulanamadı.'));
  // IDs, timestamps and legacy identifiers cannot be chosen by this command.
  if (Object.keys(payload).some(key => !['tenant_id','created_by','name','sector','city','status','risk'].includes(key))) return Promise.reject(Error('Firma bilgileri geçersiz.'));
  return execute(client,'create',null,payload.tenant_id,payload.created_by,{
    name:payload.name,sector:payload.sector??null,city:payload.city??null,status:payload.status??'aday',risk:payload.risk??'dusuk',
  });
}

export function setCompanyStatus(client: Client, companyId: string, tenantId: string, actorId: string, status: 'aktif' | 'pasif'): Promise<CompanyRow> {
  return execute(client,'status',companyId,tenantId,actorId,{status});
}
