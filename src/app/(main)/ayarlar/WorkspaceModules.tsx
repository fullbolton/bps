"use client";

import ModuleChangeHistory from "./ModuleChangeHistory";
import ModuleChangePreview from "./ModuleChangePreview";
import {useCallback, useMemo} from "react";
import {useAuth} from "@/context/AuthContext";
import {useScopedResource} from "@/components/ui/useScopedResource";
import {createClient} from "@/lib/supabase/client";
import {loadCurrentWorkspaceModules} from "@/lib/services/workspace-modules";
import {createModuleChangeCapability} from "@/lib/services/module-change";
import {MODULE_CATALOG} from "@/lib/modules/catalog";

/** The release flag exposes UI only; the database command independently authorizes every write. */
export default function WorkspaceModules({changesEnabled = false}: {changesEnabled?: boolean}) {
  const {user, role, loading} = useAuth();
  const actorId = user?.id;
  const tenantId = user?.app_metadata.active_tenant;
  const allowed = !loading && role === "yonetici" && !!actorId && !!tenantId;
  const read = useCallback(async () => {
    if (!actorId || !tenantId || role !== "yonetici") throw Error("MODULE_SCOPE");
    try {return {context:await loadCurrentWorkspaceModules(createClient(), {actorId, tenantId, role}),updateRequired:false};}
    catch(error){
      if(error instanceof Error&&error.message==="MODULE_CLIENT_UPDATE_REQUIRED")return {context:null,updateRequired:true};
      throw error;
    }
  }, [actorId, tenantId, role]);
  const resource = useScopedResource(allowed ? `${actorId}:${tenantId}:${role}` : null, read);
  const data=resource.data?.context;
  const commit = useMemo(() => changesEnabled ? createModuleChangeCapability(createClient(), async () => {
    // Recreate auth/module providers and navigation together after a verified commit.
    // A partial panel reload would leave other mounted module snapshots stale.
    window.location.replace("/ayarlar?bolum=moduller");
  }) : undefined, [changesEnabled]);
  if (loading) return <p role="status">Şirket ve yetkileriniz doğrulanıyor…</p>;
  if (!allowed) return <p role="alert">Modül bilgilerini görmek için seçili şirkette yönetici erişimi gerekir.</p>;
  return <section aria-label="Şirket modülleri" className="space-y-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h2 className="text-lg font-semibold text-slate-900">Şirket modülleri</h2>
        <p className="mt-1 text-sm text-slate-600">Bu şirketin kullandığı bölümler. Her kullanıcının erişimi ayrıca rolüne bağlıdır.</p></div>
      <button type="button" disabled={resource.loading} onClick={() => void resource.reload()} className="min-h-11 rounded-lg border border-slate-300 px-4 text-sm disabled:opacity-50">Durumu yenile</button>
    </div>
    <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">{changesEnabled ? "Değişiklikleri inceleyip onayladıktan sonra şirket ayarları güncellenir. Kapatılan modülün verileri silinmez." : "Bu ekranda mevcut durum gösterilir. Modül açma ve kapatma henüz kullanıma açık değildir."}</p>
    {resource.loading && <p role="status">Modül bilgileri yükleniyor…</p>}
    {resource.error && <p role="alert" className="text-sm text-red-700">Modül bilgileri alınamadı. Durumu yenileyerek tekrar deneyin.</p>}
    {resource.data?.updateRequired&&<div role="alert" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
      <p>Modül ayarlarının sürümü değişti. Güncel ayarları görmek için sayfayı yenileyin. Önce açık formlarınızdaki değişiklikleri kaydedin.</p>
      <button type="button" onClick={()=>window.location.reload()} className="mt-2 min-h-11 rounded-lg border border-amber-300 px-3 font-medium">Sayfayı yenile</button>
    </div>}
    {data && <>
      <p className="text-sm font-medium text-slate-800">{data.name}</p>
      <ul className="grid gap-3 sm:grid-cols-2">
        {MODULE_CATALOG.map(module => <li key={module.key} className="min-w-0 rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-start justify-between gap-3"><h3 className="font-semibold text-slate-900">{module.name}</h3>
            <span className={`shrink-0 rounded-full px-2 py-1 text-xs font-medium ${data!.modules[module.key] ? "bg-green-50 text-green-800" : "bg-slate-100 text-slate-600"}`}>{data!.modules[module.key] ? "Açık" : "Kapalı"}</span></div>
          <p className="mt-2 text-sm text-slate-600">{module.description}</p>
          {module.requires.length > 0 && <p className="mt-3 text-xs text-slate-500">Gerekli modüller: {module.requires.map(key => MODULE_CATALOG.find(item => item.key === key)!.name).join(", ")}</p>}
        </li>)}
      </ul>
      <ModuleChangeHistory key={`history:${data.actorId}:${data.tenantId}:${data.membershipVersion}:${data.selectionVersion}`} context={data} />
      <ModuleChangePreview key={`${data.actorId}:${data.tenantId}:${data.membershipVersion}:${data.selectionVersion}:${data.configRevision}`} context={data} commit={commit} />
    </>}
  </section>;
}
