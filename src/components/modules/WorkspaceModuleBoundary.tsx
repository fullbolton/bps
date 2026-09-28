"use client";

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRole } from '@/context/RoleContext';
import { createClient } from '@/lib/supabase/client';
import { loadCurrentWorkspaceModules } from '@/lib/services/workspace-modules';
import type { WorkspaceModuleContext } from '@/lib/modules/context';
import type { ModuleKey } from '@/lib/modules/catalog';
import { EmptyState } from '@/components/ui';

type Props = {
  requiredModule?: ModuleKey;
  allowedRoles?: readonly string[];
  children: (workspace: WorkspaceModuleContext) => ReactNode;
};

/** Page-entry snapshot, not a security boundary. SQL guards every supported command.
 * No focus polling: rechecking must not silently discard a user's open form.
 * Actor/tenant/role changes unmount the old page, including pending callbacks.
 */
export default function WorkspaceModuleBoundary(props: Props) {
  const { user, loading } = useAuth();
  const { role } = useRole();
  if (loading) return <EmptyState title="Yükleniyor…" description="Çalışma alanı kontrol ediliyor." size="page" />;
  if (!user || (props.allowedRoles && !props.allowedRoles.includes(role))) {
    return <EmptyState title="Erişim kısıtlı" description="Bu ekrana erişim yetkiniz yok." size="page" />;
  }
  const tenantId = user.app_metadata?.active_tenant;
  if (typeof tenantId !== 'string') return <EmptyState title="Çalışma alanı doğrulanamadı" description="Sayfayı yenileyip çalışma alanınızı tekrar seçin." size="page" />;
  return <VerifiedPage key={JSON.stringify([user.id, tenantId, role])} {...props} actorId={user.id} tenantId={tenantId} role={role} />;
}

function VerifiedPage({ actorId, tenantId, role, requiredModule, children }: Props & {actorId:string;tenantId:string;role:string}) {
  const client = useMemo(() => createClient(), []);
  const [context, setContext] = useState<WorkspaceModuleContext | null>(null);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setContext(null); setError(false);
    void loadCurrentWorkspaceModules(client, {actorId, tenantId, role})
      .then(value => { if (active) setContext(value); })
      .catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [client, actorId, tenantId, role, retry]);
  if (error) return <EmptyState title="Çalışma alanı yüklenemedi" description="Modül ayarları doğrulanamadı. Tekrar deneyin." size="page" action={{label:'Tekrar dene',onClick:() => setRetry(value => value + 1)}} />;
  if (!context) return <EmptyState title="Yükleniyor…" description="Çalışma alanı kontrol ediliyor." size="page" />;
  if (requiredModule && !context.modules[requiredModule]) return <EmptyState title="Bu modül kapalı" description="Bu bölüm çalışma alanınızda etkin değil. Kayıtlarınız korunuyor." size="page" />;
  return children(context);
}
