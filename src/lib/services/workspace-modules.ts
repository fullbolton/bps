import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';
import { parseWorkspaceModuleContext, type ModuleContextExpectation } from '@/lib/modules/context';
import { selectWorkspaceModules } from '@/lib/supabase/workspace-modules';

export async function loadWorkspaceModules(client: SupabaseClient<Database>, expected: ModuleContextExpectation) {
  return parseWorkspaceModuleContext(await selectWorkspaceModules(client), expected);
}
