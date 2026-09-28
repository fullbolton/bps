import {blockedPersonCode} from './person-code';
/** Normalized input after column mapping; never writes or authorizes an import.
 * The server must obtain a complete scoped snapshot and recheck revisions at approval.
 */
export type ReportingScope = { tenantId: string; projectId: string; sourceId: string; month: string };
export type ActualRow = {
  sourceId: string; locationCode: string; personCode: string;
  day: string; slotCode: string; minutes: number | null;
};
export type ActualSnapshot = { scope: ReportingScope; complete: boolean; rows: ActualRow[] };
export type ActualPreviewRow = {
  row: number; value: ActualRow | null; previous: ActualRow | null;
  status: 'new' | 'unchanged' | 'changed' | 'review'; issues: string[];
};
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const code = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 160 && v.trim() === v && !/[\u0000-\u001f\u007f]/.test(v);
const day = (v: unknown): v is string => typeof v === 'string' && /^20\d{2}-\d{2}-\d{2}$/.test(v) && Number.isFinite(Date.parse(v + 'T00:00:00Z')) && new Date(v + 'T00:00:00Z').toISOString().slice(0, 10) === v;
function parseRow(v: unknown, scope: ReportingScope): ActualRow | null {
  if (!object(v) || !code(v.sourceId) || !code(v.locationCode) || !code(v.personCode) || blockedPersonCode(v.personCode) || !code(v.slotCode)
    || !day(v.day) || !v.day.startsWith(scope.month + '-')
    || !(v.minutes === null || (Number.isInteger(v.minutes) && Number(v.minutes) >= 0 && Number(v.minutes) <= 1440))) return null;
  return { sourceId: v.sourceId, locationCode: v.locationCode, personCode: v.personCode, day: v.day, slotCode: v.slotCode, minutes: v.minutes as number | null };
}
// Source row IDs survive reordered spreadsheets. Natural keys catch changed IDs for the same work.
const workKey = (r: ActualRow) => JSON.stringify([r.locationCode, r.personCode, r.day, r.slotCode]);
const equal = (a: ActualRow, b: ActualRow) => workKey(a) === workKey(b) && a.minutes === b.minutes;

export function previewActualRows(scope: ReportingScope, input: unknown, snapshot: ActualSnapshot): {
  rows: ActualPreviewRow[]; missingFromUpload: ActualRow[];
} {
  if (!scope || !code(scope.tenantId) || !code(scope.projectId) || !code(scope.sourceId) || !/^20\d{2}-(0[1-9]|1[0-2])$/.test(scope.month)
    || !snapshot || !snapshot.scope || snapshot.complete !== true
    || (['tenantId', 'projectId', 'sourceId', 'month'] as const).some(k => snapshot.scope[k] !== scope[k])) throw Error('REPORT_SNAPSHOT_SCOPE');
  if (!Array.isArray(input) || !Array.isArray(snapshot.rows) || input.length > 50000 || snapshot.rows.length > 50000) throw Error('REPORT_ROW_LIMIT');
  const oldById = new Map<string, ActualRow>(), oldByWork = new Map<string, ActualRow>();
  for (const raw of snapshot.rows) {
    const r = parseRow(raw, scope);
    if (!r || oldById.has(r.sourceId) || oldByWork.has(workKey(r))) throw Error('REPORT_INVALID_SNAPSHOT');
    oldById.set(r.sourceId, r); oldByWork.set(workKey(r), r);
  }
  const parsed = input.map(v => parseRow(v, scope));
  const ids = new Map<string, number>(), works = new Map<string, number>();
  for (const r of parsed) if (r) {
    ids.set(r.sourceId, (ids.get(r.sourceId) ?? 0) + 1);
    works.set(workKey(r), (works.get(workKey(r)) ?? 0) + 1);
  }
  const rows: ActualPreviewRow[] = parsed.map((r, index) => {
    if (!r) return { row: index + 1, value: null, previous: null, status: 'review', issues: ['Kod, tarih veya çalışma süresi geçersiz.'] };
    const previous = oldById.get(r.sourceId) ?? null;
    const sameWork = oldByWork.get(workKey(r));
    const issues: string[] = [];
    if (ids.get(r.sourceId)! > 1 || works.get(workKey(r))! > 1) issues.push('Dosyada aynı kayda ait birden fazla satır var.');
    if (sameWork && sameWork.sourceId !== r.sourceId) issues.push('Bu çalışma farklı bir kaynak kimliğiyle zaten kayıtlı.');
    if (previous && workKey(previous) !== workKey(r)) issues.push('Kaynak kimliği farklı bir kişi, şube, gün veya vardiyaya bağlanmış.');
    if (r.minutes === null) issues.push('Çalışma süresi belirtilmemiş; sıfır olarak kabul edilmez.');
    return { row: index + 1, value: r, previous, issues, status: issues.length ? 'review' : !previous ? 'new' : equal(r, previous) ? 'unchanged' : 'changed' };
  });
  // Missing rows are informational only; no deletion command is produced.
  return { rows, missingFromUpload: [...oldById.values()].filter(r => !ids.has(r.sourceId)) };
}
