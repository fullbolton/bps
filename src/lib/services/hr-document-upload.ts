import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';
import { isUuid } from '@/lib/operations/pilot-validation';

type Context = { actor: string; tenant: string; employee: string };
export type HrUploadInput = {
  id: string; employmentId: string; title: string; size: number;
  sha256: string; validityDate: string | null;
};
type UploadState = 'pending' | 'published' | 'cancelled';
function record(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw Error('HR_UPLOAD_RESPONSE');
  return raw as Record<string, unknown>;
}
function envelope(raw: unknown, context: Context, employee = true) {
  const r = record(raw);
  if (![context.actor, context.tenant, context.employee].every(isUuid) || r.schemaVersion !== 1 ||
      r.actorId !== context.actor || r.tenantId !== context.tenant ||
      (employee && r.employeeId !== context.employee)) throw Error('HR_UPLOAD_RESPONSE');
  return r;
}
function upload(raw: unknown): HrUploadInput {
  const r = record(raw);
  if (!isUuid(r.id) || !isUuid(r.employmentId) || typeof r.title !== 'string' ||
      !r.title.trim() || r.title !== r.title.trim() || r.title.length > 160 || /[0-9]{11}|[\x00-\x1f\x7f]/.test(r.title) ||
      typeof r.size !== 'number' || !Number.isSafeInteger(r.size) || r.size < 5 || r.size > 10485760 ||
      typeof r.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(r.sha256)) throw Error('HR_UPLOAD_ROW');
  if (r.validityDate !== null && (typeof r.validityDate !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}$/.test(r.validityDate) || !Number.isFinite(Date.parse(r.validityDate)) ||
      new Date(r.validityDate).toISOString().slice(0, 10) !== r.validityDate ||
      r.validityDate < '1900-01-01' || r.validityDate > '2199-12-31')) throw Error('HR_UPLOAD_ROW');
  return { id: r.id, employmentId: r.employmentId, title: r.title, size: r.size,
    sha256: r.sha256, validityDate: r.validityDate as string | null };
}
export function parseHrUploadReceipt(raw: unknown, context: Context, expected: HrUploadInput) {
  const r = envelope(raw, context), item = upload(r), input = upload(expected);
  for (const key of Object.keys(input) as (keyof HrUploadInput)[]) {
    if (item[key] !== input[key]) throw Error('HR_UPLOAD_RECEIPT_MISMATCH');
  }
  if (!['pending', 'published', 'cancelled'].includes(String(r.state))) throw Error('HR_UPLOAD_RESPONSE');
  return { ...item, state: r.state as UploadState };
}
export function parseHrPendingUploads(raw: unknown, context: Context, after?: string) {
  const r = envelope(raw, context);
  if ((after !== undefined && !isUuid(after)) || !Array.isArray(r.uploads) || r.uploads.length > 50 ||
      typeof r.hasMore !== 'boolean' || (r.hasMore && r.uploads.length !== 50)) throw Error('HR_UPLOAD_RESPONSE');
  let previous = after ?? '';
  const uploads = r.uploads.map(rawItem => {
    const item = upload(rawItem), source = record(rawItem);
    if (item.id <= previous || typeof source.createdAt !== 'string' || !Number.isFinite(Date.parse(source.createdAt))) throw Error('HR_UPLOAD_ROW');
    previous = item.id;
    return { ...item, createdAt: source.createdAt };
  });
  return { uploads, hasMore: r.hasMore };
}
export async function prepareHrUpload(client: SupabaseClient<Database>, context: Context, input: HrUploadInput) {
  upload(input);
  const { data, error } = await client.rpc('hr_document_prepare_v1', {
    p_actor: context.actor, p_tenant: context.tenant, p_employee: context.employee,
    p_id: input.id, p_employment: input.employmentId, p_title: input.title,
    p_size: input.size, p_sha256: input.sha256, p_validity: input.validityDate ?? undefined,
  }).abortSignal(AbortSignal.timeout(12000));
  if (error) throw error;
  return parseHrUploadReceipt(data, context, input);
}
export async function loadHrPendingUploads(client: SupabaseClient<Database>, context: Context, after?: string) {
  const { data, error } = await client.rpc('hr_document_pending_v1', {
    p_actor: context.actor, p_tenant: context.tenant, p_employee: context.employee, p_after: after,
  }).abortSignal(AbortSignal.timeout(12000));
  if (error) throw error;
  return parseHrPendingUploads(data, context, after);
}
export async function cancelEmptyHrUpload(client: SupabaseClient<Database>, context: Context, id: string) {
  if (!isUuid(id)) throw Error('HR_UPLOAD_INPUT');
  const { data, error } = await client.rpc('hr_document_cancel_empty_v1', {
    p_actor: context.actor, p_tenant: context.tenant, p_id: id,
  }).abortSignal(AbortSignal.timeout(12000));
  if (error) throw error;
  const r = envelope(data, context, false);
  if (r.id !== id || r.state !== 'cancelled') throw Error('HR_UPLOAD_RESPONSE');
  return { id, state: 'cancelled' as const };
}
