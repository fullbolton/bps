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

  // Public routes that don't require auth
  const isLoginPage = request.nextUrl.pathname === "/login";

  // If no user and not on login page, redirect to login with return URL
  if (!user && !isLoginPage) {
    const url = request.nextUrl.clone();
    const returnTo = url.pathname + url.search;
    url.pathname = "/login";
    url.searchParams.set("returnTo", returnTo);
    return NextResponse.redirect(url);
  }

  // If user is on login page and already authenticated, redirect to dashboard
  if (user && isLoginPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.searchParams.delete("returnTo");
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
