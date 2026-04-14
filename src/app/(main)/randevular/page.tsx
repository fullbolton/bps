"use client";

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

import { useState, useMemo, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { formatDateTR } from "@/lib/format-date";
import { Plus } from "lucide-react";
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
import {
  NewAppointmentModal,
  AppointmentResultModal,
  NewTaskModal,
} from "@/components/modals";
import { createClient } from "@/lib/supabase/client";
import {
  listAllAppointments,
  createAppointment,
  completeAppointment,
} from "@/lib/services/appointments";
import { createTask } from "@/lib/services/tasks";
import { getCompanyDisplayMapByIds } from "@/lib/services/companies";
import { APPOINTMENT_TYPE_LABELS } from "@/lib/appointment-types";
import type { AppointmentMeetingType } from "@/lib/appointment-types";
import type { AppointmentRow } from "@/types/database.types";
import { selectAllCompanies } from "@/lib/supabase/companies";
import type { CompanyRow } from "@/types/database.types";
import type {
  ColumnDef,
  FilterConfig,
  FilterValues,
  RowAction,
  OncelikSeviyesi,
} from "@/types/ui";
import { selectTasksByAppointmentId } from "@/lib/supabase/tasks";
import type { TaskRow } from "@/types/database.types";
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
const CHIP_BASE = `px-3 py-1 ${TYPE_LABEL} ${RADIUS_FULL} border transition-colors`;
const CHIP_ACTIVE = `bg-slate-900 ${TEXT_INVERSE} border-slate-900`;
const CHIP_INACTIVE = "bg-white text-slate-600 border-slate-200 hover:bg-slate-50";
const DL_LABEL = `${TYPE_CAPTION} ${TEXT_SECONDARY}`;
const DL_VALUE = `${TYPE_BODY} ${TEXT_BODY} mt-0.5`;
const COL_TRUNCATED = `${TYPE_BODY} ${TEXT_SECONDARY} truncate max-w-[200px] block`;

const STATUS_LABELS: Record<string, string> = {
  planlandi: "Planlandi",
  tamamlandi: "Tamamlandi",
  iptal: "Iptal",
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
    placeholder: "Tum durumlar",
    options: [
      { label: "Planlandi", value: "planlandi" },
      { label: "Tamamlandi", value: "tamamlandi" },
      { label: "Iptal", value: "iptal" },
      { label: "Ertelendi", value: "ertelendi" },
    ],
  },
  {
    key: "tip",
    label: "Tip",
    type: "select",
    placeholder: "Tum tipler",
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
    placeholder: "Tum firmalar",
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
    header: "Gorusme Tipi",
    render: (val) => <span>{APPOINTMENT_TYPE_LABELS[val as AppointmentMeetingType] ?? String(val)}</span>,
  },
  { key: "attendee", header: "Katilimci", render: (val) => <span>{(val as string) || "—"}</span> },
  {
    key: "status",
    header: "Durum",
    sortable: true,
    render: (val) => <StatusBadge status={val as AppointmentListRow["status"]} />,
  },
  {
    key: "result",
    header: "Sonuc",
    render: (val) => (
      <span className={COL_TRUNCATED}>
        {(val as string) || "—"}
      </span>
    ),
  },
  {
    key: "next_action",
    header: "Sonraki Aksiyon",
    render: (val) => (
      <span className={COL_TRUNCATED}>
        {(val as string) || "—"}
      </span>
    ),
  },
];

