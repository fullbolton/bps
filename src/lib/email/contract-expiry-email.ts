/**
 * BPS Katman 2 — Contract Expiry Email Recall V1.
 *
 * Daily batched event-triggered recall. Finds active contracts inside
 * the 30-day approaching-expiry window, enumerates recipients per the
 * V1 rule (yonetici globally + partner assigned to the contract's
 * company), and sends one Turkish operational alert per recipient.
 * Idempotency state in `contract_expiry_emails_sent` guarantees each
 * (contract, recipient, threshold=30) combination is sent at most once.
 *
 * Scope discipline:
 *   - One domain: contract expiry. No evrak, görev, risk, kritik tarih.
 *   - One threshold: 30 days (`getApproachingLevel("approaching")`).
 *   - No digest, no reply flow, no in-app surface, no opt-out UI.
 *   - contracts.responsible is display-only; NEVER used for routing.
 *
 * Execution model:
 *   - Called from the Vercel Cron Route Handler under service-role auth.
 *   - Service role is required to enumerate recipients (partner
 *     assignments across companies) — user sessions cannot see all
 *     yonetici emails by RLS. Cron is a system-level job, not a user
 *     action, so service-role bypass is correct here.
 *   - Errors per contract/recipient are logged and swallowed so the
 *     batch loop can finish.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, ContractRow } from "@/types/database.types";
import type { UserRole } from "@/context/AuthContext";
import { computeRemainingDays } from "@/lib/services/contracts";
import { sendEmail } from "./resend-transport";

type AdminClient = SupabaseClient<Database>;

/**
 * The single threshold for V1. Matches `getApproachingLevel("approaching")`
 * in `src/lib/services/contracts.ts` and the `<= 30` ternaries in the
 * Sözleşmeler list, Firma Detay, and Raporlar views. Any change here
 * must also update the CHECK constraint on `contract_expiry_emails_sent`.
 */
export const CONTRACT_EXPIRY_THRESHOLD_DAYS = 30;

export interface BatchRunResult {
  /** Total active contracts evaluated (inside the 30-day window). */
  contractsEvaluated: number;
  /** How many (contract, recipient) pairs were attempted this run. */
  recipientsAttempted: number;
  /** How many sends actually succeeded and were stamped as sent. */
  recipientsSent: number;
  /** How many were already stamped as sent and correctly skipped. */
  recipientsSkippedIdempotent: number;
  /** Recipients attempted but failed at transport or idempotency write. */
  recipientsFailed: number;
  /** Captured error messages, capped to avoid unbounded log growth. */
  errors: string[];
}

interface RecipientRow {
  id: string;
  email: string;
  display_name: string;
  role: UserRole;
}

