import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';
import { parseWorkspaceIdentity, type WorkspaceScope } from '@/lib/workspace-context';
import { selectWorkspaceIdentity } from '@/lib/supabase/workspace-context';

export async function loadWorkspaceIdentity(client: SupabaseClient<Database>, expected: WorkspaceScope) {
  return parseWorkspaceIdentity(await selectWorkspaceIdentity(client), expected);
}
