"use client";

import { useState, useEffect, useCallback } from "react";
import {
  PageHeader,
  TabNavigation,
  DataTable,
  StatusBadge,
  EmptyState,
} from "@/components/ui";
import { useRole } from "@/context/RoleContext";
import { useAuth } from "@/context/AuthContext";
import { createClient } from "@/lib/supabase/client";
import type { TabItem, ColumnDef } from "@/types/ui";

// ---------------------------------------------------------------------------
// Static configuration dictionaries
// Inline, not dynamic truth — these are product vocabulary constants.
// ---------------------------------------------------------------------------

interface AyarDictEntry {
  id: string;
  ad: string;
  durum: "aktif" | "pasif";
}

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

interface AyarPartnerEntry {
  id: string;
  ad: string;
  sehir: string;
  durum: "aktif" | "pasif";
}

const FIRMA_ETIKETLERI: AyarDictEntry[] = [
  { id: "fe1", ad: "Lojistik", durum: "aktif" },
  { id: "fe2", ad: "Temizlik", durum: "aktif" },
  { id: "fe3", ad: "Güvenlik", durum: "aktif" },
  { id: "fe4", ad: "İnşaat", durum: "aktif" },
  { id: "fe5", ad: "Gıda", durum: "aktif" },
  { id: "fe6", ad: "Turizm", durum: "pasif" },
  { id: "fe7", ad: "Tekstil", durum: "aktif" },
  { id: "fe8", ad: "Enerji", durum: "aktif" },
];

const SOZLESME_TIPLERI: AyarDictEntry[] = [
  { id: "st1", ad: "Hizmet", durum: "aktif" },
  { id: "st2", ad: "Ek Protokol", durum: "aktif" },
];

const EVRAK_KATEGORILERI: AyarDictEntry[] = [
  { id: "ek1", ad: "Çerçeve Sözleşme", durum: "aktif" },
  { id: "ek2", ad: "Ek Protokol", durum: "aktif" },
  { id: "ek3", ad: "Yetki Belgesi", durum: "aktif" },
  { id: "ek4", ad: "Operasyon Evrakı", durum: "aktif" },
  { id: "ek5", ad: "Teklif Dosyası", durum: "aktif" },
  { id: "ek6", ad: "Ziyaret Tutanağı", durum: "aktif" },
  { id: "ek7", ad: "Diğer", durum: "aktif" },
];

const GOREV_TIPLERI: AyarDictEntry[] = [
  { id: "gt1", ad: "Manuel", durum: "aktif" },
  { id: "gt2", ad: "Randevu", durum: "aktif" },
  { id: "gt3", ad: "Sözleşme", durum: "aktif" },
];

const ROLLER: AyarRolEntry[] = [
  { id: "r1", rolAdi: "Yönetici", aciklama: "Kurumsal görünürlük, kontrol, kritik aksiyon ve yapılandırma yönetimi" },
  { id: "r2", rolAdi: "Operasyon", aciklama: "Personel talebi, aktif iş gücü, evrak takibi ve operasyonel görev akışı" },
  { id: "r3", rolAdi: "Satış", aciklama: "Firma ilişkisi, görüşme takibi, yenileme fırsatı ve müşteri teması" },
  { id: "r4", rolAdi: "İK", aciklama: "Evrak uyumu ve personel belge tamamlama" },
  { id: "r5", rolAdi: "Muhasebe", aciklama: "Finansal veri girişi, alacak takibi ve faturalama görünürlüğü" },
  { id: "r6", rolAdi: "Görüntüleyici", aciklama: "Yalnızca okuma — takip ve rapor görünürlüğü" },
];

const SEHIRLER: AyarDictEntry[] = [
  { id: "seh1", ad: "İstanbul", durum: "aktif" },
  { id: "seh2", ad: "İzmir", durum: "aktif" },
  { id: "seh3", ad: "Ankara", durum: "aktif" },
  { id: "seh4", ad: "Bursa", durum: "aktif" },
  { id: "seh5", ad: "Antalya", durum: "pasif" },
  { id: "seh6", ad: "Trabzon", durum: "aktif" },
  { id: "seh7", ad: "Edirne", durum: "aktif" },
  { id: "seh8", ad: "Konya", durum: "aktif" },
];

