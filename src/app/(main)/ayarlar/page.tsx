"use client";

import { useState, useCallback, useRef } from "react";
import {
  PageHeader,
  TabNavigation,
  DataTable,
  EmptyState,
} from "@/components/ui";
import Link from "next/link";
import { useNavigationGuard } from "@/context/NavigationGuardContext";
import { useRole } from "@/context/RoleContext";
import { useAuth } from "@/context/AuthContext";
import { createClient } from "@/lib/supabase/client";
import { useScopedResource } from "@/components/ui/useScopedResource";
import { listActiveTenantProfiles } from "@/lib/services/profiles";
import type { TabItem, ColumnDef } from "@/types/ui";

// ---------------------------------------------------------------------------
// Static configuration dictionaries
// Inline, not dynamic truth — these are product vocabulary constants.
// ---------------------------------------------------------------------------

interface AyarUserEntry {
  id: string;
  ad: string;
  rol: string;
  eposta: string;
}

interface AyarRolEntry {
  id: string;
  rolAdi: string;
  aciklama: string;
}

// Canonical 6-role BPS model. Order + slugs match the real role enum
// (yonetici, partner, operasyon, ik, muhasebe, goruntuleyici) used by
// RoleContext / migrations / ROLE_MATRIX. This array is reference
// material only — shown in the collapsed role guide. Role management
// is not built here; ROLE_MATRIX.md is the source of truth.
const ROLLER: AyarRolEntry[] = [
  { id: "r1", rolAdi: "Yönetici", aciklama: "Kurumsal görünürlük, kontrol, kritik aksiyon ve yapılandırma yönetimi" },
  { id: "r2", rolAdi: "Partner", aciklama: "Atanmış portföyünde firma, sözleşme ve operasyonel takip" },
  { id: "r3", rolAdi: "Operasyon", aciklama: "Personel talebi, aktif iş gücü, evrak takibi ve operasyonel görev akışı" },
  { id: "r4", rolAdi: "İK", aciklama: "Evrak uyumu ve personel belge tamamlama" },
  { id: "r5", rolAdi: "Muhasebe", aciklama: "Finansal veri girişi, alacak takibi ve faturalama görünürlüğü" },
  { id: "r6", rolAdi: "Görüntüleyici", aciklama: "Yalnızca okuma — takip ve rapor görünürlüğü" },
];

import {
  TYPE_BODY,
  TYPE_CAPTION,
  TYPE_CARD_TITLE,
  TEXT_PRIMARY,
  TEXT_BODY,
  TEXT_SECONDARY,
  TEXT_MUTED,
  SURFACE_PRIMARY,
  SURFACE_HEADER,
  BORDER_DEFAULT,
  BORDER_SUBTLE,
  RADIUS_DEFAULT,
  RADIUS_SM,
  BUTTON_PRIMARY,
} from "@/styles/tokens";

// ---------------------------------------------------------------------------
// Tabs
// ---------------------------------------------------------------------------

const TABS: TabItem[] = [
  { key: "kullanicilar", label: "Şirket ekibi" },
  { key: "erisim-talepleri", label: "Platform başvuruları" },
];

const COLUMNS_USERS: ColumnDef<AyarUserEntry>[] = [
  { key: "ad", header: "Ad Soyad", sortable: true },
  { key: "rol", header: "Rol", sortable: true },
  { key: "eposta", header: "E-posta" },
];

const COLUMNS_ROLES: ColumnDef<AyarRolEntry>[] = [
  { key: "rolAdi", header: "Rol Adı", sortable: true },
  {
    key: "aciklama",
    header: "Açıklama",
    render: (val) => <span className={`${TYPE_BODY} ${TEXT_BODY}`}>{val as string}</span>,
  },
];

// ---------------------------------------------------------------------------
// Access request types
// ---------------------------------------------------------------------------

interface AccessRequest {
  id: string;
  full_name: string;
  email: string;
  birim: string;
  status: "beklemede" | "onaylandi" | "reddedildi";
  created_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
}

const BIRIM_DISPLAY: Record<string, string> = {
  operasyon: "Operasyon",
  satis: "Satış",
  ik: "İK",
  muhasebe: "Muhasebe",
  diger: "Diğer",
};

