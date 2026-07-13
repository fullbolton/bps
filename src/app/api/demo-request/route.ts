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

// Single-line basic email shape — same convention as the import layer.
const BASIC_EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

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
        { success: false, error: "Cok fazla talep gonderdiniz. Lutfen 15 dakika kadar sonra tekrar deneyin." },
        { status: 429 },
      );
    }

    // 3. Server-side validation. Length caps matter because this is an
    //    unauthenticated write through service_role (RLS bypassed): the
    //    table only enforces non-blank, so without caps a caller could
    //    persist multi-megabyte payloads into the review queue.
    const fullName = String(body.full_name ?? "").trim().slice(0, 200);
    const companyName = String(body.company_name ?? "").trim().slice(0, 200);
    const email = String(body.email ?? "").trim().slice(0, 320);

    if (!fullName || !companyName || !email || !BASIC_EMAIL.test(email)) {
      return NextResponse.json(
        { success: false, error: "Lutfen zorunlu alanlari doldurun." },
        { status: 400 },
      );
    }

    const bounded = (v: unknown, max: number) =>
      typeof v === "string" ? v.trim().slice(0, max) || null : null;

    // 4. Insert via service role (bypasses RLS)
    const supabase = getAdminClient();
    const { error } = await supabase.from("demo_requests").insert({
      full_name: fullName,
      company_name: companyName,
      email,
      phone: bounded(body.phone, 40),
      sector: bounded(body.sector, 100),
      company_size: bounded(body.company_size, 100),
      message: bounded(body.message, 4000),
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
