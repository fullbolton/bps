"use client";

import { useCallback } from "react";
import Link from "next/link";
import NotificationSoundControls from "@/components/communication/NotificationSoundControls";
import DisplayNameEditor from "./DisplayNameEditor";
import { useAuth } from "@/context/AuthContext";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useNavigationGuard } from "@/context/NavigationGuardContext";
import { useScopedResource } from "@/components/ui/useScopedResource";
import { getCurrentProfile } from "@/lib/services/profiles";
import { createClient } from "@/lib/supabase/client";

const roles = { yonetici: "Yönetici", partner: "Partner", operasyon: "Operasyon", ik: "İK", muhasebe: "Muhasebe", goruntuleyici: "Görüntüleyici" };
const button = "inline-flex min-h-11 items-center rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 focus-visible:outline-2 focus-visible:outline-blue-600";

export default function AccountDetails({ conversations, unifiedInbox=false }: { conversations: boolean; unifiedInbox?: boolean }) {
  const { user, role, loading, refreshProfile } = useAuth();
  const { workspace, loading: workspaceLoading, error: workspaceError, reload } = useWorkspace();
  const guard = useNavigationGuard();
  const actorId = user?.id;
  const read = useCallback(async () => {
    const profile = await getCurrentProfile(createClient());
    if (!profile || profile.id !== actorId || typeof profile.display_name !== "string") throw Error("ACCOUNT_PROFILE");
    return profile.display_name;
  }, [actorId]);
  const profile = useScopedResource(!loading && actorId ? actorId : null, read);
  if (loading || !user) return <p role="status">Hesabınız doğrulanıyor…</p>;

  return <div className="mx-auto max-w-3xl space-y-6">
    <header><h1 className="text-2xl font-semibold text-slate-900">Hesabım</h1><p className="mt-2 text-sm text-slate-600">Hesap bilgileriniz ve bu şirketteki erişiminiz.</p></header>
    <section aria-labelledby="account-details" className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
      <h2 id="account-details" className="font-semibold text-slate-900">Hesap bilgileri</h2>
      <dl className="mt-4 grid gap-4 sm:grid-cols-2">
        {(profile.loading || profile.error) && <div><dt className="text-sm text-slate-500">Ad soyad</dt><dd className="mt-1 break-words text-slate-900">{profile.error ? <span role="alert">Ad soyad yüklenemedi. <button className="min-h-11 text-blue-700 underline" onClick={() => void profile.reload()}>Yeniden dene</button></span> : profile.loading ? <span role="status">Yükleniyor…</span> : profile.data || "Ad soyad girilmemiş"}</dd></div>}
        <div><dt className="text-sm text-slate-500">Giriş e-postası</dt><dd className="mt-1 break-all text-slate-900">{user.email || "E-posta bilgisi bulunamadı"}</dd></div>
      </dl>
      {!profile.loading && !profile.error && profile.data !== null && <DisplayNameEditor key={user.id} actorId={user.id} initialName={profile.data} onSaved={refreshProfile} />}
    </section>
    <section aria-labelledby="account-workspace" className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
      <h2 id="account-workspace" className="font-semibold text-slate-900">Çalıştığınız şirket</h2>
      {workspaceLoading ? <p role="status" className="mt-4">Şirket doğrulanıyor…</p> : workspaceError || !workspace || workspace.actorId !== user.id || workspace.tenantId !== user.app_metadata.active_tenant ? <div role="alert" className="mt-4"><p>Şirket bilgisi doğrulanamadı.</p><button className={button + " mt-3"} onClick={() => void reload()}>Yeniden dene</button></div> : <dl className="mt-4 grid gap-4 sm:grid-cols-2"><div><dt className="text-sm text-slate-500">Şirket</dt><dd className="mt-1 break-words">{workspace.name}</dd></div><div><dt className="text-sm text-slate-500">Bu şirketteki rolünüz</dt><dd className="mt-1">{roles[role]}</dd></div></dl>}
      <div className="mt-4 flex flex-wrap gap-3">
        {role === "yonetici" && <Link className={button} href="/ayarlar" onClick={guard.handle}>Şirket ayarları</Link>}
      </div>
    </section>
    {((unifiedInbox && ["yonetici", "operasyon", "ik", "muhasebe", "goruntuleyici"].includes(role ?? "")) || (conversations && (role === "yonetici" || role === "operasyon"))) && <section aria-labelledby="account-notifications" className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6"><h2 id="account-notifications" className="font-semibold text-slate-900">Bildirim sesi</h2><p className="my-3 text-sm text-slate-600">{unifiedInbox ? "Size gelen bildirimlerin sesini bu tarayıcı için yönetin." : "Talep konuşmalarında size gelen etiket ve yanıtların sesini yönetin."}</p><NotificationSoundControls /></section>}
  </div>;
}
