'use client';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { workspaceScope } from '@/lib/workspace-context';
import { createInboxTone } from '@/lib/notifications/sound';
import { createSoundSettings, INITIAL_SOUND, type SoundSettings } from '@/lib/notifications/sound-settings';
import type { InboxScope } from '@/lib/notifications/inbox-state';

type Value = SoundSettings & { enable(): Promise<void>; disable(): void; play(): boolean; fail(): void };
const Context = createContext<Value>({ ...INITIAL_SOUND, enable: async () => {}, disable() {}, play: () => false, fail() {} });
export function NotificationSoundProvider({ children }: { children: ReactNode }) {
  const { user, role, loading } = useAuth();
  const scope = workspaceScope(user);
  if (process.env.NEXT_PUBLIC_BPS_CONVERSATION_ENABLED !== 'true' || loading || !scope || (role !== 'yonetici' && role !== 'operasyon')) return <Context.Provider value={{ ...INITIAL_SOUND, enable: async () => {}, disable() {}, play: () => false, fail() {} }}>{children}</Context.Provider>;
  return <ScopedSound key={`${scope.actorId}:${scope.tenantId}:${role}`} scope={scope}>{children}</ScopedSound>;
}
function ScopedSound({ scope, children }: { scope: InboxScope; children: ReactNode }) {
  const [state, setState] = useState<SoundSettings>(INITIAL_SOUND);
  const controller = useMemo(() => createSoundSettings(scope, {
    storage: () => localStorage,
    supportsLocks: () => typeof navigator.locks?.request === 'function',
    tone: createInboxTone,
    visible: () => document.visibilityState === 'visible',
  }, setState), [scope.actorId, scope.tenantId]);
  useEffect(() => {
    controller.mount();
    const sync = (event: StorageEvent) => { try { if (event.storageArea === localStorage) controller.storageChanged(event.key); } catch { controller.fail(); } };
    window.addEventListener('storage', sync);
    return () => { controller.dispose(); window.removeEventListener('storage', sync); };
  }, [controller]);
  const value = useMemo(() => ({ ...state, enable: controller.enable, disable: controller.disable, play: controller.play, fail: controller.fail }), [state, controller]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export const useNotificationSound = () => useContext(Context);
