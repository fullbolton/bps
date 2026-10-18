import { isUuid } from '@/lib/operations/pilot-validation';
import { isWorkDate } from '@/lib/operations/daily-demand';
import { assertInboxScope, inboxScopeKey, parseSoundLedger, planSound, type InboxScope } from './inbox-state';

export type InboxKind = 'task_assignment' | 'announcement' | 'conversation';
export type InboxCursor = { kind: InboxKind; id: string };
type Base = InboxCursor & { createdAt: string; readAt: string | null };
export type WorkspaceInboxItem = Base & (
  | { kind: 'task_assignment'; payload: { taskId: string; title: string } }
  | { kind: 'announcement'; payload: { announcementId: string; body: string } }
  | { kind: 'conversation'; payload: { requestId: string; companyId: string; companyName: string; workDate: string; body: string } }
);
export type WorkspaceInbox = InboxScope & { unread: number; items: WorkspaceInboxItem[]; nextCursor: InboxCursor | null };
const object = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);
const kind = (v: unknown): v is InboxKind => v === 'task_assignment' || v === 'announcement' || v === 'conversation';
const stamp = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(v) && isWorkDate(v.slice(0, 10)) && Number.isFinite(Date.parse(v));
const text = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;
function fail(): never { throw new Error('INBOX_RESPONSE'); }
export function inboxEventKey(event: InboxCursor): string {
  if (!kind(event.kind) || !isUuid(event.id)) return fail();
  return `${event.kind}:${event.id}`;
}
export function parseInboxCursor(value: unknown): InboxCursor | null {
  if (value === null) return null;
  if (!object(value) || !kind(value.kind) || !isUuid(value.id)) return fail();
  return { kind: value.kind, id: value.id };
}
function parseItem(value: unknown): WorkspaceInboxItem {
  if (!object(value) || !kind(value.kind) || !isUuid(value.id) || !stamp(value.created_at)
    || (value.read_at !== null && !stamp(value.read_at)) || !object(value.payload)) return fail();
  const base = { id: value.id, createdAt: value.created_at, readAt: value.read_at };
  const p = value.payload;
  switch (value.kind) {
    case 'task_assignment':
      if (!isUuid(p.taskId) || !text(p.title)) return fail();
      return { ...base, kind: value.kind, payload: { taskId: p.taskId, title: p.title } };
    case 'announcement':
      if (!isUuid(p.announcementId) || !text(p.body)) return fail();
      return { ...base, kind: value.kind, payload: { announcementId: p.announcementId, body: p.body } };
    case 'conversation':
      if (!isUuid(p.requestId) || !isUuid(p.companyId) || !text(p.companyName) || !isWorkDate(p.workDate) || !text(p.body)) return fail();
      return { ...base, kind: value.kind, payload: { requestId: p.requestId, companyId: p.companyId, companyName: p.companyName, workDate: p.workDate, body: p.body } };
  }
}
/** Never display a partial source result, a guessed count, or a previous company's response. */
export function parseWorkspaceInbox(value: unknown, expected: InboxScope): WorkspaceInbox {
  inboxScopeKey(expected);
  if (!object(value) || !isUuid(value.actorId) || !isUuid(value.tenantId)
    || typeof value.unread !== 'number' || !Number.isSafeInteger(value.unread) || value.unread < 0
    || !Array.isArray(value.items) || value.items.length > 30) return fail();
  assertInboxScope({ actorId: value.actorId, tenantId: value.tenantId }, expected);
  const items = value.items.map(parseItem);
  if (new Set(items.map(inboxEventKey)).size !== items.length || items.filter(x => x.readAt === null).length > value.unread) return fail();
  const nextCursor = parseInboxCursor(value.nextCursor);
  if (nextCursor && (items.length !== 30 || inboxEventKey(nextCursor) !== inboxEventKey(items[29]))) return fail();
  return { actorId: value.actorId, tenantId: value.tenantId, unread: value.unread, items, nextCursor };
}
/** Scoped component must reset previous to null on account/company change. */
export function observeWorkspaceInbox(previous: readonly string[] | null, items: readonly WorkspaceInboxItem[]) {
  const known = new Set(previous ?? []);
  return {
    fresh: previous === null ? [] : items.filter(x => x.readAt === null && !known.has(inboxEventKey(x))).map(inboxEventKey),
    seen: [...new Set([...items.map(inboxEventKey), ...(previous ?? [])])].slice(0, 300),
  };
}

/** Separate storage/lock namespace prevents old UUID-only ledgers from swallowing
 * another source's event. No bodies, titles or user names are persisted. */
export function isWorkspaceEventKey(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const parts = value.split(':');
  return parts.length === 2 && kind(parts[0]) && isUuid(parts[1]);
}
export async function playWorkspaceInboxSoundOnce(
  scope: InboxScope, ids: readonly string[],
  storage: Pick<Storage, 'getItem' | 'setItem'>,
  locks: { request<T>(name: string, callback: () => Promise<T> | T): Promise<T> },
  play: () => boolean, now = Date.now(),
): Promise<boolean> {
  const key = 'bps:workspace-inbox-sound:v1:' + inboxScopeKey(scope);
  if (!locks?.request) throw Error('SOUND_UNAVAILABLE');
  return locks.request(key, () => {
    const next = planSound(parseSoundLedger(storage.getItem(key), isWorkspaceEventKey), ids, now, isWorkspaceEventKey);
    if (next.play) next.ledger.lastSoundAt = now;
    storage.setItem(key, JSON.stringify(next.ledger));
    return next.play && play();
  });
}
