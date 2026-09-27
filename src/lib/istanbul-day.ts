const formatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Istanbul', year: 'numeric', month: '2-digit', day: '2-digit',
});
export function istanbulDay(now = new Date()): string {
  return formatter.format(now);
}
