/**
 * Supabase browser client — used in client components.
 * Creates a single shared instance for the browser session.
 *
 * The Database generic threads the typed schema (`src/types/database.types.ts`)
 * through every query, giving the service layer end-to-end type safety.
 * Phase 0 only types the `profiles` table; future phases extend the type.
 */

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database.types";

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
