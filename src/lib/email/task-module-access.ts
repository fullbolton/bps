import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';

/** Service-only snapshot. Invalid/missing rows stop the batch; never assume ON. */
export async function enabledNotificationTenants(client: SupabaseClient<Database>, tenantIds: string[], module: "tasks" | "calendar" | "contracts"): Promise<Set<string>> {
  const ids = [...new Set(tenantIds)], enabled = new Set<string>();
  for (let from = 0; from < ids.length; from += 500) {
    const page = ids.slice(from, from + 500), expected = new Set(page), seen = new Set<string>();
    const { data, error } = await (module === 'tasks' ? client.rpc('task_notification_modules_v1', { p_tenant_ids: page }) : client.rpc('customer_notification_modules_v1', { p_tenant_ids: page, p_module: module }));
    if (error || !Array.isArray(data) || data.length !== page.length) throw Error('TASK_MODULE_UNVERIFIABLE');
    for (const row of data) {
      if (!row || !expected.has(row.tenant_id) || seen.has(row.tenant_id) || typeof row.enabled !== 'boolean') {
        throw Error('TASK_MODULE_UNVERIFIABLE');
      }
      seen.add(row.tenant_id);
      if (row.enabled) enabled.add(row.tenant_id);
    }
  }
  return enabled;
}

export const enabledTaskTenants = (client: SupabaseClient<Database>, tenantIds: string[]) => enabledNotificationTenants(client, tenantIds, "tasks");
