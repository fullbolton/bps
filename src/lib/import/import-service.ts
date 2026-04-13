/**
 * BPS CSV Import — Service layer (V1)
 *
 * Server-safe import actions for companies, contacts, contracts.
 * Yonetici-only. Inserts only validated rows into real target tables.
 * No staging tables. No import_jobs. No rollback framework.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import type { SozlesmeDurumu, FirmaDurumu, RiskSeviyesi } from "@/types/ui";
import type { ParsedRow } from "./csv-parser";
import { parseBooleanish, convertDateForDB } from "./csv-parser";

type Client = SupabaseClient<Database>;

export interface ImportResult {
  imported: number;
  skipped: number;
  errors: string[];
}

// ---------------------------------------------------------------------------
// Build company name → id resolution map (exact match, single result only)
// ---------------------------------------------------------------------------

export async function buildCompanyNameMap(
  client: Client,
): Promise<Map<string, string>> {
  const { data, error } = await client.from("companies").select("id, name");
  if (error) throw new Error(`Company map query failed: ${error.message}`);

  // Count occurrences — reject ambiguous names
  const counts = new Map<string, number>();
  const nameToId = new Map<string, string>();

  for (const row of data ?? []) {
    const name = row.name.trim();
    counts.set(name, (counts.get(name) ?? 0) + 1);
    nameToId.set(name, row.id);
  }

  // Remove ambiguous entries (2+ companies with same name)
  const result = new Map<string, string>();
  for (const [name, id] of nameToId) {
    if ((counts.get(name) ?? 0) === 1) {
      result.set(name, id);
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Import companies
// ---------------------------------------------------------------------------

export async function importCompanies(
  client: Client,
  validRows: ParsedRow[],
): Promise<ImportResult> {
  let imported = 0;
  const errors: string[] = [];

  const { data: { user } } = await client.auth.getUser();

  for (const row of validRows) {
    if (!row.valid) continue;
    const d = row.data;

    const { error } = await client.from("companies").insert({
      name: d.name.trim(),
      sector: d.sector?.trim() || null,
      city: d.city?.trim() || null,
      status: (d.status?.trim() || "aktif") as FirmaDurumu,
      risk: (d.risk?.trim() || "dusuk") as RiskSeviyesi,
      created_by: user?.id ?? null,
    });

    if (error) {
      errors.push(`Satir ${row.rowIndex}: ${error.message}`);
    } else {
      imported++;
    }
  }

  return { imported, skipped: validRows.filter((r) => !r.valid).length, errors };
}

// ---------------------------------------------------------------------------
// Import contacts
// ---------------------------------------------------------------------------

export async function importContacts(
  client: Client,
  validRows: ParsedRow[],
  companyNameToId: Map<string, string>,
): Promise<ImportResult> {
  let imported = 0;
  const errors: string[] = [];

  const { data: { user } } = await client.auth.getUser();

  for (const row of validRows) {
    if (!row.valid) continue;
    const d = row.data;
    const companyId = companyNameToId.get(d.company_name?.trim());
    if (!companyId) {
      errors.push(`Satir ${row.rowIndex}: firma "${d.company_name}" artik bulunamiyor`);
      continue;
    }

    const { error } = await client.from("contacts").insert({
      company_id: companyId,
      full_name: d.full_name.trim(),
      title: d.title?.trim() || null,
      phone: d.phone?.trim() || null,
      email: d.email?.trim() || null,
      is_primary: parseBooleanish(d.is_primary),
      context_note: d.context_note?.trim() || null,
      created_by: user?.id ?? null,
    });

    if (error) {
      errors.push(`Satir ${row.rowIndex}: ${error.message}`);
    } else {
      imported++;
    }
  }

  return { imported, skipped: validRows.filter((r) => !r.valid).length, errors };
}

// ---------------------------------------------------------------------------
// Import contracts
// ---------------------------------------------------------------------------

export async function importContracts(
  client: Client,
  validRows: ParsedRow[],
  companyNameToId: Map<string, string>,
): Promise<ImportResult> {
  let imported = 0;
  const errors: string[] = [];

  const { data: { user } } = await client.auth.getUser();

  for (const row of validRows) {
    if (!row.valid) continue;
    const d = row.data;
    const companyId = companyNameToId.get(d.company_name?.trim());
    if (!companyId) {
      errors.push(`Satir ${row.rowIndex}: firma "${d.company_name}" artik bulunamiyor`);
      continue;
    }

    const { error } = await client.from("contracts").insert({
      company_id: companyId,
      name: d.name.trim(),
      contract_type: d.contract_type?.trim() || null,
      start_date: convertDateForDB(d.start_date),
      end_date: convertDateForDB(d.end_date),
      status: (d.status?.trim() || "taslak") as SozlesmeDurumu,
      contract_value: d.contract_value?.trim() || null,
      scope: d.scope?.trim() || null,
      responsible: d.responsible?.trim() || null,
      last_action_label: d.last_action_label?.trim() || null,
      renewal_target_date: convertDateForDB(d.renewal_target_date),
      created_by: user?.id ?? null,
    });

    if (error) {
      errors.push(`Satir ${row.rowIndex}: ${error.message}`);
    } else {
      imported++;
    }
  }

  return { imported, skipped: validRows.filter((r) => !r.valid).length, errors };
}
