/**
 * Next.js middleware — Supabase session refresh + route protection.
 *
 * Unauthenticated users are redirected to /login with returnTo param.
 * Already-authenticated users on /login are redirected to /dashboard.
 * Session tokens are refreshed on every request.
 */

import { updateSession } from "@/lib/supabase/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { maintenanceResponse } from "@/lib/maintenance";

export async function middleware(request: NextRequest) {
  const paused = maintenanceResponse(request, process.env.BPS_MAINTENANCE_MODE);
  if (paused) return paused;
  // Preserve the previous public-asset bypass when maintenance is off.
  const path = request.nextUrl.pathname;
  if (path.startsWith('/_next/static') || path.startsWith('/_next/image') ||
      path === '/favicon.ico' || /\.(?:svg|png|jpg|jpeg|gif|webp)$/.test(path)) {
    return NextResponse.next();
  }
  return await updateSession(request);
}

// Include assets and every API path so an extension cannot bypass maintenance.
export const config = { matcher: ["/:path*"] };
