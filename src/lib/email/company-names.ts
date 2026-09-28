import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';

/** Service-only, tenant-bound projection. Missing/off/unverifiable companies abort composition. */
export async function readNotificationCompanyNames(client: SupabaseClient<Database>, companies: {companyId: string; tenantId: string}[], module: "calendar" | "contracts"): Promise<Map<string, string>> {
  const expected = new Map<string, string>(), names = new Map<string, string>();
  for (const company of companies) {
    if (!company.companyId || !company.tenantId || (expected.has(company.companyId) && expected.get(company.companyId) !== company.tenantId)) throw Error('code=COMPANY_SCOPE_INVALID');
    expected.set(company.companyId, company.tenantId);
  }
  const ids = [...expected.keys()];
  for (let offset = 0; offset < ids.length; offset += 100) {
    const chunk = ids.slice(offset, offset + 100);
    const { data, error } = await client.rpc('notification_company_names_v1', {
      p_company_ids: chunk, p_tenant_ids: chunk.map(id => expected.get(id)!), p_module: module,
    });
    if (error || !Array.isArray(data) || data.length !== chunk.length) throw Error('code=COMPANY_READ_FAILED');
    for (const row of data) {
      if (!row || !chunk.includes(row.id) || names.has(row.id) || row.tenant_id !== expected.get(row.id) || typeof row.name !== 'string' || !row.name.trim()) throw Error('code=COMPANY_INVALID');
      names.set(row.id, row.name);
    }
  }
  return names;
}
