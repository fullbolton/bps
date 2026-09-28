import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';
import { isUuid } from '@/lib/operations/pilot-validation';

export type CompanyFinancialSummary = {
  open_receivable: string | number | null;
  unbilled_amount: string | number | null;
  is_overdue: boolean | null;
  last_source: 'mizan' | 'muhasebe' | null;
};
function isAmount(value: unknown): value is CompanyFinancialSummary['open_receivable'] {
  return value === null || (typeof value === 'number' && Number.isFinite(value))
    || (typeof value === 'string' && /^-?\d+(?:\.\d+)?$/.test(value) && Number.isFinite(Number(value)));
}

/** A failed read is never an absent summary. Explicit scope supplements existing RLS. */
export async function loadCompanyFinancialSummary(client: SupabaseClient<Database>, companyId: string, tenantId: string): Promise<CompanyFinancialSummary | null> {
  if (!isUuid(companyId) || !isUuid(tenantId)) throw Error('Ticari özet kapsamı doğrulanamadı.');
  const {data, error} = await client.from('financial_summaries')
    .select('company_id, tenant_id, open_receivable, unbilled_amount, is_overdue, last_source')
    .eq('company_id', companyId).eq('tenant_id', tenantId).maybeSingle();
  if (error) throw Error('Ticari özet yüklenemedi. Yeniden deneyin.');
  if (data === null) return null;
  const row = data as Record<string, unknown> | undefined;
  if (!row || row.company_id !== companyId || row.tenant_id !== tenantId
    || !isAmount(row.open_receivable) || !isAmount(row.unbilled_amount)
    || !(row.is_overdue === null || typeof row.is_overdue === 'boolean')
    || !(row.last_source === null || row.last_source === 'mizan' || row.last_source === 'muhasebe')) {
    throw Error('Ticari özet yanıtı doğrulanamadı.');
  }
  return {open_receivable:row.open_receivable,unbilled_amount:row.unbilled_amount,is_overdue:row.is_overdue,last_source:row.last_source};
}
