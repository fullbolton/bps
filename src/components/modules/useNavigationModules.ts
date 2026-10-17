"use client";

import {useCallback, useMemo} from 'react';
import {useAuth} from '@/context/AuthContext';
import {useScopedResource} from '@/components/ui/useScopedResource';
import {createClient} from '@/lib/supabase/client';
import {loadCurrentWorkspaceModules} from '@/lib/services/workspace-modules';

/** Navigation snapshot only. Pages and SQL remain responsible for authorization. */
export function useNavigationModules() {
  const {user, role, loading} = useAuth();
  const actorId = user?.id;
  const tenantId = user?.app_metadata.active_tenant;
  const client = useMemo(() => createClient(), []);
  const read = useCallback(async () => {
    if (!actorId || typeof tenantId !== 'string') throw Error('MODULE_SCOPE');
    return loadCurrentWorkspaceModules(client, {actorId, tenantId, role});
  }, [client, actorId, tenantId, role]);
  const resource = useScopedResource(!loading && actorId && typeof tenantId === 'string' ? JSON.stringify([actorId,tenantId,role]) : null, read);
  return {...resource, modules: resource.data?.modules ?? null};
}
