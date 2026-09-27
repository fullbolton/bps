import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';
import { readNotificationPages } from './read-pages';
import { fetchCompanyPartnerAssignments } from './notification-recipients';

export type ContractRecipient = { id: string; email: string };

/** This template needs only email; unlike grouped mail it has no named greeting. */
export async function readContractRecipients(client: SupabaseClient<Database>, companyIds: string[], includePartners: boolean): Promise<Map<string, ContractRecipient[]>> {
  const companies = [...new Set(companyIds)];
  if (!companies.length) return new Map();
  const managers = await readNotificationPages(
    (from, to) => client.from('profiles').select('id, email', { count: 'exact' })
      .eq('role', 'yonetici').order('id').range(from, to),
    row => typeof row.id === 'string' && row.id ? row.id : null,
  );
  const hasEmail = (row: { id: string; email: string | null }): row is ContractRecipient => typeof row.email === 'string' && !!row.email;
  const assignments = includePartners ? await fetchCompanyPartnerAssignments(client, companies) : { rows: [] };
  if (assignments.error) throw Error('code=ASSIGNMENTS_INCOMPLETE');
  const ids = [...new Set(assignments.rows.map(row => row.partner_user_id))];
  const partners = new Map<string, ContractRecipient>();
  for (let offset = 0; offset < ids.length; offset += 100) {
    const chunk = ids.slice(offset, offset + 100);
    const rows = await readNotificationPages(
      (from, to) => client.from('profiles').select('id, email', { count: 'exact' })
        .in('id', chunk).eq('role', 'partner').order('id').range(from, to),
      row => chunk.includes(row.id) ? row.id : null,
    );
    for (const row of rows) if (hasEmail(row)) partners.set(row.id, row);
  }
  const byCompany = new Map(companies.map(id => [id, [...managers.filter(hasEmail)]]));
  for (const assignment of assignments.rows) {
    const partner = partners.get(assignment.partner_user_id);
    if (partner) byCompany.get(assignment.company_id)!.push(partner);
  }
  return byCompany;
}
