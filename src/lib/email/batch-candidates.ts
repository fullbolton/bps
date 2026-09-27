import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';
import { readNotificationPages } from './read-pages';
type Client = SupabaseClient<Database>;
const identity = (row: { id: string }) => typeof row.id === 'string' && row.id ? row.id : null;

export function readTaskNotificationCandidates(client: Client) {
  return readNotificationPages(
    (from, to) => client.from('tasks')
      .select('id, title, status, due_date, assigned_to_user_id, tenant_id, company_id', { count: 'exact' })
      .in('status', ['acik', 'devam_ediyor', 'gecikti']).order('id').range(from, to), identity,
  );
}
export function readDocumentNotificationCandidates(client: Client, upper: string) {
  return readNotificationPages(
    (from, to) => client.from('documents')
      .select('id, name, validity_date, tenant_id', { count: 'exact' })
      .not('validity_date', 'is', null).lte('validity_date', upper).order('id').range(from, to), identity,
  );
}
export function readAppointmentNotificationCandidates(client: Client, target: string) {
  return readNotificationPages(
    (from, to) => client.from('appointments')
      .select('id, meeting_type, attendee, meeting_date, company_id, tenant_id, status', { count: 'exact' })
      .eq('status', 'planlandi').eq('meeting_date', target).order('id').range(from, to), identity,
  );
}
