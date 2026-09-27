import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';
import { completeRows } from '@/lib/supabase/complete-result';

/** Every referenced company must resolve before composing a notification. */
export async function readNotificationCompanyNames(client: SupabaseClient<Database>, companyIds: string[]): Promise<Map<string, string>> {
  const ids = [...new Set(companyIds)], names = new Map<string, string>();
  for (let offset = 0; offset < ids.length; offset += 100) {
    const chunk = ids.slice(offset, offset + 100);
    const { data, count, error } = await client.from('companies')
      .select('id, name', { count: 'exact' }).in('id', chunk);
    if (error) throw Error('code=COMPANY_READ_FAILED');
    const rows = completeRows(data, count, 'notification companies');
    if (rows.length !== chunk.length) throw Error('code=COMPANY_MISSING');
    for (const row of rows) {
      if (!chunk.includes(row.id) || names.has(row.id) || typeof row.name !== 'string' || !row.name.trim()) {
        throw Error('code=COMPANY_INVALID');
      }
      names.set(row.id, row.name);
    }
  }
  return names;
}
