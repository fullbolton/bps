/**
 * BPS Katman 2 — Contract Expiry Email Recall cron endpoint.
 *
 * Invoked once daily by Vercel Cron (see `vercel.json`). Bearer-auth'd
 * against `CRON_SECRET` so only the scheduler can trigger the run.
 *
 * Flow:
 *   1. Guard: feature flag + bearer check.
 *   2. Instantiate a service-role Supabase client (recipient enumeration
 *      across yönetici users + partner_company_assignments requires
 *      bypassing RLS; this is a system job, not a user action).
 *   3. Hand off to `runContractExpiryRecallBatch` which does the work.
 *   4. Return a compact JSON summary for the Vercel Cron logs.
 *
 * Scope discipline — this handler does NOT:
 *   - accept user input or render UI
 *   - create BPS surfaces, settings, badges, or inbox entities
 *   - retry, schedule sub-jobs, or chain into other domains
 *   - live outside `/api/cron/contract-expiry`
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { runContractExpiryRecallBatch } from "@/lib/email/contract-expiry-email";

// Force Node.js runtime — the service-role key and Resend transport both
// assume Node fetch semantics, and we want straightforward console logs
// in Vercel Function output rather than Edge constraints.
export const runtime = "nodejs";

// This endpoint is never cached; the cron schedule is the only trigger.
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  // 1. Feature flag. Default = disabled. Ops flips this to "true" only
  //    after DNS / DKIM / SPF / DMARC on the From domain are verified
  //    and the vendor account is warmed.
  if (process.env.BPS_CONTRACT_EXPIRY_EMAIL_ENABLED !== "true") {
    return NextResponse.json(
      {
        ok: true,
        skipped: true,
        reason: "BPS_CONTRACT_EXPIRY_EMAIL_ENABLED is not 'true'",
      },
      { status: 200 },
    );
  }

  // 2. Bearer-auth against CRON_SECRET. Vercel Cron automatically
  //    attaches this header on its side once the project env has the
  //    secret set. Rejecting unauthenticated requests prevents the
  //    public URL from being invoked by anyone other than the scheduler.
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { ok: false, error: "CRON_SECRET is not configured." },
      { status: 500 },
    );
  }
  const authHeader = request.headers.get("authorization") ?? "";
  if (authHeader !== `Bearer ${secret}`) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized." },
      { status: 401 },
    );
  }

  // 3. Service-role Supabase client. Required because recipient
  //    enumeration spans every yönetici profile in the org and every
  //    partner assignment — user-scoped RLS would hide most rows. The
  //    cron is a system-level job; service role is the correct actor.
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json(
      { ok: false, error: "Missing Supabase env vars." },
      { status: 500 },
    );
  }
  const adminClient = createClient<Database>(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 4. Run the batch. Errors per contract/recipient are captured in the
  //    result object, not thrown — the cron surface should always return
  //    200 with a summary unless something catastrophic happened.
  try {
    const result = await runContractExpiryRecallBatch(adminClient);
    console.log(
      `[cron/contract-expiry] evaluated=${result.contractsEvaluated} attempted=${result.recipientsAttempted} sent=${result.recipientsSent} skipped=${result.recipientsSkippedIdempotent} failed=${result.recipientsFailed}`,
    );
    if (result.errors.length > 0) {
      for (const e of result.errors) {
        console.error(`[cron/contract-expiry] ${e}`);
      }
    }
    return NextResponse.json({ ok: true, ...result }, { status: 200 });
  } catch (err) {
    console.error("[cron/contract-expiry] Unhandled:", err);
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