// ---------------------------------------------------------------------------
// Kullanıcılar Tab — real profiles read (yonetici-only surface)
// ---------------------------------------------------------------------------
// Tenant-scoped profiles; stale responses are discarded when the account or company changes.
const ROL_DISPLAY: Record<string, string> = {
  yonetici: "Yönetici",
  partner: "Partner",
  operasyon: "Operasyon",
  ik: "İK",
  muhasebe: "Muhasebe",
  goruntuleyici: "Görüntüleyici",
};

function UsersTab() {
  const { user, role } = useAuth();
  const tenantId = user?.app_metadata.active_tenant;
  const reader = useCallback(async (): Promise<AyarUserEntry[]> => {
    const rows = await listActiveTenantProfiles(createClient());
    return rows.map(p => ({ id: p.id, ad: p.display_name, rol: ROL_DISPLAY[p.role] ?? p.role, eposta: p.email }));
  }, []);
  const resource = useScopedResource(user && typeof tenantId === "string" ? `${user.id}:${tenantId}:${role}` : null, reader);
  if (resource.loading) return <p role="status" className="p-6 text-sm text-slate-600">Şirket ekibi yükleniyor…</p>;
  if (resource.error) return <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4"><p>Şirket ekibi yüklenemedi.</p><button type="button" onClick={() => void resource.reload()} className="mt-2 min-h-11 text-sm font-medium text-blue-700 underline">Yeniden dene</button></div>;
  if (!resource.data) return <p role="status" className="p-6 text-sm text-slate-600">Şirket erişimi doğrulanıyor…</p>;
  return <DataTable<AyarUserEntry> columns={COLUMNS_USERS} data={resource.data} rowKey="id" emptyTitle="Şirket ekibinde kullanıcı bulunamadı" emptyDescription="Şirket erişimini kontrol edin. Yeni ekip üyeleri için Ekip davetleri bağlantısını kullanabilirsiniz." />;
}

// ---------------------------------------------------------------------------
// Access Requests Review Component
// ---------------------------------------------------------------------------

