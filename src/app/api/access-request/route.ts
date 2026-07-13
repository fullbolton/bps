/**
 * BPS — Access request submission Route Handler.
 *
 * Server-side controlled path for the public "Erişim Talebi" form on the
 * login page. Mirrors `/api/demo-request` one-to-one:
 *   1. Honeypot field check ("website")
 *   2. IP-based rate limiting (best-effort, in-memory)
 *   3. Server-side validation (length caps + basic email shape)
 *
 * The insert runs via service role, so the anon INSERT policy/grant on
 * `access_requests` can be dropped (see the companion migration
 * `..._close_access_requests_public_insert.sql`). This closes the
 * unauthenticated direct-write surface the login page used before.
 *
 * DEPLOY ORDER: ship this route + the login change FIRST, then apply the
 * migration. Applying the migration while the old browser-anon-insert
 * login is still live in prod would break access requests.
 *
 * `birim` is stamped "diger" server-side (yönetici assigns the real unit
 * in Ayarlar > Erişim Talepleri), matching the previous login behavior.
 * No new columns, no new behavior beyond moving the write server-side.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Rate limit — in-memory, best-effort, V1 only (same shape as demo-request)
// ---------------------------------------------------------------------------

const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT_MAX = 3; // max submissions per window per IP

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX) return false;
  entry.count++;
  return true;
}

let lastCleanup = Date.now();
function cleanupRateLimitMap() {
  const now = Date.now();
  if (now - lastCleanup < 60_000) return;
  lastCleanup = now;
  for (const [ip, entry] of rateLimitMap) {
    if (now > entry.resetAt) rateLimitMap.delete(ip);
  }
}

// Single-line basic email shape — same convention as demo-request / import.
const BASIC_EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

// ---------------------------------------------------------------------------
// Supabase admin client (service role, narrow usage)
// ---------------------------------------------------------------------------

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing Supabase env vars for access request handler");
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

    // 1. Honeypot check — if "website" is populated, it's a bot. Fake success.
    if (body.website != null && String(body.website).trim().length > 0) {
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

    // 3. Server-side validation. Length caps because this is an
    //    unauthenticated write through service_role (RLS bypassed).
    const fullName = String(body.full_name ?? "").trim().slice(0, 200);
    const email = String(body.email ?? "").trim().toLowerCase().slice(0, 320);

    if (!fullName || !email || !BASIC_EMAIL.test(email)) {
      return NextResponse.json(
        { success: false, error: "Lutfen ad soyad ve gecerli bir e-posta girin." },
        { status: 400 },
      );
    }

    // 4. Insert via service role (bypasses RLS). birim defaulted to "diger"
    //    server-side; yönetici assigns the real unit in Ayarlar.
    const supabase = getAdminClient();
    const { error } = await supabase.from("access_requests").insert({
      full_name: fullName,
      email,
      birim: "diger",
    });

    if (error) {
      // Unique-email collision → distinguishable so the login form can
      // show "zaten mevcut" instead of a generic failure.
      if (
        error.code === "23505" ||
        error.message?.includes("duplicate") ||
        error.message?.includes("unique")
      ) {
        return NextResponse.json(
          { success: false, code: "duplicate", error: "Bu e-posta ile bekleyen bir talep zaten mevcut." },
          { status: 409 },
        );
      }
      console.error("[access-request] Insert failed:", error.message);
      return NextResponse.json(
        { success: false, error: "Gonderim basarisiz. Lutfen tekrar deneyin." },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    console.error("[access-request] Unexpected error:", err);
    return NextResponse.json(
      { success: false, error: "Sunucu hatasi. Lutfen tekrar deneyin." },
      { status: 500 },
    );
  }
}
