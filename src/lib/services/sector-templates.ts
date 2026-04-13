/**
 * BPS service layer — sector templates (V1 read-only catalog).
 *
 * V1 = sector reference + read-only template catalog.
 * No write path. No automation engine. No company-level copy.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, SectorTemplateRow } from "@/types/database.types";
import {
  selectAllSectorTemplates,
  selectSectorTemplateBySectorCode,
} from "@/lib/supabase/sector-templates";

type Client = SupabaseClient<Database>;

/**
 * Get a single sector template by sector_code.
 * Returns null when no template exists for the given code.
 */
export async function getSectorTemplate(
  client: Client,
  sectorCode: string,
): Promise<SectorTemplateRow | null> {
  return selectSectorTemplateBySectorCode(client, sectorCode);
}

/**
 * Get all sector templates. Used by dropdowns and catalog views.
 */
export async function getAllSectorTemplates(
  client: Client,
): Promise<SectorTemplateRow[]> {
  return selectAllSectorTemplates(client);
}

/**
 * Get the list of valid sector codes from the catalog.
 */
export async function getSectorCodes(
  client: Client,
): Promise<string[]> {
  const templates = await selectAllSectorTemplates(client);
  return templates.map((t) => t.sector_code);
}
