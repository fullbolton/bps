/**
 * BPS — Resend transactional email transport.
 *
 * Thin wrapper around the Resend REST API. Direct fetch against
 * https://api.resend.com/emails — no npm dependency added, no SDK
 * version coupling. Resend's REST surface is versioned-by-URL and
 * stable; the shape used here (from / to / subject / text / html)
 * has been consistent since initial GA.
 *
 * This module is SERVER-ONLY. It must never be imported into a client
 * component, because RESEND_API_KEY is a server-side secret.
 *
 * Scope discipline:
 *   - One function: sendEmail(...). No batching, no templating engine,
 *     no retry logic, no bounce webhook handler.
 *   - No attachments in V1. `html` + `text` only.
 *   - No reply-to. From address should be a no-reply / bildirim mailbox.
 *   - Errors are returned, not thrown — the caller is the cron batch
 *     loop which must continue on per-recipient failure.
 */

export interface SendEmailInput {
  /** "BPS Bildirim <bildirim@bpsys.net>" style display-name + address. */
  from: string;
  to: string;
  subject: string;
  /** Plain-text body. Required — always rendered. */
  text: string;
  /** Optional minimal HTML body. No marketing template system. */
  html?: string;
}

export interface SendEmailResult {
  ok: boolean;
  /** Resend's email id on success. */
  id?: string;
  /** Vendor error message when ok = false. */
  error?: string;
  /** HTTP status, useful in logs. */
  status?: number;
}

/**
 * Send a single transactional email via Resend.
 *
 * Returns `{ ok: false, error }` for any failure (missing key,
 * vendor error, network) so the caller can log and continue.
 * Never throws.
 */
export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return {
      ok: false,
      error: "RESEND_API_KEY is not set — transport disabled.",
    };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: input.from,
        to: input.to,
        subject: input.subject,
        text: input.text,
        ...(input.html ? { html: input.html } : {}),
      }),
    });

    const status = response.status;

    if (!response.ok) {
      let message = `Resend HTTP ${status}`;
      try {
        const payload = (await response.json()) as { message?: string; error?: string };
        message = payload.message ?? payload.error ?? message;
      } catch {
        // ignore — body wasn't JSON
      }
      return { ok: false, error: message, status };
    }

    const payload = (await response.json()) as { id?: string };
    return { ok: true, id: payload.id, status };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Unknown transport error",
    };
  }
}
