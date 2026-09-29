import { parseRequestedModules, parseModuleChangePreview } from '@/lib/modules/change-preview';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { WorkspaceScope } from '@/lib/workspace-context';
import type { Database } from '@/types/database.types';
import { parseWorkspaceModuleContext, type ModuleContextExpectation } from '@/lib/modules/context';
import { selectWorkspaceModules } from '@/lib/supabase/workspace-modules';

export async function loadWorkspaceModules(client: SupabaseClient<Database>, expected: ModuleContextExpectation) {
  return parseWorkspaceModuleContext(await selectWorkspaceModules(client), expected);
}

/** Initial page snapshot; generations come from this verified RPC, never a raw claim. */
export async function loadCurrentWorkspaceModules(client: SupabaseClient<Database>, expected: WorkspaceScope & {role: string}) {
  try {
    const raw = await selectWorkspaceModules(client);
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw Error('Çalışma alanı ayarları doğrulanamadı.');
    const data = raw as Record<string, unknown>;
    const context = parseWorkspaceModuleContext(raw, {...expected,
      selectionVersion: data.selectionVersion as string | null, membershipVersion: data.membershipVersion as string});
    if (context.role !== expected.role) throw Error('Çalışma alanı yetkileriniz değişti. Sayfayı yenileyin.');
    return context;
  } catch {
    throw Error("Çalışma alanı ayarları doğrulanamadı. Sayfayı yenileyin.");
  }
}

/** Advisory snapshot; caller must not interpret empty blockers as permission to save. */
export async function previewWorkspaceModules(client: SupabaseClient<Database>, expected: ModuleContextExpectation, revision: string, requested: unknown) {
  const modules = parseRequestedModules(requested);
  const {data, error} = await client.rpc('preview_workspace_modules_v1', {
    p_expected_actor: expected.actorId, p_expected_tenant: expected.tenantId,
    p_expected_revision: revision, p_modules: modules,
  }).abortSignal(AbortSignal.timeout(12_000));
  if (error) throw error;
  return parseModuleChangePreview(data, expected, revision, modules);
}
