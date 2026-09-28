import { enabledNotificationTenants } from "./task-module-access";
import {readTenantRoleDirectory,tenantCompanyRecipients,sameRecipientMembership,type TenantRoleDirectory} from './tenant-role-recipients';
/**
 * BPS Katman 2 — Contract Expiry Email Recall V1.
 *
 * Daily batched event-triggered recall. Finds active contracts inside
 * the 30-day approaching-expiry window, enumerates recipients per the
 * V1 rule (yonetici globally + partner assigned to the contract's
 * company), and sends one Turkish operational alert per recipient.
 * Idempotency state moved to `notification_log` (2026-08-27) — the old
 * `contract_expiry_emails_sent` table is retired and its rows were backfilled
 * by `20260827000200`. The key is the same triple, generalised with a kind:
 * (kind='contract_expiry', entity_id=contract, recipient, threshold_key='30d')
 * is sent at most once. The write order is unchanged: STAMP FIRST, SEND
 * SECOND, roll the stamp back if the send fails.
 *
 * Scope discipline:
 *   - One domain: contract expiry. Other kinds live in notification-batches.ts.
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
 *     batch loop can finish. One exception: a FAILED ROLLBACK is reported
 *     loudly, because that row would sit as "sent" forever and its mail
 *     would never go out.
 *
 * KNOWN DUPLICATION: this file keeps its own email-based
 * `dedupeRecipients` while `notification-recipients.ts` defines equivalents.
 * They are NOT identical — this one dedupes by e-mail address, the shared one
 * by profile id. Two profiles sharing an address would get one mail here and
 * two there. Left as-is deliberately (surgical change; this flow was not
 * refactored), recorded as a follow-up in TASK_ROADMAP.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { computeRemainingDays } from "@/lib/calendar-date";
import { readNotificationCompanyNames } from "./company-names";
import { readExpiryContracts, type ExpiryContract } from "./contract-candidates";
import { sendEmail } from "./resend-transport";
import { stampNotification, rollbackStamp } from "./notification-log";
import {
  NOTIFICATION_THRESHOLDS,
  NOTIFICATION_RECIPIENTS,
} from "@/lib/notification-kinds";
import { loadTenantScope } from "./notification-recipients";
import { readContractRecipients, type ContractRecipient as RecipientRow } from "./contract-recipients";
import { safeSendError } from "./safe-error";

type AdminClient = SupabaseClient<Database>;

/**
 * The single threshold for V1. Matches `getApproachingLevel("approaching")`
 * in `src/lib/services/contracts.ts` and the `<= 30` ternaries in the
 * Sözleşmeler list, Firma Detay, and Raporlar views.
 *
 * Changing this value no longer touches a CHECK constraint: the retired
 * `contract_expiry_emails_sent` pinned it with `CHECK (threshold_days = 30)`,
 * but `notification_log` stores a free-form `threshold_key` and constrains
 * only `kind`. What DOES matter is that `threshold_key` is part of the
 * idempotency primary key — changing `NOTIFICATION_THRESHOLDS.contract_expiry`
 * makes every past send look unsent and re-mails it. Change deliberately.
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
  /** Alıcının üye olmadığı tenant'a ait olduğu için düşen alıcı sayısı. */
  recipientsDroppedCrossTenant: number;
  /** Recipients attempted but failed at transport or idempotency write. */
  recipientsFailed: number;
  /** Captured error messages, capped to avoid unbounded log growth. */
  errors: string[];
}


