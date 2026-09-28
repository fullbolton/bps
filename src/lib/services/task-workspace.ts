import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';
import { selectWorkspaceModules } from '@/lib/supabase/workspace-modules';
import { parseWorkspaceModuleContext } from '@/lib/modules/context';
import type { WorkspaceScope } from '@/lib/workspace-context';
import { completePages } from '@/lib/supabase/complete-pages';
import { isUuid } from '@/lib/operations/pilot-validation';

export type TaskCompanyChoice = { id: string; tenant_id: string; legacy_mock_id: string | null; name: string; status: string };

/** Initial page snapshot; generations come from this verified RPC, never a raw claim. */
export async function loadTaskWorkspace(client: SupabaseClient<Database>, expected: WorkspaceScope & {role: string}) {
  try {
    const raw = await selectWorkspaceModules(client);
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw Error('Çalışma alanı ayarları doğrulanamadı.');
    const data = raw as Record<string, unknown>;
    const context = parseWorkspaceModuleContext(raw, {...expected,
      selectionVersion: data.selectionVersion as string | null, membershipVersion: data.membershipVersion as string});
    if (context.role !== expected.role) throw Error('Çalışma alanı yetkileriniz değişti. Sayfayı yenileyin.');
    return context;
  } catch {
    throw Error("Görevler için çalışma alanı ayarları doğrulanamadı. Sayfayı yenileyin.");
  }
}

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
