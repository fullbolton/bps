import { moduleAccessMessage } from "@/lib/modules/errors";
/** Company contact reads and scoped commands. SQL owns authorization and invariants. */

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Database,
  ContactRow,
} from "@/types/database.types";

type Client = SupabaseClient<Database>;

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/**
 * List contacts for one firma. Returns an empty array when none exist or
 * the firma is out of the caller's RLS scope.
 *
 * Sort: primary first, then by created_at ascending. The "primary first"
 * sort matches the Firma Detay > Yetkililer tab presentation.
 */
export async function selectContactsByCompanyId(
  client: Client,
  companyId: string,
): Promise<ContactRow[]> {
  const { data, error } = await client
    .from("contacts")
    .select("*")
    .eq("company_id", companyId)
    .order("is_primary", { ascending: false })
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`contacts select failed: ${error.message}`);
  }
  return data ?? [];
}

/**
 * Batch-fetch the primary contact for many companies in one round trip.
 * Used by the Firmalar list cutover for the Ana Yetkili column.
 *
 * Returns one row per company that has a primary contact and is within
 * the caller's RLS scope. Companies with no primary, or with no contacts
 * at all, are silently absent from the result.
 */
export async function selectPrimaryContactsByCompanyIds(
  client: Client,
  companyIds: string[],
): Promise<ContactRow[]> {
  if (companyIds.length === 0) return [];

  const { data, error } = await client
    .from("contacts")
    .select("*")
    .in("company_id", companyIds)
    .eq("is_primary", true);

  if (error) {
    throw new Error(`contacts select failed: ${error.message}`);
  }
  return data ?? [];
}

/**
 * Fetch one contact bound to a specific company. Returns null when the
 * row does not exist, belongs to another company, or RLS hides it. The
 * service layer uses this to bind a contact mutation to the firma it
 * resolved, so a mismatched (companyId, contactId) pair cannot reach
 * across company boundaries.
 */
export async function selectContactByIdAndCompany(
  client: Client,
  id: string,
  companyId: string,
): Promise<ContactRow | null> {
  const { data, error } = await client
    .from("contacts")
    .select("*")
    .eq("id", id)
    .eq("company_id", companyId)
    .maybeSingle();

  if (error) {
    throw new Error(`contacts select failed: ${error.message}`);
  }
  return data;
}

/** One RPC transaction; never fall back to separate demote/write calls. */
export async function writeCompanyContact(
  client: Client,
  input: Database["public"]["Functions"]["write_company_contact"]["Args"],
): Promise<ContactRow> {
  const { data, error } = await client.rpc("write_company_contact", input).single();
  if (error) throw new Error(moduleAccessMessage(error) ?? "Yetkili kişi kaydedilemedi. Tekrar denemeden önce yetkili listesini kontrol edin.");
  return data;
}

export type ContactCommandScope = { companyId: string; tenantId: string; actorId: string };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** No retry: a transport error can follow a committed write. */
export async function executeContact(
  client: Client, scope: ContactCommandScope, action: "communication" | "delete" | "import",
  contactId: string | null, input: Record<string, string | boolean | null>,
): Promise<ContactRow> {
  const uncertain = "Yetkili işleminin sonucu doğrulanamadı. Tekrar denemeden önce yetkili listesini yenileyin.";
  if (![scope.companyId, scope.tenantId, scope.actorId].every(value => UUID.test(value))
    || (contactId !== null && !UUID.test(contactId))) throw Error("Yetkili işleminin kapsamı doğrulanamadı.");
  let response;
  try {
    response = await client.rpc("contact_execute_v1", {
      p_action: action, p_contact_id: contactId, p_company_id: scope.companyId,
      p_tenant_id: scope.tenantId, p_actor_id: scope.actorId, p_input: input,
    });
  } catch { throw Error(uncertain); }
  if (response.error) {
    const messages: Record<string, string> = {
      CONTACT_PRIMARY_EXISTS: "Bu firmanın ana yetkilisi zaten var. CSV satırını kontrol edin; mevcut ana yetkili değiştirilmedi.",
      CONTACT_CHANNEL_REQUIRED: "Telefon veya e-posta alanlarından en az biri zorunludur.",
      CONTACT_SCOPE: "Yetkili kişi veya firma erişimi doğrulanamadı. Listeyi yenileyin.",
      CONTACT_ROLE: "Bu yetkili kişi işlemi için yetkiniz yok.",
    };
    throw Error(messages[response.error.message] ?? moduleAccessMessage(response.error)
      ?? (response.error.code === "BC400" ? "Yetkili kişi alanlarını kontrol edin." : uncertain));
  }
  const rows = response.data;
  if (!Array.isArray(rows) || rows.length !== 1) throw Error(uncertain);
  const row = rows[0];
  if (!row || !UUID.test(row.id) || row.company_id !== scope.companyId
    || (contactId !== null && row.id !== contactId) || typeof row.full_name !== "string" || !row.full_name.trim()
    || typeof row.is_primary !== "boolean" || (action === "import" && (row.created_by !== scope.actorId || row.is_primary !== input.is_primary))) throw Error(uncertain);
  return row;
}
