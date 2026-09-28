import { isUuid } from '@/lib/operations/pilot-validation';
import { workspaceRoles, type WorkspaceRole } from '@/lib/auth-workspace';
import { parseWorkspaceIdentity, type WorkspaceScope } from '@/lib/workspace-context';
import { MODULE_CATALOG_VERSION, parseModuleStates, type ModuleStates } from '@/lib/modules/catalog';

export type ModuleContextExpectation = WorkspaceScope & {
  selectionVersion: string | null;
  membershipVersion: string;
};
export type WorkspaceModuleContext = ModuleContextExpectation & {
  name: string;
  role: WorkspaceRole;
  schemaVersion: 1;
  catalogVersion: number;
  /** Decimal string: PostgreSQL bigint must not lose precision in JavaScript. */
  configRevision: string;
  modules: ModuleStates;
};

function isRevision(value: unknown): value is string {
  return typeof value === 'string' && /^[1-9][0-9]{0,18}$/.test(value) && BigInt(value) <= BigInt('9223372036854775807');
}

/** One RPC snapshot, bound to the expected actor, company and membership generation. */
export function parseWorkspaceModuleContext(value: unknown, expected: ModuleContextExpectation): WorkspaceModuleContext {
  const identity = parseWorkspaceIdentity(value, expected);
  const data = value as Record<string, unknown>;
  if (!(expected.selectionVersion === null || isUuid(expected.selectionVersion)) || !isUuid(expected.membershipVersion)
    || data.selectionVersion !== expected.selectionVersion || data.membershipVersion !== expected.membershipVersion
    || !workspaceRoles.includes(data.role as WorkspaceRole)
    || data.schemaVersion !== 1 || data.catalogVersion !== MODULE_CATALOG_VERSION || !isRevision(data.configRevision)) {
    throw Error('MODULE_CONTEXT_RESPONSE');
  }
  return Object.freeze({
    actorId: identity.actorId, tenantId: identity.tenantId, name: identity.name,
    selectionVersion: expected.selectionVersion, membershipVersion: expected.membershipVersion,
    role: data.role as WorkspaceRole, schemaVersion: 1, catalogVersion: MODULE_CATALOG_VERSION,
    configRevision: data.configRevision, modules: parseModuleStates(data.modules),
  });
}
