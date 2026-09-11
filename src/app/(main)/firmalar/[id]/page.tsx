"use client";

import { useScopedResource } from "@/components/ui/useScopedResource";
import { useListViewState } from "@/components/ui/useListViewState";
import { appointmentLinkHref } from "@/lib/appointment-link";
import AsyncSection from "@/components/ui/AsyncSection";
import ConfirmActionDialog from "@/components/ui/ConfirmActionDialog";
import ActionNotice, { useActionNotice } from "@/components/ui/ActionNotice";

import { use, useRef, useState, useMemo, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  StickyNote,
  CalendarCheck,
  Archive,
  ArchiveRestore,
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
  Upload,
  Download,
  Trash2,
} from "lucide-react";
import {
  TabNavigation,
  EmptyState,
  FirmaSummaryHeader,
  CommercialSummaryCard,
  StatusBadge,
  RiskBadge,
} from "@/components/ui";
import DemandTrendChart from "@/components/ui/DemandTrendChart";
import { QuickNoteModal, AddContactModal, NewAppointmentModal } from "@/components/modals";
import { createAppointmentAction } from "../../randevular/actions";
import { suggestNote } from "@/lib/suggest";
import { generatePaymentFollowup } from "@/lib/draft-payment-followup";
import { generateYenidenTemasDraft } from "@/lib/draft-yeniden-temas";
import { hesaplaTeklifBedeli, DEFAULT_KAR_ORANI } from "@/lib/teklif-hesaplayici";
import { formatDateTR } from "@/lib/format-date";
import { SECTOR_LABELS } from "@/lib/sector-codes";
import type { SectorCode } from "@/lib/sector-codes";
import { useRole } from "@/context/RoleContext";
import { useAuth } from "@/context/AuthContext";
import { resolveCompanyByIdOrLegacy } from "@/lib/services/companies";
import type { CompanyRow } from "@/types/database.types";
// Phase 4 — documents now read from real Supabase truth:
import { listDocumentsByLegacyCompanyId } from "@/lib/services/documents";
import { DOCUMENT_CATEGORY_LABELS } from "@/lib/document-categories";
import type { DocumentCategory } from "@/lib/document-categories";
import {
  uploadCompanyDocumentAction,
  getCompanyDocumentDownloadUrlAction,
  deleteCompanyDocumentAction,
  deleteContactAction,
  passivateCompanyAction,
  reactivateCompanyAction,
  createContactAction,
  createNoteAction,
} from "./actions";
// Mock commercial helpers removed — real financial summary loaded from DB
import { createClient } from "@/lib/supabase/client";
import {
  ContactValidationError,
  ContactLimitReachedError,
  listContactsByLegacyCompanyId,
  updateContactFull,
  updateContactPhoneEmail,
} from "@/lib/services/contacts";
import {
  listNotesByLegacyCompanyId,
  updateNoteContent,
  pinNote,
  unpinNote,
} from "@/lib/services/notes";
import {
  listContractsByLegacyCompanyId,
  computeRemainingDays,
} from "@/lib/services/contracts";
import {
  listDemandsByLegacyCompanyId,
  computeOpenCount,
} from "@/lib/services/staffing-demands";
import {
  listAppointmentsByLegacyCompanyId,
  deriveLastCompletedDate,
  deriveNextPlannedDate,
} from "@/lib/services/appointments";
import {
  getWorkforceSummaryByLegacyCompanyId,
  deriveOpenGap,
} from "@/lib/services/workforce-summary";
import { NOTE_TAG_LABELS } from "@/lib/note-tags";
import type { NoteTagKey } from "@/lib/note-tags";
import type {
  ContactRow,
  NoteRow,
  AppointmentRow,
} from "@/types/database.types";
import type { TabItem } from "@/types/ui";
import { APPOINTMENT_TYPE_LABELS } from "@/lib/appointment-types";
import type { AppointmentMeetingType } from "@/lib/appointment-types";
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
  { key: "yetkililer", label: "Yetkililer" },
  { key: "sozlesmeler", label: "Sözleşmeler" },
  { key: "talepler", label: "Talepler" },
  { key: "aktif-isgucu", label: "Aktif İş Gücü" },
  { key: "randevular", label: "Randevular" },
  { key: "evraklar", label: "Evraklar" },
  { key: "notlar", label: "Notlar" },
];

const COMPANY_TAB_DEFAULTS = { tab: "genel" };

const DISABLED_TAB_MESSAGES: Record<string, { title: string; description: string }> = {};