const OPERASYON_PARTNERLERI: AyarPartnerEntry[] = [
  { id: "op1", ad: "Ahmet B.", sehir: "İstanbul", durum: "aktif" },
  { id: "op2", ad: "Mehmet Y.", sehir: "Ankara", durum: "aktif" },
  { id: "op3", ad: "Zeynep A.", sehir: "Bursa", durum: "aktif" },
  { id: "op4", ad: "Burak Ş.", sehir: "İzmir", durum: "aktif" },
  { id: "op5", ad: "Elif Y.", sehir: "Konya", durum: "aktif" },
  { id: "op6", ad: "Burak Ş.", sehir: "Edirne", durum: "aktif" },
  { id: "op7", ad: "Fatma Ç.", sehir: "Trabzon", durum: "aktif" },
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
  { key: "kullanicilar", label: "Kullanıcılar" },
  { key: "erisim-talepleri", label: "Erişim Talepleri" },
  { key: "roller", label: "Roller" },
  { key: "firma-etiketleri", label: "Firma Etiketleri" },
  { key: "sozlesme-tipleri", label: "Sözleşme Tipleri" },
  { key: "evrak-kategorileri", label: "Evrak Kategorileri" },
  { key: "gorev-tipleri", label: "Görev Tipleri" },
  { key: "sehirler", label: "Şehirler" },
  { key: "operasyon-partnerleri", label: "Operasyon Partnerleri" },
  { key: "bildirim-kurallari", label: "Bildirim Kuralları" },
];

// ---------------------------------------------------------------------------
// Column definitions (existing)
// ---------------------------------------------------------------------------

