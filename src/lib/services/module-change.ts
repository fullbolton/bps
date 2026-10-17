import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';
import { createModuleChangeAttempt, type ModuleChangePayload } from '@/lib/modules/change-attempt';

/** Release capability only. SQL scope checks and EXECUTE remain the authority.
 * No automatic retries: an uncertain response belongs to the same UI attempt.
 */
export function createModuleChangeCapability(client: SupabaseClient<Database>, invalidate: () => Promise<void>) {
  return {
    prepare: (context: Parameters<typeof createModuleChangeAttempt>[0], modules: Parameters<typeof createModuleChangeAttempt>[2]) =>
      createModuleChangeAttempt(context, crypto.randomUUID(), modules),
    transport: async (payload: ModuleChangePayload): Promise<unknown> => {
      const {data, error} = await client.rpc('change_workspace_modules_v1', {...payload})
        .abortSignal(AbortSignal.timeout(15_000));
      if (error) throw error;
      // The attempt validates the receipt against its immutable original intent.
      return data;
    },
    refresh: invalidate,
  };
}
