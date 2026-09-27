/** A server row limit is not an empty/smaller data set. Use with count: exact. */
export function completeRows<T>(data: T[] | null, count: number | null, label: string): T[] {
  if (!Array.isArray(data) || !Number.isSafeInteger(count) || count === null || count < 0 || data.length !== count) {
    throw new Error(`${label}: Kayıtların tamamı alınamadı. Eksik liste gösterilmiyor.`);
  }
  return data;
}

/** Exact count can remain useful even when PostgREST clips the returned rows. */
export function countedResult<T>(result: { data: T[] | null; count: number | null; error: unknown }): { count: number | null; rows: T[] | null } {
  if (result.error || !Number.isSafeInteger(result.count) || result.count === null || result.count < 0) return { count: null, rows: null };
  if (Array.isArray(result.data) && result.data.length > result.count) return { count: null, rows: null };
  return { count: result.count, rows: Array.isArray(result.data) && result.data.length === result.count ? result.data : null };
}
