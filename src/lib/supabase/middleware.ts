/**
 * Supabase middleware client — used in Next.js middleware for
 * session refresh and route protection.
 */

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh session — important for keeping tokens alive
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Public routes that don't require auth.
  //
  // /api/cron/* and /api/healthz are bypassed here because they are
  // invoked without a Supabase session — without this exclusion the
  // middleware would redirect them to /login before the handler ever
  // runs. Both routes have their own bearer-auth via CRON_SECRET
  // (see src/app/api/cron/contract-expiry/route.ts and
  // src/app/api/healthz/route.ts), so skipping the Supabase redirect
  // here is safe.
  const pathname = request.nextUrl.pathname;
  const isPublicRoute =
    pathname === "/login" ||
    pathname === "/" ||
    pathname.startsWith("/api/demo-request") ||
    pathname.startsWith("/api/cron") ||
    pathname === "/api/healthz";

  // If no user and not on a public route, redirect to login with return URL
  if (!user && !isPublicRoute) {
    const url = request.nextUrl.clone();
    const returnTo = url.pathname + url.search;
    url.pathname = "/login";
    url.searchParams.set("returnTo", returnTo);
    return NextResponse.redirect(url);
  }

  // If user is on login page and already authenticated, redirect to dashboard
  const isLoginPage = pathname === "/login";
  if (user && isLoginPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.searchParams.delete("returnTo");
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
