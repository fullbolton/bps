import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, ContractRow } from '@/types/database.types';
import { readNotificationPages } from './read-pages';

export type ExpiryContract = Pick<ContractRow, 'id' | 'tenant_id' | 'company_id' | 'name' | 'end_date' | 'responsible'>;

/** Date-window calculation stays with the existing caller; read all candidates. */
export function readExpiryContracts(client: SupabaseClient<Database>): Promise<ExpiryContract[]> {
  return readNotificationPages(
    (from, to) => client.from('contracts')
      .select('id, tenant_id, company_id, name, end_date, responsible', { count: 'exact' })
      .eq('status', 'aktif').not('end_date', 'is', null)
      .order('id').range(from, to),
    row => typeof row.id === 'string' && row.id ? row.id : null,
  );
}
