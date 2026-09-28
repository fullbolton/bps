/** Bounded compatibility reader for screens that still filter full lists locally.
 * Each request keeps the caller's RLS and filters. Callers MUST provide a stable
 * order ending in unique id. This detects clipped pages, count drift and repeats;
 * separate HTTP requests are not a database snapshot (same-count edits may occur).
 */
export async function completePages<T extends { id: string }>(
  fetchPage: (from: number, to: number, signal: AbortSignal) => PromiseLike<{ data: T[] | null; count: number | null; error: unknown }>,
  label: string,
): Promise<T[]> {
  const pageSize = 500;
  const maximum = 10_000;
  const signal = AbortSignal.timeout(30_000);
  const rows: T[] = [];
  const ids = new Set<string>();
  let total: number | undefined;
  const incomplete = () => new Error(`${label}: Liste eksiksiz alınamadı veya okuma sırasında değişti. Lütfen yenileyin.`);
  while (true) {
    signal.throwIfAborted();
    const result = await fetchPage(rows.length, rows.length + pageSize - 1, signal);
    signal.throwIfAborted();
    if (result.error) throw new Error(`${label}: Kayıtlar yüklenemedi. Lütfen tekrar deneyin.`);
    const { data, count } = result;
    if (!Array.isArray(data) || count === null || !Number.isSafeInteger(count) || count < 0) throw incomplete();
    if (count > maximum) throw new Error(`${label}: Bu görünüm en fazla 10.000 kayıt yükleyebilir. Eksik liste gösterilmiyor.`);
    if (total !== undefined && count !== total) throw incomplete();
    total = count;
    if (data.length !== Math.min(pageSize, total - rows.length)) throw incomplete();
    for (const row of data) {
      if (!row || typeof row.id !== 'string' || !row.id || ids.has(row.id)) throw incomplete();
      ids.add(row.id);
      rows.push(row);
    }
    if (rows.length === total) return rows;
  }
}
