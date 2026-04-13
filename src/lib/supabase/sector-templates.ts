/**
 * BPS — Raw Supabase access for the `sector_templates` table.
 *
 * Read-only catalog. No write path in V1.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, SectorTemplateRow } from "@/types/database.types";

type Client = SupabaseClient<Database>;

/**
 * Read all sector templates, ordered by label.
 */
export async function selectAllSectorTemplates(
  client: Client,
): Promise<SectorTemplateRow[]> {
  const { data, error } = await client
    .from("sector_templates")
    .select("*")
    .order("label", { ascending: true });

  if (error) {
    throw new Error(`sector_templates select-all failed: ${error.message}`);
  }
  return data ?? [];
}

/**
 * Read a single sector template by sector_code.
 */
export async function selectSectorTemplateBySectorCode(
  client: Client,
  sectorCode: string,
): Promise<SectorTemplateRow | null> {
  const { data, error } = await client
    .from("sector_templates")
    .select("*")
    .eq("sector_code", sectorCode)
    .maybeSingle();

  if (error) {
    throw new Error(`sector_templates select-by-code failed: ${error.message}`);
  }
  return data ?? null;
}