export default function FirmaDetayPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { role } = useRole();
  const documentsAccessRestricted = role === "muhasebe" || role === "goruntuleyici";
  const { user, loading: authLoading } = useAuth();
  // UI reset identity only; server/RLS remain the authorization authority.
  const companyScope = `${id}:${user?.id ?? ""}:${user?.app_metadata?.active_tenant ?? ""}:${role}`;
  const companyScopeRef = useRef(companyScope);
  companyScopeRef.current = companyScope;
  const feedback = useActionNotice(companyScope);
  const [statusAction, setStatusAction] = useState<{ scope: string; next: "aktif" | "pasif" } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ scope: string; kind: "contact" | "document"; id: string; name: string } | null>(null);
  const [deletionNotice, setDeletionNotice] = useState<{ scope: string; text: string } | null>(null);
  function requestDelete(kind: "contact" | "document", recordId: string, name: string) {
    feedback.clear();
    setDeletionNotice(null);
    setDeleteTarget({ scope: companyScope, kind, id: recordId, name });
  }
  const visibleTabs = useMemo(() => role === "goruntuleyici"
    ? TABS.filter(tab => tab.key === "genel")
    : role === "ik" ? TABS.filter(tab => ["genel", "evraklar", "talepler", "aktif-isgucu", "notlar"].includes(tab.key))
    : role === "muhasebe" ? TABS.filter(tab => ["genel", "sozlesmeler"].includes(tab.key)) : TABS, [role]);
  const tabView = useListViewState("firma-sekme", !authLoading && user ? companyScope : null, COMPANY_TAB_DEFAULTS);
  // Stored preferences cannot reveal a tab outside this role's visible set.
  const activeTab = visibleTabs.some(tab => tab.key === tabView.filters.tab) ? tabView.filters.tab : "genel";
  const setTabFilters = tabView.setFilters;
  const setActiveTab = useCallback((key: string) => {
    if (visibleTabs.some(tab => tab.key === key)) setTabFilters({ tab: key });
  }, [visibleTabs, setTabFilters]);
  const [openNoteContext, setOpenNoteContext] = useState<{ scope: string | null } | null>(null);
  const [noteDefaultIcerik, setNoteDefaultIcerik] = useState("");
  // Note suggestion flow state
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [suggestPrompt, setSuggestPrompt] = useState("");
  const [suggestResult, setSuggestResult] = useState<string | null>(null);
  // Payment follow-up draft state
  const [paymentDraftOpen, setPaymentDraftOpen] = useState(false);
  const [paymentDraftText, setPaymentDraftText] = useState<string | null>(null);
  const [paymentCopied, setPaymentCopied] = useState(false);
  // Notlar state — Faz 1B: real Supabase truth via service layer.
  // One fetch feeds both the Notlar tab (full list, pinned first then
  // chronological) and the Genel Bakış > Son Notlar card (top 3 slice).
  // The service resolves legacy id → companies row → RLS-scoped note
  // rows, so partner scope is re-verified at every read.
  const [notEditTarget, setNotEditTarget] = useState<NoteRow | null>(null);
  const [notTagFilter, setNotTagFilter] = useState<NoteTagKey | "">("");
  // Yetkili kişiler — Faz 1A: real Supabase truth via service layer.
  // Resolution flow inside the service: legacy mock id ("f1") → companies row
  // (RLS-checked) → contacts query. Out-of-scope/missing firmas surface as
  // a CompanyNotFoundOrOutOfScopeError, which we map to an inline message.
  const supabase = useMemo(() => createClient(), []);
  const contactScope = !authLoading && user && ["yonetici", "operasyon"].includes(role) ? companyScope : null;
  const readContacts = useCallback(() => listContactsByLegacyCompanyId(supabase, id), [supabase, id]);
  const contactsResource = useScopedResource(contactScope, readContacts);
  const yetkililer = contactsResource.data ?? [];
  const contactsReady = !!contactScope && !contactsResource.loading && !contactsResource.error;
  const reloadYetkililer = contactsResource.reload;
  const notesScope = !authLoading && user && !["goruntuleyici", "muhasebe"].includes(role) ? companyScope : null;
  const readNotes = useCallback(() => listNotesByLegacyCompanyId(supabase, id), [supabase, id]);
  const notesResource = useScopedResource(notesScope, readNotes);
  const notlar = notesResource.data ?? [];
  const reloadNotlar = notesResource.reload;
  // Pin failures are action failures; they must not replace a readable note list.
  const noteContext = useMemo(() => ({ scope: notesScope }), [notesScope]);
  const liveNoteContext = useRef<typeof noteContext | null>(noteContext);
  liveNoteContext.current = noteContext;
  const [notePinError, setNotePinError] = useState<typeof noteContext | null>(null);
  type NotePinOperation = { context: typeof noteContext; id: string; next: boolean };
  const notePinFlight = useRef<NotePinOperation | null>(null);
  const [notePinPending, setNotePinPending] = useState<NotePinOperation | null>(null);
  const pinBusy = notePinPending?.context === noteContext;
  useEffect(() => {
    liveNoteContext.current = noteContext;
    setOpenNoteContext(null);
    setNotEditTarget(null);
    setNoteDefaultIcerik("");
    setNotTagFilter("");
    setSuggestOpen(false);
    setSuggestPrompt("");
    setSuggestResult(null);
    return () => { liveNoteContext.current = null; };
  }, [noteContext]);
  // Phase 3 state: Talepler, Randevular, İş Gücü — real Supabase truth.
  const staffingScope = !authLoading && user ? companyScope : null;
  const readDemands = useCallback(() => listDemandsByLegacyCompanyId(supabase, id), [supabase, id]);
  const readWorkforce = useCallback(() => getWorkforceSummaryByLegacyCompanyId(supabase, id), [supabase, id]);
  const demandResource = useScopedResource(staffingScope, readDemands);
  const workforceResource = useScopedResource(staffingScope, readWorkforce);
  const firmaTalepler = demandResource.data ?? [];
  const firmaIsGucu = workforceResource.data;
  const [appointmentOpen, setAppointmentOpen] = useState(false);
  const appointmentsEnabled = !authLoading && !!user;
  const appointmentContext = useMemo(() => ({ scope: companyScope, enabled: appointmentsEnabled }), [companyScope, appointmentsEnabled]);
  const liveAppointmentContext = useRef<typeof appointmentContext | null>(appointmentContext);
  liveAppointmentContext.current = appointmentContext;
  const appointmentsGeneration = useRef(0);
  const [appointmentsSnapshot, setAppointmentsSnapshot] = useState<{ context: typeof appointmentContext; rows: AppointmentRow[]; loading: boolean; error: boolean } | null>(null);
  const firmaRandevular = appointmentsSnapshot?.context === appointmentContext ? appointmentsSnapshot.rows : [];
  const appointmentsLoading = appointmentsSnapshot?.context !== appointmentContext || appointmentsSnapshot.loading;
  const appointmentsError = appointmentsSnapshot?.context === appointmentContext && appointmentsSnapshot.error;
  const reloadAppointments = useCallback(async () => {
    if (!appointmentContext.enabled || liveAppointmentContext.current !== appointmentContext) return;
    const generation = ++appointmentsGeneration.current;
    const current = () => liveAppointmentContext.current === appointmentContext && generation === appointmentsGeneration.current;
    setAppointmentsSnapshot({ context: appointmentContext, rows: [], loading: true, error: false });
    try {
      const rows = await listAppointmentsByLegacyCompanyId(supabase, id);
      if (current()) setAppointmentsSnapshot({ context: appointmentContext, rows, loading: false, error: false });
    } catch {
      if (current()) setAppointmentsSnapshot({ context: appointmentContext, rows: [], loading: false, error: true });
    }
  }, [supabase, id, appointmentContext]);
  useEffect(() => {
    liveAppointmentContext.current = appointmentContext;
    setAppointmentOpen(false);
    feedback.clear();
    void reloadAppointments();
    return () => { liveAppointmentContext.current = null; ++appointmentsGeneration.current; };
    // Clear only on context changes; notice helpers are recreated each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appointmentContext, reloadAppointments]);
  const contactContext = useMemo(() => ({ scope: contactScope }), [contactScope]);
  const liveContactContext = useRef<typeof contactContext | null>(contactContext);
  liveContactContext.current = contactContext;
  const [openContactContext, setOpenContactContext] = useState<typeof contactContext | null>(null);
  const [editingContact, setEditingContact] = useState<ContactRow | null>(null);
  const [editPhoneEmailOnly, setEditPhoneEmailOnly] = useState(false);
  useEffect(() => {
    liveContactContext.current = contactContext;
    setOpenContactContext(null); setEditingContact(null); setEditPhoneEmailOnly(false);
    return () => { liveContactContext.current = null; };
  }, [contactContext]);
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

  // Real company shell — loaded from DB, handles both legacy IDs and UUIDs
  const [companyShell, setCompanyShell] = useState<CompanyRow | null>(null);
  const [companyLoading, setCompanyLoading] = useState(true);
  const [loadedCompanyScope, setLoadedCompanyScope] = useState("");
  useEffect(() => {
    let current = true;
    setCompanyLoading(true);
    setCompanyShell(null);
    resolveCompanyByIdOrLegacy(supabase, id)
      .then((company) => { if (current) setCompanyShell(company); })
      .catch(() => { if (current) setCompanyShell(null); })
      .finally(() => {
        if (current) { setCompanyLoading(false); setLoadedCompanyScope(companyScope); }
      });
    return () => { current = false; };
  }, [supabase, id, companyScope]);

  async function changeCompanyStatus(next: "aktif" | "pasif") {
    if (!companyShell || companyScopeRef.current !== companyScope) throw new Error("Firma bilgisi değişti. Sayfayı yenileyin.");
    const result = await (next === "pasif" ? passivateCompanyAction(companyShell.id) : reactivateCompanyAction(companyShell.id));
    if (!result.ok) throw new Error(result.error);
    // These actions return a name only when UPDATE RETURNING affected a row.
    if (result.name === undefined) throw new Error("Firma durumu değiştirilemedi veya kayda erişim değişti. Sayfayı yenileyin.");
    if (companyScopeRef.current !== companyScope) return;
    setCompanyShell({ ...companyShell, status: next });
    feedback.show(`${result.name} ${next === "pasif" ? "pasife" : "aktife"} alındı.`);
    router.refresh();
  }

  // Build firma-compatible object from real company shell for downstream consumers
  const firma = companyShell ? {
    id,
    firmaAdi: companyShell.name,
    sektor: companyShell.sector ? (SECTOR_LABELS[companyShell.sector as SectorCode] ?? companyShell.sector) : "—",
    sehir: companyShell.city ?? "—",
    durum: companyShell.status,
    risk: companyShell.risk,
    // Placeholders for fields consumed by non-migrated sections
    telefon: "—", adres: "—", vergiNo: "—", kayitTarihi: "—",
    acikBakiye: "—", sonFaturaTarihi: "—", sonFaturaTutari: "—",
    kesilmemisBekleyen: "—", ticariRisk: "dusuk" as const,
    acikTalep: 0, eksikEvrak: 0,
    riskSinyalleri: [] as string[], sonNotlar: [] as string[],
    anaYetkili: "—", aktifSozlesme: 0, aktifIsGucu: 0,
    sonGorusme: "—", sonrakiRandevu: "—",
    yaklaşanRandevu: 0,
  } : null;

  // UI-only passive guard (E + UI-only). When the company is pasif, new
  // operation-creation actions are disabled (Not Ekle/Önerisi stay open
  // for closure/audit notes; all viewing stays open). NOT a security
  // boundary — server-side guard is a future DELTA; this is UX only.
  const isPassiveCompany = firma?.durum === "pasif";
  const PASSIVE_BLOCK_TITLE = "Firma pasif olduğu için yeni işlem oluşturulamaz.";

  // Financial summary — real DB, truthful absence state.
  // `last_source` distinguishes mizan-derived visibility from muhasebe
  // manual-flow visibility so the Ticari Özet card can surface a subtle
  // source caption. Legacy rows written before the source signal was
  // added return null and render no caption.
  const [firmaFinancial, setFirmaFinancial] = useState<{
    open_receivable: string | null;
    unbilled_amount: string | null;
    is_overdue: boolean;
    last_source: "mizan" | "muhasebe" | null;
  } | null>(null);
  useEffect(() => {
    if (!companyShell) return;
    (async () => {
      try {
        const { data } = await supabase
          .from("financial_summaries")
          .select("open_receivable, unbilled_amount, is_overdue, last_source")
          .eq("company_id", companyShell.id)
          .maybeSingle();
        const row = data as
          | {
              open_receivable: string | null;
              unbilled_amount: string | null;
              is_overdue: boolean | null;
              last_source: string | null;
            }
          | null;
        setFirmaFinancial(
          row
            ? {
                open_receivable: row.open_receivable ?? null,
                unbilled_amount: row.unbilled_amount ?? null,
                is_overdue: Boolean(row.is_overdue),
                last_source:
                  row.last_source === "mizan" || row.last_source === "muhasebe"
                    ? row.last_source
                    : null,
              }
            : null,
        );
      } catch {
        setFirmaFinancial(null);
      }
    })();
  }, [supabase, companyShell]);

  // Sözleşmeler — Faz 2: real Supabase truth via service layer.
  // One fetch feeds both the Sözleşmeler tab (full list) and the
  // Genel Bakış > Aktif Sözleşmeler card (filtered to status='aktif').
  // Resolution path: legacy mock id → companies row (RLS-checked) →
  // contracts query. UI roles follow the existing contract SELECT policy.
  const contractsAllowed = ["yonetici", "operasyon"].includes(role);
  const readContracts = useCallback(() => listContractsByLegacyCompanyId(supabase, id), [supabase, id]);
  const contractsResource = useScopedResource(
    !authLoading && user && contractsAllowed ? companyScope : null,
    readContracts,
  );
  const firmaSozlesmeler = contractsResource.data ?? [];
  const reloadSozlesmeler = contractsResource.reload;
  const aktifSozlesmeler = useMemo(
    () => firmaSozlesmeler.filter((s) => s.status === "aktif"),
    [firmaSozlesmeler]
  );

  // -------------------------------------------------------------------------
  // Phase 4A — Firma Evraklar (real Supabase truth)
  // -------------------------------------------------------------------------
  const readDocuments = useCallback(() => listDocumentsByLegacyCompanyId(supabase, id), [supabase, id]);
  const documentResource = useScopedResource(!authLoading && user && !documentsAccessRestricted ? companyScope : null, readDocuments);
  const firmaDocs = documentResource.data ?? [];
  const docsLoading = documentResource.loading;
  const docsError = documentResource.error;
  const reloadDocs = documentResource.reload;

  async function confirmRecordDelete(target: NonNullable<typeof deleteTarget>) {
    if (target.scope !== companyScopeRef.current) throw new Error("Firma bilgisi değişti. Sayfayı yenileyin.");
    if (target.kind === "contact") {
      const result = await deleteContactAction(target.id);
      if (!result.ok) throw new Error(result.error);
      if (target.scope !== companyScopeRef.current) return;
      if (result.deletedName !== undefined) feedback.show(`${result.deletedName} yetkili kişilerden silindi.`);
      else setDeletionNotice({ scope: companyScope, text: "Silinen yetkili kaydı doğrulanamadı. Kayıt daha önce kaldırılmış veya silme erişiminiz değişmiş olabilir." });
      await reloadYetkililer();
    } else {
      const result = await deleteCompanyDocumentAction(target.id);
      if (!result.ok) throw new Error(result.error);
      if (target.scope !== companyScopeRef.current) return;
      if (result.warning) setDeletionNotice({ scope: companyScope, text: `${target.name}: Belge kaydı silindi, dosyanın temizlenmesi tamamlanamadı. Yönetici kontrolü gerekiyor.` });
      else if (result.deleted) feedback.show(`${target.name} belge kaydı silindi.`);
      else setDeletionNotice({ scope: companyScope, text: "Silinen belge kaydı doğrulanamadı. Kayıt daha önce kaldırılmış veya silme erişiminiz değişmiş olabilir." });
      await reloadDocs();
    }
    if (target.scope === companyScopeRef.current) router.refresh();
  }

  // Document upload modal + per-row download error (item-level — never
  // collapses the tab; matches the Evraklar page resilience pattern).
  const [evrakUploadOpen, setEvrakUploadOpen] = useState(false);
  const [evrakUploadError, setEvrakUploadError] = useState<string | null>(null);
  const [evrakDownloadError, setEvrakDownloadError] = useState<string | null>(null);
  if (companyLoading || loadedCompanyScope !== companyScope) {
    return <p className="text-sm text-slate-500 py-12 text-center">Yukleniyor...</p>;
  }

  if (!firma) {
    return (
      <div className="py-12">
        <EmptyState
          title="Firma bulunamadi"
          description="Bu ID ile eslesen bir firma bulunamadi."
          size="page"
          action={{ label: "Firmalara Don", onClick: () => router.push("/firmalar") }}
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
      onClick: () => { setNotEditTarget(null); setNoteDefaultIcerik(""); setOpenNoteContext(noteContext); },
      icon: <StickyNote size={16} />,
    },
      {
        label: "Not Önerisi",
        onClick: () => { setSuggestPrompt(""); setSuggestResult(null); setSuggestOpen(true); },
        icon: <Lightbulb size={16} />,
      },
    ] : []),
    ...(["yonetici", "operasyon"].includes(role) ? [{
      label: "Randevu Planla",
      onClick: () => setAppointmentOpen(true),
      icon: <CalendarCheck size={16} />,
      disabled: firma.durum === "pasif",
    }] : []),
    // Passivate — yonetici-only, only on an aktif/aday firma.
    ...(role === "yonetici" && firma && firma.durum !== "pasif" ? [
      {
        label: "Pasife Al",
        onClick: () => { feedback.clear(); setStatusAction({ scope: companyScope, next: "pasif" }); },
        icon: <Archive size={16} />,
      },
    ] : []),
    // Reactivate — yonetici-only, on any firma that is not already aktif.
    //
    // ⚠ ÖLÇÜLDÜ (2026-09-03): bu koşul `=== "pasif"` idi ve passivate'in aynası
    // DEĞİLDİ. Passivate `!== "pasif"` ile aday'ı da kapsıyor, reactivate ise
    // yalnız pasif'i kapsıyordu. Sonuç: bir `aday` firmanın tek yaşam döngüsü
    // hamlesi pasife gitmekti; aktife alma yolu ekranda YOKTU.
    //
    // Üç durumlu bir döngüde `!== "pasif"` ile `=== "pasif"` birbirinin aynası
    // değil — eski yorum ("mirror of passivate") iki durumlu bir dünyada
    // yazılmıştı ve `aday` eklendiğinde sessizce yanlışlaştı.
    //
    // Bu, firmalar listesine "Yeni Firma" eklenmeden önce de vardı (randevu ve
    // talep formlarından doğan firmalar da `aday`), ama o yol dar olduğu için
    // görünmüyordu. Liste ekranı firma eklemenin ANA yolu olunca çıkmaz oldu.
    //
    // `reactivateCompanyAction` tarafında değişiklik gerekmiyor: eylemin durum
    // ön koşulu hiç yoktu, yalnız düğmenin görünürlük koşulu dardı.
    ...(role === "yonetici" && firma && firma.durum !== "aktif" ? [
      {
        label: "Aktife Al",
        onClick: () => { feedback.clear(); setStatusAction({ scope: companyScope, next: "aktif" }); },
        icon: <ArchiveRestore size={16} />,
      },
    ] : []),
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
        partner={undefined}
        actions={headerActions}
      />

      {companyShell && (role === "yonetici" || role === "operasyon") && (
        <button className="mb-5 inline-flex min-h-11 items-center rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700" onClick={() => router.push(`/talepler/gunluk?firma=${companyShell.id}`)}>
          Günlük personel planını aç
        </button>
      )}

      <ActionNotice message={feedback.message} onDismiss={feedback.clear} />
      {deletionNotice?.scope === companyScope && <p role="alert" className="mb-5 break-words rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{deletionNotice.text}</p>}
      {deleteTarget?.scope === companyScope && role === "yonetici" && (
        <ConfirmActionDialog key={`${companyScope}:${deleteTarget.kind}:${deleteTarget.id}`}
          title={deleteTarget.kind === "contact" ? "Yetkili kişiyi kalıcı olarak sil" : "Belgeyi kalıcı olarak sil"}
          recordName={deleteTarget.name}
          description={deleteTarget.kind === "contact"
            ? "Bu kişinin firma içindeki yetkili kaydı kalıcı olarak kaldırılır. Bu işlem geri alınamaz. Firma ve diğer yetkililer korunur."
            : "Belge kaydı kalıcı olarak kaldırılır; bağlı dosya varsa temizlenmesi de denenir. Bu işlem geri alınamaz. Sürüm geçmişine bağlı belgeler sistem tarafından korunur."}
          confirmLabel="Kalıcı olarak sil" destructive onConfirm={() => confirmRecordDelete(deleteTarget)}
          onClose={() => { if (companyScopeRef.current === companyScope) setDeleteTarget(null); }}
        />
      )}
      {statusAction?.scope === companyScope && role === "yonetici" && (
        <ConfirmActionDialog key={`${companyScope}:${statusAction.next}`}
          title={statusAction.next === "pasif" ? "Firmayı pasife al" : "Firmayı aktife al"}
          recordName={firma.firmaAdi}
          description={statusAction.next === "pasif"
            ? "Firma kaydı ve geçmişi korunur. Pasif firmaya yeni operasyonel kayıt eklenemez. Daha sonra yeniden aktife alabilirsiniz."
            : "Firma aktif duruma geçer. Yetkili kullanıcılar firma için yeniden işlem oluşturabilir."}
          confirmLabel={statusAction.next === "pasif" ? "Pasife al" : "Aktife al"}
          onConfirm={() => changeCompanyStatus(statusAction.next)}
          onClose={() => { if (companyScopeRef.current === companyScope) setStatusAction(null); }}
        />
      )}

      <TabNavigation
        tabs={visibleTabs.map(tab => ({ ...tab, disabled: tab.disabled || !tabView.ready }))}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      <div className="mt-6 min-w-0">
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
              {!contractsAllowed ? (
                <p className={`${TYPE_CAPTION} ${TEXT_MUTED}`}>Bu rolde sözleşmeler görüntülenemez.</p>
              ) : (
                <AsyncSection isLoading={contractsResource.loading} hasError={contractsResource.error} onRetry={() => { void reloadSozlesmeler(); }}>
                  {aktifSozlesmeler.length === 0 ? (
                    <p className={`${TYPE_BODY} ${TEXT_MUTED} text-center py-3`}>
                      {firmaSozlesmeler.length === 0 ? "Bu firmaya ait sözleşme kaydı yok." : "Aktif sözleşme yok."}
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {aktifSozlesmeler.map((s) => {
                        const kalanGun = computeRemainingDays(s.end_date);
                        return (
                          <a
                            href={`/sozlesmeler/${s.id}`}
                            aria-label={`${s.name} — sözleşmeyi aç`}
                            key={s.id}
                            className="flex min-h-11 flex-wrap items-center justify-between gap-2 rounded-lg py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 hover:bg-slate-50"
                          >
                            <span className={`${TYPE_BODY} ${TEXT_BODY} min-w-0 break-words`}>
                              {s.name}
                            </span>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              {kalanGun !== null && kalanGun <= 30 && (
                                <span className={`${TYPE_CAPTION} font-medium ${kalanGun <= 15 ? "text-red-600" : "text-amber-600"}`}>
                                  {kalanGun} gün
                                </span>
                              )}
                              <StatusBadge status={s.status} />
                            </div>
                          </a>
                        );
                      })}
                    </div>
                  )}
                  {/* Preparation in-flight count — derived from real lifecycle status */}
                  {(() => {
                    const hazirlikta = firmaSozlesmeler.filter(
                      (s) => s.status === "taslak" || s.status === "imza_bekliyor"
                    ).length;
                    if (hazirlikta === 0) return null;
                    return (
                      <p className={`${TYPE_CAPTION} text-amber-600 mt-2`}>
                        {hazirlikta} sözleşme hazırlık aşamasında
                      </p>
                    );
                  })()}
                </AsyncSection>
              )}
            </div>}

            {/* 2. Açık Talepler — hidden for muhasebe */}
            {role !== "muhasebe" && (() => {
              const acikKalanToplam = firmaTalepler.reduce((s, t) => s + computeOpenCount(t), 0);
              return (
                <div className={CARD}>
                  <h3 className={CARD_TITLE}>
                    <Users size={14} className={TEXT_MUTED} />
                    Açık Talepler
                  </h3>
                  <AsyncSection isLoading={demandResource.loading} hasError={demandResource.error} onRetry={() => { void demandResource.reload(); }}>
                  <div className="flex items-baseline gap-2 py-2">
                    <span className={`${TYPE_KPI_VALUE} ${TEXT_PRIMARY}`}>{acikKalanToplam}</span>
                    <span className={`${TYPE_BODY} ${TEXT_SECONDARY}`}>açık pozisyon</span>
                  </div>
                  {firmaTalepler.filter((t) => computeOpenCount(t) > 0).length === 0 ? (
                    <p className={`${TYPE_CAPTION} ${TEXT_MUTED}`}>{firmaTalepler.length === 0 ? "Bu firmaya ait talep kaydı yok." : "Açık personel ihtiyacı görünmüyor."}</p>
                  ) : (
                    <div className="space-y-1.5 mt-2">
                      {firmaTalepler.filter((t) => computeOpenCount(t) > 0).map((t) => (
                        <div key={t.id} className={`flex items-center justify-between ${TYPE_CAPTION}`}>
                          <span className="text-slate-600">{t.position}</span>
                          <span className="text-red-600 font-medium">{computeOpenCount(t)} açık</span>
                        </div>
                      ))}
                    </div>
                  )}
                  </AsyncSection>
                </div>
              );
            })()}

            {/* 3. Aktif İş Gücü Özeti — hidden for muhasebe */}
            {role !== "muhasebe" && (() => {
              return (
                <div className={CARD}>
                  <h3 className={CARD_TITLE}>
                    <Briefcase size={14} className={TEXT_MUTED} />
                    Aktif İş Gücü Özeti
                  </h3>
                  <AsyncSection isLoading={workforceResource.loading} hasError={workforceResource.error} onRetry={() => { void workforceResource.reload(); }}>
                  {firmaIsGucu ? (
                    <div className="space-y-2">
                      <div className="flex items-baseline gap-2">
                        <span className={`${TYPE_KPI_VALUE} ${TEXT_PRIMARY}`}>{firmaIsGucu.current_count}</span>
                        <span className={`${TYPE_BODY} ${TEXT_SECONDARY}`}>/ {firmaIsGucu.target_count} hedef</span>
                      </div>
                      {deriveOpenGap(firmaIsGucu) > 0 && (
                        <p className={`${TYPE_CAPTION} text-amber-600 font-medium`}>{deriveOpenGap(firmaIsGucu)} açık fark</p>
                      )}
                      <div className={`flex items-center gap-3 ${TYPE_CAPTION} ${TEXT_SECONDARY}`}>
                        <span className="text-green-600">+{firmaIsGucu.hires_last_30d} giriş</span>
                        <span className="text-red-600">−{firmaIsGucu.exits_last_30d} çıkış</span>
                      </div>
                    </div>
                  ) : (
                    <p className={`${TYPE_CAPTION} ${TEXT_MUTED}`}>Bu firma için iş gücü kaydı yok.</p>
                  )}
                  </AsyncSection>
                </div>
              );
            })()}

            {/* 4. Yaklaşan Randevular — hidden for muhasebe, derived from real truth */}
            {role !== "muhasebe" && (() => {
              const planliRandevuSayisi = firmaRandevular.filter((r) => r.status === "planlandi").length;
              return (
                <div className={CARD}>
                  <h3 className={CARD_TITLE}>
                    <CalendarCheck size={14} className={TEXT_MUTED} />
                    Yaklaşan Randevular
                  </h3>
                  <AsyncSection isLoading={appointmentsLoading} hasError={appointmentsError} onRetry={() => { void reloadAppointments(); }}>
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
                  </AsyncSection>
                </div>
              );
            })()}

            {/* 5. Evrak takibi — stored status, only after a successful read */}
            {role !== "muhasebe" && (() => {
              const eksikler = firmaDocs.filter((e) => e.status !== "tam");
              return (
                <div className={CARD}>
                  <h3 className={CARD_TITLE}>
                    <FolderOpen size={14} className={TEXT_MUTED} />
                    Evrak Takibi
                  </h3>
                  {documentsAccessRestricted ? (
                    <p className={`${TYPE_CAPTION} ${TEXT_MUTED}`}>Erişim kısıtlı — bu rolde evrak görüntülenemez.</p>
                  ) : (
                    <AsyncSection isLoading={docsLoading} hasError={docsError} onRetry={() => { void reloadDocs(); }}>
                      <div className="flex items-baseline gap-2 py-2">
                        <span className={`${TYPE_KPI_VALUE} font-semibold ${eksikler.length > 0 ? "text-amber-600" : TEXT_PRIMARY}`}>
                          {eksikler.length}
                        </span>
                        <span className={`${TYPE_BODY} ${TEXT_SECONDARY}`}>takip gerektiren belge</span>
                      </div>
                      {eksikler.length === 0 ? (
                        <p className={`${TYPE_CAPTION} ${TEXT_MUTED}`}>{firmaDocs.length === 0 ? "Bu firmaya ait belge kaydı yok." : "Kayıtlı belgelerde takip gerektiren durum yok."}</p>
                      ) : (
                        <div className="space-y-1.5 mt-2">
                          {eksikler.map((e) => (
                            <div key={e.id} className={`flex items-center justify-between ${TYPE_CAPTION}`}>
                              <span className="text-slate-600 truncate mr-2">{e.name}</span>
                              <StatusBadge status={e.status} />
                            </div>
                          ))}
                        </div>
                      )}
                    </AsyncSection>
                  )}
                </div>
              );
            })()}

            {/* 6. Ticari Ozet — real financial data or honest absence */}
            {!["goruntuleyici", "ik"].includes(role) && (() => {
              if (!firmaFinancial) {
                return (
                  <div className={CARD}>
                    <h3 className={CARD_TITLE}>
                      <BarChart3 size={14} className={TEXT_MUTED} />
                      Ticari Ozet
                    </h3>
                    <p className={`${TYPE_BODY} ${TEXT_MUTED} text-center py-3`}>
                      Ticari ozet verisi henuz mevcut degil.
                    </p>
                  </div>
                );
              }
              return (
                <CommercialSummaryCard
                  acikBakiye={firmaFinancial.open_receivable ?? "—"}
                  sonFaturaTarihi={"—"}
                  sonFaturaTutari={"—"}
                  kesilmemisBekleyen={firmaFinancial.unbilled_amount ?? "—"}
                  ticariRisk={firmaFinancial.is_overdue ? "yuksek" : "dusuk"}
                  kaynak={firmaFinancial.last_source}
                />
              );
            })()}

            {/* 7. Son Notlar — reads from notes state, hidden for görüntüleyici + muhasebe */}
            {!["goruntuleyici", "muhasebe"].includes(role) && <div className={CARD}>
              <h3 className={CARD_TITLE}>
                <StickyNote size={14} className={TEXT_MUTED} />
                Son Notlar
              </h3>
              <AsyncSection isLoading={notesResource.loading} hasError={notesResource.error} onRetry={() => { void reloadNotlar(); }}>
              {notlar.length === 0 ? (
                <p className={`${TYPE_BODY} ${TEXT_MUTED} text-center py-3`}>
                  Henüz not yok.
                </p>
              ) : (
                <div className="space-y-2">
                  {notlar.slice(0, 3).map((n) => (
                    <div key={n.id} className={`py-1.5 ${LIST_DIVIDER}`}>
                      <p className={`${TYPE_BODY} ${TEXT_BODY} whitespace-pre-wrap break-words`}>{n.content}</p>
                      <p className={`${TYPE_CAPTION} ${TEXT_MUTED} mt-0.5`}>{n.author_name} · {formatDateTR(n.created_at.slice(0, 10))}</p>
                    </div>
                  ))}
                </div>
              )}
              </AsyncSection>
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
              {(() => {
                // Real risk signals from financial summary
                const ticariBullets: string[] = [];
                if (firmaFinancial?.is_overdue && firmaFinancial?.open_receivable) {
                  ticariBullets.push(`Ticari: Gecikmis alacak ${firmaFinancial.open_receivable}`);
                }
                if (firmaFinancial?.unbilled_amount) {
                  ticariBullets.push(`Ticari: Kesilmemis bekleyen ${firmaFinancial.unbilled_amount}`);
                }
                const allSignals = ticariBullets.length === 0;

                if (allSignals) {
                  return <p className={`${TYPE_BODY} ${TEXT_MUTED}`}>Aktif risk sinyali yok.</p>;
                }

                const canDraftPayment = ticariBullets.length > 0 && (role === "yonetici" || role === "partner");

                return (
                  <>
                    <ul className="space-y-1.5">
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

            {/* 9. Tahmini Ticari Kalite — removed, no real data source */}
          </div>

          {/* Ticari Temas — outbound draft helpers, yönetici + partner only */}
          {(role === "yonetici" || role === "partner") && firma.durum === "aktif" && (() => {
            const sonGorusmeTarih = firma.sonGorusme;
            const isStale = sonGorusmeTarih && sonGorusmeTarih !== "—" && (() => {
              const diff = (new Date().getTime() - new Date(sonGorusmeTarih).getTime()) / (1000 * 60 * 60 * 24);
              return diff > 30;
            })();
            const tb = firmaFinancial ? { gecikmisAlacak: firmaFinancial.is_overdue ? (firmaFinancial.open_receivable ?? undefined) : undefined, kesilmemisBekleyen: firmaFinancial.unbilled_amount ?? undefined } : null;
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

          </>
        )}

        {/* Yetkililer tab — firm contacts, max 5 */}
        {activeTab === "yetkililer" && (
          <div className={CARD_LG}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
              <h3 className={CARD_TITLE_PLAIN}>Yetkili Kişiler</h3>
              <div className="flex flex-shrink-0 items-center gap-2 sm:justify-end">
                {/* Yetkili Ekle (create) — yonetici-only by app-level
                    product decision; partner is HOLD / pending follow-up.
                    Passive-company guard (disabled + tooltip) preserved. */}
                {role === "yonetici" && yetkililer.length < 5 && (
                  <button
                    type="button"
                    onClick={() => { setEditingContact(null); setEditPhoneEmailOnly(false); setOpenContactContext(contactContext); }}
                    disabled={isPassiveCompany || !contactsReady}
                    title={isPassiveCompany ? PASSIVE_BLOCK_TITLE : undefined}
                    className={`min-h-11 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 ${TYPE_CAPTION} font-medium ${TEXT_BODY} border ${BORDER_DEFAULT} ${RADIUS_SM} ${SURFACE_PRIMARY} hover:bg-slate-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent`}
                  >
                    <UserPlus size={14} strokeWidth={1.8} />
                    Yetkili Ekle
                  </button>
                )}
                {contactsReady && yetkililer.length >= 5 && (
                  <span className={`${TYPE_CAPTION} ${TEXT_MUTED}`}>Maksimum 5 yetkili</span>
                )}
              </div>
            </div>
            <AsyncSection isLoading={contactsResource.loading} hasError={contactsResource.error} onRetry={() => { void reloadYetkililer(); }}>
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
                {yetkililer.map((ytk, idx) => (
                  <div key={ytk.id} className={`py-3 ${idx < yetkililer.length - 1 ? `border-b ${BORDER_SUBTLE}` : ""}`}>
                    <div className="flex items-start justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className={`${TYPE_BODY} font-medium ${TEXT_PRIMARY} break-words min-w-0`}>{ytk.full_name}</p>
                          {ytk.is_primary && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded-full bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-600/20">
                              <Star size={8} />
                              Ana Yetkili
                            </span>
                          )}
                        </div>
                        {ytk.title && (
                          <p className={`${TYPE_CAPTION} ${TEXT_SECONDARY} mt-0.5 break-words`}>{ytk.title}</p>
                        )}
                        <div className="flex flex-col gap-1.5 mt-1.5 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-4 sm:gap-y-1">
                          {ytk.phone && (
                            <a href={`tel:${ytk.phone.replace(/\s/g, "")}`} className={`${TYPE_CAPTION} ${TEXT_LINK} inline-flex items-center gap-1.5 min-w-0 hover:underline`}>
                              <Phone size={12} className={`flex-shrink-0 ${TEXT_MUTED}`} aria-hidden />
                              <span className="break-all">{ytk.phone}</span>
                            </a>
                          )}
                          {ytk.email && (
                            <a href={`mailto:${ytk.email}`} className={`${TYPE_CAPTION} ${TEXT_LINK} inline-flex items-center gap-1.5 min-w-0 hover:underline`}>
                              <Mail size={12} className={`flex-shrink-0 ${TEXT_MUTED}`} aria-hidden />
                              <span className="break-all">{ytk.email}</span>
                            </a>
                          )}
                        </div>
                        {ytk.context_note && (
                          <p className={`${TYPE_CAPTION} ${TEXT_MUTED} mt-1 whitespace-pre-wrap break-words`}>{ytk.context_note}</p>
                        )}
                      </div>
                      {/* Edit + delete actions — role-gated. Edit:
                          yonetici/partner/operasyon. Delete: yonetici-only
                          (hard delete; mirrors the contacts DELETE app guard). */}
                      <div className="flex-shrink-0 ml-2 flex flex-col sm:flex-row items-center">
                        {(role === "yonetici" || role === "partner" || role === "operasyon") && (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingContact(ytk);
                              setEditPhoneEmailOnly(role === "operasyon");
                              setOpenContactContext(contactContext);
                            }}
                            className={`min-h-11 min-w-11 inline-flex items-center justify-center ${TEXT_MUTED} hover:text-slate-600 hover:bg-slate-100 ${RADIUS_SM} transition-colors`}
                            aria-label={`${ytk.full_name} — düzenle`}
                          >
                            <Pencil size={13} aria-hidden />
                          </button>
                        )}
                        {role === "yonetici" && (
                          <button
                            type="button"
                            onClick={() => requestDelete("contact", ytk.id, ytk.full_name)}
                            className={`min-h-11 min-w-11 inline-flex items-center justify-center ${TEXT_MUTED} hover:text-red-600 hover:bg-red-50 ${RADIUS_SM} transition-colors disabled:opacity-40 disabled:cursor-not-allowed`}
                            aria-label={`${ytk.full_name} — kalıcı olarak sil`}
                            title="Yetkili kişiyi kalıcı olarak sil"
                          >
                            <Trash2 size={13} aria-hidden />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            </AsyncSection>
          </div>
        )}

        {/* Sözleşmeler tab — firm's contracts */}
        {activeTab === "sozlesmeler" && (
          <div className={CARD_LG}>
            <h3 className={CARD_TITLE_PLAIN}>
              Firma Sözleşmeleri
            </h3>
            {!contractsAllowed ? (
              <p className={`${TYPE_BODY} ${TEXT_MUTED}`}>Bu rolde sözleşmeler görüntülenemez.</p>
            ) : (
              <AsyncSection isLoading={contractsResource.loading} hasError={contractsResource.error} onRetry={() => { void reloadSozlesmeler(); }}>
                {firmaSozlesmeler.length === 0 ? (
                  <EmptyState title="Sözleşme yok" description="Bu firmaya ait sözleşme bulunamadı." size="tab" />
                ) : (
                  <div className="space-y-2">
                    {firmaSozlesmeler.map((s) => {
                      const kalanGun = computeRemainingDays(s.end_date);
                      return (
                        <a
                          href={`/sozlesmeler/${s.id}`}
                          aria-label={`${s.name} — sözleşmeyi aç`}
                          key={s.id}
                          className={`flex min-h-11 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between py-3 ${LIST_DIVIDER} ${TABLE_ROW_HOVER} -mx-2 px-2 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500`}
                        >
                          <div className="min-w-0 flex-1 break-words">
                            <p className={`${TYPE_BODY} font-medium ${TEXT_BODY}`}>{s.name}</p>
                            <p className={`${TYPE_CAPTION} ${TEXT_MUTED} mt-0.5`}>
                              {s.contract_type ?? "—"} · {s.responsible ?? "—"}
                              {s.last_action_label ? ` · ${s.last_action_label}` : ""}
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 sm:flex-shrink-0">
                            {kalanGun !== null && kalanGun <= 30 && (
                              <span className={`${TYPE_CAPTION} font-medium ${kalanGun <= 15 ? "text-red-600" : "text-amber-600"}`}>
                                {kalanGun} gün
                              </span>
                            )}
                            <StatusBadge status={s.status} />
                            <span className={`${TYPE_CAPTION} text-blue-700`}>Sözleşmeyi aç</span>
                          </div>
                        </a>
                      );
                    })}
                  </div>
                )}
              </AsyncSection>
            )}
          </div>
        )}

        {/* Randevular tab — firm's appointments (Faz 3 real truth) */}
        {activeTab === "randevular" && (() => {
          return (
            <div className={CARD_LG}>
              <h3 className={CARD_TITLE_PLAIN}>
                Firma Randevuları
              </h3>
              <AsyncSection isLoading={appointmentsLoading} hasError={appointmentsError} onRetry={() => { void reloadAppointments(); }}>
              {firmaRandevular.length === 0 ? (
                <EmptyState title="Randevu yok" description="Bu firmaya ait randevu bulunamadı." size="tab" />
              ) : (
                <div className="space-y-2">
                  {firmaRandevular.map((r) => (
                    <a key={r.id} href={appointmentLinkHref(r.id)} aria-label={`${formatDateTR(r.meeting_date)} ${r.attendee || APPOINTMENT_TYPE_LABELS[r.meeting_type]} randevusunu aç`}
                      className="flex min-h-11 items-center gap-3 rounded-lg border border-slate-200 p-3 hover:border-blue-300 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
                      <div className="min-w-0 flex-1 break-words">
                        <p className={`${TYPE_BODY} font-medium ${TEXT_BODY}`}>
                          {formatDateTR(r.meeting_date)} {r.meeting_time ?? ""} — {APPOINTMENT_TYPE_LABELS[r.meeting_type as AppointmentMeetingType] ?? r.meeting_type}
                        </p>
                        <p className={`${TYPE_CAPTION} ${TEXT_MUTED} mt-0.5`}>{r.attendee ?? "—"}</p>
                        {r.result && (
                          <p className={`${TYPE_CAPTION} ${TEXT_SECONDARY} mt-0.5 truncate max-w-md`}>{r.result}</p>
                        )}
                        <span className="mt-1 block text-xs text-blue-700">Randevuyu aç →</span>
                      </div>
                      <span className="shrink-0"><StatusBadge status={r.status} /></span>
                    </a>
                  ))}
                </div>
              )}
              </AsyncSection>
            </div>
          );
        })()}

        {/* Talepler tab — firm's requests (Faz 3 real truth) */}
        {activeTab === "talepler" && (() => {
          return (
            <>
            {!demandResource.loading && !demandResource.error && <DemandTrendChart talepler={firmaTalepler} />}
            <div className={CARD_LG}>
              <h3 className={CARD_TITLE_PLAIN}>Firma Talepleri</h3>
              <AsyncSection isLoading={demandResource.loading} hasError={demandResource.error} onRetry={() => { void demandResource.reload(); }}>
              {firmaTalepler.length === 0 ? (
                <EmptyState title="Talep yok" description="Bu firmaya ait personel talebi bulunamadı." size="tab" />
              ) : (
                <div className="space-y-2">
                  {firmaTalepler.map((t) => (
                    <div key={t.id} className={`flex items-center justify-between py-2.5 ${LIST_DIVIDER}`}>
                      <div className="min-w-0">
                        <p className={`${TYPE_BODY} font-medium ${TEXT_BODY}`}>{t.position}</p>
                        <p className={`${TYPE_CAPTION} ${TEXT_MUTED} mt-0.5`}>{t.requested_count} talep · {t.provided_count} sağlanan · {computeOpenCount(t)} açık</p>
                      </div>
                      <StatusBadge status={t.status} />
                    </div>
                  ))}
                </div>
              )}
              </AsyncSection>
            </div>
            </>
          );
        })()}

        {/* Aktif İş Gücü tab — firm's workforce (Faz 3 real truth) */}
        {activeTab === "aktif-isgucu" && (() => {
          return (
            <div className={CARD_LG}>
              <h3 className={CARD_TITLE_PLAIN}>Aktif İş Gücü</h3>
              <AsyncSection isLoading={workforceResource.loading} hasError={workforceResource.error} onRetry={() => { void workforceResource.reload(); }}>
              {firmaIsGucu ? (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div className={`text-center p-3 ${SURFACE_HEADER} rounded`}>
                    <p className={`${TYPE_KPI_VALUE} ${TEXT_PRIMARY}`}>{firmaIsGucu.current_count}</p>
                    <p className={`${TYPE_CAPTION} ${TEXT_SECONDARY} mt-1`}>Aktif Kişi</p>
                  </div>
                  <div className={`text-center p-3 ${SURFACE_HEADER} rounded`}>
                    <p className={`${TYPE_KPI_VALUE} ${TEXT_PRIMARY}`}>{firmaIsGucu.target_count}</p>
                    <p className={`${TYPE_CAPTION} ${TEXT_SECONDARY} mt-1`}>Hedef Kişi</p>
                  </div>
                  <div className={`text-center p-3 ${SURFACE_HEADER} rounded`}>
                    <p className={`${TYPE_KPI_VALUE} ${deriveOpenGap(firmaIsGucu) > 0 ? "text-red-600" : "text-green-600"}`}>{deriveOpenGap(firmaIsGucu) > 0 ? `−${deriveOpenGap(firmaIsGucu)}` : "0"}</p>
                    <p className={`${TYPE_CAPTION} ${TEXT_SECONDARY} mt-1`}>Açık Fark</p>
                  </div>
                  <div className="text-center p-3 bg-green-50 rounded">
                    <p className="text-xl font-semibold text-green-700">+{firmaIsGucu.hires_last_30d}</p>
                    <p className={`${TYPE_CAPTION} ${TEXT_SECONDARY} mt-1`}>Son 30g Giriş</p>
                  </div>
                  <div className="text-center p-3 bg-red-50 rounded">
                    <p className="text-xl font-semibold text-red-600">−{firmaIsGucu.exits_last_30d}</p>
                    <p className={`${TYPE_CAPTION} ${TEXT_SECONDARY} mt-1`}>Son 30g Çıkış</p>
                  </div>
                </div>
              ) : (
                <EmptyState title="İş gücü verisi yok" description="Bu firma için iş gücü kaydı bulunamadı." size="tab" />
              )}
              </AsyncSection>
            </div>
          );
        })()}

        {/* Evraklar tab — firm's documents (real Supabase truth) */}
        {activeTab === "evraklar" && (() => {
          if (documentsAccessRestricted) {
            return (
              <div className={CARD_LG}>
                <h3 className={CARD_TITLE_PLAIN}>Firma Evraklari</h3>
                <EmptyState title="Erişim kısıtlı" description="Bu rolde evrak görüntülenemez." size="tab" />
              </div>
            );
          }

          // Upload boundary matches ROLE_MATRIX row 308 (Evrak yükleme):
          // yonetici + partner-scope + operasyon + ik. Partner scope is
          // enforced at the DB layer by the documents INSERT policy.
          const canMutateDocs = ["yonetici", "partner", "operasyon", "ik"].includes(role);
          // Delete is yonetici-only — mirrors the documents + storage.objects
          // DELETE RLS policies. Same gate the server action enforces.
          const canDeleteDocs = role === "yonetici";
          const contractLabelById = new Map(firmaSozlesmeler.map((c) => [c.id, c.name]));

          async function handleEvrakDownload(documentId: string) {
            setEvrakDownloadError(null);
            const result = await getCompanyDocumentDownloadUrlAction(documentId);
            if (result.ok) {
              window.open(result.url, "_blank", "noopener,noreferrer");
              return;
            }
            // Per-row failure stays item-level — page chrome unaffected.
            setEvrakDownloadError(result.error);
          }

          return (
            <div className={CARD_LG}>
              <div className="flex items-center justify-between mb-4">
                <h3 className={CARD_TITLE_PLAIN + " mb-0"}>Firma Evraklari</h3>
                {canMutateDocs && firma && (
                  <button
                    type="button"
                    onClick={() => { setEvrakUploadError(null); setEvrakUploadOpen(true); }}
                    disabled={isPassiveCompany}
                    title={isPassiveCompany ? PASSIVE_BLOCK_TITLE : undefined}
                    className={`flex items-center gap-1.5 ${TYPE_CAPTION} ${TEXT_LINK} hover:underline disabled:opacity-40 disabled:cursor-not-allowed disabled:no-underline`}
                  >
                    <Upload size={13} />
                    Belge Yükle
                  </button>
                )}
              </div>

              {evrakDownloadError && (
                <p className={`${TYPE_CAPTION} text-red-600 mb-3`} role="alert" aria-live="polite">
                  {evrakDownloadError}
                </p>
              )}

              <AsyncSection isLoading={docsLoading} hasError={docsError} onRetry={() => void reloadDocs()}>
              {firmaDocs.length === 0 ? (
                <EmptyState title="Belge yok" description="Bu firmaya ait belge bulunmuyor." size="tab" />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className={`bg-slate-50 ${TYPE_CAPTION} ${TEXT_SECONDARY}`}>
                      <tr>
                        <th className="px-3 py-2 text-left font-medium">Belge</th>
                        <th className="px-3 py-2 text-left font-medium">Kategori</th>
                        <th className="px-3 py-2 text-left font-medium">Durum</th>
                        <th className="px-3 py-2 text-left font-medium">Geçerlilik</th>
                        <th className="px-3 py-2 text-left font-medium">Sözleşme</th>
                        <th className="px-3 py-2 text-left font-medium">Yükleyen</th>
                        <th className="px-3 py-2 text-left font-medium">Güncellenme</th>
                        <th className="px-3 py-2 text-right font-medium" aria-label="aksiyon"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {firmaDocs.map((d) => (
                        <tr key={d.id} className={`border-t ${BORDER_SUBTLE}`}>
                          <td className={`px-3 py-2 ${TYPE_BODY} ${TEXT_BODY} max-w-[220px]`}>{d.contract_document_title && <p className="font-medium">{d.contract_document_title}</p>}<p className="truncate">{d.name}</p></td>
                          <td className={`px-3 py-2 ${TYPE_BODY} ${TEXT_BODY}`}>{DOCUMENT_CATEGORY_LABELS[d.category]}</td>
                          <td className="px-3 py-2"><StatusBadge status={d.status} /></td>
                          <td className={`px-3 py-2 ${TYPE_BODY} ${TEXT_BODY}`}>{d.validity_date ? formatDateTR(d.validity_date) : "—"}</td>
                          <td className={`px-3 py-2 ${TYPE_BODY} ${TEXT_BODY} max-w-[180px]`}>{d.contract_id ? (["yonetici","operasyon"].includes(role) ? <a href={`/sozlesmeler/${d.contract_id}`} className="text-blue-700 hover:underline">{contractLabelById.get(d.contract_id) ?? "Sözleşme dosyaları"}</a> : contractLabelById.get(d.contract_id) ?? "—") : "—"}</td>
                          <td className={`px-3 py-2 ${TYPE_BODY} ${TEXT_BODY} max-w-[160px] truncate`}>{d.uploaded_by ?? "—"}</td>
                          <td className={`px-3 py-2 ${TYPE_BODY} ${TEXT_BODY}`}>{formatDateTR(d.updated_at.slice(0, 10))}</td>
                          <td className="px-3 py-2 text-right">
                            <div className="inline-flex items-center gap-3">
                              <button
                                type="button"
                                onClick={() => { void handleEvrakDownload(d.id); }}
                                disabled={!d.storage_path}
                                className={`min-h-11 inline-flex items-center gap-1 ${TYPE_CAPTION} ${TEXT_LINK} hover:underline disabled:opacity-40 disabled:cursor-not-allowed`}
                                title={d.storage_path ? "İndir" : "Bu belge için dosya yok"}
                              >
                                <Download size={12} />
                                İndir
                              </button>
                              {canDeleteDocs && !d.contract_id && (
                                <button
                                  type="button"
                                  onClick={() => requestDelete("document", d.id, d.name)}
                                  aria-label={`${d.name} — kalıcı olarak sil`}
                                  className={`min-h-11 inline-flex items-center gap-1 ${TYPE_CAPTION} text-red-600 hover:underline disabled:opacity-40 disabled:cursor-not-allowed`}
                                  title="Belgeyi kalıcı olarak sil"
                                >
                                  <Trash2 size={12} />
                                  Sil
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              </AsyncSection>
            </div>
          );
        })()}

        {/* Notlar tab — firm-scoped institutional memory */}
        {activeTab === "notlar" && (() => {
          // Capability gates — authoritative source is the DB RLS policy
          // `notes_update_own_or_broad`. We mirror the same logic here so
          // buttons that the server would reject never render.
          //   - broad edit: yonetici (global), partner (scoped — scope
          //     check already applied server-side via RLS)
          //   - self edit:  operasyon / ik may edit their own notes;
          //     ownership comes from `author_id`, NEVER from `author_name`
          //   - pin/unpin: yonetici only
          const canEditNote = (n: NoteRow) => {
            if (role === "yonetici" || role === "partner") return true;
            if (role === "operasyon" || role === "ik") {
              return !!user && n.author_id === user.id;
            }
            return false;
          };
          const canPin = (_n: NoteRow) => role === "yonetici";

          const sabitlenenler = notlar.filter((n) => n.is_pinned);
          const filtrelenmis = notlar
            .filter((n) => !notTagFilter || n.tag === notTagFilter)
            .filter((n) => !n.is_pinned);
          const mevcutEtiketler = [
            ...new Set(notlar.map((n) => n.tag).filter(Boolean)),
          ] as NoteTagKey[];

          async function handlePinToggle(n: NoteRow, next: boolean) {
            if (liveNoteContext.current !== noteContext || !noteContext.scope || notePinFlight.current?.context === noteContext) return;
            const operation: NotePinOperation = { context: noteContext, id: n.id, next };
            notePinFlight.current = operation;
            setNotePinPending(operation);
            setNotePinError(null);
            const current = () => liveNoteContext.current === noteContext && notePinFlight.current === operation;
            try {
              if (next) await pinNote(supabase, id, n.id);
              else await unpinNote(supabase, id, n.id);
              if (!current()) return;
              feedback.show(next ? "Not sabitlendi." : "Notun sabitlemesi kaldırıldı.");
              await reloadNotlar();
              if (current()) router.refresh();
            } catch {
              if (current()) setNotePinError(noteContext);
            } finally {
              // A late operation must never unlock a newer context's pending write.
              if (notePinFlight.current === operation) notePinFlight.current = null;
              if (liveNoteContext.current === noteContext) setNotePinPending(value => value === operation ? null : value);
            }
          }

          return (
            <div className={CARD_LG}>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                <h3 className={CARD_TITLE_PLAIN}>Firma Notları</h3>
                <div className="flex items-center gap-3">
                  {mevcutEtiketler.length > 0 && (
                    <select
                      aria-label="Not etiketi"
                      value={notTagFilter}
                      onChange={(e) => setNotTagFilter(e.target.value as NoteTagKey | "")}
                      className={`px-2 py-1 ${TYPE_CAPTION} border ${BORDER_DEFAULT} ${RADIUS_SM} focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white`}
                    >
                      <option value="">Tüm etiketler</option>
                      {mevcutEtiketler.map((et) => (
                        <option key={et} value={et}>{NOTE_TAG_LABELS[et]}</option>
                      ))}
                    </select>
                  )}
                  {canCreateNotes && (
                    <button
                      onClick={() => { setNotEditTarget(null); setNoteDefaultIcerik(""); setOpenNoteContext(noteContext); }}
                      className={`min-h-11 flex items-center gap-1.5 ${TYPE_CAPTION} ${TEXT_LINK} hover:underline`}
                    >
                      <Plus size={13} />
                      Yeni Not
                    </button>
                  )}
                </div>
              </div>

              {pinBusy && <p role="status" className={`${TYPE_BODY} text-blue-700 mb-3`}>Notun sabitleme durumu kaydediliyor…</p>}
              {notePinError === noteContext && (
                <p className={`${TYPE_CAPTION} text-red-600 mb-3`} role="alert" aria-live="polite">
                  Notun sabitleme durumu değiştirilemedi. Tekrar deneyin.
                </p>
              )}

              <AsyncSection isLoading={notesResource.loading} hasError={notesResource.error} onRetry={() => { void reloadNotlar(); }}>
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
                              <p className={`${TYPE_BODY} ${TEXT_BODY} whitespace-pre-wrap break-words`}>{n.content}</p>
                              <div className={`flex flex-wrap items-center gap-x-2 gap-y-1 mt-1.5 ${TYPE_CAPTION} ${TEXT_MUTED}`}>
                                <span>{n.author_name}</span>
                                <span>·</span>
                                <span>{formatDateTR(n.created_at.slice(0, 10))}</span>
                                {n.tag && (
                                  <>
                                    <span>·</span>
                                    <span className="px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-medium">{NOTE_TAG_LABELS[n.tag]}</span>
                                  </>
                                )}
                                <span className="text-blue-500 flex items-center gap-0.5"><Pin size={9} /> Sabit</span>
                              </div>
                            </div>
                            <div className="flex flex-col sm:flex-row items-center gap-1 flex-shrink-0 ml-2">
                              {canPin(n) && (
                                <button
                                  disabled={pinBusy}
                                  onClick={() => { void handlePinToggle(n, false); }}
                                  className={`flex h-11 w-11 items-center justify-center ${TEXT_MUTED} hover:text-slate-600 ${RADIUS_SM} hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed`}
                                  title="Sabitlemeyi kaldır"
                                  aria-busy={pinBusy && notePinPending?.id === n.id}
                                >
                                  <Pin size={12} />
                                </button>
                              )}
                              {canEditNote(n) && (
                                <button
                                  aria-label="Notu düzenle"
                                  onClick={() => { setNotEditTarget(n); setOpenNoteContext(noteContext); }}
                                  className={`flex h-11 w-11 items-center justify-center ${TEXT_MUTED} hover:text-slate-600 ${RADIUS_SM} hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed`}
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
                          <p className={`${TYPE_BODY} ${TEXT_BODY} whitespace-pre-wrap break-words`}>{n.content}</p>
                          <div className={`flex flex-wrap items-center gap-x-2 gap-y-1 mt-1.5 ${TYPE_CAPTION} ${TEXT_MUTED}`}>
                            <span>{n.author_name}</span>
                            <span>·</span>
                            <span>{formatDateTR(n.created_at.slice(0, 10))}</span>
                            {n.tag && (
                              <>
                                <span>·</span>
                                <span className="px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-medium">{NOTE_TAG_LABELS[n.tag]}</span>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col sm:flex-row items-center gap-1 flex-shrink-0 ml-2">
                          {canPin(n) && (
                            <button
                              disabled={pinBusy}
                              onClick={() => { void handlePinToggle(n, true); }}
                              className={`flex h-11 w-11 items-center justify-center ${TEXT_MUTED} hover:text-blue-500 ${RADIUS_SM} hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed`}
                              title="Sabitle"
                              aria-busy={pinBusy && notePinPending?.id === n.id}
                            >
                              <Pin size={12} />
                            </button>
                          )}
                          {canEditNote(n) && (
                            <button
                              aria-label="Notu düzenle"
                                  onClick={() => { setNotEditTarget(n); setOpenNoteContext(noteContext); }}
                              className={`flex h-11 w-11 items-center justify-center ${TEXT_MUTED} hover:text-slate-600 ${RADIUS_SM} hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed`}
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
              </AsyncSection>
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

      {appointmentOpen && companyShell && ["yonetici", "operasyon"].includes(role) && (
        <NewAppointmentModal
          key={companyScope}
          open={appointmentOpen}
          onClose={() => { if (liveAppointmentContext.current === appointmentContext) setAppointmentOpen(false); }}
          defaultFirmaId={companyShell.id}
          firmalar={[{ id: companyShell.id, ad: companyShell.name }]}
          allowNewCompany={false}
          onSubmit={async ({ firmaId, tarih, saat, gorusmeTipi, katilimci }) => {
            if (liveAppointmentContext.current !== appointmentContext || firmaId !== companyShell.id) throw new Error("Firma bilgisi değişti. Randevu formunu yeniden açın.");
            const result = await createAppointmentAction({
              legacyCompanyId: firmaId,
              meetingDate: tarih,
              meetingTime: saat || undefined,
              meetingType: gorusmeTipi,
              attendee: katilimci || undefined,
            });
            if (liveAppointmentContext.current !== appointmentContext) return;
            if (!result.ok) throw new Error(result.error);
            // Creation succeeded: a subsequent list refresh failure must not
            // keep a retryable create form open and invite a duplicate insert.
            setAppointmentOpen(false);
            setActiveTab("randevular");
            feedback.show("Randevu oluşturuldu. Durumu: planlandı.");
            void reloadAppointments();
            router.refresh();
          }}
        />
      )}

      {openNoteContext === noteContext && notesScope && <QuickNoteModal
        key={`${companyScope}:${notEditTarget?.id ?? "new"}`}
        open
        onClose={() => {
          if (liveNoteContext.current !== noteContext) return;
          setOpenNoteContext(null); setNoteDefaultIcerik(""); setNotEditTarget(null);
        }}
        firmaAdi={firma.firmaAdi}
        defaultIcerik={notEditTarget ? notEditTarget.content : noteDefaultIcerik}
        defaultEtiket={notEditTarget?.tag ?? ""}
        editMode={!!notEditTarget}
        onSubmit={async ({ icerik, etiket }) => {
          if (liveNoteContext.current !== noteContext || !noteContext.scope) return;
          try {
            if (notEditTarget) {
              await updateNoteContent(supabase, id, notEditTarget.id, { content: icerik, tag: etiket });
            } else {
              const result = await createNoteAction(id, { content: icerik, tag: etiket });
              if (!result.ok) throw new Error("Not kaydedilemedi.");
            }
          } catch {
            if (liveNoteContext.current !== noteContext) return;
            throw new Error("Not kaydedilemedi. Bilgileriniz korundu; tekrar deneyin.");
          }
          if (liveNoteContext.current !== noteContext) return;
          // A committed save is complete even if the subsequent list read fails.
          setOpenNoteContext(null);
          setNoteDefaultIcerik("");
          setNotEditTarget(null);
          setNotTagFilter("");
          setActiveTab("notlar");
          feedback.show(notEditTarget ? "Not güncellendi." : "Not firmaya eklendi.");
          void reloadNotlar();
          router.refresh();
        }}
      />}

      {openContactContext === contactContext && contactScope && <AddContactModal
        key={`${companyScope}:${editingContact?.id ?? "new"}`}
        open
        onClose={() => {
          if (liveContactContext.current !== contactContext) return;
          setOpenContactContext(null); setEditingContact(null); setEditPhoneEmailOnly(false);
        }}
        editData={editingContact}
        phoneEmailOnly={editPhoneEmailOnly}
        currentAnaYetkiliAdi={yetkililer.find((y) => y.is_primary)?.full_name}
        onSubmit={async (data) => {
          if (liveContactContext.current !== contactContext || !contactContext.scope) return;
          try {
            if (editingContact) {
              if (editPhoneEmailOnly) await updateContactPhoneEmail(supabase, id, editingContact.id, { phone: data.phone, email: data.email });
              else await updateContactFull(supabase, id, editingContact.id, data);
            } else {
              if (!companyShell) throw new Error("Firma yüklenmedi.");
              const result = await createContactAction(companyShell.id, data);
              if (!result.ok) {
                if (result.error === new ContactLimitReachedError().message) throw new ContactLimitReachedError();
                throw new Error(result.error);
              }
            }
          } catch (error) {
            if (liveContactContext.current !== contactContext) return;
            if (error instanceof ContactValidationError) throw error;
            throw new Error("Yetkili kaydedilemedi. Bilgileriniz korundu; tekrar deneyin.");
          }
          if (liveContactContext.current !== contactContext) return;
          setOpenContactContext(null); setEditingContact(null); setEditPhoneEmailOnly(false);
          setActiveTab("yetkililer");
          feedback.show(editingContact ? "Yetkili bilgileri güncellendi." : "Yetkili firmaya eklendi.");
          void reloadYetkililer();
          router.refresh();
        }}
      />}

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
                      setOpenNoteContext(noteContext);
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
                    const tb = firmaFinancial ? { gecikmisAlacak: firmaFinancial.is_overdue ? (firmaFinancial.open_receivable ?? undefined) : undefined, kesilmemisBekleyen: firmaFinancial.unbilled_amount ?? undefined } : null;
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
                      const currentAnaYetkili = yetkililer.find((y) => y.is_primary)?.full_name ?? firma.anaYetkili;
                      const draft = generateYenidenTemasDraft({
                        firmaAdi: firma.firmaAdi,
                        anaYetkili: currentAnaYetkili,
                        sonGorusme: firma.sonGorusme,
                        aktifSozlesme: firma.aktifSozlesme,
                      });
                      setTemasDraftText(draft);
                    } else {
                      const tb = firmaFinancial ? { gecikmisAlacak: firmaFinancial.is_overdue ? (firmaFinancial.open_receivable ?? undefined) : undefined, kesilmemisBekleyen: firmaFinancial.unbilled_amount ?? undefined } : null;
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

      {/* Evrak upload modal — server-action backed, PDF-only, server-set
          tenant_id/company_id/created_by/uploaded_by/storage_path. The
          companyId here is the REAL DB UUID from `companyShell`, never
          the route param (which may be a legacy_mock_id). The storage
          policy parses the first path segment as a company UUID. */}
      {evrakUploadOpen && companyShell && (
        <EvrakUploadModal
          companyId={companyShell.id}
          companyName={companyShell.name}
          contracts={firmaSozlesmeler.map((c) => ({ id: c.id, name: c.name }))}
          submitError={evrakUploadError}
          onClose={() => { setEvrakUploadOpen(false); setEvrakUploadError(null); }}
          onSubmitError={setEvrakUploadError}
          onSuccess={async () => {
            setEvrakUploadOpen(false);
            setEvrakUploadError(null);
            await reloadDocs();
            router.refresh();
          }}
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// EvrakUploadModal — page-local upload form.
//
// Server-action backed (see `./actions.ts > uploadCompanyDocumentAction`).
// The component itself only collects inputs and forwards them as
// FormData; identity / tenant / company / audit fields are set by the
// action against the cookie-derived session. The browser never sees a
// signed URL it can persist, never sees a service-role client, and
// never writes directly to `documents`.
// ---------------------------------------------------------------------------

interface EvrakUploadModalProps {
  companyId: string;
  companyName: string;
  contracts: { id: string; name: string }[];
  submitError: string | null;
  onClose: () => void;
  onSubmitError: (err: string) => void;
  onSuccess: () => Promise<void> | void;
}

function EvrakUploadModal({
  companyId,
  companyName,
  contracts,
  submitError,
  onClose,
  onSubmitError,
  onSuccess,
}: EvrakUploadModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [category, setCategory] = useState<DocumentCategory>("diger");
  const [contractId, setContractId] = useState("");
  const [validityDate, setValidityDate] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const MAX_BYTES = 10 * 1024 * 1024;
  const canSubmit = !!file && name.trim().length > 0 && !submitting;

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0] ?? null;
    if (!picked) { setFile(null); setFileError(null); return; }
    if (picked.type !== "application/pdf") {
      setFile(null); setFileError("Sadece PDF dosyası yüklenebilir."); return;
    }
    if (picked.size > MAX_BYTES) {
      setFile(null); setFileError("Dosya boyutu 10 MB'dan büyük olamaz."); return;
    }
    setFile(picked); setFileError(null);
  }

  async function handleSubmit() {
    if (!canSubmit || !file) return;
    setSubmitting(true);
    const fd = new FormData();
    fd.set("company_id", companyId);
    fd.set("name", name.trim());
    fd.set("category", category);
    if (contractId) fd.set("contract_id", contractId);
    if (validityDate) fd.set("validity_date", validityDate);
    fd.set("file", file);

    try {
      const result = await uploadCompanyDocumentAction(fd);
      if (result.ok) {
        await onSuccess();
      } else {
        onSubmitError(result.error);
      }
    } catch (err) {
      onSubmitError(err instanceof Error ? err.message : "Belge yüklenemedi.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={`fixed inset-0 ${Z_OVERLAY} flex items-center justify-center p-4 ${SURFACE_OVERLAY_DARK}`} role="dialog" aria-modal="true">
      <div className={`${SURFACE_PRIMARY} ${RADIUS_DEFAULT} shadow-xl w-full max-w-md p-5 space-y-4`}>
        <div>
          <h3 className={`${TYPE_CARD_TITLE} ${TEXT_PRIMARY}`}>Belge Yükle</h3>
          <p className={`${TYPE_CAPTION} ${TEXT_MUTED} mt-0.5`}>{companyName}</p>
        </div>

        <div className="space-y-3">
          <div>
            <label className={`block ${TYPE_CAPTION} ${TEXT_SECONDARY} mb-1`}>Dosya (PDF) <span className="text-red-500">*</span></label>
            <input type="file" accept="application/pdf" onChange={handleFileChange} disabled={submitting}
              className={`w-full ${TYPE_CAPTION} file:mr-3 file:px-3 file:py-1.5 file:text-sm file:font-medium file:bg-slate-50 file:border file:border-slate-200 file:rounded-md file:text-slate-700 hover:file:bg-slate-100 disabled:opacity-40`} />
            {file && !fileError && (
              <p className={`mt-1 ${TYPE_CAPTION} ${TEXT_MUTED}`}>{file.name} · {(file.size / 1024 / 1024).toFixed(2)} MB</p>
            )}
            {fileError && (<p className={`mt-1 ${TYPE_CAPTION} text-red-600`}>{fileError}</p>)}
            <p className={`mt-1 ${TYPE_CAPTION} ${TEXT_MUTED}`}>Maksimum 10 MB, sadece PDF.</p>
          </div>

          <div>
            <label className={`block ${TYPE_CAPTION} ${TEXT_SECONDARY} mb-1`}>Belge Adı <span className="text-red-500">*</span></label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} disabled={submitting}
              placeholder="Belge adını girin"
              className={`w-full px-3 py-2 ${TYPE_BODY} border ${BORDER_DEFAULT} ${RADIUS_SM} focus:outline-none focus:ring-2 focus:ring-blue-500`} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={`block ${TYPE_CAPTION} ${TEXT_SECONDARY} mb-1`}>Kategori</label>
              <select value={category} onChange={(e) => setCategory(e.target.value as DocumentCategory)} disabled={submitting}
                className={`w-full px-3 py-2 ${TYPE_BODY} border ${BORDER_DEFAULT} ${RADIUS_SM} bg-white focus:outline-none focus:ring-2 focus:ring-blue-500`}>
                {(Object.keys(DOCUMENT_CATEGORY_LABELS) as DocumentCategory[]).map((k) => (
                  <option key={k} value={k}>{DOCUMENT_CATEGORY_LABELS[k]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={`block ${TYPE_CAPTION} ${TEXT_SECONDARY} mb-1`}>Geçerlilik (ops.)</label>
              <input type="date" value={validityDate} onChange={(e) => setValidityDate(e.target.value)} disabled={submitting}
                className={`w-full px-3 py-2 ${TYPE_BODY} border ${BORDER_DEFAULT} ${RADIUS_SM} focus:outline-none focus:ring-2 focus:ring-blue-500`} />
            </div>
          </div>

          {contracts.length > 0 && (
            <div>
              <label className={`block ${TYPE_CAPTION} ${TEXT_SECONDARY} mb-1`}>Bağlı Sözleşme (ops.)</label>
              <select value={contractId} onChange={(e) => setContractId(e.target.value)} disabled={submitting}
                className={`w-full px-3 py-2 ${TYPE_BODY} border ${BORDER_DEFAULT} ${RADIUS_SM} bg-white focus:outline-none focus:ring-2 focus:ring-blue-500`}>
                <option value="">— bağlama —</option>
                {contracts.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
              </select>
            </div>
          )}
        </div>

        {submitError && (<p className={`${TYPE_CAPTION} text-red-600`} role="alert" aria-live="polite">{submitError}</p>)}

        <div className="flex items-center justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} disabled={submitting}
            className={`px-4 py-2 ${TYPE_CAPTION} font-medium ${TEXT_BODY} bg-white border ${BORDER_DEFAULT} ${RADIUS_SM} hover:bg-slate-50 disabled:opacity-40`}>
            İptal
          </button>
          <button type="button" onClick={handleSubmit} disabled={!canSubmit}
            className={`px-4 py-2 ${TYPE_CAPTION} font-medium text-white bg-blue-600 ${RADIUS_SM} hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed`}>
            {submitting ? "Yükleniyor..." : "Yükle"}
          </button>
        </div>
      </div>
    </div>
  );
}