interface ContractWithCompany {
  contract: ContractRow;
  companyName: string;
  remainingDays: number;
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

/**
 * Run one daily batch cycle.
 *
 * 1. Fetch active contracts with end_date inside `[0, 30]` days from now.
 * 2. For each, resolve the company name and enumerate recipients.
 * 3. For each (contract, recipient) pair, skip if already stamped; else
 *    send email and stamp on success.
 */
export async function runContractExpiryRecallBatch(
  client: AdminClient,
  now: Date = new Date(),
): Promise<BatchRunResult> {
  const result: BatchRunResult = {
    contractsEvaluated: 0,
    recipientsAttempted: 0,
    recipientsSent: 0,
    recipientsSkippedIdempotent: 0,
    recipientsFailed: 0,
    errors: [],
  };

  const fromAddress =
    process.env.BPS_EMAIL_FROM ?? "BPS Bildirim <bildirim@bpsys.net>";
  const appUrl = (process.env.BPS_APP_URL ?? "https://bpsys.net").replace(/\/$/, "");

  // 1. Fetch candidate contracts — active, non-null end_date. The date
  //    window is filtered client-side because Postgres can't compute
  //    computeRemainingDays (which has TZ-stable semantics) inside a
  //    single SQL predicate without duplicating logic. The candidate
  //    set is tiny in practice (contracts with end_date in the next
  //    month), so the client-side filter cost is negligible.
  const { data: contractRows, error: contractError } = await client
    .from("contracts")
    .select("*")
    .eq("status", "aktif")
    .not("end_date", "is", null);

  if (contractError) {
    result.errors.push(`contracts fetch failed: ${contractError.message}`);
    return result;
  }

  const candidates: ContractWithCompany[] = [];
  const companyIds = new Set<string>();
  for (const c of contractRows ?? []) {
    const remaining = computeRemainingDays(c.end_date, now);
    if (remaining === null) continue;
    if (remaining < 0 || remaining > CONTRACT_EXPIRY_THRESHOLD_DAYS) continue;
    candidates.push({ contract: c, companyName: "—", remainingDays: remaining });
    companyIds.add(c.company_id);
  }

  result.contractsEvaluated = candidates.length;
  if (candidates.length === 0) {
    return result;
  }

  // 2. Resolve company names in one round-trip.
  const { data: companyRows, error: companyError } = await client
    .from("companies")
    .select("id, name")
    .in("id", Array.from(companyIds));

  if (companyError) {
    result.errors.push(`companies fetch failed: ${companyError.message}`);
    return result;
  }

  const companyNameById = new Map<string, string>();
  for (const row of companyRows ?? []) {
    companyNameById.set(row.id, row.name);
  }
  for (const c of candidates) {
    c.companyName = companyNameById.get(c.contract.company_id) ?? "—";
  }

  // 3. Fetch all yonetici profiles once (global recipients, small set).
  const { data: yoneticiRows, error: yoneticiError } = await client
    .from("profiles")
    .select("id, email, display_name, role")
    .eq("role", "yonetici");

  if (yoneticiError) {
    result.errors.push(`yonetici fetch failed: ${yoneticiError.message}`);
    return result;
  }
  const yoneticiRecipients: RecipientRow[] = (yoneticiRows ?? []).filter(
    (p): p is RecipientRow => Boolean(p.email),
  );

  // 4. Pre-fetch partner assignments keyed by company.
  const { data: pcaRows, error: pcaError } = await client
    .from("partner_company_assignments")
    .select("partner_user_id, company_id")
    .in("company_id", Array.from(companyIds));

  if (pcaError) {
    result.errors.push(`partner_company_assignments fetch failed: ${pcaError.message}`);
    return result;
  }

  const partnerIdsByCompany = new Map<string, Set<string>>();
  const allPartnerIds = new Set<string>();
  for (const row of pcaRows ?? []) {
    let set = partnerIdsByCompany.get(row.company_id);
    if (!set) {
      set = new Set<string>();
      partnerIdsByCompany.set(row.company_id, set);
    }
    set.add(row.partner_user_id);
    allPartnerIds.add(row.partner_user_id);
  }

  // 5. Resolve partner profiles (filter by role = 'partner' as a
  //    defense-in-depth check — only profiles currently holding the
  //    partner role should receive the mail, even if an assignment
  //    row exists from a prior role change).
  let partnerProfileById = new Map<string, RecipientRow>();
  if (allPartnerIds.size > 0) {
    const { data: partnerRows, error: partnerError } = await client
      .from("profiles")
      .select("id, email, display_name, role")
      .in("id", Array.from(allPartnerIds))
      .eq("role", "partner");

    if (partnerError) {
      result.errors.push(`partner profiles fetch failed: ${partnerError.message}`);
      return result;
    }
    partnerProfileById = new Map(
      (partnerRows ?? [])
        .filter((p): p is RecipientRow => Boolean(p.email))
        .map((p) => [p.id, p]),
    );
  }

  // 6. Loop per contract × recipient. Per-recipient idempotency is
  //    enforced by attempting to write the stamp row BEFORE sending the
  //    email, with ON CONFLICT DO NOTHING + returning the written row.
  //    If the row already existed (zero rows returned), we treat this
  //    as "already sent" and skip without calling the vendor.
  //
  //    Writing-first is deliberately chosen over send-first-then-stamp
  //    so a crash between send and stamp cannot cause a duplicate send
  //    on the next run. A crash between stamp and send means a single
  //    recipient silently missed one mail — acceptable V1 trade. The
  //    next threshold tier (if ever added) would give a second chance.
  for (const c of candidates) {
    const recipients = dedupeRecipients([
      ...yoneticiRecipients,
      ...Array.from(partnerIdsByCompany.get(c.contract.company_id) ?? [])
        .map((pid) => partnerProfileById.get(pid))
        .filter((r): r is RecipientRow => r !== undefined),
    ]);

    for (const recipient of recipients) {
      result.recipientsAttempted++;

      const stampInsert = await client
        .from("contract_expiry_emails_sent")
        .insert({
          contract_id: c.contract.id,
          recipient_profile_id: recipient.id,
          threshold_days: CONTRACT_EXPIRY_THRESHOLD_DAYS,
        })
        .select("contract_id")
        .maybeSingle();

      if (stampInsert.error) {
        // Duplicate PK = idempotency skip (Postgres code 23505).
        // Any other error = real failure.
        const code = (stampInsert.error as { code?: string }).code;
        if (code === "23505") {
          result.recipientsSkippedIdempotent++;
          continue;
        }
        result.recipientsFailed++;
        pushError(
          result,
          `stamp insert failed for contract ${c.contract.id} / recipient ${recipient.id}: ${stampInsert.error.message}`,
        );
        continue;
      }
      if (!stampInsert.data) {
        // Unexpected — treat as skip to be safe.
        result.recipientsSkippedIdempotent++;
        continue;
      }

      const email = buildEmail({
        recipient,
        contract: c.contract,
        companyName: c.companyName,
        remainingDays: c.remainingDays,
        appUrl,
      });

      const send = await sendEmail({
        from: fromAddress,
        to: recipient.email,
        subject: email.subject,
        text: email.text,
        html: email.html,
      });

      if (!send.ok) {
        // Roll back the idempotency stamp so the next run retries.
        await client
          .from("contract_expiry_emails_sent")
          .delete()
          .eq("contract_id", c.contract.id)
          .eq("recipient_profile_id", recipient.id)
          .eq("threshold_days", CONTRACT_EXPIRY_THRESHOLD_DAYS);
        result.recipientsFailed++;
        pushError(
          result,
          `send failed for contract ${c.contract.id} / ${recipient.email}: ${send.error ?? "unknown"}`,
        );
        continue;
      }

      result.recipientsSent++;
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Template — static Turkish strings, marketing-free
// ---------------------------------------------------------------------------

interface EmailBuildInput {
  recipient: RecipientRow;
  contract: ContractRow;
  companyName: string;
  remainingDays: number;
  appUrl: string;
}

interface BuiltEmail {
  subject: string;
  text: string;
  html: string;
}

export function buildEmail(input: EmailBuildInput): BuiltEmail {
  const { contract, companyName, remainingDays, appUrl } = input;
  const endDateDisplay = formatDateTR(contract.end_date);
  const deepLink = `${appUrl}/sozlesmeler/${contract.id}`;

  const subject = `Sözleşme 30 gün içinde bitiyor — ${companyName}`;

  const responsibleLine =
    contract.responsible && contract.responsible.trim().length > 0
      ? `Sorumlu (kayıtlı): ${contract.responsible.trim()}\n`
      : "";

  const text = [
    `Firma: ${companyName}`,
    `Sözleşme: ${contract.name}`,
    `Bitiş tarihi: ${endDateDisplay}`,
    `Kalan gün: ${remainingDays}`,
    responsibleLine.trim(),
    "",
    `BPS'te görüntüle: ${deepLink}`,
    "",
    "Bu bildirim BPS'teki sözleşme sorumluluğunuzla ilgilidir.",
  ]
    .filter((line) => line !== "")
    .join("\n");

  // Minimal HTML. No marketing template system, no images, no tracking
  // pixels. Renders sensibly in any mail client; falls back to `text`
  // cleanly when HTML is stripped.
  const html = [
    `<p><strong>Firma:</strong> ${escapeHtml(companyName)}<br>`,
    `<strong>Sözleşme:</strong> ${escapeHtml(contract.name)}<br>`,
    `<strong>Bitiş tarihi:</strong> ${escapeHtml(endDateDisplay)}<br>`,
    `<strong>Kalan gün:</strong> ${remainingDays}`,
    contract.responsible && contract.responsible.trim().length > 0
      ? `<br><strong>Sorumlu (kayıtlı):</strong> ${escapeHtml(contract.responsible.trim())}`
      : "",
    `</p>`,
    `<p><a href="${escapeHtml(deepLink)}">BPS'te görüntüle</a></p>`,
    `<p style="color:#666;font-size:12px;">Bu bildirim BPS'teki sözleşme sorumluluğunuzla ilgilidir.</p>`,
  ].join("");

  return { subject, text, html };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function dedupeRecipients(rows: RecipientRow[]): RecipientRow[] {
  const seen = new Set<string>();
  const out: RecipientRow[] = [];
  for (const r of rows) {
    if (!r.email) continue;
    const key = r.email.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(r);
  }
  return out;
}

function formatDateTR(iso: string | null | undefined): string {
  if (!iso) return "—";
  const parts = iso.slice(0, 10).split("-");
  if (parts.length !== 3) return iso;
  const [y, m, d] = parts;
  return `${d}.${m}.${y}`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const MAX_CAPTURED_ERRORS = 20;

function pushError(result: BatchRunResult, message: string): void {
  if (result.errors.length < MAX_CAPTURED_ERRORS) {
    result.errors.push(message);
  }
}
