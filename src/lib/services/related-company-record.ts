import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';

/** Read-time application guard; DB constraints must also enforce this across concurrent writes. */
export async function requireRelatedCompanyRecord(
  client: SupabaseClient<Database>,
  table: 'contracts' | 'appointments',
  id: string | null,
  company: { id: string; tenant_id: string },
  tenantId: string,
): Promise<void> {
  if (company.tenant_id !== tenantId) throw new Error('Firma çalışma alanıyla eşleşmiyor. Sayfayı yenileyin.');
  if (id === null) return;
  const label = table === 'contracts' ? 'Sözleşme' : 'Randevu';
  const { data, error } = await client.from(table)
    .select('id, company_id, tenant_id')
    .eq('id', id).eq('company_id', company.id).eq('tenant_id', tenantId).maybeSingle();
  if (error) throw new Error(`${label} ilişkisi doğrulanamadı. Yeniden deneyin.`);
  if (!data || data.id !== id || data.company_id !== company.id || data.tenant_id !== tenantId) {
    throw new Error(`${label} bulunamadı veya seçilen firmaya ait değil.`);
  }
}
