/**
 * BPS /api/healthz — env var value-correctness runtime self-check.
 *
 * Forward-looking guarantee for the 2026-04-20 silent failure: the
 * SUPABASE_SERVICE_ROLE_KEY slot held an anon JWT and the cron handler
 * ran for 4 days with RLS applied, returning 0 rows with no error. This
 * endpoint decodes each JWT at runtime and asserts role/ref/format, so
 * a bad env-var slot is caught with one curl after deploy.
 *
 * Bearer auth (CRON_SECRET); read-only. See 00_core/SECURITY_CHECKLIST § 3.5.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Check = { name: string; pass: boolean; detail: string };

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    return JSON.parse(Buffer.from(parts[1], "base64url").toString("utf-8"));
  } catch {
    return null;
  }
}

function extractProjectRef(url: string | undefined): string | null {
  if (!url) return null;
  try { return new URL(url).hostname.split(".")[0] || null; } catch { return null; }
}

function checkJwt(
  name: string,
  raw: string | undefined,
  expectedRole: "service_role" | "anon",
  expectedRef: string | null,
): Check {
  if (!raw) return { name, pass: false, detail: "env var missing" };
  const trimmed = raw.trim();
  const payload = decodeJwtPayload(trimmed);
  if (!payload) return { name, pass: false, detail: "not a decodable JWT" };
  if (payload.role !== expectedRole) {
    return { name, pass: false, detail: `role="${String(payload.role)}", expected "${expectedRole}"` };
  }
  if (!expectedRef) return { name, pass: false, detail: "supabase url missing" };
  if (payload.ref !== expectedRef) {
    return { name, pass: false, detail: "jwt ref does not match supabase url ref" };
  }
  return { name, pass: true, detail: `role=${expectedRole}, ref matches url, length=${trimmed.length}` };
}

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ status: "fail", error: "Unauthorized." }, { status: 401 });
  }

  const { NEXT_PUBLIC_SUPABASE_URL: supabaseUrl, SUPABASE_SERVICE_ROLE_KEY: serviceKey } = process.env;
  const { NEXT_PUBLIC_SUPABASE_ANON_KEY: anonKey, RESEND_API_KEY: resendKey } = process.env;
  const expectedRef = extractProjectRef(supabaseUrl);

  const checks: Check[] = [
    checkJwt("service_role_jwt", serviceKey, "service_role", expectedRef),
    checkJwt("anon_jwt", anonKey, "anon", expectedRef),
  ];

  // Secondary sanity: confirm the service_role JWT authenticates against
  // the target project. Catches JWTs that decode correctly but have been
  // rotated on the Supabase side or target the wrong project.
  let queryPass = false;
  let queryDetail = "skipped (service_role_jwt did not pass)";
  if (checks[0].pass && supabaseUrl && serviceKey) {
    try {
      const admin = createClient<Database>(supabaseUrl, serviceKey.trim(), {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const { error, count } = await admin
        .from("profiles")
        .select("id", { count: "exact", head: true });
      if (error) queryDetail = `query error: ${error.message}`;
      else { queryPass = true; queryDetail = `profiles head-count ok (count=${count ?? 0})`; }
    } catch (err) {
      queryDetail = `exception: ${err instanceof Error ? err.message : "unknown"}`;
    }
  }
  checks.push({ name: "service_role_query", pass: queryPass, detail: queryDetail });

  checks.push({
    name: "cron_secret_present",
    pass: secret.length >= 32,
    detail: `length=${secret.length}`,
  });

  const resendOk =
    !!resendKey && resendKey.startsWith("re_") && resendKey.length >= 30 && resendKey.length <= 50;
  checks.push({
    name: "resend_key_format",
    pass: resendOk,
    detail: resendKey ? `prefix=${resendKey.slice(0, 3)}, length=${resendKey.length}` : "env var missing",
  });

  const allPass = checks.every((c) => c.pass);
  return NextResponse.json(
    {
      status: allPass ? "ok" : "fail",
      checks,
      meta: {
        timestamp: new Date().toISOString(),
        deployment: process.env.VERCEL_DEPLOYMENT_ID ?? null,
      },
    },
    { status: allPass ? 200 : 500 },
  );
}
