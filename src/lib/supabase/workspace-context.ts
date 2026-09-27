import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';

export async function selectWorkspaceIdentity(client: SupabaseClient<Database>) {
  const { data, error } = await client.rpc('current_workspace_context').abortSignal(AbortSignal.timeout(12_000));
  if (error) throw error;
  return data;
}
