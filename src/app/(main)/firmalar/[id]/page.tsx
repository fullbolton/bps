"use client";

import { use, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  StickyNote,
  CalendarCheck,
  ArrowLeft,
  AlertTriangle,
  FileText,
  Users,
  Briefcase,
  FolderOpen,
  Lightbulb,
  AtSign,
  BarChart3,
  ArrowRightLeft,
  Send,
  Calculator,
  ChevronDown,
  ChevronUp,
  Star,
  Phone,
  Mail,
  UserPlus,
  Pencil,
  Pin,
  Plus,
} from "lucide-react";
import {
  TabNavigation,
  EmptyState,
  FirmaSummaryHeader,
  CommercialSummaryCard,
  TimelineList,
  StatusBadge,
  RiskBadge,
  MarginBandBadge,
} from "@/components/ui";
import DemandTrendChart from "@/components/ui/DemandTrendChart";
import { QuickNoteModal, AddContactModal } from "@/components/modals";
import { suggestNote } from "@/lib/suggest";
import { generatePaymentFollowup } from "@/lib/draft-payment-followup";
import { generateYenidenTemasDraft } from "@/lib/draft-yeniden-temas";
import { hesaplaTeklifBedeli, DEFAULT_KAR_ORANI } from "@/lib/teklif-hesaplayici";
import { formatDateTR } from "@/lib/format-date";
import { MOCK_BAHSETMELER } from "@/mocks/bahsetmeler";
import { FIRMA_PARTNER_MAP } from "@/mocks/ayarlar";
import type { Bahsetme } from "@/mocks/bahsetmeler";
import { useRole } from "@/context/RoleContext";
import { MOCK_FIRMALAR, MOCK_FIRMA_DETAY, MOCK_FIRMA_TIMELINE } from "@/mocks/firmalar";
import { MOCK_SOZLESMELER, MOCK_SOZLESME_DETAY } from "@/mocks/sozlesmeler";
import { MOCK_RANDEVULAR, RANDEVU_TIPI_LABELS } from "@/mocks/randevular";
import { MOCK_TALEPLER } from "@/mocks/talepler";
import { MOCK_IS_GUCU } from "@/mocks/aktif-isgucu";
import { MOCK_EVRAKLAR } from "@/mocks/evraklar";
import { KATEGORI_LABELS } from "@/types/batch4";
import { getTicariBaskiByFirma, FIRMA_ALACAK_DAGILIMI, FIRMA_KESILMEMIS_DAGILIMI } from "@/mocks/finansal-ozet";
import { getContractMarjBandi, getFirmaTicariKaliteOzeti } from "@/mocks/ticari-kalite";
import { getAktifInisiyatiflerByFirma } from "@/mocks/inisiyatifler";
import { MOCK_YONLENDIRMELER, birimFromRole } from "@/mocks/yonlendirmeler";
import { MOCK_YETKILILER, replaceFirmaYetkililer } from "@/mocks/yetkililer";
import { MOCK_NOTLAR, NOT_ETIKET_LABELS } from "@/mocks/notlar";
import type { MockNot, NotEtiketi } from "@/mocks/notlar";
import type { MockYetkili } from "@/mocks/yetkililer";
import type { Yonlendirme } from "@/mocks/yonlendirmeler";
import { BIRIM_LABELS } from "@/types/yonlendirme";
import type { BirimKodu } from "@/types/yonlendirme";
import type { EvrakKategorisi } from "@/types/batch4";
import type { TabItem } from "@/types/ui";
import type { RandevuTipi } from "@/mocks/randevular";
import {
  SURFACE_PRIMARY,
  SURFACE_HEADER,
  SURFACE_OVERLAY_DARK,
  BORDER_DEFAULT,
  BORDER_SUBTLE,
  RADIUS_DEFAULT,
  RADIUS_SM,
  TYPE_BODY,
  TYPE_CARD_TITLE,
  TYPE_CAPTION,
  TYPE_KPI_VALUE,
  TEXT_PRIMARY,
  TEXT_BODY,
  TEXT_SECONDARY,
  TEXT_MUTED,
  TABLE_ROW_HOVER,
  TEXT_LINK,
  Z_OVERLAY,
} from "@/styles/tokens";

// Card container shorthand — exact same classes as before, now token-derived
const CARD = `${SURFACE_PRIMARY} border ${BORDER_DEFAULT} ${RADIUS_DEFAULT} p-4`;
const CARD_LG = `${SURFACE_PRIMARY} border ${BORDER_DEFAULT} ${RADIUS_DEFAULT} p-5`;
const CARD_TITLE = `${TYPE_CARD_TITLE} ${TEXT_PRIMARY} mb-3 flex items-center gap-1.5`;
const CARD_TITLE_PLAIN = `${TYPE_CARD_TITLE} ${TEXT_PRIMARY} mb-4`;
const LIST_DIVIDER = `border-b ${BORDER_SUBTLE} last:border-0`;

const TABS: TabItem[] = [
  { key: "genel", label: "Genel Bakış" },
  { key: "zaman-cizgisi", label: "Zaman Çizgisi" },
  { key: "yetkililer", label: "Yetkililer" },
  { key: "sozlesmeler", label: "Sözleşmeler" },
  { key: "talepler", label: "Talepler" },
  { key: "aktif-isgucu", label: "Aktif İş Gücü" },
  { key: "randevular", label: "Randevular" },
  { key: "evraklar", label: "Evraklar" },
  { key: "notlar", label: "Notlar" },
];

const DISABLED_TAB_MESSAGES: Record<string, { title: string; description: string }> = {};

