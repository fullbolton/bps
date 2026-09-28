import {requireOperationalText} from '@/lib/privacy/operational-text';
import { isUuid } from './pilot-validation';

export const COMMENT_MAX_CHARACTERS = 4000;
export const COMMENT_MAX_MENTIONS = 10;
export type CommentCommand = {
  commandId: string; actorId: string; tenantId: string; requestId: string;
  body: string; parentId: string | null; mentionIds: string[];
};

function invalid(): never { throw new Error('COMM_INPUT'); }
function uuid(value: unknown): string {
  if (!isUuid(value)) return invalid();
  return value.toLowerCase();
}

/** Input validation only. The RPC must independently authorize actor, source and recipients. */
export function parseCommentCommand(raw: unknown): CommentCommand {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return invalid();
  const v = raw as Record<string, unknown>;
  const keys = ['commandId', 'actorId', 'tenantId', 'requestId', 'body', 'parentId', 'mentionIds'];
  if (Object.keys(v).length !== keys.length || keys.some(k => !Object.hasOwn(v, k))) return invalid();
  if (typeof v.body !== 'string') return invalid();
  const body = v.body.replace(/\r\n?/g, '\n').trim();
  // PostgreSQL text cannot contain NUL; unpaired UTF-16 surrogates cannot safely round-trip UTF-8.
  if (!body || body.includes('\0') || /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(body) ||
      [...body].length > COMMENT_MAX_CHARACTERS) return invalid();
  if (!Array.isArray(v.mentionIds) || v.mentionIds.length > COMMENT_MAX_MENTIONS) return invalid();
  const mentionIds = [...new Set(v.mentionIds.map(uuid))].sort();
  return {
    commandId: uuid(v.commandId), actorId: uuid(v.actorId), tenantId: uuid(v.tenantId),
    requestId: uuid(v.requestId), body, parentId: v.parentId === null ? null : uuid(v.parentId), mentionIds,
  };
}

/** New submissions only; stored commands remain recoverable after policy changes. */
export function validateCommentCommand(raw: unknown): CommentCommand {
  const command = parseCommentCommand(raw);
  requireOperationalText(command.body);
  return command;
}

/** Stable identity for retry comparison, not a signature or authorization token. */
export function commentCommandIdentity(raw: unknown): string {
  return JSON.stringify(parseCommentCommand(raw));
}

/** A malformed RPC success must never clear a pending command or show "sent". */
export function parseCommentReceipt(raw: unknown, command: CommentCommand): { messageId: string } {
  const expected = parseCommentCommand(command);
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('COMM_RESPONSE');
  const r = raw as Record<string, unknown>;
  for (const key of ['commandId', 'actorId', 'tenantId', 'requestId'] as const) {
    if (!isUuid(r[key]) || r[key].toLowerCase() !== expected[key]) throw new Error('COMM_RESPONSE');
  }
  if (!isUuid(r.messageId)) throw new Error('COMM_RESPONSE');
  return { messageId: r.messageId.toLowerCase() };
}

export function parseCommentResolution(raw: unknown, command: CommentCommand): {status:'sent';messageId:string}|{status:'closed'} {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw Error('COMM_RESPONSE');
  const r=raw as Record<string,unknown>;
  if(r.status==='sent')return {status:'sent',...parseCommentReceipt(r,command)};
  if(r.status!=='closed')throw Error('COMM_RESPONSE');
  // Reuse the same strict scope check; a closed fence has no message ID.
  parseCommentReceipt({...r,messageId:command.commandId},command);
  return {status:'closed'};
}