interface ContractWithCompany {
  contract: ExpiryContract;
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
 * 3. For each (contract, recipient) pair: drop it if the recipient is not a
 *    member of the contract's tenant, skip it if already stamped, otherwise
 *    STAMP FIRST and then send — rolling the stamp back if the send fails.
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
    recipientsDroppedCrossTenant: 0,
    recipientsFailed: 0,
    errors: [],
  };

  const fromAddress =
    process.env.BPS_EMAIL_FROM ?? "BPS Bildirim <bildirim@bpsys.net>";
  const appUrl = (process.env.BPS_APP_URL ?? "https://bpsys.net").replace(
    /\/$/,
    "",
  );

  // Read every active dated contract before applying the existing TZ-stable
  // date calculation. A server cap must not hide the final candidate.
  let contractRows: ExpiryContract[];
  try {
    contractRows = await readExpiryContracts(client);
    const enabled = await enabledNotificationTenants(client, contractRows.map(row => row.tenant_id), "contracts");
    contractRows = contractRows.filter(row => enabled.has(row.tenant_id));
  } catch {
    result.errors.push("contracts fetch failed: code=READ_INCOMPLETE");
    return result;
  }

  const candidates: ContractWithCompany[] = [];
  const companyIds = new Set<string>();
  for (const c of contractRows) {
    const remaining = computeRemainingDays(c.end_date, now);
    if (remaining === null) continue;
    if (remaining < 0 || remaining > CONTRACT_EXPIRY_THRESHOLD_DAYS) continue;
    candidates.push({
      contract: c,
      companyName: "—",
      remainingDays: remaining,
    });
    companyIds.add(c.company_id);
  }

  result.contractsEvaluated = candidates.length;
  if (candidates.length === 0) {
    return result;
  }

  let companyNameById: Map<string, string>;
  try {
    companyNameById = await readNotificationCompanyNames(client, candidates.map(c => ({companyId: c.contract.company_id, tenantId: c.contract.tenant_id})), "contracts");
  } catch {
    result.errors.push("companies fetch failed: code=READ_INCOMPLETE");
    return result;
  }
  for (const c of candidates) c.companyName = companyNameById.get(c.contract.company_id)!;

  const ceStrategy = NOTIFICATION_RECIPIENTS.contract_expiry;
  const includePartners = ceStrategy.mode === "company" ? ceStrategy.includePartners : false;
  let recipientsByCompany: Map<string, RecipientRow[]>;
  let directory:TenantRoleDirectory|undefined;
  try {
    if(process.env.NEXT_PUBLIC_BPS_MULTI_WORKSPACE_ENABLED==='true'){
     directory=await readTenantRoleDirectory(client);
     recipientsByCompany=await tenantCompanyRecipients(client,directory,candidates.map(c=>({companyId:c.contract.company_id,tenantId:c.contract.tenant_id})),includePartners,false);
    }else recipientsByCompany = await readContractRecipients(client, [...companyIds], includePartners);
  } catch {
    result.errors.push("contract recipients fetch failed: code=READ_INCOMPLETE");
    return result;
  }

  // 6. Loop per contract × recipient. Per-recipient idempotency is enforced by
  //    writing the stamp row into `notification_log` BEFORE sending. The insert
  //    is a plain INSERT: a duplicate raises Postgres 23505, which
  //    `stampNotification` reports as "already_sent" and we skip without
  //    calling the vendor. (There is no ON CONFLICT clause — the error IS the
  //    signal.)
  //
  //    Stamp-first is deliberately chosen over send-first-then-stamp so a
  //    crash between the two cannot cause a duplicate send on the next run. A crash between stamp and send means a single
  //    recipient silently missed one mail — acceptable V1 trade. The
  //    next threshold tier (if ever added) would give a second chance.
  // TENANT KAPSAMI. `profiles`'ta tenant_id olmadığı için "bütün yönetici
  // profilleri" sorgusu bütün tenant'ları getirir; filtre olmadan her yönetici
  // BAŞKA tenant'ların sözleşme bildirimlerini alırdı. Harita yüklenemezse
  // hiç mail gönderilmez (fail-closed) — sızdırmaktansa bir koşu kaçmak.
  const { scope, error: scopeError } = await loadTenantScope(client);
  if (scopeError) result.errors.push(scopeError);
  if (!scope.loaded) {
    result.errors.push(
      "tenant scope unavailable — hiç mail gönderilmedi (fail-closed)",
    );
    return result;
  }

  if(directory){
   try{const fresh=await readTenantRoleDirectory(client);const original=scope.isMember;scope.isMember=(tenant,id)=>original(tenant,id)&&sameRecipientMembership(directory!,fresh,tenant,id);}
   catch{result.errors.push('tenant roles unavailable; no email sent');return result;}
  }
  for (const c of candidates) {
    // Scope before email deduplication: a same-address profile in another
    // tenant must not suppress an eligible recipient for this contract.
    const scopedRecipients = (recipientsByCompany.get(c.contract.company_id) ?? []).filter(recipient => {
      if (scope.isMember(c.contract.tenant_id, recipient.id)) return true;
      result.recipientsDroppedCrossTenant++;
      return false;
    });
    const recipients = dedupeRecipients(scopedRecipients);

    for (const recipient of recipients) {
      result.recipientsAttempted++;

      // Ledger moved to `notification_log` (2026-08-27). Same key shape,
      // generalised: (kind, entity_id, recipient, threshold_key). The write
      // order is unchanged — stamp first, send second, roll back on failure.
      const stampKey = {
        kind: "contract_expiry" as const,
        entityId: c.contract.id,
        recipientProfileId: recipient.id,
        thresholdKey: NOTIFICATION_THRESHOLDS.contract_expiry,
        tenantId: c.contract.tenant_id,
      };
      try {
        if (!(await enabledNotificationTenants(client, [c.contract.tenant_id], "contracts")).has(c.contract.tenant_id)) continue;
      } catch { result.errors.push("contract modules unavailable before stamp; no email sent"); continue; }
      const stamp = await stampNotification(client, stampKey);
      if (stamp.status === "already_sent") {
        result.recipientsSkippedIdempotent++;
        continue;
      }
      if (stamp.status === "failed") {
        result.recipientsFailed++;
        pushError(
          result,
          `stamp insert failed for contract ${c.contract.id} / recipient ${recipient.id}: ${stamp.error}`,
        );
        continue;
      }

      // Delivery cannot share a SQL lock; do not promise recall of in-flight email.
      let enabled = false;
      try { enabled = (await enabledNotificationTenants(client, [c.contract.tenant_id], "contracts")).has(c.contract.tenant_id); }
      catch { result.errors.push("contract modules unavailable before send; no email sent"); }
      if (!enabled) {
        const rollback = await rollbackStamp(client, stampKey);
        if (!rollback.ok) result.errors.push(`ROLLBACK FAILED (contract module/${c.contract.id}/${recipient.id}): ${rollback.error ?? "unknown"}`);
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
        // Roll back the idempotency stamp so the next run retries. A failed
        // rollback is NOT swallowed: that row would sit as "sent" forever and
        // the mail would never go out.
        const rb = await rollbackStamp(client, stampKey);
        if (!rb.ok) {
          pushError(
            result,
            `ROLLBACK FAILED for contract ${c.contract.id} / recipient ${recipient.id}: ${rb.error ?? "unknown"} — bu kalem bir daha denenmeyecek`,
          );
        }
        result.recipientsFailed++;
        pushError(
          result,
          `send failed for contract ${c.contract.id} / profile ${recipient.id}: ${safeSendError(send)}`,
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
  contract: ExpiryContract;
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
    "Bu bildirim, yaklaşan bitiş tarihi nedeniyle BPS tarafından gönderildi.",
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
    `<p style="color:#666;font-size:12px;">Bu bildirim, yaklaşan bitiş tarihi nedeniyle BPS tarafından gönderildi.</p>`,
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
