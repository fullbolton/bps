import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';

/** Fresh record-level check: a document may now belong to a disabled contract module. */
export async function enabledNotificationDocuments(client: SupabaseClient<Database>, items: {entityId: string; tenantId: string}[]): Promise<Set<string>> {
  const expected = new Map<string, string>(), enabled = new Set<string>();
  for (const item of items) {
    if (!item.entityId || !item.tenantId || (expected.has(item.entityId) && expected.get(item.entityId) !== item.tenantId)) throw Error('DOCUMENT_SCOPE_INVALID');
    expected.set(item.entityId, item.tenantId);
  }
  const ids = [...expected.keys()];
  for (let from = 0; from < ids.length; from += 500) {
    const page = ids.slice(from, from + 500), seen = new Set<string>();
    const {data, error} = await client.rpc('document_notification_state_v1', {p_ids: page, p_tenant_ids: page.map(id => expected.get(id)!)});
    if (error || !Array.isArray(data) || data.length !== page.length) throw Error('DOCUMENT_MODULE_UNVERIFIABLE');
    for (const row of data) {
      if (!row || !page.includes(row.id) || seen.has(row.id) || row.tenant_id !== expected.get(row.id) || typeof row.enabled !== 'boolean') throw Error('DOCUMENT_MODULE_UNVERIFIABLE');
      seen.add(row.id);
      if (row.enabled) enabled.add(row.id);
    }
  }
  return enabled;
}
