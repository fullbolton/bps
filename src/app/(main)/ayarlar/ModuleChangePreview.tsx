"use client";

import { useCallback, useRef, useState } from "react";
import { useScopedResource } from "@/components/ui/useScopedResource";
import { MODULE_CATALOG, type ModuleStates } from "@/lib/modules/catalog";
import type { WorkspaceModuleContext } from "@/lib/modules/context";
import { previewWorkspaceModules } from "@/lib/services/workspace-modules";
import { createClient } from "@/lib/supabase/client";

import ModuleChangeCommit from './ModuleChangeCommit';
import type { createModuleChangeAttempt, ModuleChangePayload } from '@/lib/modules/change-attempt';

type CommitCapability = {
  prepare: (context: WorkspaceModuleContext, modules: ModuleStates) => ReturnType<typeof createModuleChangeAttempt>;
  transport: (payload: ModuleChangePayload) => Promise<unknown>;
  refresh: () => Promise<void>;
};

const moduleName = (key: string) => MODULE_CATALOG.find(module => module.key === key)!.name;

/** Mounted only with a verified snapshot; the parent unmounts it on refresh/scope change. */
export default function ModuleChangePreview({ context, commit }: { context: WorkspaceModuleContext; commit?: CommitCapability }) {
  const [attempt, setAttempt] = useState<ReturnType<typeof createModuleChangeAttempt> | null>(null);
  const locked = useRef(false);
  const [prepareError, setPrepareError] = useState(false);
  const [draft, setDraft] = useState<ModuleStates>(context.modules);
  const [requested, setRequested] = useState<ModuleStates | null>(null);
  const read = useCallback(async () => {
    if (!requested) throw Error("MODULE_PREVIEW_INPUT");
    return previewWorkspaceModules(createClient(), context, context.configRevision, requested);
  }, [context, requested]);
  const preview = useScopedResource(requested ? context.configRevision : null, read);
  const changed = MODULE_CATALOG.filter(module => draft[module.key] !== context.modules[module.key]);
  const result = requested ? preview.data : null;
  const blockers = result?.checks.filter(check => check.blocking) ?? [];

  const canPrepare = !!commit && !!result && !preview.loading && !preview.error
    && changed.length > 0 && !blockers.length && !result.dependencies.length
    && MODULE_CATALOG.every(module => result.requested[module.key] === draft[module.key]);
  function prepare() {
    if (!commit || !canPrepare || locked.current) return;
    locked.current = true;
    try { setAttempt(commit.prepare(context, { ...draft })); setPrepareError(false); }
    catch { locked.current = false; setPrepareError(true); }
  }

  return <section aria-label="Modül değişikliği önizlemesi" className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
    <div>
      <h3 className="font-semibold text-slate-900">Değişiklikleri incele</h3>
      <p className="mt-1 text-sm text-slate-600">Kullanmak istediğiniz modülleri seçin; açık işleri ve gerekli bağlantıları kontrol edin. Bu seçimler şirket ayarlarını değiştirmez.</p>
    </div>
    <fieldset disabled={!!attempt} className="grid gap-2 sm:grid-cols-2">
      <legend className="sr-only">Önizleme için modül seçimi</legend>
      {MODULE_CATALOG.map(module => <label key={module.key} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-slate-200 px-3 py-2">
        <input type="checkbox" checked={draft[module.key]} onChange={event => {
          if (locked.current) return;
          setPrepareError(false);
          setDraft(current => ({ ...current, [module.key]: event.target.checked }));
          setRequested(null);
        }} className="h-4 w-4 accent-blue-600" />
        <span className="text-sm">{module.name}</span>
      </label>)}
    </fieldset>
    {changed.length > 0 ? <ul aria-label="Planlanan değişiklikler" className="text-sm text-slate-700">
      {changed.map(module => <li key={module.key}>{module.name}: {draft[module.key] ? "açılması planlanıyor" : "kapatılması planlanıyor"}</li>)}
    </ul> : <p className="text-sm text-slate-500">Henüz değişiklik seçilmedi.</p>}
    <div className="flex flex-wrap gap-2">
      <button type="button" disabled={!!attempt || !changed.length || (!!requested && preview.loading)} onClick={() => { if (!locked.current) setRequested({ ...draft }); }} className="min-h-11 rounded-lg bg-blue-600 px-4 text-sm font-medium text-white disabled:opacity-50">Etkisini kontrol et</button>
      <button type="button" disabled={!!attempt || !changed.length} onClick={() => { if (locked.current) return; setPrepareError(false); setDraft(context.modules); setRequested(null); }} className="min-h-11 rounded-lg border border-slate-300 px-4 text-sm">Seçimleri sıfırla</button>
    </div>
    {requested && preview.loading && <p role="status" className="text-sm">Açık işler ve modül bağlantıları kontrol ediliyor…</p>}
    {requested && preview.error && <p role="alert" className="text-sm text-red-700">Kontrol tamamlanamadı. Tekrar deneyin; şirket ayarları veya yetkiniz değiştiyse Durumu yenile ile güncel bilgileri alın.</p>}
    {result && <div aria-label="Önizleme sonucu" className="space-y-3 border-t border-slate-200 pt-4">
      <p className="text-sm text-slate-500">Kontrol tarihi: {result.assessmentDate.split("-").reverse().join(".")}</p>
      {result.dependencies.length > 0 && <ul className="space-y-2 text-sm text-amber-800">{result.dependencies.map(item => <li key={`${item.module}:${item.requires}`}>{moduleName(item.module)} açık kalacaksa {moduleName(item.requires)} de açık olmalı.</li>)}</ul>}
      {blockers.length > 0 && <ul className="space-y-2 text-sm text-amber-800">{blockers.map(check => <li key={check.code}>{check.label} <a href={check.href} className="font-medium underline">İlgili kayıtları aç</a></li>)}</ul>}
      {!result.dependencies.length && !blockers.length && <p className="text-sm text-slate-700">Bu kontrolde değişikliği engelleyen açık iş veya eksik modül bağlantısı bulunmadı.</p>}
      {!commit && <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">Bu bir önizlemedir; hiçbir ayar kaydedilmedi. Modül açma ve kapatma henüz kullanıma açık değildir.</p>}
      {commit && !attempt && canPrepare && <button type="button" onClick={prepare} className="min-h-11 rounded-lg bg-blue-600 px-4 text-sm font-medium text-white">Kaydetmeden önce onayla</button>}
      {prepareError && <p role="alert">Kayıt hazırlanamadı. Tekrar deneyin.</p>}
      {commit && attempt && <ModuleChangeCommit context={context} attempt={attempt} transport={commit.transport} refresh={commit.refresh} onBack={() => { attempt.discard(); locked.current = false; setAttempt(null); }} />}
    </div>}
  </section>;
}
