/**
 * BPS — Demo request submission Route Handler.
 *
 * Server-side controlled path for public demo request form.
 * Three protection layers:
 *   1. Honeypot field check
 *   2. IP-based rate limiting (best-effort, in-memory)
 *   3. Server-side validation
 *
 * Only accepted submissions reach demo_requests table.
 * Uses service role for the narrow insert — anon insert policy
 * is removed separately.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Rate limit — in-memory, best-effort, V1 only
// ---------------------------------------------------------------------------

const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT_MAX = 3; // max submissions per window per IP

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true; // allowed
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    return false; // blocked
  }

  entry.count++;
  return true; // allowed
}

// Periodic cleanup to prevent memory leak (runs lazily)
let lastCleanup = Date.now();
function cleanupRateLimitMap() {
  const now = Date.now();
  if (now - lastCleanup < 60_000) return; // cleanup at most once per minute
  lastCleanup = now;
  for (const [ip, entry] of rateLimitMap) {
    if (now > entry.resetAt) rateLimitMap.delete(ip);
  }
}

// ---------------------------------------------------------------------------
// Supabase admin client (service role, narrow usage)
// ---------------------------------------------------------------------------

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing Supabase env vars for demo request handler");
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// ---------------------------------------------------------------------------
// Route Handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    cleanupRateLimitMap();

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: "Gecersiz istek formati." },
        { status: 400 },
      );
    }
    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { success: false, error: "Gecersiz istek formati." },
        { status: 400 },
      );
    }

    // 1. Honeypot check — if "website" field is populated, it's a bot
    if (body.website != null && String(body.website).trim().length > 0) {
      // Fake success — bot thinks submission worked
      return NextResponse.json({ success: true }, { status: 200 });
    }

    // 2. Rate limit check
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      ?? request.headers.get("x-real-ip")
      ?? "unknown";

    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { success: false, error: "Cok fazla talep gonderdiniz. Lutfen birkac dakika sonra tekrar deneyin." },
        { status: 429 },
      );
    }

    // 3. Server-side validation
    const fullName = String(body.full_name ?? "").trim();
    const companyName = String(body.company_name ?? "").trim();
    const email = String(body.email ?? "").trim();

    if (!fullName || !companyName || !email || !email.includes("@")) {
      return NextResponse.json(
        { success: false, error: "Lutfen zorunlu alanlari doldurun." },
        { status: 400 },
      );
    }

    // 4. Insert via service role (bypasses RLS)
    const supabase = getAdminClient();
    const { error } = await supabase.from("demo_requests").insert({
      full_name: fullName,
      company_name: companyName,
      email,
      phone: typeof body.phone === "string" ? body.phone.trim() || null : null,
      sector: typeof body.sector === "string" ? body.sector || null : null,
      company_size: typeof body.company_size === "string" ? body.company_size || null : null,
      message: typeof body.message === "string" ? body.message.trim() || null : null,
    });

    if (error) {
      console.error("[demo-request] Insert failed:", error.message);
      return NextResponse.json(
        { success: false, error: "Gonderim basarisiz. Lutfen tekrar deneyin." },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    console.error("[demo-request] Handler error:", err);
    return NextResponse.json(
      { success: false, error: "Beklenmeyen bir hata olustu." },
      { status: 500 },
    );
  }
}
