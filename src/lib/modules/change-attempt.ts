import { isUuid } from '@/lib/operations/pilot-validation';
import { MODULE_CATALOG, parseModuleStates } from '@/lib/modules/catalog';
import { parseWorkspaceModuleContext, type WorkspaceModuleContext } from '@/lib/modules/context';
import { parseModuleChangeReceipt } from '@/lib/modules/change-receipt';

export type ModuleChangePayload = Readonly<{
  p_actor: string; p_tenant: string;
  p_membership_version: string; p_selection_version: string | null;
  p_revision: string; p_command: string; p_modules: ReturnType<typeof parseModuleStates>;
}>;
type Receipt = ReturnType<typeof parseModuleChangeReceipt>;
type Outcome = { status: 'committed'; receipt: Receipt } | { status: 'unconfirmed' } | { status: 'discarded' };

/** One user-confirmed intent. Keep this instance after an uncertain response.
 * The transport is injected: this does not expose or grant the candidate RPC.
 * A committed receipt still requires a fresh workspace read before showing settings.
 */
export function createModuleChangeAttempt(context: WorkspaceModuleContext, commandId: string, requested: unknown) {
  const snapshot = parseWorkspaceModuleContext(context, context);
  const modules = parseModuleStates(requested);
  if (snapshot.role !== 'yonetici' || !isUuid(commandId)
    || MODULE_CATALOG.every(module => modules[module.key] === snapshot.modules[module.key])) {
    throw Error('MODULE_COMMAND_INPUT');
  }
  const payload: ModuleChangePayload = Object.freeze({
    p_actor: snapshot.actorId, p_tenant: snapshot.tenantId,
    p_membership_version: snapshot.membershipVersion,
    p_selection_version: snapshot.selectionVersion,
    p_revision: snapshot.configRevision, p_command: commandId, p_modules: modules,
  });
  let inFlight: Promise<Outcome> | undefined;
  let committed: Receipt | undefined;
  let discarded = false;
  return Object.freeze({
    /** Call on unmount or workspace/role change. This suppresses local results;
     * it does not undo a request already received by the server. */
    discard() { discarded = true; committed = undefined; },
    send(current: WorkspaceModuleContext, transport: (payload: ModuleChangePayload) => Promise<unknown>): Promise<Outcome> {
      if (discarded) return Promise.resolve({ status: 'discarded' });
      // Never send the old workspace's intent through a newly selected identity.
      const live = parseWorkspaceModuleContext(current, snapshot);
      if (live.role !== 'yonetici') throw Error('MODULE_COMMAND_SCOPE');
      if (committed) return Promise.resolve({ status: 'committed', receipt: committed });
      if (inFlight) return inFlight;
      // Keep the original revision even if the server advanced: it may be our lost commit.
      inFlight = Promise.resolve().then(() => discarded ? undefined : transport(payload)).then(value => {
        if (discarded) return { status: 'discarded' as const };
        committed = parseModuleChangeReceipt(value, { context: snapshot, commandId, modules });
        return { status: 'committed' as const, receipt: committed };
      }).catch((): Outcome => ({ status: discarded ? 'discarded' : 'unconfirmed' })).finally(() => { inFlight = undefined; });
      return inFlight;
    },
  });
}
