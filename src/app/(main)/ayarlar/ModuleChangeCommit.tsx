"use client";

import { useEffect, useRef, useState } from 'react';
import type { WorkspaceModuleContext } from '@/lib/modules/context';
import type { createModuleChangeAttempt, ModuleChangePayload } from '@/lib/modules/change-attempt';

type Attempt = ReturnType<typeof createModuleChangeAttempt>;
type Props = {
  context: WorkspaceModuleContext;
  attempt: Attempt;
  transport: (payload: ModuleChangePayload) => Promise<unknown>;
  refresh: () => Promise<void>;
};

/** Integration candidate: not mounted in production. Parent must freeze the reviewed
 * draft while mounted and key this panel by actor/tenant/membership/selection. */
export default function ModuleChangeCommit({ context, attempt, transport, refresh }: Props) {
  const [state, setState] = useState<'ready' | 'saving' | 'uncertain' | 'refreshing' | 'refreshFailed' | 'done' | 'scopeError'>('ready');
  const busy = useRef(false);
  const active = useRef(true);
  const currentAttempt = useRef(attempt);
  useEffect(() => {
    currentAttempt.current = attempt;
    active.current = true;
    return () => {
      active.current = false;
      // React Strict Mode immediately replays effects on the same mount.
      void Promise.resolve().then(() => {
        if (!active.current || currentAttempt.current !== attempt) attempt.discard();
      });
    };
  }, [attempt]);
  async function reload() {
    setState('refreshing');
    try {
      await refresh();
      if (active.current) setState('done');
    } catch {
      if (active.current) setState('refreshFailed');
    }
  }
  async function submit() {
    if (busy.current || !active.current) return;
    busy.current = true;
    try {
      if (state === 'refreshFailed') { await reload(); return; }
      setState('saving');
      const outcome = await attempt.send(context, transport);
      if (!active.current || outcome.status === 'discarded') return;
      if (outcome.status === 'unconfirmed') { setState('uncertain'); return; }
      await reload();
    } catch {
      if (active.current) setState('scopeError');
    } finally { busy.current = false; }
  }
  return <section aria-label="Modül değişikliğini kaydet" className="space-y-3 rounded-xl border border-slate-200 p-4">
    {state === 'ready' && <p>İncelediğiniz modül değişiklikleri bu şirkete uygulanacak. Mevcut kayıtlar silinmez.</p>}
    {state === 'saving' && <p role="status">Değişiklikler kaydediliyor…</p>}
    {state === 'uncertain' && <p role="alert">İşlemin sonucu doğrulanamadı. Aynı işlemi tekrar deneyin; kaydedilmişse ikinci kez uygulanmaz.</p>}
    {state === 'refreshing' && <p role="status">Değişiklik kaydedildi. Güncel şirket ayarları alınıyor…</p>}
    {state === 'refreshFailed' && <p role="alert">Değişiklik kaydedildi ancak güncel ayarlar alınamadı. Ayarları yeniden yükleyin.</p>}
    {state === 'scopeError' && <p role="alert">Şirket veya yetki bilgileri doğrulanamadı. Güncel ayarları açıp değişiklikleri yeniden inceleyin.</p>}
    {state === 'done' && <p role="status">Değişiklik kaydedildi ve şirket ayarları yenilendi.</p>}
    {!['done', 'scopeError'].includes(state) && <button type="button" disabled={state === 'saving' || state === 'refreshing'} onClick={() => void submit()} className="min-h-11 rounded-lg bg-blue-600 px-4 text-sm font-medium text-white disabled:opacity-50">
      {state === 'refreshFailed' ? 'Güncel ayarları yükle' : state === 'uncertain' ? 'Aynı işlemi tekrar dene' : 'Onayla ve kaydet'}
    </button>}
  </section>;
}
