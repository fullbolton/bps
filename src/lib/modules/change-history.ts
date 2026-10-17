import { MODULE_CATALOG, parseModuleStates, type ModuleKey } from './catalog';
import { isRevision, parseWorkspaceModuleContext, type WorkspaceModuleContext } from './context';
export type ModuleHistoryEntry = {
  revision: string; createdAt: string; actorName: string | null; kind: 'bootstrap' | 'settings';
  changes: { key: ModuleKey; enabled: boolean }[];
};
/** Bounded newest-first history; malformed or partial audit data is never shown as complete. */
export function parseModuleHistory(raw: unknown, expected: WorkspaceModuleContext): ModuleHistoryEntry[] {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw Error('MODULE_HISTORY_RESPONSE');
  const data = raw as Record<string, unknown>;
  const context = parseWorkspaceModuleContext(data.context, expected);
  if (context.role !== 'yonetici' || expected.role !== 'yonetici' || context.configRevision !== expected.configRevision
    || !Array.isArray(data.entries) || data.entries.length !== Math.min(Number(BigInt(context.configRevision)),20)) throw Error('MODULE_HISTORY_SCOPE');
  let expectedState = context.modules;
  return data.entries.map((value: unknown, index: number) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('MODULE_HISTORY_ENTRY');
    const row = value as Record<string,unknown>;
    if (!isRevision(row.revision) || BigInt(row.revision) !== BigInt(context.configRevision)-BigInt(index)
      || typeof row.createdAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(row.createdAt) || !Number.isFinite(Date.parse(row.createdAt))) throw Error('MODULE_HISTORY_ENTRY');
    const bootstrap = row.revision === '1';
    if (row.kind !== (bootstrap ? 'bootstrap' : 'settings') || (bootstrap ? row.actorName !== null : typeof row.actorName !== 'string' || !row.actorName.trim())) throw Error('MODULE_HISTORY_ENTRY');
    const after = parseModuleStates(row.after);
    if (MODULE_CATALOG.some(m=>after[m.key]!==expectedState[m.key])) throw Error('MODULE_HISTORY_CHAIN');
    let changes: ModuleHistoryEntry['changes'];
    if (bootstrap) {
      if (!row.before || typeof row.before !== 'object' || Array.isArray(row.before) || Object.keys(row.before).length) throw Error('MODULE_HISTORY_ENTRY');
      changes = [];
    } else {
      const before = parseModuleStates(row.before);
      expectedState = before;
      changes = MODULE_CATALOG.filter(m=>before[m.key]!==after[m.key]).map(m=>({key:m.key,enabled:after[m.key]}));
      if (!changes.length) throw Error('MODULE_HISTORY_ENTRY');
    }
    return { revision:row.revision,createdAt:row.createdAt,actorName:row.actorName as string|null,kind:row.kind as ModuleHistoryEntry['kind'],changes };
  });
}
