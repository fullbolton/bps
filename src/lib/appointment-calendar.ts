/** Calendar dates are civil dates, not browser-local instants. */
export function appointmentDayKey(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-GB', {timeZone: 'Europe/Istanbul', year: 'numeric', month: '2-digit', day: '2-digit'}).formatToParts(date);
  const value = (type: string) => parts.find(part => part.type === type)!.value;
  return `${value('year')}-${value('month')}-${value('day')}`;
}

export interface CalendarAppointment {
  id: string;
  meeting_date: string;
  meeting_time: string | null;
  firma_name: string;
  attendee: string | null;
  meeting_type: string;
  status: string;
}

/** Group once per response/filter change; undated times sort after timed entries. */
export function groupCalendarAppointments<T extends CalendarAppointment>(rows: readonly T[]): Map<string, T[]> {
  const days = new Map<string, T[]>();
  for (const row of rows) {
    const entries = days.get(row.meeting_date) ?? [];
    entries.push(row);
    days.set(row.meeting_date, entries);
  }
  for (const entries of days.values()) {
    entries.sort((a, b) => (a.meeting_time || '99').localeCompare(b.meeting_time || '99') || a.id.localeCompare(b.id));
  }
  return days;
}
