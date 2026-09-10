export interface ListViewState {
  search: string;
  filters: Record<string, string>;
}

export function listViewKey(list: string, scope: string) {
  return `bps:list-view:v1:${JSON.stringify([list, scope])}`;
}

export function normalizeListView(value: unknown, defaults: Record<string, string>): ListViewState {
  const record = value && typeof value === "object" ? value as Partial<ListViewState> : {};
  const filters = Object.fromEntries(Object.entries(defaults).map(([key, fallback]) => {
    const item = record.filters && Object.hasOwn(record.filters, key) ? record.filters[key] : undefined;
    return [key, typeof item === "string" && item.length <= 512 ? item : fallback];
  }));
  return { search: typeof record.search === "string" && record.search.length <= 512 ? record.search : "", filters };
}

export function readListView(raw: string | null, defaults: Record<string, string>): ListViewState {
  try { return normalizeListView(raw && raw.length <= 8192 ? JSON.parse(raw) : null, defaults); }
  catch { return normalizeListView(null, defaults); }
}
