import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';

/** Versioned, read-only foundation. Do not fall back to all modules on RPC failure. */
export async function selectWorkspaceModules(client: SupabaseClient<Database>) {
  const { data, error } = await client.rpc('current_workspace_modules_v1').abortSignal(AbortSignal.timeout(12_000));
  if (error) throw error;
  return data;
}