const COLUMNS_DICT: ColumnDef<AyarDictEntry>[] = [
  { key: "ad", header: "Ad", sortable: true },
  {
    key: "durum",
    header: "Durum",
    sortable: true,
    render: (val) => <StatusBadge status={val as "aktif" | "pasif"} />,
  },
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

const COLUMNS_PARTNERS: ColumnDef<AyarPartnerEntry>[] = [
  { key: "ad", header: "Partner Adı", sortable: true },
  { key: "sehir", header: "Şehir", sortable: true },
  {
    key: "durum",
    header: "Durum",
    sortable: true,
    render: (val) => <StatusBadge status={val as "aktif" | "pasif"} />,
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
// Replaces the previous KULLANICILAR mock. The page is already yonetici-gated
// at the parent; RLS on `profiles` permits yonetici to read all rows. Maps
// the profile shape into AyarUserEntry so the existing COLUMNS_USERS and
// DataTable render identically to before. Honest empty state when no rows.
// ---------------------------------------------------------------------------

const ROL_DISPLAY: Record<string, string> = {
  yonetici: "Yönetici",
  partner: "Partner",
  operasyon: "Operasyon",
  ik: "İK",
  muhasebe: "Muhasebe",
  goruntuleyici: "Görüntüleyici",
};

function UsersTab() {
  const [users, setUsers] = useState<AyarUserEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data, error: fetchError } = await supabase
        .from("profiles")
        .select("id, display_name, role, email")
        .order("display_name", { ascending: true });
      if (cancelled) return;
      if (fetchError) {
        setError("Kullanıcılar yüklenemedi.");
        setUsers([]);
      } else {
        const mapped: AyarUserEntry[] = (data ?? []).map((p) => ({
          id: p.id,
          ad: p.display_name,
          rol: ROL_DISPLAY[p.role] ?? p.role,
          eposta: p.email,
        }));
        setUsers(mapped);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div
        className={`${SURFACE_HEADER} border ${BORDER_DEFAULT} ${RADIUS_DEFAULT} px-4 py-12 text-center`}
      >
        <p className={`${TYPE_BODY} ${TEXT_MUTED}`}>Yükleniyor…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className={`${SURFACE_HEADER} border ${BORDER_DEFAULT} ${RADIUS_DEFAULT} px-4 py-12 text-center`}
      >
        <p className={`${TYPE_BODY} text-red-600`} role="alert">
          {error}
        </p>
      </div>
    );
  }

  return (
    <DataTable<AyarUserEntry>
      columns={COLUMNS_USERS}
      data={users}
      rowKey="id"
      emptyTitle="Henüz kullanıcı yok"
    />
  );
}

// ---------------------------------------------------------------------------
// Access Requests Review Component
// ---------------------------------------------------------------------------

function AccessRequestsTab() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchRequests = useCallback(async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("access_requests")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && data) {
      setRequests(data as AccessRequest[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  async function handleAction(id: string, newStatus: "onaylandi" | "reddedildi") {
    setActionLoading(id);
    const supabase = createClient();

    const { error } = await supabase
      .from("access_requests")
      .update({
        status: newStatus,
        reviewed_at: new Date().toISOString(),
        reviewed_by: user?.email ?? "yonetici",
      })
      .eq("id", id);

    if (!error) {
      setRequests((prev) =>
        prev.map((r) =>
          r.id === id
            ? { ...r, status: newStatus, reviewed_at: new Date().toISOString(), reviewed_by: user?.email ?? "yonetici" }
            : r
        )
      );
    }
    setActionLoading(null);
  }

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
  const [activeTab, setActiveTab] = useState("kullanicilar");

  if (role !== "yonetici") {
    return (
      <>
        <PageHeader title="Ayarlar" subtitle="Sistem yapılandırması" />
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
      <PageHeader title="Ayarlar" subtitle="Sistem yapılandırması" />

      <div className="space-y-4">
        <TabNavigation tabs={TABS} activeTab={activeTab} onTabChange={setActiveTab} />

        {activeTab === "kullanicilar" && <UsersTab />}

        {activeTab === "erisim-talepleri" && (
          <AccessRequestsTab />
        )}

        {activeTab === "roller" && (
          <DataTable<AyarRolEntry>
            columns={COLUMNS_ROLES}
            data={ROLLER}
            rowKey="id"
            emptyTitle="Rol tanımı yok"
          />
        )}

        {activeTab === "firma-etiketleri" && (
          <DataTable<AyarDictEntry>
            columns={COLUMNS_DICT}
            data={FIRMA_ETIKETLERI}
            rowKey="id"
            emptyTitle="Firma etiketi yok"
          />
        )}

        {activeTab === "sozlesme-tipleri" && (
          <DataTable<AyarDictEntry>
            columns={COLUMNS_DICT}
            data={SOZLESME_TIPLERI}
            rowKey="id"
            emptyTitle="Sözleşme tipi yok"
          />
        )}

        {activeTab === "evrak-kategorileri" && (
          <DataTable<AyarDictEntry>
            columns={COLUMNS_DICT}
            data={EVRAK_KATEGORILERI}
            rowKey="id"
            emptyTitle="Evrak kategorisi yok"
          />
        )}

        {activeTab === "gorev-tipleri" && (
          <DataTable<AyarDictEntry>
            columns={COLUMNS_DICT}
            data={GOREV_TIPLERI}
            rowKey="id"
            emptyTitle="Görev tipi yok"
          />
        )}

        {activeTab === "sehirler" && (
          <DataTable<AyarDictEntry>
            columns={COLUMNS_DICT}
            data={SEHIRLER}
            rowKey="id"
            emptyTitle="Şehir yok"
          />
        )}

        {activeTab === "operasyon-partnerleri" && (
          <DataTable<AyarPartnerEntry>
            columns={COLUMNS_PARTNERS}
            data={OPERASYON_PARTNERLERI}
            rowKey="id"
            emptyTitle="Operasyon partneri yok"
          />
        )}

        {activeTab === "bildirim-kurallari" && (
          <EmptyState
            title="Bildirim Kuralları"
            description="Bildirim kuralları yapılandırması henüz kapsam dışıdır."
            size="tab"
          />
        )}
      </div>
    </>
  );
}