export default function RandevularPage() {
  const { role } = useRole();
  const router = useRouter();

  const supabase = useMemo(() => createClient(), []);
  const [appointments, setAppointments] = useState<AppointmentRow[]>([]);
  const [companyNameById, setCompanyNameById] = useState<Record<string, string>>({});
  const [companyLegacyById, setCompanyLegacyById] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  // Real companies for the firma filter + New Appointment modal.
  const [allCompanies, setAllCompanies] = useState<CompanyRow[]>([]);

  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<FilterValues>({
    durum: "",
    firma: "",
    tip: "",
  });
  const [newOpen, setNewOpen] = useState(false);
  const [resultTarget, setResultTarget] = useState<{ open: boolean; randevuId?: string }>({ open: false });
  const [taskTarget, setTaskTarget] = useState<{
    open: boolean;
    firmaId?: string;
    randevuId?: string;
  }>({ open: false });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedTasks, setSelectedTasks] = useState<TaskRow[]>([]);

  const handleSearch = useCallback((val: string) => setSearch(val), []);

  // ------------------------------------------------------------------
  // Data loading
  // ------------------------------------------------------------------

  const reload = useCallback(async () => {
    setLoadError(null);
    try {
      const rows = await listAllAppointments(supabase);
      setAppointments(rows);
      const uniqueCompanyIds = Array.from(new Set(rows.map((r) => r.company_id)));
      const display = await getCompanyDisplayMapByIds(supabase, uniqueCompanyIds);
      setCompanyNameById(display.nameById);
      setCompanyLegacyById(display.legacyById);
    } catch (err) {
      setAppointments([]);
      setCompanyNameById({});
      setCompanyLegacyById({});
      setLoadError(
        err instanceof Error ? err.message : "Randevular yuklenirken bir hata olustu.",
      );
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    setLoading(true);
    void reload();
  }, [reload]);

  // Companies for the firma filter + New Appointment modal.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const rows = await selectAllCompanies(supabase);
        if (active) setAllCompanies(rows);
      } catch {
        if (active) setAllCompanies([]);
      }
    })();
    return () => { active = false; };
  }, [supabase]);

  // ------------------------------------------------------------------
  // Load tasks linked to the selected appointment (for the side panel)
  // ------------------------------------------------------------------

  useEffect(() => {
    if (!selectedId) {
      setSelectedTasks([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const tasks = await selectTasksByAppointmentId(supabase, selectedId);
        if (!cancelled) setSelectedTasks(tasks);
      } catch {
        if (!cancelled) setSelectedTasks([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, selectedId]);

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
      label: "Gorev Olustur",
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

  if (["goruntuleyici", "ik", "muhasebe"].includes(role)) {
    return (
      <>
        <PageHeader title="Randevular" subtitle="Gorusme takibi" />
        <EmptyState title="Erisim kisitli" description="Bu ekran erisiminizin disindadir." size="page" />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Randevular"
        subtitle="Gorusme sonuclari ve takip aksiyonlari"
        actions={[
          {
            label: "Yeni Randevu",
            onClick: () => setNewOpen(true),
            icon: <Plus size={16} />,
          },
        ]}
      />

      <div className="space-y-4">
        {loadError && (
          <p className={`${TYPE_CAPTION} text-red-600`} role="alert" aria-live="polite">
            {loadError}
          </p>
        )}

        <div className="flex items-center gap-2 flex-wrap">
          {Object.entries(statusCounts).map(([status, count]) => (
            <button
              key={status}
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

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="w-full sm:max-w-xs">
            <SearchInput placeholder="Firma, katilimci ara..." onChange={handleSearch} />
          </div>
          <FilterBar filters={filterConfig} values={filters} onChange={setFilters} />
        </div>

        {loading ? (
          <p className={`${TYPE_BODY} ${TEXT_MUTED} text-center py-8`}>Yukleniyor...</p>
        ) : (
          <DataTable<AppointmentListRow>
            columns={COLUMNS}
            data={filteredData}
            rowKey="id"
            onRowClick={(row) => setSelectedId(row.id)}
            rowActions={rowActions}
            emptyTitle="Randevu bulunamadi"
            emptyDescription="Arama veya filtre kriterlerinizi degistirin."
          />
        )}
      </div>

      <RightSidePanel
        open={!!selectedRandevu}
        onClose={() => setSelectedId(null)}
        title="Randevu Detay"
      >
        {selectedRandevu && (
          <dl className="space-y-3">
            <div>
              <dt className={DL_LABEL}>Firma</dt>
              <dd className={`${TYPE_BODY} mt-0.5`}>
                {companyLegacyById[selectedRandevu.company_id] ? (
                  <a
                    href={`/firmalar/${companyLegacyById[selectedRandevu.company_id]}`}
                    className={`${TEXT_LINK} hover:underline`}
                  >
                    {selectedRandevu.firma_name}
                  </a>
                ) : (
                  <span className={TEXT_BODY}>{selectedRandevu.firma_name}</span>
                )}
              </dd>
            </div>
            <div>
              <dt className={DL_LABEL}>Tarih / Saat</dt>
              <dd className={DL_VALUE}>
                {formatDateTR(selectedRandevu.meeting_date)} {selectedRandevu.meeting_time ?? ""}
              </dd>
            </div>
            <div>
              <dt className={DL_LABEL}>Gorusme Tipi</dt>
              <dd className={DL_VALUE}>{APPOINTMENT_TYPE_LABELS[selectedRandevu.meeting_type]}</dd>
            </div>
            <div>
              <dt className={DL_LABEL}>Katilimci</dt>
              <dd className={DL_VALUE}>{selectedRandevu.attendee || "—"}</dd>
            </div>
            <div>
              <dt className={DL_LABEL}>Durum</dt>
              <dd className="mt-1"><StatusBadge status={selectedRandevu.status} /></dd>
            </div>
            {selectedRandevu.result && (
              <div className={`pt-2 border-t ${BORDER_SUBTLE}`}>
                <dt className={DL_LABEL}>Sonuc</dt>
                <dd className={DL_VALUE}>{selectedRandevu.result}</dd>
              </div>
            )}
            {selectedRandevu.next_action && (
              <div>
                <dt className={DL_LABEL}>Sonraki Aksiyon</dt>
                <dd className={DL_VALUE}>{selectedRandevu.next_action}</dd>
              </div>
            )}
            {selectedTasks.length > 0 && (
              <div className={`pt-2 border-t ${BORDER_SUBTLE}`}>
                <dt className={DL_LABEL}>Bu Randevudan Acilan Gorevler</dt>
                <dd className="mt-1 space-y-1.5">
                  {selectedTasks.map((task) => (
                    <p key={task.id} className={`${TYPE_BODY} ${TEXT_BODY}`}>
                      {task.title}
                    </p>
                  ))}
                </dd>
              </div>
            )}
          </dl>
        )}
      </RightSidePanel>

      <NewAppointmentModal
        open={newOpen}
        onClose={() => setNewOpen(false)}
        firmalar={firmaOptions}
        onSubmit={async ({ firmaId, tarih, saat, gorusmeTipi, katilimci }) => {
          await createAppointment(supabase, {
            legacyCompanyId: firmaId,
            meetingDate: tarih,
            meetingTime: saat || undefined,
            meetingType: gorusmeTipi,
            attendee: katilimci || undefined,
          });
          await reload();
          router.refresh();
        }}
      />
      <AppointmentResultModal
        open={resultTarget.open}
        onClose={() => setResultTarget({ open: false })}
        randevuId={resultTarget.randevuId}
        onComplete={async ({ randevuId, sonuc, sonrakiAksiyon }) => {
          if (!randevuId) return;
          await completeAppointment(supabase, randevuId, {
            result: sonuc,
            nextAction: sonrakiAksiyon,
            createTask: true,
          });
          await reload();
          router.refresh();
        }}
      />
      <NewTaskModal
        open={taskTarget.open}
        onClose={() => setTaskTarget({ open: false })}
        firmalar={firmaOptions}
        defaultKaynak="randevu"
        defaultFirmaId={taskTarget.firmaId}
        defaultKaynakRef={taskTarget.randevuId}
        onSubmit={async ({ baslik, firmaId, kaynak, kaynakRef, atananKisi, termin, oncelik }) => {
          await createTask(supabase, {
            legacyCompanyId: firmaId,
            title: baslik,
            assignedTo: atananKisi || undefined,
            dueDate: termin || undefined,
            sourceType: kaynak,
            sourceRef: kaynakRef,
            appointmentId: kaynakRef,
            priority: oncelik,
          });
          await reload();
          router.refresh();
        }}
      />
    </>
  );
}
