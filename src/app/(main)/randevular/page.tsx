"use client";
import ListToolbar from "@/components/ui/ListToolbar";

import type { SearchInputHandle } from "@/components/ui/SearchInput";
import { useListViewState } from "@/components/ui/useListViewState";
import ActionNotice, { useActionNotice } from "@/components/ui/ActionNotice";
import PickerFeedback from "@/components/ui/PickerFeedback";
import AppointmentLinkOpener from "./AppointmentLinkOpener";
import AppointmentTasks from "./AppointmentTasks";
import AsyncSection from "@/components/ui/AsyncSection";

/**
 * Randevular list page — Phase 3B cutover.
 *
 * Data source: Supabase `appointments` table via the service layer.
 * Company names are resolved in a single batched round trip via
 * `getCompanyDisplayMapByIds`. The firma filter dropdown and the
 * NewAppointmentModal firma picker now source options from the real
 * companies table via `selectAllCompanies` (RLS-scoped).
 *
 * The appointment-to-task handoff (completing an appointment and
 * optionally creating a linked task) is delegated to the service
 * layer's `completeAppointment`, which handles both the status
 * update and the task creation atomically.
 */

import { Suspense, useState, useRef, useMemo, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { formatDateTR } from "@/lib/format-date";
import { Plus, RefreshCw } from "lucide-react";
import {
  PageHeader,
  SearchInput,
  FilterBar,
  DataTable,
  StatusBadge,
  RightSidePanel,
  EmptyState,
} from "@/components/ui";
import { useRole } from "@/context/RoleContext";
import { useAuth } from "@/context/AuthContext";
import {
  NewAppointmentModal,
  AppointmentResultModal,
  NewTaskModal,
} from "@/components/modals";
import { createClient } from "@/lib/supabase/client";
import { listAllAppointments } from "@/lib/services/appointments";
import { getCompanyDisplayMapByIds } from "@/lib/services/companies";
// Create + complete paths route through server actions so the passive-
// company guard runs before the insert / task side-effect. createTaskAction
// is shared with the Görevler page (the "Görev Oluştur" flow creates a görev).
import {
  createAppointmentAction,
  completeAppointmentAction,
} from "./actions";
import { createTaskAction } from "../gorevler/actions";
import { APPOINTMENT_TYPE_LABELS } from "@/lib/appointment-types";
import type { AppointmentMeetingType } from "@/lib/appointment-types";
import type { AppointmentRow } from "@/types/database.types";
import { selectAllCompanies } from "@/lib/supabase/companies";
import { listActiveTenantProfiles } from "@/lib/services/profiles";
import type { CompanyRow, ProfileRow } from "@/types/database.types";
import type {
  ColumnDef,
  FilterConfig,
  FilterValues,
  RowAction,
  OncelikSeviyesi,
} from "@/types/ui";
import { clsx } from "clsx";
import {
  TYPE_BODY,
  TYPE_CAPTION,
  TYPE_LABEL,
  TEXT_BODY,
  TEXT_SECONDARY,
  TEXT_MUTED,
  TEXT_INVERSE,
  TEXT_LINK,
  BORDER_SUBTLE,
  RADIUS_FULL,
} from "@/styles/tokens";

// Page-local helpers
const CHIP_BASE = `min-h-11 px-3 py-2 ${TYPE_LABEL} ${RADIUS_FULL} border transition-colors`;
const CHIP_ACTIVE = `bg-slate-900 ${TEXT_INVERSE} border-slate-900`;
const CHIP_INACTIVE = "bg-white text-slate-600 border-slate-200 hover:bg-slate-50";
const DL_LABEL = `${TYPE_CAPTION} ${TEXT_SECONDARY}`;
const DL_VALUE = `${TYPE_BODY} ${TEXT_BODY} mt-0.5 break-words`;
const COL_TRUNCATED = `${TYPE_BODY} ${TEXT_SECONDARY} truncate max-w-[200px] block`;

const STATUS_LABELS: Record<string, string> = {
  planlandi: "Planlandı",
  tamamlandi: "Tamamlandı",
  iptal: "İptal",
  ertelendi: "Ertelendi",
};

/**
 * Augment the raw `AppointmentRow` with the resolved firma display
 * name. This is the row shape consumed by the DataTable.
 */
interface AppointmentListRow extends AppointmentRow {
  firma_name: string;
}

const FILTER_CONFIG: FilterConfig[] = [
  {
    key: "durum",
    label: "Durum",
    type: "select",
    placeholder: "Tüm durumlar",
    options: [
      { label: "Planlandı", value: "planlandi" },
      { label: "Tamamlandı", value: "tamamlandi" },
      { label: "İptal", value: "iptal" },
      { label: "Ertelendi", value: "ertelendi" },
    ],
  },
  {
    key: "tip",
    label: "Görüşme türü",
    type: "select",
    placeholder: "Tüm tipler",
    options: (Object.keys(APPOINTMENT_TYPE_LABELS) as AppointmentMeetingType[]).map((t) => ({
      label: APPOINTMENT_TYPE_LABELS[t],
      value: t,
    })),
  },
  // Note: the "firma" filter is appended at the component level so its
  // options come from the real companies table (RLS-scoped).
];

function buildFirmaFilter(companyNames: string[]): FilterConfig {
  return {
    key: "firma",
    label: "Firma",
    type: "select",
    placeholder: "Tüm firmalar",
    options: Array.from(new Set(companyNames)).map((name) => ({
      label: name,
      value: name,
    })),
  };
}

const COLUMNS: ColumnDef<AppointmentListRow>[] = [
  { key: "meeting_date", header: "Tarih", sortable: true, render: (val) => formatDateTR(val as string) },
  { key: "firma_name", header: "Firma", sortable: true },
  {
    key: "meeting_type",
    header: "Görüşme Tipi",
    render: (val) => <span>{APPOINTMENT_TYPE_LABELS[val as AppointmentMeetingType] ?? String(val)}</span>,
  },
  { key: "attendee", header: "Katılımcı", render: (val) => <span>{(val as string) || "—"}</span> },
  {
    key: "status",
    header: "Durum",
    sortable: true,
    render: (val) => <StatusBadge status={val as AppointmentListRow["status"]} />,
  },
  {
    key: "result",
    header: "Sonuç",
    render: (val) => (
      <span className={COL_TRUNCATED}>
        {(val as string) || "—"}
      </span>
    ),
  },
  {
    key: "next_action",
    header: "Takip işlemi",
    render: (val) => (
      <span className={COL_TRUNCATED}>
        {(val as string) || "—"}
      </span>
    ),
  },
];

const LIST_FILTER_DEFAULTS: FilterValues = { durum: "", firma: "", tip: "" };

export default function RandevularPage() {
  const { role } = useRole();
  const { loading: authLoading, user } = useAuth();
  const feedback = useActionNotice(JSON.stringify([user?.id, user?.app_metadata?.active_tenant, role]));
  const router = useRouter();

  const supabase = useMemo(() => createClient(), []);
  const [snapshot, setSnapshot] = useState<{scope: string; rows: AppointmentRow[]; names: Record<string,string>; legacy: Record<string,string>} | null>(null);
  const [readState, setReadState] = useState<{scope: string; loading: boolean; error: string | null} | null>(null);
  const generation = useRef(0);
  const [companySnapshot, setCompanySnapshot] = useState<{scope: string; rows: CompanyRow[]; status: "ready" | "error"} | null>(null);
  const [companyRetry, setCompanyRetry] = useState(0);
  const [profileRetry, setProfileRetry] = useState(0);
  const [profileSnapshot, setProfileSnapshot] = useState<{scope: string; rows: ProfileRow[]; status: "ready" | "error"} | null>(null);

  const searchControl = useRef<SearchInputHandle>(null);
  const listScope = !authLoading && user ? JSON.stringify([user.id, user.app_metadata?.active_tenant ?? null, role]) : null;
  const { search, filters, setSearch: handleSearch, setFilters, ready: viewReady } = useListViewState("randevular", listScope, LIST_FILTER_DEFAULTS);
  // A new identity token also distinguishes A → B → A while a write is pending.
  const context = useMemo(() => ({scope: listScope}), [listScope]);
  const liveContext = useRef<typeof context | null>(context);
  liveContext.current = context;
  const appointments = useMemo(() => snapshot?.scope === listScope ? snapshot?.rows ?? [] : [], [snapshot, listScope]);
  const companyNameById = useMemo(() => snapshot?.scope === listScope ? snapshot?.names ?? {} : {}, [snapshot, listScope]);
  const companyLegacyById = useMemo(() => snapshot?.scope === listScope ? snapshot?.legacy ?? {} : {}, [snapshot, listScope]);
  const loading = readState?.scope !== listScope || readState?.loading !== false;
  const loadError = readState?.scope === listScope ? readState?.error : null;
  const allCompanies = useMemo(() => companySnapshot?.scope === listScope ? companySnapshot?.rows ?? [] : [], [companySnapshot, listScope]);
  const allProfiles = useMemo(() => profileSnapshot?.scope === listScope ? profileSnapshot?.rows ?? [] : [], [profileSnapshot, listScope]);
  const companiesDurum = companySnapshot?.scope === listScope ? companySnapshot?.status ?? "loading" : "loading";
  const profilesDurum = profileSnapshot?.scope === listScope ? profileSnapshot?.status ?? "loading" : "loading";
  const [newOpen, setNewOpen] = useState(false);
  const [resultTarget, setResultTarget] = useState<{ open: boolean; randevuId?: string }>({ open: false });
  // Info (not error): set when a completion succeeds but the follow-up
  // task was skipped because the firma is pasif.
  const [completionNotice, setCompletionNotice] = useState<string | null>(null);
  const [taskTarget, setTaskTarget] = useState<{
    open: boolean;
    firmaId?: string;
    randevuId?: string;
  }>({ open: false });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const openLinkedAppointment = useCallback((id: string) => {
    if (liveContext.current === context) setSelectedId(id);
  }, [context]);


  // ------------------------------------------------------------------
  // Data loading
  // ------------------------------------------------------------------

  const reload = useCallback(async () => {
    if (!listScope || liveContext.current !== context) return;
    const request = ++generation.current;
    const isCurrent = () => request === generation.current && liveContext.current === context;
    setReadState({scope: listScope, loading: true, error: null});
    try {
      const rows = await listAllAppointments(supabase);
      if (!isCurrent()) return;
      const display = await getCompanyDisplayMapByIds(supabase, Array.from(new Set(rows.map(row => row.company_id))));
      if (!isCurrent()) return;
      setSnapshot({scope: listScope, rows, names: display.nameById, legacy: display.legacyById});
      setReadState({scope: listScope, loading: false, error: null});
    } catch (err) {
      if (!isCurrent()) return;
      setSnapshot(null);
      setReadState({scope: listScope, loading: false, error: err instanceof Error ? err.message : "Randevular yüklenirken bir hata oluştu."});
    }
  }, [supabase, listScope, context]);

  useEffect(() => {
    liveContext.current = context;
    setSnapshot(null); setSelectedId(null); setCompletionNotice(null);
    setResultTarget({open:false}); setNewOpen(false); setTaskTarget({open:false});
    void reload();
    return () => { generation.current++; liveContext.current = null; };
  }, [reload, context]);

  // Directories must belong to the same resolved user/tenant/role as the list.
  useEffect(() => {
    if (!listScope) return;
    let active = true;
    setCompanySnapshot(null);
    void selectAllCompanies(supabase).then(rows => {
      if (active) setCompanySnapshot({scope: listScope, rows, status: "ready"});
    }).catch(() => {
      if (active) setCompanySnapshot({scope: listScope, rows: [], status: "error"});
    });
    return () => { active = false; };
  }, [supabase, listScope, companyRetry]);

  useEffect(() => {
    if (!listScope) return;
    let active = true;
    setProfileSnapshot(null);
    void listActiveTenantProfiles(supabase).then(rows => {
      if (active) setProfileSnapshot({scope: listScope, rows, status: "ready"});
    }).catch(() => {
      if (active) setProfileSnapshot({scope: listScope, rows: [], status: "error"});
    });
    return () => { active = false; };
  }, [supabase, listScope, profileRetry]);

  // ------------------------------------------------------------------
  // Derived data
  // ------------------------------------------------------------------

  const enrichedRows: AppointmentListRow[] = useMemo(() => {
    return appointments.map((a) => ({
      ...a,
      firma_name: companyNameById[a.company_id] ?? "—",
    }));
  }, [appointments, companyNameById]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const appointment of appointments) {
      counts[appointment.status] = (counts[appointment.status] || 0) + 1;
    }
    return counts;
  }, [appointments]);

  const filteredData = useMemo(() => {
    return enrichedRows.filter((r) => {
      if (search) {
        const q = search.toLowerCase();
        const match =
          r.firma_name.toLowerCase().includes(q) ||
          (r.attendee?.toLowerCase().includes(q) ?? false) ||
          (r.result?.toLowerCase().includes(q) ?? false);
        if (!match) return false;
      }
      if (filters.durum && r.status !== filters.durum) return false;
      if (filters.firma && r.firma_name !== filters.firma) return false;
      if (filters.tip && r.meeting_type !== filters.tip) return false;
      return true;
    });
  }, [enrichedRows, search, filters]);

  const selectedRandevu = useMemo(
    () => enrichedRows.find((r) => r.id === selectedId) ?? null,
    [enrichedRows, selectedId]
  );

  const kullaniciOptions = useMemo(
    () => allProfiles.filter((p) => ["yonetici", "operasyon", "ik"].includes(p.role)).map((p) => ({ id: p.id, ad: p.display_name })),
    [allProfiles],
  );

  const firmaOptions = useMemo(
    () =>
      allCompanies.map((c) => ({
        id: c.legacy_mock_id ?? c.id,
        ad: c.name,
      })),
    [allCompanies],
  );

  const filterConfig = useMemo<FilterConfig[]>(
    () => [
      ...FILTER_CONFIG,
      buildFirmaFilter(allCompanies.map((c) => c.name)),
    ],
    [allCompanies],
  );

  const rowActions: RowAction<AppointmentListRow>[] = [
    {
      label: "Tamamla",
      onClick: (row) => setResultTarget({ open: true, randevuId: row.id }),
      isDisabled: (row) => row.status === "tamamlandi" || row.status === "iptal",
    },
    {
      label: "Görev oluştur",
      onClick: (row) => {
        // Find the legacy mock id for this company so NewTaskModal can
        // work with the still-mock firmalar dictionary.
        const legacyId = companyLegacyById[row.company_id] ?? row.company_id;
        setTaskTarget({ open: true, firmaId: legacyId, randevuId: row.id });
      },
    },
  ];

  // ------------------------------------------------------------------
  // Role gate
  // ------------------------------------------------------------------

  // Auth not resolved yet — don't flash "Erişim kısıtlı" (role defaults to
  // "goruntuleyici" while AuthContext is loading). Wait, then decide.
  if (authLoading || !viewReady) {
    return (
      <>
        <PageHeader title="Randevular" subtitle="Görüşme takibi" />
        <EmptyState title="Yükleniyor…" description="Yetki bilgisi kontrol ediliyor." size="page" />
      </>
    );
  }

  if (["goruntuleyici", "ik", "muhasebe"].includes(role)) {
    return (
      <>
        <PageHeader title="Randevular" subtitle="Görüşme takibi" />
        <EmptyState title="Erişim kısıtlı" description="Bu ekrana erişim yetkiniz yok." size="page" />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Randevular"
        subtitle="Görüşme sonuçlarını ve takip işlerini yönetin."
        actions={[
          {
            label: "Yeni Randevu",
            onClick: () => { feedback.clear(); setNewOpen(true); },
            icon: <Plus size={16} />,
          },
        ]}
      />

      <Suspense fallback={null}>
        <AppointmentLinkOpener key={listScope} ready={!!listScope && !loading && !loadError && snapshot?.scope === listScope}
          appointmentIds={appointments.map(row => row.id)} onOpen={openLinkedAppointment} />
      </Suspense>
      <ActionNotice message={feedback.message} onDismiss={feedback.clear} />

      <div className="space-y-4">
        {loadError && (
          <AsyncSection isLoading={false} hasError onRetry={() => { void reload(); }}>
            {null}
          </AsyncSection>
        )}

        <PickerFeedback id="appointment-company-directory" status={companiesDurum} count={allCompanies.length} name="Firma listesi"
          emptyText="Firma filtresinde gösterilecek firma yok." onRetry={() => setCompanyRetry(value => value + 1)} />
        {completionNotice && (
          <p className={`${TYPE_CAPTION} text-amber-600`} role="status" aria-live="polite">
            {completionNotice}
          </p>
        )}

        <div className="flex items-center gap-2 flex-wrap">
          {Object.entries(statusCounts).map(([status, count]) => (
            <button
              key={status}
              type="button"
              aria-pressed={filters.durum === status}
              onClick={() =>
                setFilters((prev) => ({
                  ...prev,
                  durum: prev.durum === status ? "" : status,
                }))
              }
              className={clsx(
                CHIP_BASE,
                filters.durum === status ? CHIP_ACTIVE : CHIP_INACTIVE
              )}
            >
              {STATUS_LABELS[status] ?? status} ({count})
            </button>
          ))}
        </div>

        <ListToolbar label="Randevularda ara" search={<SearchInput ref={searchControl} key={listScope} value={search} maxLength={512} placeholder="Firma, katılımcı ara…" onChange={handleSearch} />}>
          <FilterBar filters={filterConfig} values={filters} onChange={setFilters} />
          <div className="mt-3 flex justify-end"><button type="button" disabled={loading} onClick={() => { void reload(); }}
            className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40">
            <RefreshCw size={16} aria-hidden="true" className={loading ? "animate-spin" : undefined} />
            Listeyi yenile
          </button></div>
        </ListToolbar>

        {loading ? (
          <p role="status" className={`${TYPE_BODY} ${TEXT_MUTED} text-center py-8`}>Randevular yükleniyor…</p>
        ) : !loadError ? (
          <DataTable<AppointmentListRow>
            columns={COLUMNS}
            data={filteredData}
            rowKey="id"
            onRowClick={(row) => setSelectedId(row.id)}
            rowActions={rowActions}
            emptyAction={(appointments.length > 0 && (search !== "" || Object.values(filters).some(Boolean))) ? {
              label: "Arama ve filtreleri temizle",
              onClick: () => { searchControl.current?.clear(); setFilters(LIST_FILTER_DEFAULTS); },
            } : undefined}
            emptyTitle={appointments.length === 0 ? "Henüz randevu yok" : "Bu filtrelerle eşleşen randevu yok"}
            emptyDescription={appointments.length === 0 ? "Yeni Randevu ile ilk görüşmenizi planlayabilirsiniz.":"Aramayı veya filtreleri değiştirerek yeniden deneyin."}
          />
        ) : null}
      </div>

      <RightSidePanel
        open={!!selectedRandevu}
        onClose={() => setSelectedId(null)}
        title="Randevu detayı"
      >
        {selectedRandevu && (
          <dl className="space-y-3">
            <div>
              <dt className={DL_LABEL}>Firma</dt>
              <dd className={`${TYPE_BODY} mt-0.5`}>
                <Link href={`/firmalar/${selectedRandevu.company_id}`}
                  className={`${TEXT_LINK} inline-block min-h-11 max-w-full break-words py-2 underline underline-offset-4`}>
                  {selectedRandevu.firma_name === "—" ? "Firma kaydını aç" : selectedRandevu.firma_name}
                </Link>
              </dd>
            </div>
            <div>
              <dt className={DL_LABEL}>Tarih / Saat</dt>
              <dd className={DL_VALUE}>
                {formatDateTR(selectedRandevu.meeting_date)} {selectedRandevu.meeting_time ?? ""}
              </dd>
            </div>
            <div>
              <dt className={DL_LABEL}>Görüşme Tipi</dt>
              <dd className={DL_VALUE}>{APPOINTMENT_TYPE_LABELS[selectedRandevu.meeting_type]}</dd>
            </div>
            <div>
              <dt className={DL_LABEL}>Katılımcı</dt>
              <dd className={DL_VALUE}>{selectedRandevu.attendee || "—"}</dd>
            </div>
            <div>
              <dt className={DL_LABEL}>Durum</dt>
              <dd className="mt-1"><StatusBadge status={selectedRandevu.status} /></dd>
            </div>
            {selectedRandevu.result && (
              <div className={`pt-2 border-t ${BORDER_SUBTLE}`}>
                <dt className={DL_LABEL}>Sonuç</dt>
                <dd className={DL_VALUE}>{selectedRandevu.result}</dd>
              </div>
            )}
            {selectedRandevu.next_action && (
              <div>
                <dt className={DL_LABEL}>Sonraki Aksiyon</dt>
                <dd className={DL_VALUE}>{selectedRandevu.next_action}</dd>
              </div>
            )}
            <div className={`pt-2 border-t ${BORDER_SUBTLE}`}>
              <dt className={DL_LABEL}>Bu randevuya bağlı görevler</dt>
              <dd className="mt-1">
                <AppointmentTasks key={`${listScope}:${selectedRandevu.id}`} client={supabase} appointmentId={selectedRandevu.id} />
              </dd>
            </div>
          </dl>
        )}
      </RightSidePanel>

      {newOpen && <NewAppointmentModal
        key={`${user?.id}:${user?.app_metadata?.active_tenant}:${role}`}
        open={newOpen}
        onClose={() => { if (liveContext.current === context) setNewOpen(false); }}
        firmalar={firmaOptions}
        firmalarDurum={companiesDurum}
        onRetryFirmalar={() => setCompanyRetry(value => value + 1)}
        onSubmit={async ({ firmaId, tarih, saat, gorusmeTipi, katilimci }) => {
          const result = await createAppointmentAction({
            legacyCompanyId: firmaId,
            meetingDate: tarih,
            meetingTime: saat || undefined,
            meetingType: gorusmeTipi,
            attendee: katilimci || undefined,
          });
          if (liveContext.current !== context) return;
          if (!result.ok) throw new Error(result.error);
          feedback.show("Randevu oluşturuldu. Durumu: planlandı.");
          setNewOpen(false);
          void reload();
          router.refresh();
        }}
      />}
      <AppointmentResultModal
        key={`${listScope}:${resultTarget.randevuId ?? "none"}`}
        open={resultTarget.open}
        onClose={() => { if (liveContext.current === context) setResultTarget({ open: false }); }}
        randevuId={resultTarget.randevuId}
        actorId={user?.id??""}
        onComplete={async ({ randevuId, sonuc, sonrakiAksiyon, actorId }) => {
          if (!randevuId) return;
          // The action completes the appointment (allowed on a pasif firma)
          // and guards the follow-up task side-effect. On success it may
          // report that the task was skipped because the firma is pasif —
          // surfaced to the user, never silent.
          const result = await completeAppointmentAction(randevuId, {
            result: sonuc,
            nextAction: sonrakiAksiyon,
            createTask: true,
          }, actorId);
          if (liveContext.current !== context) return;
          if (!result.ok) throw new Error(result.error);
          feedback.show(result.taskCreated ? "Randevu tamamlandı ve takip görevi oluşturuldu." : "Randevu tamamlandı.");
          await reload();
          if (liveContext.current !== context) return;
          router.refresh();
          setCompletionNotice(
            result.taskSkippedReason
              ? `Randevu tamamlandı. Takip görevi oluşturulmadı: ${result.taskSkippedReason}`
              : null,
          );
        }}
      />
      <NewTaskModal
        key={`${listScope}:${taskTarget.randevuId ?? "none"}`}
        open={taskTarget.open}
        onClose={() => { if (liveContext.current === context) setTaskTarget({ open: false }); }}
        firmalar={firmaOptions}
        firmalarDurum={companiesDurum}
        onRetryFirmalar={() => setCompanyRetry(value => value + 1)}
        kullanicilar={kullaniciOptions}
        kullanicilarDurum={profilesDurum}
        onRetryKullanicilar={() => setProfileRetry(value => value + 1)}
        defaultKaynak="randevu"
        defaultFirmaId={taskTarget.firmaId}
        defaultKaynakRef={taskTarget.randevuId}
        onSubmit={async ({ baslik, firmaId, kaynak, kaynakRef, atananKisiId, termin, oncelik }) => {
          const result = await createTaskAction({
            legacyCompanyId: firmaId,
            title: baslik,
            // id only — the service resolves the display name server-side.
            assignedToUserId: atananKisiId,
            dueDate: termin || undefined,
            sourceType: kaynak,
            sourceRef: kaynakRef,
            appointmentId: kaynakRef,
            priority: oncelik,
          });
          if (liveContext.current !== context) return;
          if (!result.ok) throw new Error(result.error);
          feedback.show(`${baslik} görevlere eklendi.`);
          await reload();
          if (liveContext.current !== context) return;
          router.refresh();
        }}
      />
    </>
  );
}
