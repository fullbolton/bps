import { MODULE_CATALOG, parseModuleStates, type ModuleStates } from './catalog';

export type CatalogSnapshot =
  | Readonly<{ version: 1; modules: ModuleStates }>
  | Readonly<{ version: 2; modules: ModuleStates & Readonly<{ hr: boolean }> }>;

/** Stored snapshot versions are explicit. This does not enable catalog 2 in the UI. */
export function parseCatalogSnapshot(version: unknown, value: unknown): CatalogSnapshot {
  if (version === 1) return Object.freeze({ version, modules: parseModuleStates(value) });
  if (version !== 2) throw Error('MODULE_HISTORY_VERSION');
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('MODULE_CONFIG_RESPONSE');
  const record = value as Record<string, unknown>;
  if (Object.keys(record).length !== MODULE_CATALOG.length + 1
    || !Object.hasOwn(record, 'hr') || typeof record.hr !== 'boolean') throw Error('MODULE_CONFIG_RESPONSE');
  const { hr, ...legacy } = record;
  return Object.freeze({ version, modules: Object.freeze({ ...parseModuleStates(legacy), hr }) });
}

/** The only default is at the explicit 1→2 migration boundary, never on a read. */
export function upgradeCatalogSnapshot(value: unknown): Extract<CatalogSnapshot, { version: 2 }> {
  return parseCatalogSnapshot(2, { ...parseModuleStates(value), hr: false }) as Extract<CatalogSnapshot, { version: 2 }>;
}

/** Old clients may change their known keys, but must preserve the stored HR flag.
 * Call only after the server's scope, revision and lock checks. This pure merge is
 * neither an entitlement check nor authorization to persist or activate HR.
 */
export function mergeCatalogRequest(current: CatalogSnapshot, clientVersion: unknown, desired: unknown): CatalogSnapshot {
  const stored = parseCatalogSnapshot(current.version, current.modules);
  const request = parseCatalogSnapshot(clientVersion, desired);
  if (stored.version === 1) {
    if (request.version !== 1) throw Error('MODULE_CATALOG_UPGRADE_REQUIRED');
    return request;
  }
  return request.version === 2 ? request : parseCatalogSnapshot(2, { ...request.modules, hr: stored.modules.hr });
}

export type CatalogDelta = Readonly<{
  upgraded: boolean;
  changes: ReadonlyArray<Readonly<{ key: keyof ModuleStates | 'hr'; enabled: boolean }>>;
}>;

/** An upgrade is an audit event in its own right; never invent a toggle for it. */
export function compareCatalogSnapshots(before: CatalogSnapshot, after: CatalogSnapshot): CatalogDelta {
  const left = parseCatalogSnapshot(before.version, before.modules);
  const right = parseCatalogSnapshot(after.version, after.modules);
  if (left.version === 2 && right.version === 1) throw Error('MODULE_CATALOG_DOWNGRADE');
  const upgraded = left.version === 1 && right.version === 2;
  if (upgraded && right.version === 2 && right.modules.hr) throw Error('MODULE_CATALOG_UPGRADE_HR_ENABLED');
  const changes: { key: keyof ModuleStates | 'hr'; enabled: boolean }[] = MODULE_CATALOG
    .filter(module => left.modules[module.key] !== right.modules[module.key])
    .map(module => ({ key: module.key, enabled: right.modules[module.key] }));
  // Migration must preserve existing settings, and activation must be a later,
  // separately authorized event so its actor and entitlement can be audited.
  if (upgraded && changes.length) throw Error('MODULE_CATALOG_UPGRADE_CHANGED_STATE');
  if (left.version === 2 && right.version === 2 && left.modules.hr !== right.modules.hr) {
    changes.push({ key: 'hr', enabled: right.modules.hr });
  }
  return Object.freeze({ upgraded, changes: Object.freeze(changes.map(change => Object.freeze(change))) });
}
