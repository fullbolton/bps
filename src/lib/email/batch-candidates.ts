import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';
import { readNotificationPages } from './read-pages';
type Client = SupabaseClient<Database>;
const identity = (row: { id: string }) => typeof row.id === 'string' && row.id ? row.id : null;

export function readTaskNotificationCandidates(client: Client) {
  return readNotificationPages(
    (from, to) => client.rpc('task_notification_candidates_v1', {}, { count: 'exact' }).order('id').range(from, to), identity,
  );
}
export function readDocumentNotificationCandidates(client: Client, upper: string) {
  return readNotificationPages(
    (from, to) => client.rpc('document_notification_candidates_v1', {p_upper: upper}, {count: 'exact'}).order('id').range(from, to), identity,
  );
}
export function readAppointmentNotificationCandidates(client: Client, target: string) {
  return readNotificationPages(
    (from, to) => client.rpc('appointment_notification_candidates_v1', {p_target: target}, {count: 'exact'}).order('id').range(from, to), identity,
  );
}
