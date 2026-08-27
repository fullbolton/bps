/**
 * BPS service layer — Dashboard "Duyurular" (Batch 10 Phase 2).
 *
 *     UI Component (Dashboard Duyurular strip)
 *         |
 *     src/lib/services/announcements.ts     <- THIS FILE -- business logic
 *         |
 *     src/lib/supabase/announcements.ts     <- raw CRUD only
 *         |
 *     Supabase Postgres + RLS
 *
 * Invariants enforced here (mirrored by DB constraints / RLS):
 *   - NOT firm-scoped. Partner scope does NOT apply — there is no company_id.
 *   - Broad-read within the tenant; create/delete is yonetici-only.
 *   - One-directional: no reply, no reaction, no recipient, no read-state.
 *   - NO EDIT PATH. Correction is delete-and-repost, by design.
 *   - body must be non-blank.
 *
 * Error surface:
 *   - AnnouncementValidationError -- blank body, body over the length cap
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Database,
  AnnouncementRow,
  AnnouncementInsert,
} from "@/types/database.types";
import {
  selectRecentAnnouncements,
  insertAnnouncement,
  deleteAnnouncement,
} from "@/lib/supabase/announcements";

type Client = SupabaseClient<Database>;

// ---------------------------------------------------------------------------
// Policy constants
// ---------------------------------------------------------------------------

/**
 * How many announcements the Dashboard strip shows.
 *
 * Batch 10 Phase 2 specifies a "compact one-directional strip" without naming
 * a number. Three keeps the strip compact and is the only ageing rule in the
 * feature: there is no expiry column and no archive — older announcements
 * simply fall off the end of the read.
 */
export const ANNOUNCEMENT_STRIP_LIMIT = 3;

/**
 * Upper bound on announcement text.
 *
 * The DB only enforces non-blank. This cap is a UI-integrity rule, not a
 * security boundary: the strip renders inline, so an unbounded body would
 * push the rest of the Dashboard down.
 */
export const ANNOUNCEMENT_MAX_LENGTH = 500;

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class AnnouncementValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AnnouncementValidationError";
  }
}

// ---------------------------------------------------------------------------
// UI-facing input shapes
// ---------------------------------------------------------------------------

export interface AnnouncementCreateInput {
  body: string;
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/**
 * Read the announcements for the Dashboard strip, newest first.
 *
 * Tenant scoping is RLS's job, not this function's.
 */
export async function listRecentAnnouncements(
  client: Client,
  limit: number = ANNOUNCEMENT_STRIP_LIMIT,
): Promise<AnnouncementRow[]> {
  return selectRecentAnnouncements(client, limit);
}

// ---------------------------------------------------------------------------
// Writes -- create (yonetici-only, enforced by RLS)
// ---------------------------------------------------------------------------

/**
 * Create an announcement.
 *
 * Behavior:
 *   - Validates body (non-blank, within the length cap).
 *   - Stamps created_by from the auth session.
 *   - tenant_id is supplied by the caller, server-resolved. It is never read
 *     from a client payload -- see the dashboard server action.
 */
export async function createAnnouncement(
  client: Client,
  input: AnnouncementCreateInput,
  options: { tenantId: string },
): Promise<AnnouncementRow> {
  const body = input.body.trim();
  if (body.length === 0) {
    throw new AnnouncementValidationError("Duyuru metni bos olamaz.");
  }
  if (body.length > ANNOUNCEMENT_MAX_LENGTH) {
    throw new AnnouncementValidationError(
      `Duyuru metni en fazla ${ANNOUNCEMENT_MAX_LENGTH} karakter olabilir.`,
    );
  }

  const {
    data: { user },
  } = await client.auth.getUser();

  const payload: AnnouncementInsert = {
    tenant_id: options.tenantId,
    body,
    created_by: user?.id ?? null,
  };

  return insertAnnouncement(client, payload);
}

// ---------------------------------------------------------------------------
// Writes -- delete (yonetici-only, enforced by RLS)
// ---------------------------------------------------------------------------

/**
 * Remove an announcement.
 *
 * This is the ONLY correction path. Announcements carry no edit route, so a
 * mistyped announcement is removed and reposted rather than amended.
 */
export async function removeAnnouncement(
  client: Client,
  id: string,
): Promise<void> {
  return deleteAnnouncement(client, id);
}
