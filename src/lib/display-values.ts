/** Format database numeric values without treating unavailable data as zero. */
export function formatTry(value: string | number | null | undefined): string {
  if (value == null || (typeof value === 'string' && !value.trim())) return '—';
  if (typeof value === 'string' && !/^-?\d+(?:\.\d+)?$/.test(value.trim())) return '—';
  const amount = Number(value);
  if (!Number.isFinite(amount)) return '—';
  return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', minimumFractionDigits: 2 }).format(amount);
}

/** Display/filter equivalence only; original stored city text is preserved. */
export function cityLabel(value: string | null | undefined): string {
  const city = value?.trim() ?? '';
  return /^istanbul$/i.test(city.normalize('NFD').replace(/[\u0300-\u036f]/g, '')) ? 'İstanbul' : city;
}
