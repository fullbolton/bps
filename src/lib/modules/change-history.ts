import { MODULE_CATALOG, parseModuleStates, type ModuleKey } from './catalog';
import { isRevision, parseWorkspaceModuleContext, type WorkspaceModuleContext } from './context';
import { compareCatalogSnapshots, parseCatalogSnapshot } from './catalog-snapshot';
export type ModuleHistoryEntry = {
  revision: string; createdAt: string; actorName: string | null; kind: 'bootstrap' | 'settings' | 'catalog_upgrade';
  changes: { key: ModuleKey | 'hr'; enabled: boolean }[];
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
    const afterSnapshot = parseCatalogSnapshot(1, row.after);
    const after = afterSnapshot.modules;
    if (MODULE_CATALOG.some(m=>after[m.key]!==expectedState[m.key])) throw Error('MODULE_HISTORY_CHAIN');
    let changes: ModuleHistoryEntry['changes'];
    if (bootstrap) {
      if (!row.before || typeof row.before !== 'object' || Array.isArray(row.before) || Object.keys(row.before).length) throw Error('MODULE_HISTORY_ENTRY');
      changes = [];
    } else {
      const before = parseModuleStates(row.before);
      expectedState = before;
      changes = compareCatalogSnapshots({ version: 1, modules: before }, afterSnapshot).changes.map(change => ({ key: change.key as ModuleKey, enabled: change.enabled }));
      if (!changes.length) throw Error('MODULE_HISTORY_ENTRY');
    }
    return { revision:row.revision,createdAt:row.createdAt,actorName:row.actorName as string|null,kind:row.kind as ModuleHistoryEntry['kind'],changes };
  });
}

/** Mixed catalog history preserves every revision, including the migration event. */
export function parseVersionedModuleHistory(raw: unknown, expected: WorkspaceModuleContext): ModuleHistoryEntry[] {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw Error('MODULE_HISTORY_RESPONSE');
  const data = raw as Record<string, unknown>;
  if (!data.context || typeof data.context !== 'object' || Array.isArray(data.context)) throw Error('MODULE_HISTORY_SCOPE');
  const wire = data.context as Record<string, unknown>;
  // Validate identity before interpreting a newer catalog. For known v2, scope
  // validation uses its explicit v1 projection; audit snapshots remain complete.
  const projected = wire.catalogVersion === 2 && wire.modules && typeof wire.modules === 'object'
    ? Object.fromEntries(Object.entries(wire.modules).filter(([key]) => key !== 'hr')) : wire.modules;
  const context = parseWorkspaceModuleContext(wire.catalogVersion === 2 ? { ...wire, catalogVersion: 1, modules: projected } : wire, expected);
  if (context.role !== 'yonetici' || expected.role !== 'yonetici' || context.configRevision !== expected.configRevision
    || MODULE_CATALOG.some(m => context.modules[m.key] !== expected.modules[m.key])) throw Error('MODULE_HISTORY_SCOPE');
  if (data.historySchemaVersion !== 2 || !Array.isArray(data.entries)) throw Error('MODULE_HISTORY_VERSION');
  if (data.entries.length !== Math.min(Number(BigInt(context.configRevision)),20)) throw Error('MODULE_HISTORY_SCOPE');
  let expectedSnapshot = parseCatalogSnapshot(wire.catalogVersion, wire.modules);
  return data.entries.map((value: unknown,index: number) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('MODULE_HISTORY_ENTRY');
    const row = value as Record<string,unknown>;
    if (!isRevision(row.revision) || BigInt(row.revision) !== BigInt(context.configRevision)-BigInt(index)
      || typeof row.createdAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(row.createdAt)
      || !Number.isFinite(Date.parse(row.createdAt))) throw Error('MODULE_HISTORY_ENTRY');
    const after = parseCatalogSnapshot(row.afterCatalogVersion,row.after);
    if (after.version !== expectedSnapshot.version || compareCatalogSnapshots(after,expectedSnapshot).changes.length) throw Error('MODULE_HISTORY_CHAIN');
    if (row.revision === '1') {
      if (row.kind !== 'bootstrap' || row.actorName !== null || row.beforeCatalogVersion !== row.afterCatalogVersion
        || !row.before || typeof row.before !== 'object' || Array.isArray(row.before) || Object.keys(row.before).length) throw Error('MODULE_HISTORY_ENTRY');
      return {revision:row.revision,createdAt:row.createdAt,actorName:null,kind:'bootstrap',changes:[]};
    }
    const before = parseCatalogSnapshot(row.beforeCatalogVersion,row.before);
    const delta = compareCatalogSnapshots(before,after);
    if (delta.upgraded ? row.kind !== 'catalog_upgrade' || row.actorName !== null
      : row.kind !== 'settings' || typeof row.actorName !== 'string' || !row.actorName.trim() || !delta.changes.length) throw Error('MODULE_HISTORY_ENTRY');
    expectedSnapshot = before;
    return {revision:row.revision,createdAt:row.createdAt,actorName:row.actorName as string|null,
      kind:delta.upgraded?'catalog_upgrade':'settings',changes:delta.changes.map(change=>({...change}))};
  });
}
