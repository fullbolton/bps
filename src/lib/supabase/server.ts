/**
 * Supabase server client — used in server components and middleware.
 * Creates a per-request client with cookie-based session.
 *
 * The Database generic threads the typed schema (`src/types/database.types.ts`)
 * through every query, giving the service layer end-to-end type safety.
 */

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/types/database.types";

export async function createServerSupabaseClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // The `setAll` method is called from Server Components where
            // cookies cannot be set. This can safely be ignored when the
            // middleware handles session refresh.
          }
        },
      },
    }
  );
}
