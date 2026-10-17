import { isUuid } from '@/lib/operations/pilot-validation';
import { MODULE_CATALOG, parseModuleStates } from '@/lib/modules/catalog';
import { isRevision, parseWorkspaceModuleContext, type WorkspaceModuleContext } from '@/lib/modules/context';

/** A receipt proves this command committed, not that its result is still current.
 * Always refresh the workspace before rendering current settings after a replay. */
export function parseModuleChangeReceipt(
  value: unknown,
  expected: { context: WorkspaceModuleContext; commandId: string; modules: unknown },
) {
  const context = parseWorkspaceModuleContext(expected.context, expected.context);
  const requested = parseModuleStates(expected.modules);
  if (context.role !== 'yonetici' || !isUuid(expected.commandId)
    || MODULE_CATALOG.every(module => requested[module.key] === context.modules[module.key])) {
    throw Error('MODULE_COMMAND_INPUT');
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('MODULE_COMMAND_RESPONSE');
  const data = value as Record<string, unknown>;
  if (data.schemaVersion !== 1 || data.actorId !== context.actorId || data.tenantId !== context.tenantId
    || data.commandId !== expected.commandId || typeof data.replayed !== 'boolean'
    || !isRevision(data.revision) || BigInt(data.revision) !== BigInt(context.configRevision) + BigInt(1)) {
    throw Error('MODULE_COMMAND_RESPONSE');
  }
  const modules = parseModuleStates(data.modules);
  if (MODULE_CATALOG.some(module => modules[module.key] !== requested[module.key])) throw Error('MODULE_COMMAND_RESPONSE');
  return Object.freeze({schemaVersion: 1 as const, actorId: context.actorId, tenantId: context.tenantId,
    commandId: expected.commandId, revision: data.revision, modules, replayed: data.replayed});
}