export default function FirmaDetayPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { role } = useRole();
  const [activeTab, setActiveTab] = useState("genel");
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteDefaultIcerik, setNoteDefaultIcerik] = useState("");
  // Note suggestion flow state
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [suggestPrompt, setSuggestPrompt] = useState("");
  const [suggestResult, setSuggestResult] = useState<string | null>(null);
  // Payment follow-up draft state
  const [paymentDraftOpen, setPaymentDraftOpen] = useState(false);
  const [paymentDraftText, setPaymentDraftText] = useState<string | null>(null);
  const [paymentCopied, setPaymentCopied] = useState(false);
  // Mention state
  const [mentions, setMentions] = useState<Bahsetme[]>(() => MOCK_BAHSETMELER.filter((b) => b.firmaId === id));
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionAlici, setMentionAlici] = useState("");
  const [mentionMesaj, setMentionMesaj] = useState("");
  // Yönlendirme state — firma-attached routing between units
  const [yonlendirmeler, setYonlendirmeler] = useState<Yonlendirme[]>(
    () => MOCK_YONLENDIRMELER.filter((y) => y.firmaId === id)
  );
  const [yonlendirmeOpen, setYonlendirmeOpen] = useState(false);
  const [yonHedefBirim, setYonHedefBirim] = useState<BirimKodu | "">("");
  const [yonAciklama, setYonAciklama] = useState("");
  // Notlar state
  const [notlar, setNotlar] = useState<MockNot[]>(
    () => MOCK_NOTLAR.filter((n) => n.firmaId === id)
  );
  const [notEditTarget, setNotEditTarget] = useState<MockNot | null>(null);
  const [notTagFilter, setNotTagFilter] = useState<NotEtiketi | "">("");
  // Yetkili ki��iler state
  const [yetkililer, _setYetkililer] = useState<MockYetkili[]>(
    () => MOCK_YETKILILER.filter((y) => y.firmaId === id)
  );
  function setYetkililer(
    updater: MockYetkili[] | ((prev: MockYetkili[]) => MockYetkili[])
  ) {
    _setYetkililer((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      replaceFirmaYetkililer(id, next);
      return next;
    });
  }
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<MockYetkili | null>(null);
  const [editPhoneEmailOnly, setEditPhoneEmailOnly] = useState(false);
  // Ticari Temas — outbound draft helpers
  const [temasType, setTemasType] = useState<"yeniden_temas" | "odeme_takibi" | null>(null);
  const [temasDraftText, setTemasDraftText] = useState<string | null>(null);
  const [temasCopied, setTemasCopied] = useState(false);
  // Teklif Hesaplayıcı — inline offer calculator
  const [hesapOpen, setHesapOpen] = useState(false);
  const [hesapNet, setHesapNet] = useState("");
  const [hesapKar, setHesapKar] = useState(String(DEFAULT_KAR_ORANI));
  const [hesapEkOpen, setHesapEkOpen] = useState(false);
  const [hesapEk, setHesapEk] = useState("");
  const [hesapYemek, setHesapYemek] = useState("");
  const [hesapServis, setHesapServis] = useState("");
  const [hesapKiyafet, setHesapKiyafet] = useState("");

  const firma = MOCK_FIRMA_DETAY[id];
  const timeline = MOCK_FIRMA_TIMELINE[id] ?? [];

  // Active contracts for this firma
  const firmaSozlesmeler = useMemo(
    () => MOCK_SOZLESMELER.filter((s) => s.firmaId === id),
    [id]
  );
  const aktifSozlesmeler = useMemo(
    () => firmaSozlesmeler.filter((s) => s.durum === "aktif"),
    [firmaSozlesmeler]
  );

  if (!firma) {
    return (
      <div className="py-12">
        <EmptyState
          title="Firma bulunamadı"
          description="Bu ID ile eşleşen bir firma bulunamadı."
          size="page"
          action={{ label: "Firmalara Dön", onClick: () => router.push("/firmalar") }}
        />
      </div>
    );
  }

  const canCreateNotes = !["goruntuleyici", "muhasebe"].includes(role);
  const canCreateRouting = role !== "goruntuleyici";

  const headerActions = [
    ...(canCreateNotes ? [
    {
      label: "Not Ekle",
      onClick: () => { setNoteDefaultIcerik(""); setNoteOpen(true); },
      icon: <StickyNote size={16} />,
    },
      {
        label: "Not Önerisi",
        onClick: () => { setSuggestPrompt(""); setSuggestResult(null); setSuggestOpen(true); },
        icon: <Lightbulb size={16} />,
      },
    ] : []),
    {
      label: "Randevu Planla",
      onClick: () => {},
      icon: <CalendarCheck size={16} />,
      disabled: true,
    },
  ];

  return (
    <>
      {/* Back navigation */}
      <button
        onClick={() => router.push("/firmalar")}
        className={`flex items-center gap-1.5 ${TYPE_BODY} ${TEXT_SECONDARY} hover:text-slate-700 mb-4 transition-colors`}
      >
        <ArrowLeft size={16} />
        <span>Firmalar</span>
      </button>

      <FirmaSummaryHeader
        firmaAdi={firma.firmaAdi}
        durum={firma.durum}
        risk={firma.risk}
        sektor={firma.sektor}
        sehir={firma.sehir}
        partner={FIRMA_PARTNER_MAP[id]?.partnerAdi}
        actions={headerActions}
      />

      <TabNavigation
        tabs={
          role === "goruntuleyici"
            ? TABS.filter((t) => t.key === "genel")
            : role === "ik"
              ? TABS.filter((t) => ["genel", "evraklar", "talepler", "aktif-isgucu", "notlar"].includes(t.key))
              : role === "muhasebe"
                ? TABS.filter((t) => ["genel", "sozlesmeler"].includes(t.key))
                : TABS
        }
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      <div className="mt-4">
        {/* ────────────────────────────────────────────────
            Genel Bakış — 8 documented overview cards
            ──────────────────────────────────────────────── */}
        {activeTab === "genel" && (
          <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 1. Aktif Sözleşmeler — hidden for ik (contract domain) */}
            {role !== "ik" && <div className={CARD}>
              <h3 className={CARD_TITLE}>
                <FileText size={14} className={TEXT_MUTED} />
                Aktif Sözleşmeler
              </h3>
              {aktifSozlesmeler.length === 0 ? (
                <p className={`${TYPE_BODY} ${TEXT_MUTED} text-center py-3`}>
                  Aktif sözleşme yok.
                </p>
              ) : (
                <div className="space-y-2">
                  {aktifSozlesmeler.map((s) => (
                    <div
                      key={s.id}
                      className="flex items-center justify-between py-1.5"
                    >
                      <span className={`${TYPE_BODY} ${TEXT_BODY} truncate mr-3`}>
                        {s.sozlesmeAdi}
                      </span>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {s.kalanGun !== null && s.kalanGun <= 30 && (
                          <span className={`${TYPE_CAPTION} font-medium ${s.kalanGun <= 15 ? "text-red-600" : "text-amber-600"}`}>
                            {s.kalanGun} gün
                          </span>
                        )}
                        <StatusBadge status={s.durum} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {/* Preparation in-flight count */}
              {(() => {
                const hazirlikta = firmaSozlesmeler.filter(
                  (s) => (s.durum === "taslak" || s.durum === "imza_bekliyor") && MOCK_SOZLESME_DETAY[s.id]?.ticariHazirlik
                ).length;
                if (hazirlikta === 0) return null;
                return (
                  <p className={`${TYPE_CAPTION} text-amber-600 mt-2`}>
                    {hazirlikta} sözleşme hazırlık aşamasında
                  </p>
                );
              })()}
            </div>}

            {/* 2. Açık Talepler — hidden for muhasebe */}
            {role !== "muhasebe" && (() => {
              const firmaTalepler = MOCK_TALEPLER.filter((t) => t.firmaId === id);
              const acikKalanToplam = firmaTalepler.reduce((s, t) => s + t.acikKalan, 0);
              return (
                <div className={CARD}>
                  <h3 className={CARD_TITLE}>
                    <Users size={14} className={TEXT_MUTED} />
                    Açık Talepler
                  </h3>
                  <div className="flex items-baseline gap-2 py-2">
                    <span className={`${TYPE_KPI_VALUE} ${TEXT_PRIMARY}`}>{acikKalanToplam}</span>
                    <span className={`${TYPE_BODY} ${TEXT_SECONDARY}`}>açık pozisyon</span>
                  </div>
                  {firmaTalepler.filter((t) => t.acikKalan > 0).length === 0 ? (
                    <p className={`${TYPE_CAPTION} ${TEXT_MUTED}`}>Tüm talepler karşılanmış.</p>
                  ) : (
                    <div className="space-y-1.5 mt-2">
                      {firmaTalepler.filter((t) => t.acikKalan > 0).map((t) => (
                        <div key={t.id} className={`flex items-center justify-between ${TYPE_CAPTION}`}>
                          <span className="text-slate-600">{t.pozisyon}</span>
                          <span className="text-red-600 font-medium">{t.acikKalan} açık</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* 3. Aktif İş Gücü Özeti — hidden for muhasebe */}
            {role !== "muhasebe" && (() => {
              const firmaIsGucu = MOCK_IS_GUCU.find((ig) => ig.firmaId === id);
              return (
                <div className={CARD}>
                  <h3 className={CARD_TITLE}>
                    <Briefcase size={14} className={TEXT_MUTED} />
                    Aktif İş Gücü Özeti
                  </h3>
                  {firmaIsGucu ? (
                    <div className="space-y-2">
                      <div className="flex items-baseline gap-2">
                        <span className={`${TYPE_KPI_VALUE} ${TEXT_PRIMARY}`}>{firmaIsGucu.aktifKisi}</span>
                        <span className={`${TYPE_BODY} ${TEXT_SECONDARY}`}>/ {firmaIsGucu.hedefKisi} hedef</span>
                      </div>
                      {firmaIsGucu.acikFark > 0 && (
                        <p className={`${TYPE_CAPTION} text-amber-600 font-medium`}>{firmaIsGucu.acikFark} açık fark</p>
                      )}
                      <div className={`flex items-center gap-3 ${TYPE_CAPTION} ${TEXT_SECONDARY}`}>
                        <span className="text-green-600">+{firmaIsGucu.son30GunGiris} giriş</span>
                        <span className="text-red-600">−{firmaIsGucu.son30GunCikis} çıkış</span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-baseline gap-2 py-3">
                      <span className={`${TYPE_KPI_VALUE} ${TEXT_PRIMARY}`}>{firma.aktifIsGucu}</span>
                      <span className={`${TYPE_BODY} ${TEXT_SECONDARY}`}>aktif personel</span>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* 4. Yaklaşan Randevular — hidden for muhasebe, derived from source */}
            {role !== "muhasebe" && (() => {
              const planliRandevuSayisi = MOCK_RANDEVULAR.filter((r) => r.firmaId === id && r.durum === "planlandi").length;
              return (
                <div className={CARD}>
                  <h3 className={CARD_TITLE}>
                    <CalendarCheck size={14} className={TEXT_MUTED} />
                    Yaklaşan Randevular
                  </h3>
                  <div className="flex items-baseline gap-2 py-3">
                    <span className={`${TYPE_KPI_VALUE} ${TEXT_PRIMARY}`}>
                      {planliRandevuSayisi}
                    </span>
                    <span className={`${TYPE_BODY} ${TEXT_SECONDARY}`}>planlanan randevu</span>
                  </div>
                  {planliRandevuSayisi === 0 ? (
                    <p className={`${TYPE_CAPTION} ${TEXT_MUTED}`}>Planlanmış randevu yok.</p>
                  ) : (
                    <p className={`${TYPE_CAPTION} ${TEXT_MUTED}`}>
                      Detaylar Randevular sekmesinde.
                    </p>
                  )}
                </div>
              );
            })()}

            {/* 5. Eksik Evraklar — hidden for muhasebe */}
            {role !== "muhasebe" && (() => {
              const firmaEvraklar = MOCK_EVRAKLAR.filter((e) => e.firmaId === id);
              const eksikler = firmaEvraklar.filter((e) => e.durum !== "tam");
              return (
                <div className={CARD}>
                  <h3 className={CARD_TITLE}>
                    <FolderOpen size={14} className={TEXT_MUTED} />
                    Eksik Evraklar
                  </h3>
                  <div className="flex items-baseline gap-2 py-2">
                    <span className={`${TYPE_KPI_VALUE} font-semibold ${eksikler.length > 0 ? "text-amber-600" : TEXT_PRIMARY}`}>
                      {eksikler.length}
                    </span>
                    <span className={`${TYPE_BODY} ${TEXT_SECONDARY}`}>eksik / süresi dolan evrak</span>
                  </div>
                  {eksikler.length === 0 ? (
                    <p className={`${TYPE_CAPTION} ${TEXT_MUTED}`}>Tüm evraklar tamam.</p>
                  ) : (
                    <div className="space-y-1.5 mt-2">
                      {eksikler.map((e) => (
                        <div key={e.id} className={`flex items-center justify-between ${TYPE_CAPTION}`}>
                          <span className="text-slate-600 truncate mr-2">{e.evrakAdi}</span>
                          <StatusBadge status={e.durum} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* 6. Ticari Özet — hidden for görüntüleyici + ik */}
            {!["goruntuleyici", "ik"].includes(role) && (() => {
              // Use confirmed financial data if available, fall back to static mock
              const confirmedAlacak = FIRMA_ALACAK_DAGILIMI.find((a) => a.firmaId === id);
              const confirmedKesilmemis = FIRMA_KESILMEMIS_DAGILIMI.find((k) => k.firmaId === id);
              return (
                <CommercialSummaryCard
                  acikBakiye={confirmedAlacak?.acikAlacak ?? firma.acikBakiye}
                  sonFaturaTarihi={firma.sonFaturaTarihi}
                  sonFaturaTutari={firma.sonFaturaTutari}
                  kesilmemisBekleyen={confirmedKesilmemis?.kesilmemisBekleyen ?? firma.kesilmemisBekleyen}
                  ticariRisk={firma.ticariRisk}
                />
              );
            })()}

            {/* 7. Son Notlar — reads from notes state, hidden for görüntüleyici + muhasebe */}
            {!["goruntuleyici", "muhasebe"].includes(role) && <div className={CARD}>
              <h3 className={CARD_TITLE}>
                <StickyNote size={14} className={TEXT_MUTED} />
                Son Notlar
              </h3>
              {notlar.length === 0 ? (
                <p className={`${TYPE_BODY} ${TEXT_MUTED} text-center py-3`}>
                  Henüz not yok.
                </p>
              ) : (
                <div className="space-y-2">
                  {notlar.slice(0, 3).map((n) => (
                    <div key={n.id} className={`py-1.5 ${LIST_DIVIDER}`}>
                      <p className={`${TYPE_BODY} ${TEXT_BODY}`}>{n.icerik}</p>
                      <p className={`${TYPE_CAPTION} ${TEXT_MUTED} mt-0.5`}>{n.yazan} · {formatDateTR(n.tarih)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>}

            {/* 8. Risk Sinyalleri — hidden for görüntüleyici + ik + muhasebe */}
            {!["goruntuleyici", "ik", "muhasebe"].includes(role) && <div className={CARD}>
              <h3 className={CARD_TITLE}>
                <AlertTriangle size={14} className="text-amber-500" />
                Risk Sinyalleri
              </h3>
              <div className="flex items-center gap-2 mb-3">
                <RiskBadge risk={firma.risk} size="md" />
              </div>
              {/* Yönetici inisiyatif cue — extremely subtle */}
              {role === "yonetici" && (() => {
                const firmaInisiyatifler = getAktifInisiyatiflerByFirma(id);
                if (firmaInisiyatifler.length === 0) return null;
                return (
                  <p className={`${TYPE_CAPTION} text-blue-600 mb-3 flex items-center gap-1`}>
                    <span className="w-1 h-1 rounded-full bg-blue-500 flex-shrink-0" />
                    Yönetici takibinde: {firmaInisiyatifler[0].baslik}
                  </p>
                );
              })()}
              {(() => {
                const tb = getTicariBaskiByFirma(id);
                const ticariBullets: string[] = [];
                if (tb?.gecikmisAlacak) ticariBullets.push(`Ticari: Gecikmiş alacak ${tb.gecikmisAlacak}`);
                if (tb?.kesilmemisBekleyen) ticariBullets.push(`Ticari: Kesilmemiş bekleyen ${tb.kesilmemisBekleyen}`);
                const allSignals = firma.riskSinyalleri.length === 0 && ticariBullets.length === 0;

                if (allSignals) {
                  return <p className={`${TYPE_BODY} ${TEXT_MUTED}`}>Aktif risk sinyali yok.</p>;
                }

                const canDraftPayment = ticariBullets.length > 0 && (role === "yonetici" || role === "partner");

                return (
                  <>
                    <ul className="space-y-1.5">
                      {firma.riskSinyalleri.map((sinyal, idx) => (
                        <li key={idx} className={`flex items-start gap-2 ${TYPE_BODY} ${TEXT_BODY}`}>
                          <span className="text-amber-500 mt-0.5">•</span>
                          {sinyal}
                        </li>
                      ))}
                      {ticariBullets.map((sinyal, idx) => (
                        <li key={`ticari-${idx}`} className={`flex items-start gap-2 ${TYPE_BODY} text-amber-600`}>
                          <span className="text-amber-400 mt-0.5">•</span>
                          {sinyal}
                        </li>
                      ))}
                    </ul>
                    {canDraftPayment && (
                      <button
                        onClick={() => { setPaymentDraftText(null); setPaymentCopied(false); setPaymentDraftOpen(true); }}
                        className={`mt-3 ${TYPE_CAPTION} text-amber-600 hover:text-amber-700 hover:underline transition-colors`}
                      >
                        Ödeme takibi taslağı oluştur →
                      </button>
                    )}
                  </>
                );
              })()}
            </div>}

            {/* 9. Tahmini Ticari Kalite — management assumption visibility */}
            {(role === "yonetici" || role === "partner") && (() => {
              const kalite = getFirmaTicariKaliteOzeti(id);
              const toplam = kalite.saglikli + kalite.dar + kalite.riskli;
              if (toplam === 0) return null;
              return (
                <div className={CARD}>
                  <h3 className={CARD_TITLE}>
                    <BarChart3 size={14} className={TEXT_MUTED} />
                    Tahmini Ticari Kalite
                  </h3>
                  <p className={`${TYPE_CAPTION} ${TEXT_MUTED} -mt-2 mb-3`}>Yönetim varsayımı</p>
                  <div className="space-y-1.5">
                    {kalite.saglikli > 0 && (
                      <div className={`flex items-center justify-between ${TYPE_BODY}`}>
                        <MarginBandBadge band="saglikli" />
                        <span className={`${TYPE_CAPTION} ${TEXT_SECONDARY}`}>{kalite.saglikli} sözleşme</span>
                      </div>
                    )}
                    {kalite.dar > 0 && (
                      <div className={`flex items-center justify-between ${TYPE_BODY}`}>
                        <MarginBandBadge band="dar" />
                        <span className={`${TYPE_CAPTION} ${TEXT_SECONDARY}`}>{kalite.dar} sözleşme</span>
                      </div>
                    )}
                    {kalite.riskli > 0 && (
                      <div className={`flex items-center justify-between ${TYPE_BODY}`}>
                        <MarginBandBadge band="riskli" />
                        <span className={`${TYPE_CAPTION} ${TEXT_SECONDARY}`}>{kalite.riskli} sözleşme</span>
                      </div>
                    )}
                  </div>
                  {kalite.enKotuBant === "riskli" && (
                    <p className={`${TYPE_CAPTION} text-red-600 mt-3`}>
                      Ticari kalite dikkat gerektiriyor
                    </p>
                  )}
                  {kalite.enKotuBant === "dar" && kalite.riskli === 0 && (
                    <p className={`${TYPE_CAPTION} text-amber-600 mt-3`}>
                      Dar marjlı sözleşme mevcut
                    </p>
                  )}
                </div>
              );
            })()}
          </div>

          {/* Ticari Temas — outbound draft helpers, yönetici + partner only */}
          {(role === "yonetici" || role === "partner") && firma.durum === "aktif" && (() => {
            const sonGorusmeTarih = firma.sonGorusme;
            const isStale = sonGorusmeTarih && sonGorusmeTarih !== "—" && (() => {
              const diff = (new Date().getTime() - new Date(sonGorusmeTarih).getTime()) / (1000 * 60 * 60 * 24);
              return diff > 30;
            })();
            const tb = getTicariBaskiByFirma(id);
            const hasTicariBaski = !!(tb?.gecikmisAlacak || tb?.kesilmemisBekleyen);
            if (!isStale && !hasTicariBaski) return null;

            return (
              <div className={`flex items-center gap-3 py-2`}>
                <Send size={13} className={TEXT_MUTED} />
                <span className={`${TYPE_CAPTION} ${TEXT_SECONDARY}`}>Ticari Temas:</span>
                {isStale && (
                  <button
                    onClick={() => { setTemasType("yeniden_temas"); setTemasDraftText(null); setTemasCopied(false); }}
                    className={`${TYPE_CAPTION} ${TEXT_LINK} hover:underline`}
                  >
                    Yeniden Temas Taslağı
                  </button>
                )}
                {isStale && hasTicariBaski && (
                  <span className={`${TYPE_CAPTION} ${TEXT_MUTED}`}>·</span>
                )}
                {hasTicariBaski && (
                  <button
                    onClick={() => { setTemasType("odeme_takibi"); setTemasDraftText(null); setTemasCopied(false); }}
                    className={`${TYPE_CAPTION} ${TEXT_LINK} hover:underline`}
                  >
                    Ödeme Takibi Taslağı
                  </button>
                )}
              </div>
            );
          })()}

          {/* Teklif Hesaplayıcı — inline offer calculator, yönetici + partner only */}
          {(role === "yonetici" || role === "partner") && firma.durum === "aktif" && (
            <div className={`${SURFACE_PRIMARY} border ${hesapOpen ? BORDER_DEFAULT : `border-dashed ${BORDER_DEFAULT}`} ${RADIUS_DEFAULT} ${hesapOpen ? "p-4" : "px-4 py-2.5"} transition-all`}>
              <div
                className="flex items-center justify-between cursor-pointer"
                onClick={() => setHesapOpen(!hesapOpen)}
              >
                <div className="flex items-center gap-2">
                  <Calculator size={13} className={TEXT_MUTED} />
                  <span className={`${TYPE_CAPTION} ${TEXT_SECONDARY}`}>Teklif Hesaplayıcı</span>
                  {!hesapOpen && (
                    <span className={`${TYPE_CAPTION} ${TEXT_MUTED}`}>— Net ücret girin, önerilen teklif bedeli hesaplayın</span>
                  )}
                </div>
                {hesapOpen ? <ChevronUp size={12} className={TEXT_MUTED} /> : <ChevronDown size={12} className={TEXT_MUTED} />}
              </div>

              {hesapOpen && (() => {
                const netVal = parseFloat(hesapNet) || 0;
                const karVal = parseFloat(hesapKar) || 0;
                const result = netVal > 0 ? hesaplaTeklifBedeli({
                  netUcretGunluk: netVal,
                  hedefKarOrani: karVal,
                  ekOdeme: parseFloat(hesapEk) || 0,
                  yemek: parseFloat(hesapYemek) || 0,
                  servis: parseFloat(hesapServis) || 0,
                  kiyafet: parseFloat(hesapKiyafet) || 0,
                }) : null;

                return (
                  <div className="mt-3 space-y-3">
                    {/* Primary inputs */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className={`${TYPE_CAPTION} ${TEXT_MUTED} block mb-1`}>Net Ücret (günlük, ₺)</label>
                        <input
                          type="number"
                          value={hesapNet}
                          onChange={(e) => setHesapNet(e.target.value)}
                          placeholder="ör. 1560"
                          className={`w-full px-2.5 py-1.5 ${TYPE_BODY} border ${BORDER_DEFAULT} ${RADIUS_SM} focus:outline-none focus:ring-1 focus:ring-blue-500`}
                        />
                      </div>
                      <div>
                        <label className={`${TYPE_CAPTION} ${TEXT_MUTED} block mb-1`}>Hedef Kâr Oranı (%)</label>
                        <input
                          type="number"
                          value={hesapKar}
                          onChange={(e) => setHesapKar(e.target.value)}
                          placeholder="ör. 16.5"
                          step="0.5"
                          className={`w-full px-2.5 py-1.5 ${TYPE_BODY} border ${BORDER_DEFAULT} ${RADIUS_SM} focus:outline-none focus:ring-1 focus:ring-blue-500`}
                        />
                      </div>
                    </div>

                    {/* Secondary inputs — collapsed */}
                    <div>
                      <button
                        onClick={(e) => { e.stopPropagation(); setHesapEkOpen(!hesapEkOpen); }}
                        className={`${TYPE_CAPTION} ${TEXT_MUTED} hover:${TEXT_SECONDARY} flex items-center gap-1`}
                      >
                        {hesapEkOpen ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                        Ek maliyet kalemleri
                      </button>
                      {hesapEkOpen && (
                        <div className="grid grid-cols-4 gap-2 mt-2">
                          <div>
                            <label className={`${TYPE_CAPTION} ${TEXT_MUTED} block mb-1`}>Ek Ödeme</label>
                            <input type="number" value={hesapEk} onChange={(e) => setHesapEk(e.target.value)} placeholder="0" className={`w-full px-2 py-1 ${TYPE_CAPTION} border ${BORDER_DEFAULT} ${RADIUS_SM} focus:outline-none focus:ring-1 focus:ring-blue-500`} />
                          </div>
                          <div>
                            <label className={`${TYPE_CAPTION} ${TEXT_MUTED} block mb-1`}>Yemek</label>
                            <input type="number" value={hesapYemek} onChange={(e) => setHesapYemek(e.target.value)} placeholder="0" className={`w-full px-2 py-1 ${TYPE_CAPTION} border ${BORDER_DEFAULT} ${RADIUS_SM} focus:outline-none focus:ring-1 focus:ring-blue-500`} />
                          </div>
                          <div>
                            <label className={`${TYPE_CAPTION} ${TEXT_MUTED} block mb-1`}>Servis</label>
                            <input type="number" value={hesapServis} onChange={(e) => setHesapServis(e.target.value)} placeholder="0" className={`w-full px-2 py-1 ${TYPE_CAPTION} border ${BORDER_DEFAULT} ${RADIUS_SM} focus:outline-none focus:ring-1 focus:ring-blue-500`} />
                          </div>
                          <div>
                            <label className={`${TYPE_CAPTION} ${TEXT_MUTED} block mb-1`}>Kıyafet</label>
                            <input type="number" value={hesapKiyafet} onChange={(e) => setHesapKiyafet(e.target.value)} placeholder="0" className={`w-full px-2 py-1 ${TYPE_CAPTION} border ${BORDER_DEFAULT} ${RADIUS_SM} focus:outline-none focus:ring-1 focus:ring-blue-500`} />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Result area */}
                    {result && (
                      <div className={`${SURFACE_HEADER} ${RADIUS_SM} p-3 space-y-1.5`}>
                        <div className="flex items-center justify-between">
                          <span className={`${TYPE_CAPTION} ${TEXT_SECONDARY}`}>Tahmini İşveren Maliyeti</span>
                          <span className={`${TYPE_BODY} ${TEXT_BODY} font-medium`}>₺{result.tahminiIsverenMaliyeti.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / gün</span>
                        </div>
                        <div className={`flex items-center justify-between pt-1.5 border-t ${BORDER_SUBTLE}`}>
                          <span className={`${TYPE_BODY} font-medium ${TEXT_PRIMARY}`}>Önerilen Teklif Bedeli</span>
                          <span className={`${TYPE_KPI_VALUE} ${TEXT_PRIMARY}`}>₺{result.onerilenTeklifBedeli.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                        <p className={`${TYPE_CAPTION} ${TEXT_MUTED} text-right`}>KDV hariç, kişi başı günlük</p>
                      </div>
                    )}

                    {!result && hesapNet && (
                      <p className={`${TYPE_CAPTION} text-amber-600`}>Geçerli bir net ücret girin.</p>
                    )}

                    <p className={`${TYPE_CAPTION} ${TEXT_MUTED}`}>Yönetim varsayımlarına dayalı tahmini hesaplama. Kesin teklif değildir.</p>
                  </div>
                );
              })()}
            </div>
          )}

          {/* Son Bahsetmeler — hidden for görüntüleyici + muhasebe */}
          {!["goruntuleyici", "muhasebe"].includes(role) && <div className={`${SURFACE_PRIMARY} border border-dashed ${BORDER_DEFAULT} ${RADIUS_DEFAULT} p-4`}>
            <div className="flex items-center justify-between mb-3">
              <h3 className={`${TYPE_CAPTION} ${TEXT_SECONDARY} flex items-center gap-1.5`}>
                <AtSign size={12} />
                Son Bahsetmeler
              </h3>
              {canCreateNotes && (
                <button
                  onClick={() => { setMentionAlici(""); setMentionMesaj(""); setMentionOpen(!mentionOpen); }}
                  className={`${TYPE_CAPTION} ${TEXT_LINK} hover:underline`}
                >
                  Bahset
                </button>
              )}
            </div>

            {/* Compose — inline, compact */}
            {mentionOpen && (
              <div className={`mb-3 p-3 ${SURFACE_HEADER} ${RADIUS_SM} space-y-2`}>
                <input
                  type="text"
                  value={mentionAlici}
                  onChange={(e) => setMentionAlici(e.target.value)}
                  placeholder="Kime? (ör. Mehmet Y.)"
                  className={`w-full px-2 py-1.5 ${TYPE_CAPTION} border ${BORDER_DEFAULT} ${RADIUS_SM} focus:outline-none focus:ring-1 focus:ring-blue-500`}
                />
                <input
                  type="text"
                  value={mentionMesaj}
                  onChange={(e) => setMentionMesaj(e.target.value)}
                  placeholder="Ne hakkında? (kısa not)"
                  className={`w-full px-2 py-1.5 ${TYPE_CAPTION} border ${BORDER_DEFAULT} ${RADIUS_SM} focus:outline-none focus:ring-1 focus:ring-blue-500`}
                />
                <div className="flex justify-end gap-2">
                  <button onClick={() => setMentionOpen(false)} className={`px-2 py-1 ${TYPE_CAPTION} ${TEXT_MUTED} hover:${TEXT_BODY}`}>İptal</button>
                  <button
                    onClick={() => {
                      if (!mentionAlici.trim() || !mentionMesaj.trim()) return;
                      setMentions((prev) => [{
                        id: `bhs-new-${Date.now()}`,
                        firmaId: id,
                        gonderen: "Demo Kullanıcı",
                        alici: mentionAlici.trim(),
                        mesaj: mentionMesaj.trim(),
                        tarih: "Az önce",
                      }, ...prev]);
                      setMentionOpen(false);
                      setMentionAlici("");
                      setMentionMesaj("");
                    }}
                    disabled={!mentionAlici.trim() || !mentionMesaj.trim()}
                    className={`px-2 py-1 ${TYPE_CAPTION} text-white bg-blue-600 ${RADIUS_SM} hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed`}
                  >
                    Bahset
                  </button>
                </div>
              </div>
            )}

            {/* Mention list */}
            {mentions.length === 0 ? (
              <p className={`${TYPE_CAPTION} ${TEXT_MUTED} text-center py-2`}>Henüz bahsetme yok.</p>
            ) : (
              <div className="space-y-0">
                {mentions.slice(0, 5).map((b, idx) => (
                  <div key={b.id} className={`py-2 ${idx < Math.min(mentions.length, 5) - 1 ? `border-b ${BORDER_SUBTLE}` : ""}`}>
                    <p className={TYPE_CAPTION}>
                      <span className={`font-medium ${TEXT_BODY}`}>{b.gonderen}</span>
                      <span className={TEXT_MUTED}> → </span>
                      <span className={`font-medium ${TEXT_BODY}`}>{b.alici}</span>
                      <span className={TEXT_MUTED}> · {b.tarih}</span>
                    </p>
                    <p className={`${TYPE_CAPTION} ${TEXT_BODY} mt-0.5`}>{b.mesaj}</p>
                    {b.bagliKayit && (
                      <p className={`${TYPE_CAPTION} ${TEXT_MUTED} mt-0.5`}>↳ {b.bagliKayit}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>}

          {/* Bekleyen Yönlendirmeler — cross-unit routing signals */}
          {role !== "goruntuleyici" && (() => {
            const bekleyenler = yonlendirmeler.filter((y) => y.durum === "bekliyor");
            const tamamlananlar = yonlendirmeler.filter((y) => y.durum === "tamamlandi");
            const kullaniciBirim = birimFromRole(role);
            // Each role resolves own birim; yönetici can resolve ALL routings
            const canResolve = (y: Yonlendirme) =>
              y.hedefBirim === kullaniciBirim || role === "yonetici";

            return (
              <div className={`${SURFACE_PRIMARY} border border-dashed ${BORDER_DEFAULT} ${RADIUS_DEFAULT} p-4`}>
                <div className="flex items-center justify-between mb-3">
                  <h3 className={`${TYPE_CAPTION} ${TEXT_SECONDARY} flex items-center gap-1.5`}>
                    <ArrowRightLeft size={12} />
                    Bekleyen Yönlendirmeler
                  </h3>
                  {canCreateRouting && (
                    <button
                      onClick={() => { setYonHedefBirim(""); setYonAciklama(""); setYonlendirmeOpen(!yonlendirmeOpen); }}
                      className={`${TYPE_CAPTION} ${TEXT_LINK} hover:underline`}
                    >
                      Yönlendir
                    </button>
                  )}
                </div>

                {/* Compose — inline, compact */}
                {yonlendirmeOpen && (
                  <div className={`mb-3 p-3 ${SURFACE_HEADER} ${RADIUS_SM} space-y-2`}>
                    <select
                      value={yonHedefBirim}
                      onChange={(e) => setYonHedefBirim(e.target.value as BirimKodu | "")}
                      className={`w-full px-2 py-1.5 ${TYPE_CAPTION} border ${BORDER_DEFAULT} ${RADIUS_SM} focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white`}
                    >
                      <option value="">Hedef birim seçin</option>
                      {(["operasyon", "satis", "muhasebe", "yonetim"] as BirimKodu[])
                        .filter((b) => b !== kullaniciBirim)
                        .map((b) => (
                          <option key={b} value={b}>{BIRIM_LABELS[b]}</option>
                        ))}
                    </select>
                    <input
                      type="text"
                      value={yonAciklama}
                      onChange={(e) => setYonAciklama(e.target.value)}
                      placeholder="Kısa açıklama (ne bekleniyor?)"
                      className={`w-full px-2 py-1.5 ${TYPE_CAPTION} border ${BORDER_DEFAULT} ${RADIUS_SM} focus:outline-none focus:ring-1 focus:ring-blue-500`}
                    />
                    <div className="flex justify-end gap-2">
                      <button onClick={() => setYonlendirmeOpen(false)} className={`px-2 py-1 ${TYPE_CAPTION} ${TEXT_MUTED}`}>İptal</button>
                      <button
                        onClick={() => {
                          if (!yonHedefBirim || !yonAciklama.trim()) return;
                          const newYon: Yonlendirme = {
                            id: `yon-new-${Date.now()}`,
                            firmaId: id,
                            kaynakBirim: kullaniciBirim,
                            hedefBirim: yonHedefBirim as BirimKodu,
                            gonderen: "Demo Kullanıcı",
                            aciklama: yonAciklama.trim(),
                            tarih: "Az önce",
                            durum: "bekliyor",
                          };
                          console.log("[Yönlendirme oluşturuldu]", newYon);
                          setYonlendirmeler((prev) => [newYon, ...prev]);
                          setYonlendirmeOpen(false);
                          setYonHedefBirim("");
                          setYonAciklama("");
                        }}
                        disabled={!yonHedefBirim || !yonAciklama.trim()}
                        className={`px-2 py-1 ${TYPE_CAPTION} text-white bg-blue-600 ${RADIUS_SM} hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed`}
                      >
                        Yönlendir
                      </button>
                    </div>
                  </div>
                )}

                {/* Pending routings */}
                {bekleyenler.length === 0 && tamamlananlar.length === 0 ? (
                  <p className={`${TYPE_CAPTION} ${TEXT_MUTED} text-center py-2`}>Bu firma için yönlendirme yok.</p>
                ) : (
                  <div className="space-y-0">
                    {bekleyenler.map((y, idx) => (
                      <div key={y.id} className={`py-2 ${idx < bekleyenler.length - 1 || tamamlananlar.length > 0 ? `border-b ${BORDER_SUBTLE}` : ""}`}>
                        <div className="flex items-center justify-between">
                          <p className={TYPE_CAPTION}>
                            <span className={`font-medium ${TEXT_BODY}`}>{BIRIM_LABELS[y.kaynakBirim]}</span>
                            <span className={TEXT_MUTED}> → </span>
                            <span className={`font-medium ${TEXT_BODY}`}>{BIRIM_LABELS[y.hedefBirim]}</span>
                            <span className={TEXT_MUTED}> · {y.tarih}</span>
                          </p>
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded-full bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20">
                            <span className="w-1 h-1 rounded-full bg-amber-500" />
                            Bekliyor
                          </span>
                        </div>
                        <p className={`${TYPE_CAPTION} ${TEXT_BODY} mt-0.5`}>{y.aciklama}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <p className={`${TYPE_CAPTION} ${TEXT_MUTED}`}>{y.gonderen}</p>
                          {canResolve(y) && (
                            <button
                              onClick={() => {
                                console.log("[Yönlendirme tamamlandı]", y.id);
                                setYonlendirmeler((prev) =>
                                  prev.map((item) =>
                                    item.id === y.id
                                      ? { ...item, durum: "tamamlandi" as const, tamamlayanKisi: "Demo Kullanıcı" }
                                      : item
                                  )
                                );
                              }}
                              className={`${TYPE_CAPTION} text-green-600 hover:text-green-700 hover:underline`}
                            >
                              Tamamlandı
                            </button>
                          )}
                        </div>
                      </div>
                    ))}

                    {/* Recently resolved — compact, faded */}
                    {tamamlananlar.slice(0, 2).map((y, idx) => (
                      <div key={y.id} className={`py-2 ${idx < Math.min(tamamlananlar.length, 2) - 1 ? `border-b ${BORDER_SUBTLE}` : ""}`}>
                        <div className="flex items-center justify-between">
                          <p className={`${TYPE_CAPTION} ${TEXT_MUTED}`}>
                            {BIRIM_LABELS[y.kaynakBirim]} → {BIRIM_LABELS[y.hedefBirim]} · {y.tarih}
                          </p>
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded-full bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/20">
                            <span className="w-1 h-1 rounded-full bg-green-500" />
                            Tamamlandı
                          </span>
                        </div>
                        <p className={`${TYPE_CAPTION} ${TEXT_MUTED} mt-0.5 line-through`}>{y.aciklama}</p>
                        {y.tamamlayanKisi && (
                          <p className={`${TYPE_CAPTION} ${TEXT_MUTED} mt-0.5`}>✓ {y.tamamlayanKisi}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}
          </>
        )}

        {/* Zaman Çizgisi tab */}
        {activeTab === "zaman-cizgisi" && (
          <div className={CARD_LG}>
            {timeline.length > 0 ? (
              <TimelineList events={timeline} />
            ) : (
              <EmptyState
                title="Zaman çizgisi boş"
                description="Bu firma için henüz bir aktivite kaydı yok."
                size="tab"
              />
            )}
          </div>
        )}

        {/* Yetkililer tab — firm contacts, max 5 */}
        {activeTab === "yetkililer" && (
          <div className={CARD_LG}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
              <h3 className={CARD_TITLE_PLAIN}>Yetkili Kişiler</h3>
              <div className="flex flex-shrink-0 items-center gap-2 sm:justify-end">
                {(role === "yonetici" || role === "partner") && yetkililer.length < 5 && (
                  <button
                    type="button"
                    onClick={() => { setEditingContact(null); setEditPhoneEmailOnly(false); setContactModalOpen(true); }}
                    className={`inline-flex items-center justify-center gap-1.5 px-3 py-1.5 ${TYPE_CAPTION} font-medium ${TEXT_BODY} border ${BORDER_DEFAULT} ${RADIUS_SM} ${SURFACE_PRIMARY} hover:bg-slate-50 transition-colors`}
                  >
                    <UserPlus size={14} strokeWidth={1.8} />
                    Yetkili Ekle
                  </button>
                )}
                {yetkililer.length >= 5 && (
                  <span className={`${TYPE_CAPTION} ${TEXT_MUTED}`}>Maksimum 5 yetkili</span>
                )}
              </div>
            </div>
            {yetkililer.length === 0 ? (
              <div className="py-2 -mx-1">
                <EmptyState
                  title="Yetkili kişi yok"
                  description="Bu firmaya henüz yetkili kişi eklenmemiş."
                  size="tab"
                />
              </div>
            ) : (
              <div className="space-y-0">
                {yetkililer
                  .sort((a, b) => (a.anaYetkili === b.anaYetkili ? 0 : a.anaYetkili ? -1 : 1))
                  .map((ytk, idx) => (
                  <div key={ytk.id} className={`py-3 ${idx < yetkililer.length - 1 ? `border-b ${BORDER_SUBTLE}` : ""}`}>
                    <div className="flex items-start justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className={`${TYPE_BODY} font-medium ${TEXT_PRIMARY}`}>{ytk.adSoyad}</p>
                          {ytk.anaYetkili && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded-full bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-600/20">
                              <Star size={8} />
                              Ana Yetkili
                            </span>
                          )}
                        </div>
                        {ytk.unvan && (
                          <p className={`${TYPE_CAPTION} ${TEXT_SECONDARY} mt-0.5`}>{ytk.unvan}</p>
                        )}
                        <div className="flex flex-col gap-1.5 mt-1.5 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-4 sm:gap-y-1">
                          {ytk.telefon && (
                            <a href={`tel:${ytk.telefon.replace(/\s/g, "")}`} className={`${TYPE_CAPTION} ${TEXT_LINK} inline-flex items-center gap-1.5 min-w-0 hover:underline`}>
                              <Phone size={12} className={`flex-shrink-0 ${TEXT_MUTED}`} aria-hidden />
                              <span className="break-all">{ytk.telefon}</span>
                            </a>
                          )}
                          {ytk.eposta && (
                            <a href={`mailto:${ytk.eposta}`} className={`${TYPE_CAPTION} ${TEXT_LINK} inline-flex items-center gap-1.5 min-w-0 hover:underline`}>
                              <Mail size={12} className={`flex-shrink-0 ${TEXT_MUTED}`} aria-hidden />
                              <span className="break-all">{ytk.eposta}</span>
                            </a>
                          )}
                        </div>
                        {ytk.kisaNotlar && (
                          <p className={`${TYPE_CAPTION} ${TEXT_MUTED} mt-1`}>{ytk.kisaNotlar}</p>
                        )}
                      </div>
                      {/* Edit action — role-gated */}
                      {(role === "yonetici" || role === "partner" || role === "operasyon") && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingContact(ytk);
                            setEditPhoneEmailOnly(role === "operasyon");
                            setContactModalOpen(true);
                          }}
                          className={`flex-shrink-0 ml-3 p-1.5 ${TEXT_MUTED} hover:text-slate-600 hover:bg-slate-100 ${RADIUS_SM} transition-colors`}
                          aria-label={`${ytk.adSoyad} — düzenle`}
                        >
                          <Pencil size={13} aria-hidden />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Sözleşmeler tab — firm's contracts */}
        {activeTab === "sozlesmeler" && (
          <div className={CARD_LG}>
            <h3 className={CARD_TITLE_PLAIN}>
              Firma Sözleşmeleri
            </h3>
            {firmaSozlesmeler.length === 0 ? (
              <EmptyState title="Sözleşme yok" description="Bu firmaya ait sözleşme bulunamadı." size="tab" />
            ) : (
              <div className="space-y-2">
                {firmaSozlesmeler.map((s) => (
                  <div
                    key={s.id}
                    {...(role !== "muhasebe" ? { onClick: () => router.push(`/sozlesmeler/${s.id}`) } : {})}
                    className={`flex items-center justify-between py-2.5 ${LIST_DIVIDER} ${role !== "muhasebe" ? `cursor-pointer ${TABLE_ROW_HOVER}` : ""} -mx-2 px-2 rounded`}
                  >
                    <div className="min-w-0">
                      <p className={`${TYPE_BODY} font-medium ${TEXT_BODY}`}>{s.sozlesmeAdi}</p>
                      <p className={`${TYPE_CAPTION} ${TEXT_MUTED} mt-0.5`}>{s.tur} · {s.sorumlu}{(() => {
                        const detay = MOCK_SOZLESME_DETAY[s.id];
                        if (!detay?.ticariHazirlik) return null;
                        const lastDone = [...detay.ticariHazirlik.adimlar].reverse().find((a) => a.tamamlandi);
                        if (!lastDone) return null;
                        return ` · ${lastDone.adim} ${lastDone.tarih}`;
                      })()}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                      {(role === "yonetici" || role === "partner") && (() => {
                        const band = getContractMarjBandi(s.id);
                        if (!band) return null;
                        return <MarginBandBadge band={band} />;
                      })()}
                      {s.kalanGun !== null && s.kalanGun <= 30 && (
                        <span className={`${TYPE_CAPTION} font-medium ${s.kalanGun <= 15 ? "text-red-600" : "text-amber-600"}`}>
                          {s.kalanGun} gün
                        </span>
                      )}
                      <StatusBadge status={s.durum} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Randevular tab — firm's appointments */}
        {activeTab === "randevular" && (() => {
          const firmaRandevular = MOCK_RANDEVULAR.filter((r) => r.firmaId === id);
          return (
            <div className={CARD_LG}>
              <h3 className={CARD_TITLE_PLAIN}>
                Firma Randevuları
              </h3>
              {firmaRandevular.length === 0 ? (
                <EmptyState title="Randevu yok" description="Bu firmaya ait randevu bulunamadı." size="tab" />
              ) : (
                <div className="space-y-2">
                  {firmaRandevular.map((r) => (
                    <div
                      key={r.id}
                      className={`flex items-center justify-between py-2.5 ${LIST_DIVIDER}`}
                    >
                      <div className="min-w-0">
                        <p className={`${TYPE_BODY} font-medium ${TEXT_BODY}`}>
                          {formatDateTR(r.tarih)} {r.saat} — {RANDEVU_TIPI_LABELS[r.gorusmeTipi as RandevuTipi]}
                        </p>
                        <p className={`${TYPE_CAPTION} ${TEXT_MUTED} mt-0.5`}>{r.katilimci}</p>
                        {r.sonuc && (
                          <p className={`${TYPE_CAPTION} ${TEXT_SECONDARY} mt-0.5 truncate max-w-md`}>{r.sonuc}</p>
                        )}
                      </div>
                      <StatusBadge status={r.durum} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })()}

        {/* Talepler tab — firm's requests */}
        {activeTab === "talepler" && (() => {
          const firmaTalepler = MOCK_TALEPLER.filter((t) => t.firmaId === id);
          return (
            <>
            <DemandTrendChart talepler={firmaTalepler} />
            <div className={CARD_LG}>
              <h3 className={CARD_TITLE_PLAIN}>Firma Talepleri</h3>
              {firmaTalepler.length === 0 ? (
                <EmptyState title="Talep yok" description="Bu firmaya ait personel talebi bulunamadı." size="tab" />
              ) : (
                <div className="space-y-2">
                  {firmaTalepler.map((t) => (
                    <div key={t.id} className={`flex items-center justify-between py-2.5 ${LIST_DIVIDER}`}>
                      <div className="min-w-0">
                        <p className={`${TYPE_BODY} font-medium ${TEXT_BODY}`}>{t.pozisyon}</p>
                        <p className={`${TYPE_CAPTION} ${TEXT_MUTED} mt-0.5`}>{t.talepEdilen} talep · {t.saglanan} sağlanan · {t.acikKalan} açık</p>
                      </div>
                      <StatusBadge status={t.durum} />
                    </div>
                  ))}
                </div>
              )}
            </div>
            </>
          );
        })()}

        {/* Aktif İş Gücü tab — firm's workforce */}
        {activeTab === "aktif-isgucu" && (() => {
          const firmaIsGucu = MOCK_IS_GUCU.find((ig) => ig.firmaId === id);
          return (
            <div className={CARD_LG}>
              <h3 className={CARD_TITLE_PLAIN}>Aktif İş Gücü</h3>
              {firmaIsGucu ? (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div className={`text-center p-3 ${SURFACE_HEADER} rounded`}>
                    <p className={`${TYPE_KPI_VALUE} ${TEXT_PRIMARY}`}>{firmaIsGucu.aktifKisi}</p>
                    <p className={`${TYPE_CAPTION} ${TEXT_SECONDARY} mt-1`}>Aktif Kişi</p>
                  </div>
                  <div className={`text-center p-3 ${SURFACE_HEADER} rounded`}>
                    <p className={`${TYPE_KPI_VALUE} ${TEXT_PRIMARY}`}>{firmaIsGucu.hedefKisi}</p>
                    <p className={`${TYPE_CAPTION} ${TEXT_SECONDARY} mt-1`}>Hedef Kişi</p>
                  </div>
                  <div className={`text-center p-3 ${SURFACE_HEADER} rounded`}>
                    <p className={`${TYPE_KPI_VALUE} ${firmaIsGucu.acikFark > 0 ? "text-red-600" : "text-green-600"}`}>{firmaIsGucu.acikFark > 0 ? `−${firmaIsGucu.acikFark}` : "0"}</p>
                    <p className={`${TYPE_CAPTION} ${TEXT_SECONDARY} mt-1`}>Açık Fark</p>
                  </div>
                  <div className="text-center p-3 bg-green-50 rounded">
                    <p className="text-xl font-semibold text-green-700">+{firmaIsGucu.son30GunGiris}</p>
                    <p className={`${TYPE_CAPTION} ${TEXT_SECONDARY} mt-1`}>Son 30g Giriş</p>
                  </div>
                  <div className="text-center p-3 bg-red-50 rounded">
                    <p className="text-xl font-semibold text-red-600">−{firmaIsGucu.son30GunCikis}</p>
                    <p className={`${TYPE_CAPTION} ${TEXT_SECONDARY} mt-1`}>Son 30g Çıkış</p>
                  </div>
                </div>
              ) : (
                <EmptyState title="İş gücü verisi yok" description="Bu firma için iş gücü kaydı bulunamadı." size="tab" />
              )}
            </div>
          );
        })()}

        {/* Evraklar tab — firm's documents */}
        {activeTab === "evraklar" && (() => {
          const firmaEvraklar = MOCK_EVRAKLAR.filter((e) => e.firmaId === id);
          return (
            <div className={CARD_LG}>
              <h3 className={CARD_TITLE_PLAIN}>Firma Evrakları</h3>
              {firmaEvraklar.length === 0 ? (
                <EmptyState title="Evrak yok" description="Bu firmaya ait evrak bulunamadı." size="tab" />
              ) : (
                <div className="space-y-2">
                  {firmaEvraklar.map((e) => (
                    <div key={e.id} className={`flex items-center justify-between py-2.5 ${LIST_DIVIDER}`}>
                      <div className="min-w-0">
                        <p className={`${TYPE_BODY} font-medium ${TEXT_BODY}`}>{e.evrakAdi}</p>
                        <p className={`${TYPE_CAPTION} ${TEXT_MUTED} mt-0.5`}>{KATEGORI_LABELS[e.kategori as EvrakKategorisi]} {e.gecerlilikTarihi ? `· ${formatDateTR(e.gecerlilikTarihi)}` : ""}</p>
                      </div>
                      <StatusBadge status={e.durum} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })()}

        {/* Notlar tab — firm-scoped institutional memory */}
        {activeTab === "notlar" && (() => {
          const sabitlenenler = notlar.filter((n) => n.sabitlendi);
          const filtrelenmis = notlar
            .filter((n) => !notTagFilter || n.etiket === notTagFilter)
            .filter((n) => !n.sabitlendi);
          const mevcutEtiketler = [...new Set(notlar.map((n) => n.etiket).filter(Boolean))] as NotEtiketi[];
          const canEditNote = (_n: MockNot) => role === "yonetici";
          const canPin = (_n: MockNot) => role === "yonetici";

          return (
            <div className={CARD_LG}>
              <div className="flex items-center justify-between mb-4">
                <h3 className={CARD_TITLE_PLAIN}>Firma Notları</h3>
                <div className="flex items-center gap-3">
                  {mevcutEtiketler.length > 0 && (
                    <select
                      value={notTagFilter}
                      onChange={(e) => setNotTagFilter(e.target.value as NotEtiketi | "")}
                      className={`px-2 py-1 ${TYPE_CAPTION} border ${BORDER_DEFAULT} ${RADIUS_SM} focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white`}
                    >
                      <option value="">Tüm etiketler</option>
                      {mevcutEtiketler.map((et) => (
                        <option key={et} value={et}>{NOT_ETIKET_LABELS[et]}</option>
                      ))}
                    </select>
                  )}
                  {canCreateNotes && (
                    <button
                      onClick={() => { setNotEditTarget(null); setNoteDefaultIcerik(""); setNoteOpen(true); }}
                      className={`flex items-center gap-1.5 ${TYPE_CAPTION} ${TEXT_LINK} hover:underline`}
                    >
                      <Plus size={13} />
                      Yeni Not
                    </button>
                  )}
                </div>
              </div>

              {notlar.length === 0 ? (
                <EmptyState title="Not yok" description="Bu firma için henüz not eklenmemiş." size="tab" />
              ) : (
                <div className="space-y-0">
                  {/* Pinned notes section */}
                  {sabitlenenler.length > 0 && (
                    <>
                      <div className={`${TYPE_CAPTION} ${TEXT_MUTED} flex items-center gap-1.5 mb-2`}>
                        <Pin size={11} />
                        Sabitlenmiş Notlar
                      </div>
                      {sabitlenenler.map((n, idx) => (
                        <div key={n.id} className={`py-3 ${idx < sabitlenenler.length - 1 ? `border-b ${BORDER_SUBTLE}` : `border-b ${BORDER_DEFAULT} mb-3 pb-3`}`}>
                          <div className="flex items-start justify-between">
                            <div className="min-w-0 flex-1">
                              <p className={`${TYPE_BODY} ${TEXT_BODY}`}>{n.icerik}</p>
                              <div className={`flex items-center gap-2 mt-1.5 ${TYPE_CAPTION} ${TEXT_MUTED}`}>
                                <span>{n.yazan}</span>
                                <span>·</span>
                                <span>{formatDateTR(n.tarih)}</span>
                                {n.etiket && (
                                  <>
                                    <span>·</span>
                                    <span className="px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-medium">{NOT_ETIKET_LABELS[n.etiket]}</span>
                                  </>
                                )}
                                <span className="text-blue-500 flex items-center gap-0.5"><Pin size={9} /> Sabit</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0 ml-3">
                              {canPin(n) && (
                                <button
                                  onClick={() => setNotlar((prev) => prev.map((x) => x.id === n.id ? { ...x, sabitlendi: false } : x))}
                                  className={`p-1 ${TEXT_MUTED} hover:text-slate-600 ${RADIUS_SM} hover:bg-slate-100`}
                                  title="Sabitlemeyi kaldır"
                                >
                                  <Pin size={12} />
                                </button>
                              )}
                              {canEditNote(n) && (
                                <button
                                  onClick={() => { setNotEditTarget(n); setNoteOpen(true); }}
                                  className={`p-1 ${TEXT_MUTED} hover:text-slate-600 ${RADIUS_SM} hover:bg-slate-100`}
                                >
                                  <Pencil size={12} />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </>
                  )}

                  {/* Chronological feed */}
                  {filtrelenmis.length === 0 && sabitlenenler.length === 0 && (
                    <p className={`${TYPE_BODY} ${TEXT_MUTED} text-center py-4`}>Filtre ile eşleşen not bulunamadı.</p>
                  )}
                  {filtrelenmis.map((n, idx) => (
                    <div key={n.id} className={`py-3 ${idx < filtrelenmis.length - 1 ? `border-b ${BORDER_SUBTLE}` : ""}`}>
                      <div className="flex items-start justify-between">
                        <div className="min-w-0 flex-1">
                          <p className={`${TYPE_BODY} ${TEXT_BODY}`}>{n.icerik}</p>
                          <div className={`flex items-center gap-2 mt-1.5 ${TYPE_CAPTION} ${TEXT_MUTED}`}>
                            <span>{n.yazan}</span>
                            <span>·</span>
                            <span>{formatDateTR(n.tarih)}</span>
                            {n.etiket && (
                              <>
                                <span>·</span>
                                <span className="px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-medium">{NOT_ETIKET_LABELS[n.etiket]}</span>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0 ml-3">
                          {canPin(n) && (
                            <button
                              onClick={() => setNotlar((prev) => prev.map((x) => x.id === n.id ? { ...x, sabitlendi: true } : x))}
                              className={`p-1 ${TEXT_MUTED} hover:text-blue-500 ${RADIUS_SM} hover:bg-slate-100`}
                              title="Sabitle"
                            >
                              <Pin size={12} />
                            </button>
                          )}
                          {canEditNote(n) && (
                            <button
                              onClick={() => { setNotEditTarget(n); setNoteOpen(true); }}
                              className={`p-1 ${TEXT_MUTED} hover:text-slate-600 ${RADIUS_SM} hover:bg-slate-100`}
                            >
                              <Pencil size={12} />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })()}

        {/* Disabled tabs — tab-specific empty state */}
        {DISABLED_TAB_MESSAGES[activeTab] && (
          <EmptyState
            title={DISABLED_TAB_MESSAGES[activeTab].title}
            description={DISABLED_TAB_MESSAGES[activeTab].description}
            size="tab"
          />
        )}
      </div>

      <QuickNoteModal
        open={noteOpen}
        onClose={() => { setNoteOpen(false); setNoteDefaultIcerik(""); setNotEditTarget(null); }}
        firmaAdi={firma.firmaAdi}
        defaultIcerik={notEditTarget ? notEditTarget.icerik : noteDefaultIcerik}
        defaultEtiket={notEditTarget?.etiket ?? ""}
        editMode={!!notEditTarget}
        onSubmit={({ icerik, etiket }) => {
          if (notEditTarget) {
            setNotlar((prev) => prev.map((n) =>
              n.id === notEditTarget.id ? { ...n, icerik, etiket: etiket || undefined } : n
            ));
            console.log("[Not güncellendi]", notEditTarget.id);
          } else {
            const newNot: MockNot = {
              id: `not-new-${Date.now()}`,
              firmaId: id,
              icerik,
              yazan: "Demo Kullanıcı",
              tarih: new Date().toISOString().split("T")[0],
              etiket: etiket || undefined,
              sabitlendi: false,
            };
            setNotlar((prev) => [newNot, ...prev]);
            console.log("[Not oluşturuldu]", newNot);
          }
          setNotEditTarget(null);
        }}
      />

      <AddContactModal
        open={contactModalOpen}
        onClose={() => { setContactModalOpen(false); setEditingContact(null); setEditPhoneEmailOnly(false); }}
        editData={editingContact}
        phoneEmailOnly={editPhoneEmailOnly}
        currentAnaYetkiliAdi={yetkililer.find((y) => y.anaYetkili)?.adSoyad}
        onSubmit={(data) => {
          if (editingContact) {
            // Edit existing
            setYetkililer((prev) =>
              prev.map((y) => {
                if (y.id === editingContact.id) {
                  const updated = editPhoneEmailOnly
                    ? { ...y, telefon: data.telefon || y.telefon, eposta: data.eposta || y.eposta }
                    : { ...y, ...data };
                  return updated;
                }
                // If new anaYetkili was set, unset others
                if (data.anaYetkili && !editPhoneEmailOnly && y.firmaId === id) {
                  return { ...y, anaYetkili: false };
                }
                return y;
              })
            );
            console.log("[Yetkili güncellendi]", editingContact.id, data);
          } else {
            // Create new
            const newYetkili: MockYetkili = {
              id: `ytk-new-${Date.now()}`,
              firmaId: id,
              adSoyad: data.adSoyad,
              ...(data.unvan ? { unvan: data.unvan } : {}),
              ...(data.telefon ? { telefon: data.telefon } : {}),
              ...(data.eposta ? { eposta: data.eposta } : {}),
              anaYetkili: data.anaYetkili,
              ...(data.kisaNotlar ? { kisaNotlar: data.kisaNotlar } : {}),
            };
            setYetkililer((prev) => {
              // If new one is anaYetkili, unset others
              const updated = data.anaYetkili
                ? prev.map((y) => y.firmaId === id ? { ...y, anaYetkili: false } : y)
                : prev;
              return [newYetkili, ...updated];
            });
            console.log("[Yetkili oluşturuldu]", newYetkili);
          }
        }}
      />

      {/* Note Suggestion Flow — prompt → preview → confirm into QuickNoteModal */}
      {suggestOpen && (
        <div className={`fixed inset-0 ${SURFACE_OVERLAY_DARK} flex items-center justify-center ${Z_OVERLAY}`} onClick={() => setSuggestOpen(false)}>
          <div className={`${SURFACE_PRIMARY} ${RADIUS_DEFAULT} shadow-xl w-full max-w-md mx-4 p-5`} onClick={(e) => e.stopPropagation()}>
            <h3 className={`${TYPE_CARD_TITLE} ${TEXT_PRIMARY} mb-3`}>Not Önerisi — {firma.firmaAdi}</h3>

            {!suggestResult ? (
              /* Prompt input phase */
              <div className="space-y-3">
                <div>
                  <label className={`block ${TYPE_BODY} font-medium ${TEXT_BODY} mb-1`}>Ne oldu?</label>
                  <textarea
                    value={suggestPrompt}
                    onChange={(e) => setSuggestPrompt(e.target.value)}
                    placeholder="Kısaca açıklayın..."
                    rows={3}
                    className={`w-full px-3 py-2 ${TYPE_BODY} border ${BORDER_DEFAULT} ${RADIUS_SM} focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none`}
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button onClick={() => setSuggestOpen(false)} className={`px-3 py-2 ${TYPE_BODY} font-medium ${TEXT_BODY} ${SURFACE_PRIMARY} border ${BORDER_DEFAULT} ${RADIUS_SM} hover:bg-slate-50`}>
                    İptal
                  </button>
                  <button
                    onClick={() => {
                      const result = suggestNote(suggestPrompt, { firmaAdi: firma.firmaAdi, sektor: firma.sektor });
                      setSuggestResult(result);
                    }}
                    disabled={!suggestPrompt.trim()}
                    className={`px-3 py-2 ${TYPE_BODY} font-medium text-white bg-blue-600 ${RADIUS_SM} hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed`}
                  >
                    Öner
                  </button>
                </div>
              </div>
            ) : (
              /* Preview phase */
              <div className="space-y-3">
                <div className={`${SURFACE_HEADER} ${RADIUS_SM} p-3`}>
                  <p className={`${TYPE_CAPTION} ${TEXT_SECONDARY} mb-1`}>Önerilen not:</p>
                  <pre className={`${TYPE_BODY} ${TEXT_BODY} whitespace-pre-wrap font-sans`}>{suggestResult}</pre>
                </div>
                <div className="flex justify-end gap-2">
                  <button onClick={() => { setSuggestOpen(false); setSuggestResult(null); }} className={`px-3 py-2 ${TYPE_BODY} font-medium ${TEXT_BODY} ${SURFACE_PRIMARY} border ${BORDER_DEFAULT} ${RADIUS_SM} hover:bg-slate-50`}>
                    İptal
                  </button>
                  <button
                    onClick={() => {
                      setNoteDefaultIcerik(suggestResult);
                      setSuggestOpen(false);
                      setSuggestResult(null);
                      setNoteOpen(true);
                    }}
                    className={`px-3 py-2 ${TYPE_BODY} font-medium text-white bg-blue-600 ${RADIUS_SM} hover:bg-blue-700`}
                  >
                    Kabul Et
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Payment follow-up draft modal */}
      {paymentDraftOpen && (
        <div className={`fixed inset-0 ${SURFACE_OVERLAY_DARK} flex items-center justify-center ${Z_OVERLAY}`} onClick={() => setPaymentDraftOpen(false)}>
          <div className={`${SURFACE_PRIMARY} ${RADIUS_DEFAULT} shadow-xl w-full max-w-lg mx-4 max-h-[85vh] flex flex-col`} onClick={(e) => e.stopPropagation()}>
            <div className={`px-5 py-4 border-b ${BORDER_DEFAULT} flex-shrink-0`}>
              <h2 className={`${TYPE_CARD_TITLE} ${TEXT_PRIMARY}`}>Ödeme Takibi Taslağı — {firma.firmaAdi}</h2>
              <p className={`${TYPE_CAPTION} ${TEXT_MUTED} mt-1`}>Taslak metin — göndermeden önce gözden geçirin</p>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {!paymentDraftText ? (
                <div className="space-y-3">
                  <p className={`${TYPE_BODY} ${TEXT_BODY}`}>
                    {firma.firmaAdi} için ticari baskı verilerine dayalı ödeme takip yazısı taslağı oluşturulacak.
                  </p>
                  <p className={`${TYPE_CAPTION} ${TEXT_SECONDARY}`}>
                    Taslak mevcut alacak verilerinden üretilir. Göndermeden önce incelemeniz gerekir.
                  </p>
                </div>
              ) : (
                <div className={`${SURFACE_HEADER} ${RADIUS_SM} p-4`}>
                  <pre className={`${TYPE_BODY} ${TEXT_BODY} whitespace-pre-wrap font-sans`}>{paymentDraftText}</pre>
                </div>
              )}
            </div>
            <div className={`px-5 py-3 border-t ${BORDER_DEFAULT} flex justify-end gap-2 flex-shrink-0`}>
              <button onClick={() => setPaymentDraftOpen(false)} className={`px-4 py-2 ${TYPE_BODY} font-medium ${TEXT_BODY} ${SURFACE_PRIMARY} border ${BORDER_DEFAULT} ${RADIUS_SM} hover:bg-slate-50`}>
                {paymentDraftText ? "Kapat" : "İptal"}
              </button>
              {!paymentDraftText ? (
                <button
                  onClick={() => {
                    const tb = getTicariBaskiByFirma(id);
                    if (!tb) return;
                    setPaymentDraftText(generatePaymentFollowup(firma.firmaAdi, tb));
                    setPaymentCopied(false);
                  }}
                  className={`px-4 py-2 ${TYPE_BODY} font-medium text-white bg-blue-600 ${RADIUS_SM} hover:bg-blue-700`}
                >
                  Taslak Oluştur
                </button>
              ) : (
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(paymentDraftText).then(() => setPaymentCopied(true));
                  }}
                  className={`px-4 py-2 ${TYPE_BODY} font-medium text-white ${paymentCopied ? "bg-green-600" : "bg-blue-600"} ${RADIUS_SM} ${paymentCopied ? "" : "hover:bg-blue-700"}`}
                >
                  {paymentCopied ? "Kopyalandı" : "Kopyala"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Ticari Temas draft modal — yeniden temas + ödeme takibi */}
      {temasType && (
        <div className={`fixed inset-0 ${SURFACE_OVERLAY_DARK} flex items-center justify-center ${Z_OVERLAY}`} onClick={() => setTemasType(null)}>
          <div className={`${SURFACE_PRIMARY} ${RADIUS_DEFAULT} shadow-xl w-full max-w-lg mx-4 max-h-[85vh] flex flex-col`} onClick={(e) => e.stopPropagation()}>
            <div className={`px-5 py-4 border-b ${BORDER_DEFAULT} flex-shrink-0`}>
              <h2 className={`${TYPE_CARD_TITLE} ${TEXT_PRIMARY}`}>
                {temasType === "yeniden_temas" ? "Yeniden Temas Taslağı" : "Ödeme Takibi Taslağı"}
              </h2>
              <p className={`${TYPE_CAPTION} ${TEXT_MUTED} mt-1`}>
                Taslak metin — göndermeden önce gözden geçirin
              </p>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {!temasDraftText ? (
                <div className="space-y-3">
                  <p className={`${TYPE_BODY} ${TEXT_BODY}`}>
                    {temasType === "yeniden_temas"
                      ? `${firma.firmaAdi} için yeniden temas taslağı oluşturulacak.`
                      : `${firma.firmaAdi} için ödeme takibi taslağı oluşturulacak.`}
                  </p>
                  <p className={`${TYPE_CAPTION} ${TEXT_MUTED}`}>
                    Taslak firma bağlam verileri kullanılarak hazırlanır. Gönderim öncesi gözden geçirilmelidir.
                  </p>
                </div>
              ) : (
                <div className={`${SURFACE_HEADER} ${RADIUS_SM} p-4`}>
                  <pre className={`${TYPE_BODY} ${TEXT_BODY} whitespace-pre-wrap font-sans`}>{temasDraftText}</pre>
                </div>
              )}
            </div>
            <div className={`px-5 py-3 border-t ${BORDER_DEFAULT} flex justify-end gap-2 flex-shrink-0`}>
              <button onClick={() => setTemasType(null)} className={`px-4 py-2 ${TYPE_BODY} font-medium ${TEXT_BODY} ${SURFACE_PRIMARY} border ${BORDER_DEFAULT} ${RADIUS_SM} hover:bg-slate-50`}>
                {temasDraftText ? "Kapat" : "İptal"}
              </button>
              {!temasDraftText ? (
                <button
                  onClick={() => {
                    if (temasType === "yeniden_temas") {
                      const currentAnaYetkili = yetkililer.find((y) => y.anaYetkili)?.adSoyad ?? firma.anaYetkili;
                      const draft = generateYenidenTemasDraft({
                        firmaAdi: firma.firmaAdi,
                        anaYetkili: currentAnaYetkili,
                        sonGorusme: firma.sonGorusme,
                        aktifSozlesme: firma.aktifSozlesme,
                      });
                      setTemasDraftText(draft);
                    } else {
                      const tb = getTicariBaskiByFirma(id);
                      if (tb) {
                        setTemasDraftText(generatePaymentFollowup(firma.firmaAdi, tb));
                      }
                    }
                    setTemasCopied(false);
                  }}
                  className={`px-4 py-2 ${TYPE_BODY} font-medium text-white bg-blue-600 ${RADIUS_SM} hover:bg-blue-700`}
                >
                  Taslak Oluştur
                </button>
              ) : (
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(temasDraftText).then(() => setTemasCopied(true));
                  }}
                  className={`px-4 py-2 ${TYPE_BODY} font-medium text-white ${temasCopied ? "bg-green-600" : "bg-blue-600"} ${RADIUS_SM} ${temasCopied ? "" : "hover:bg-blue-700"}`}
                >
                  {temasCopied ? "Kopyalandı" : "Kopyala"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
