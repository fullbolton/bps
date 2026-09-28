import { moduleAccessMessage } from "@/lib/modules/errors";
import { completePages } from "./complete-pages";
/** Company note reads and scoped command transport.
 * Role, ownership, author identity and field constraints are enforced in SQL.
 * This layer rejects failed, missing and mismatched command responses.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, NoteRow } from "@/types/database.types";

type Client = SupabaseClient<Database>;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Read every note for a single company, pinned first then newest first.
 *
 * Ordering follows the pinned/newest display contract. Index-only execution
 * is not assumed: this query reads the full row.
 *
 * The Firma Detay Notlar tab uses this directly. The Genel Bakış
 * Son Notlar card re-uses the same state and slices the first three
 * rows — no separate "recent" query is needed.
 */
export async function selectNotesByCompanyId(
  client: Client,
  companyId: string,
): Promise<NoteRow[]> {
  return completePages((from, to, signal) => client
    .from("notes")
    .select("*", {count:"exact"})
    .eq("company_id", companyId)
    .order("is_pinned", { ascending: false })
    .order("created_at", { ascending: false })
    .order("id", { ascending: true }).range(from, to).abortSignal(signal), "Notlar");
}

export type NoteCommandScope = { companyId: string; tenantId: string; actorId: string };

/** Single command, no retry: a lost response can follow a committed write. */
export async function executeNote(client: Client, scope: NoteCommandScope, action: 'create' | 'edit' | 'pin' | 'delete', noteId: string | null, input: Record<string, string | boolean | null>): Promise<NoteRow> {
  const unknown = 'Not işleminin sonucu doğrulanamadı. Tekrar denemeden önce notları yenileyin.';
  if (![scope.companyId,scope.tenantId,scope.actorId].every(value=>UUID.test(value)) || (noteId!==null && !UUID.test(noteId))) throw Error('Not işleminin kapsamı doğrulanamadı.');
  let response;
  try { response = await client.rpc('note_execute_v1', {p_action:action,p_note_id:noteId,p_company_id:scope.companyId,p_tenant_id:scope.tenantId,p_actor_id:scope.actorId,p_input:input}); }
  catch { throw Error(unknown); }
  if (response.error) {
    const domainMessage = response.error.message==='NOTE_AUTHOR_MISSING' ? 'Not eklemek için profilinizde adınızı tamamlayın.'
      : response.error.message==='NOTE_OWNERSHIP' ? 'Bu notu yalnızca yazarı veya yönetici düzenleyebilir.' : null;
    throw Error(domainMessage ?? moduleAccessMessage(response.error) ?? (response.error.code === 'BN400' ? 'Not içeriğini ve etiketini kontrol edin (en fazla 10.000 karakter).' : unknown));
  }
  const rows=response.data;
  if (!Array.isArray(rows) || rows.length!==1) throw Error(unknown);
  const row=rows[0];
  if (!row || typeof row.id!=='string' || !UUID.test(row.id) || row.company_id!==scope.companyId || row.tenant_id!==scope.tenantId
    || (noteId!==null && row.id!==noteId) || typeof row.content!=='string' || !row.content.trim() || typeof row.author_name!=='string' || !row.author_name.trim() || typeof row.is_pinned!=='boolean'
    || (action==='create' && (row.author_id!==scope.actorId || row.is_pinned)) || (action==='pin' && row.is_pinned!==input.is_pinned)) throw Error(unknown);
  return row;
}
