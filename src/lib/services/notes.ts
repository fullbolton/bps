import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, NoteRow } from "@/types/database.types";
import { selectNotesByCompanyId, executeNote, type NoteCommandScope } from "@/lib/supabase/notes";
import { requireCompanyByLegacyMockId } from "@/lib/services/companies";
import { normalizeNoteTag, type NoteTagKey } from "@/lib/note-tags";
type Client = SupabaseClient<Database>;

export class NoteValidationError extends Error {
  constructor(message: string) { super(message); this.name="NoteValidationError"; }
}
export interface NoteCreateInput { content: string; tag?: NoteTagKey | "" | null }
export type NoteContentUpdateInput = NoteCreateInput;

function content(raw: string): string {
  if (typeof raw!=="string" || !raw.trim()) throw new NoteValidationError("Not içeriği boş olamaz.");
  return raw.trim();
}

async function scope(client: Client, companyId: string): Promise<NoteCommandScope> {
  const company=await requireCompanyByLegacyMockId(client,companyId);
  const identity=await client.auth.getUser();
  if (identity.error || !identity.data.user) throw new NoteValidationError("Oturum bulunamadı. Lütfen tekrar giriş yapın.");
  return {companyId:company.id,tenantId:company.tenant_id,actorId:identity.data.user.id};
}

export async function listNotesByLegacyCompanyId(client: Client, companyId: string): Promise<NoteRow[]> {
  const company=await requireCompanyByLegacyMockId(client,companyId);
  return selectNotesByCompanyId(client,company.id);
}

/** Author identity/name and all role/ownership decisions are derived in the database. */
export async function createNote(client: Client, companyId: string, input: NoteCreateInput, options: {tenantId:string}): Promise<NoteRow> {
  const context=await scope(client,companyId);
  if (context.tenantId!==options.tenantId) throw new NoteValidationError("Çalışma alanı değişti. Sayfayı yenileyin.");
  return executeNote(client,context,'create',null,{content:content(input.content),tag:normalizeNoteTag(input.tag)});
}
export async function updateNoteContent(client: Client, companyId: string, noteId: string, input: NoteContentUpdateInput): Promise<NoteRow> {
  return executeNote(client,await scope(client,companyId),'edit',noteId,{content:content(input.content),tag:normalizeNoteTag(input.tag)});
}
export async function pinNote(client: Client, companyId: string, noteId: string): Promise<NoteRow> {
  return executeNote(client,await scope(client,companyId),'pin',noteId,{is_pinned:true});
}
export async function unpinNote(client: Client, companyId: string, noteId: string): Promise<NoteRow> {
  return executeNote(client,await scope(client,companyId),'pin',noteId,{is_pinned:false});
}
export async function deleteNoteById(client: Client, companyId: string, noteId: string): Promise<void> {
  await executeNote(client,await scope(client,companyId),'delete',noteId,{});
}