function AccessRequestsTab() {
  const { user, role } = useAuth();
  const inFlight = useRef(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const fetchRequests = useCallback(async () => {
    const supabase = createClient();
    const permission = await supabase.rpc("is_platform_admin");
    if (permission.error || typeof permission.data !== "boolean") throw new Error("permission");
    if (!permission.data) return { allowed: false, rows: [] as AccessRequest[] };
    const { data, error } = await supabase.from("access_requests")
      .select("id,full_name,email,birim,status,created_at,reviewed_at,reviewed_by")
      .order("created_at", { ascending: false }).order("id", { ascending: false }).limit(100);
    if (error || !Array.isArray(data)) throw new Error("read");
    return { allowed: true, rows: data as AccessRequest[] };
  }, []);
  const resource = useScopedResource(user ? `${user.id}:${role}` : null, fetchRequests);
  const requests = resource.data?.rows ?? [];
  const loading = resource.loading;

  async function handleAction(id: string, newStatus: "onaylandi" | "reddedildi") {
    if (inFlight.current || !resource.data?.allowed || !user) return;
    inFlight.current = true;
    setActionLoading(id);
    setActionError(null);
    try {
      const { data, error } = await createClient().from("access_requests")
        .update({ status: newStatus, reviewed_at: new Date().toISOString(), reviewed_by: user.email ?? user.id })
        .eq("id", id).eq("status", "beklemede").select("id,status").single();
      if (error || data?.id !== id || data.status !== newStatus) {
        throw new Error("İşlem doğrulanamadı veya talep başka bir yönetici tarafından değerlendirildi. Listeyi yenileyerek kontrol edin.");
      }
      await resource.reload();
    } catch {
      setActionError("İşlem doğrulanamadı veya talep başka bir yönetici tarafından değerlendirildi. Listeyi yenileyerek kontrol edin.");
    } finally {
      inFlight.current = false;
      setActionLoading(null);
    }
  }

  if (resource.error) return <div role="alert"><p>Erişim talepleri okunamadı.</p><button type="button" onClick={() => void resource.reload()} className="min-h-11 text-blue-700 underline">Yeniden dene</button></div>;
  if (!loading && resource.data?.allowed === false) return <EmptyState title="Platform yönetimine özel" description="Erişim başvurularını yalnız platform yöneticisi inceleyebilir. Şirket ekibinizi Çalışma alanı kurulumu bölümünden davet edebilirsiniz." size="tab" />;

  const pending = requests.filter((r) => r.status === "beklemede");
  const reviewed = requests.filter((r) => r.status !== "beklemede");

  if (loading) {
    return (
      <div
        className={`${SURFACE_HEADER} border ${BORDER_DEFAULT} ${RADIUS_DEFAULT} px-4 py-12 text-center`}
      >
        <p className={`${TYPE_BODY} ${TEXT_MUTED}`}>Yükleniyor…</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600"><p>En son 100 platform başvurusu gösterilir. Onay, kullanıcı hesabı veya şirket üyeliği oluşturmaz.</p><button type="button" disabled={actionLoading !== null} onClick={() => void resource.reload()} className="min-h-11 text-blue-700 underline disabled:opacity-50">Listeyi yenile</button></div>
      {actionError && (
        <p className={`${TYPE_CAPTION} text-red-600`} role="alert" aria-live="polite">
          {actionError}
        </p>
      )}
      {/* Pending requests */}
      <div>
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <h3 className={`${TYPE_CARD_TITLE} ${TEXT_PRIMARY}`}>Bekleyen Talepler</h3>
          {pending.length > 0 && (
            <span
              className="inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 text-[10px] font-semibold leading-none rounded-full bg-amber-100 text-amber-800 ring-1 ring-inset ring-amber-200/60"
              aria-label={`${pending.length} bekleyen talep`}
            >
              {pending.length}
            </span>
          )}
        </div>
        {pending.length === 0 ? (
          <EmptyState
            title="Bekleyen Talep Yok"
            description="Yeni erişim talepleri burada listelenir."
            size="tab"
          />
        ) : (
          <div className={`${SURFACE_PRIMARY} border ${BORDER_DEFAULT} ${RADIUS_DEFAULT} overflow-hidden`}>
            {pending.map((req, idx) => (
              <div
                key={req.id}
                className={`p-4 ${idx < pending.length - 1 ? `border-b ${BORDER_SUBTLE}` : ""}`}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                  <div className="min-w-0 flex-1">
                    <p className={`${TYPE_BODY} font-medium ${TEXT_PRIMARY}`}>{req.full_name}</p>
                    <p className={`${TYPE_CAPTION} ${TEXT_SECONDARY} mt-1 break-all`}>{req.email}</p>
                    <p className={`${TYPE_CAPTION} ${TEXT_MUTED} mt-1.5`}>
                      Birim: {BIRIM_DISPLAY[req.birim] ?? req.birim}
                      <span className="text-slate-300 mx-1.5" aria-hidden>
                        ·
                      </span>
                      {new Date(req.created_at).toLocaleDateString("tr-TR")}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 sm:flex-nowrap sm:justify-end sm:flex-shrink-0 sm:pt-0.5">
                    <button
                      type="button"
                      onClick={() => handleAction(req.id, "onaylandi")}
                      disabled={actionLoading === req.id}
                      className={`flex-1 min-w-[5.5rem] sm:flex-initial px-3 py-2 ${TYPE_CAPTION} font-medium text-center text-green-800 bg-green-50 border border-green-200/90 ${RADIUS_SM} hover:bg-green-100 disabled:opacity-50 transition-colors`}
                    >
                      Onayla
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAction(req.id, "reddedildi")}
                      disabled={actionLoading === req.id}
                      className={`flex-1 min-w-[5.5rem] sm:flex-initial px-3 py-2 ${TYPE_CAPTION} font-medium text-center text-red-800 bg-red-50 border border-red-200/90 ${RADIUS_SM} hover:bg-red-100 disabled:opacity-50 transition-colors`}
                    >
                      Reddet
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recently reviewed */}
      {reviewed.length > 0 && (
        <div>
          <h3 className={`${TYPE_CARD_TITLE} ${TEXT_SECONDARY} mb-3`}>Son İşlenenler</h3>
          <div className={`${SURFACE_PRIMARY} border ${BORDER_DEFAULT} ${RADIUS_DEFAULT} overflow-hidden divide-y divide-slate-100`}>
            {reviewed.slice(0, 10).map((req) => (
              <div key={req.id} className="p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className={`${TYPE_BODY} font-medium ${TEXT_PRIMARY}`}>{req.full_name}</p>
                    <p className={`${TYPE_CAPTION} ${TEXT_SECONDARY} break-all`}>{req.email}</p>
                    <p className={`${TYPE_CAPTION} ${TEXT_MUTED} pt-1 border-t border-slate-100`}>
                      {BIRIM_DISPLAY[req.birim] ?? req.birim}
                      {req.reviewed_at && (
                        <>
                          <span className="text-slate-300 mx-1.5" aria-hidden>
                            ·
                          </span>
                          {new Date(req.reviewed_at).toLocaleDateString("tr-TR")}
                        </>
                      )}
                      {req.reviewed_by && (
                        <>
                          <span className="text-slate-300 mx-1.5" aria-hidden>
                            ·
                          </span>
                          <span className="break-all">{req.reviewed_by}</span>
                        </>
                      )}
                    </p>
                  </div>
                  <span
                    className={`${TYPE_CAPTION} font-semibold flex-shrink-0 sm:pt-0.5 ${
                      req.status === "onaylandi" ? "text-green-600" : "text-red-600"
                    }`}
                  >
                    {req.status === "onaylandi" ? "Onaylandı" : "Reddedildi"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AyarlarPage() {
  const { role } = useRole();
  const { loading: authLoading } = useAuth();
  const guard = useNavigationGuard();
  const [activeTab, setActiveTab] = useState("kullanicilar");

  // Auth not resolved yet — don't flash "Erişim kısıtlı" (role defaults to
  // "goruntuleyici" while AuthContext is loading). Wait, then decide.
  if (authLoading) {
    return (
      <>
        <PageHeader title="Ayarlar" subtitle="Şirket ekibi, davetler ve erişim başvuruları" />
        <EmptyState title="Yükleniyor…" description="Yetki bilgisi kontrol ediliyor." size="page" />
      </>
    );
  }

  if (role !== "yonetici") {
    return (
      <>
        <PageHeader title="Ayarlar" subtitle="Şirket ekibi, davetler ve erişim başvuruları" />
        <EmptyState
          title="Erişim kısıtlı"
          description="Bu ekran yönetici erişimi gerektirir."
          size="page"
        />
      </>
    );
  }

  return (
    <>
      <PageHeader title="Ayarlar" subtitle="Şirket ekibi, davetler ve erişim başvuruları" />
      <div className="mb-5 grid gap-3 sm:grid-cols-2">
        <Link href="/kurulum" onClick={guard.handle} className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-blue-900 hover:bg-blue-100 focus-visible:outline-2 focus-visible:outline-blue-600"><span className="block font-semibold">Ekip davetleri ve kurulum →</span><span className="mt-1 block text-sm">Ekibe erişim verin; firma, şube ve ilk plan adımlarını tamamlayın.</span></Link>
        <Link href="/yonetim" onClick={guard.handle} className="rounded-xl border border-slate-200 bg-white p-4 text-slate-800 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-blue-600"><span className="block font-semibold">İş dağılımını görüntüle →</span><span className="mt-1 block text-sm">Kimde hangi iş var, hangi işler üstlenilmeyi bekliyor görün.</span></Link>
      </div>
      <div className="space-y-4">
        <TabNavigation tabs={TABS} activeTab={activeTab} onTabChange={setActiveTab} />
        {activeTab === "kullanicilar" && <>
          <p className="text-sm text-slate-600">Seçili şirketin kullanıcıları ve mevcut rolleri. Yeni bir ekip üyesi için Ekip davetleri ve kurulum bölümünü açın.</p>
          <UsersTab />
          <details className="rounded-xl border border-slate-200 bg-white p-4">
            <summary className="min-h-11 cursor-pointer font-medium text-slate-700 focus-visible:outline-2 focus-visible:outline-blue-600">Roller hakkında</summary>
            <p className="mb-3 text-sm text-slate-500">Genel rol açıklamalarıdır; bu bölüm yetki değiştirmez. Erişim, şirket üyeliği ve ilgili ekranın yetki kurallarına bağlıdır.</p>
            <DataTable<AyarRolEntry> columns={COLUMNS_ROLES} data={ROLLER} rowKey="id" />
          </details>
        </>}
        {activeTab === "erisim-talepleri" && <>
          <p className="text-sm text-slate-600">Platforma gelen başvurular içindir. Şirketinize ekip üyesi eklemek için Ekip davetleri ve kurulum bölümünü kullanın.</p>
          <AccessRequestsTab />
        </>}
      </div>
    </>
  );
}
