"use client";

import { createContext, useCallback, useContext, useEffect, type ReactNode } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useScopedResource } from '@/components/ui/useScopedResource';
import { createClient } from '@/lib/supabase/client';
import { loadWorkspaceIdentity } from '@/lib/services/workspace-context';
import { workspaceScope, type WorkspaceIdentity } from '@/lib/workspace-context';

type WorkspaceContextValue = {
  workspace: WorkspaceIdentity | null;
  loading: boolean;
  error: boolean;
  reload: () => Promise<void>;
};
const WorkspaceContext = createContext<WorkspaceContextValue>({ workspace: null, loading: true, error: false, reload: async () => {} });

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const expected = workspaceScope(user), actorId = expected?.actorId, tenantId = expected?.tenantId;
  const client = createClient();
  const read = useCallback(async () => {
    if (!actorId || !tenantId) throw Error('WORKSPACE_SCOPE');
    return loadWorkspaceIdentity(client, { actorId, tenantId });
  }, [client, actorId, tenantId]);
  const resource = useScopedResource(!authLoading && actorId && tenantId ? `${actorId}:${tenantId}` : null, read);
  const reload = resource.reload;
  // Returning to an old tab revalidates the name/scope, without retaining a
  // previous workspace on failure. This does not claim to revoke other modules.
  useEffect(() => {
    const refresh = () => { if (document.visibilityState === 'visible') void reload(); };
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => { window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh); };
  }, [reload]);
  const missing = !authLoading && !expected;
  return <WorkspaceContext.Provider value={{
    workspace: missing || authLoading ? null : resource.data,
    loading: authLoading || (!missing && resource.loading),
    error: missing || resource.error,
    reload,
  }}>{children}</WorkspaceContext.Provider>;
}

export const useWorkspace = () => useContext(WorkspaceContext);
