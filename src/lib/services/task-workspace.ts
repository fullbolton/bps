import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';
import type { WorkspaceScope } from '@/lib/workspace-context';
import { completePages } from '@/lib/supabase/complete-pages';
import { isUuid } from '@/lib/operations/pilot-validation';

export type TaskCompanyChoice = { id: string; tenant_id: string; legacy_mock_id: string | null; name: string; status: string };

export { loadCurrentWorkspaceModules as loadTaskWorkspace } from './workspace-modules';

export async function loadTaskCompanyChoices(client: SupabaseClient<Database>, expected: WorkspaceScope): Promise<TaskCompanyChoice[]> {
  const rows = await completePages((from,to,signal) => client.rpc('task_company_choices_v1', {}, {count:'exact'})
    .order('name').order('id').range(from,to).abortSignal(signal), 'Firma listesi');
  return rows.map(row => {
    if (!isUuid(row.id) || row.tenant_id !== expected.tenantId || typeof row.name !== 'string' || !row.name.trim()
      || !['aday','aktif','pasif'].includes(row.status) || !(row.legacy_mock_id === null || typeof row.legacy_mock_id === 'string')) {
      throw Error('Firma listesi doğrulanamadı.');
    }
    return {id:row.id,tenant_id:row.tenant_id,legacy_mock_id:row.legacy_mock_id,name:row.name,status:row.status};
  });
}
