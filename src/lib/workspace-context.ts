import { isUuid } from '@/lib/operations/pilot-validation';

export type WorkspaceScope = { actorId: string; tenantId: string };
export type WorkspaceIdentity = WorkspaceScope & { name: string };

/** The claim is only a freshness key for UI. The RPC verifies live membership. */
export function workspaceScope(user: { id: string; app_metadata?: Record<string, unknown> } | null): WorkspaceScope | null {
  const tenantId = user?.app_metadata?.active_tenant;
  return user && isUuid(user.id) && isUuid(tenantId) ? { actorId: user.id, tenantId } : null;
}

export function matchesWorkspace(value: WorkspaceScope | null, expected: WorkspaceScope): boolean {
  return !!value && value.actorId === expected.actorId && value.tenantId === expected.tenantId;
}

export function parseWorkspaceIdentity(value: unknown, expected: WorkspaceScope): WorkspaceIdentity {
  if (!isUuid(expected.actorId) || !isUuid(expected.tenantId) || !value || typeof value !== 'object' || Array.isArray(value)) {
    throw Error('WORKSPACE_RESPONSE');
  }
  const data = value as Record<string, unknown>;
  if (data.actorId !== expected.actorId || data.tenantId !== expected.tenantId
    || typeof data.name !== 'string' || !data.name.trim() || data.name.length > 500
    || /[\u0000-\u001f\u007f]/.test(data.name)) throw Error('WORKSPACE_RESPONSE');
  // Only the contract fields can leave this parser; never forward extra RPC data.
  return { ...expected, name: data.name.trim() };
}
