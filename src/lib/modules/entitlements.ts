import { MODULE_CATALOG, type ModuleKey } from './catalog';
import { parseCatalogSnapshot } from './catalog-snapshot';
import { isRevision, parseWorkspaceModuleContext, type WorkspaceModuleContext } from './context';

type Rights = Readonly<Record<ModuleKey | 'hr',boolean>>;
const keys = [...MODULE_CATALOG.map(module=>module.key),'hr'] as const;
/** Rights do not have activation dependencies: allocation and activation are separate. */
export function parseRights(raw: unknown): Rights {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw Error('MODULE_ENTITLEMENTS_RESPONSE');
  const value = raw as Record<string,unknown>;
  if (Object.keys(value).length !== keys.length || keys.some(key=>!Object.hasOwn(value,key)||typeof value[key]!=='boolean')) throw Error('MODULE_ENTITLEMENTS_RESPONSE');
  return Object.freeze(Object.fromEntries(keys.map(key=>[key,value[key]]))) as Rights;
}

export function parseModuleEntitlements(raw: unknown, expected: WorkspaceModuleContext) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw Error('MODULE_ENTITLEMENTS_RESPONSE');
  const data = raw as Record<string,unknown>;
  if (!data.context || typeof data.context !== 'object' || Array.isArray(data.context)) throw Error('MODULE_ENTITLEMENTS_RESPONSE');
  const wire = data.context as Record<string,unknown>;
  const modules = wire.modules && typeof wire.modules === 'object' && !Array.isArray(wire.modules)
    ? Object.fromEntries(Object.entries(wire.modules).filter(([key])=>key!=='hr')) : wire.modules;
  const context = parseWorkspaceModuleContext(wire.catalogVersion===2?{...wire,catalogVersion:1,modules}:wire,expected);
  if (context.role!=='yonetici'||expected.role!=='yonetici'||context.configRevision!==expected.configRevision
    ||MODULE_CATALOG.some(module=>context.modules[module.key]!==expected.modules[module.key])) throw Error('MODULE_ENTITLEMENTS_SCOPE');
  if(data.schemaVersion!==1||wire.catalogVersion!==2||!isRevision(data.entitlementRevision)) throw Error('MODULE_ENTITLEMENTS_RESPONSE');
  const snapshot=parseCatalogSnapshot(2,wire.modules);
  if(snapshot.version!==2) throw Error('MODULE_ENTITLEMENTS_RESPONSE');
  const granted=parseRights(data.granted),ready=parseRights(data.ready);
  if(keys.some(key=>snapshot.modules[key]&&(!granted[key]||!ready[key]))) throw Error('MODULE_ENTITLEMENTS_INCONSISTENT');
  return Object.freeze({context,revision:data.entitlementRevision,granted,ready,enabled:snapshot.modules});
}
