import { safeDbError } from './safe-error';

type Page<T> = { data: T[] | null; count: number | null; error: { code?: string | null } | null };

/** Measured, ordered reads. Not a transaction snapshot across requests. */
export async function readNotificationPages<T>(
  fetchPage: (from: number, to: number) => PromiseLike<Page<T>>,
  identity: (row: T) => string | null,
): Promise<T[]> {
  const rows: T[] = [], seen = new Set<string>();
  let expected: number | null = null;
  do {
    let page: Page<T>;
    try { page = await fetchPage(rows.length, rows.length + 499); }
    catch { throw Error('code=READ_FAILED'); }
    const { data, count, error } = page;
    if (error) throw Error(safeDbError(error));
    if (!Array.isArray(data) || !Number.isSafeInteger(count) || count === null || count < 0
      || (expected !== null && count !== expected) || data.length > 500
      || rows.length + data.length > count || (!data.length && rows.length < count)) {
      throw Error('code=INCOMPLETE_PAGE');
    }
    expected = count;
    for (const row of data) {
      const key = identity(row);
      if (!key || seen.has(key)) throw Error('code=INVALID_PAGE_IDENTITY');
      seen.add(key);
      rows.push(row);
    }
  } while (rows.length < expected);
  return rows;
}
