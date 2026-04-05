/**
 * Next.js middleware — Supabase session refresh + route protection.
 *
 * Unauthenticated users are redirected to /login with returnTo param.
 * Already-authenticated users on /login are redirected to /dashboard.
 * Session tokens are refreshed on every request.
 */

import { updateSession } from "@/lib/supabase/middleware";
import type { NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     * - public assets
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
