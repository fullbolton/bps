"use client";

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
  KPIStatCard,
  PriorityBadge,
  TaskSourceBadge,
  RightSidePanel,
  EmptyState,
} from "@/components/ui";
import { useRole } from "@/context/RoleContext";
import { NewTaskModal } from "@/components/modals";
// Faz 3: Görevler list cutover. Tasks now come from the tasks service
// layer; MOCK_FIRMALAR is reused only as a UI dictionary so the firma
// filter dropdown and the New Task modal can offer firma names without
// touching the full Firmalar migration.
import { MOCK_FIRMALAR } from "@/mocks/firmalar";
import { createClient } from "@/lib/supabase/client";
import {
  listAllTasks,
  createTask,
  updateTask,
  type TaskCreateInput,
} from "@/lib/services/tasks";
import { getCompanyDisplayMapByIds } from "@/lib/services/companies";
import { TASK_SOURCE_LABELS } from "@/lib/task-sources";
import type { TaskSourceType } from "@/lib/task-sources";
import type { TaskRow } from "@/types/database.types";
import type { ColumnDef, FilterConfig, FilterValues, RowAction } from "@/types/ui";
import type { GorevDurumu, OncelikSeviyesi } from "@/types/ui";
import { clsx } from "clsx";
import {
  TYPE_BODY,
  TYPE_CAPTION,
  TYPE_CARD_TITLE,
  TYPE_LABEL,
  TEXT_PRIMARY,
  TEXT_BODY,
  TEXT_SECONDARY,
  TEXT_MUTED,
  TEXT_INVERSE,
  TEXT_LINK,
  BORDER_SUBTLE,
  RADIUS_FULL,
  RADIUS_SM,
  INPUT_BASE,
  BUTTON_PRIMARY,
} from "@/styles/tokens";

// Page-local helpers
const CHIP_BASE = `px-3 py-1 ${TYPE_LABEL} ${RADIUS_FULL} border transition-colors`;
const CHIP_ACTIVE = `bg-slate-900 ${TEXT_INVERSE} border-slate-900`;
const CHIP_INACTIVE = "bg-white text-slate-600 border-slate-200 hover:bg-slate-50";
const DL_LABEL = `${TYPE_CAPTION} ${TEXT_SECONDARY}`;
const DL_VALUE = `${TYPE_BODY} ${TEXT_BODY} mt-0.5`;
const FORM_LABEL = `block ${TYPE_BODY} font-medium ${TEXT_BODY} mb-1`;

const STATUS_LABELS: Record<string, string> = {
  acik: "Açık",
  devam_ediyor: "Devam Ediyor",
  tamamlandi: "Tamamlandı",
  gecikti: "Gecikti",
  iptal: "İptal",
};

/**
 * Augment the raw `TaskRow` with the firma display name resolved from
 * companies. firma_name is resolved via `getCompanyDisplayMapByIds`
 * after loading tasks from the service layer.
 */
interface TaskListRow extends TaskRow {
  firma_name: string;
  firma_legacy_id: string | null;
}

const FILTER_CONFIG: FilterConfig[] = [
  {
    key: "durum",
    label: "Durum",
    type: "select",
    placeholder: "Tüm durumlar",
    options: [
      { label: "Açık", value: "acik" },
      { label: "Devam Ediyor", value: "devam_ediyor" },
      { label: "Tamamlandı", value: "tamamlandi" },
      { label: "Gecikti", value: "gecikti" },
      { label: "İptal", value: "iptal" },
    ],
  },
  {
    key: "oncelik",
    label: "Öncelik",
    type: "select",
    placeholder: "Tüm öncelikler",
    options: [
      { label: "Düşük", value: "dusuk" },
      { label: "Normal", value: "normal" },
      { label: "Yüksek", value: "yuksek" },
      { label: "Kritik", value: "kritik" },
    ],
  },
  {
    key: "kaynak",
    label: "Kaynak",
    type: "select",
    placeholder: "Tüm kaynaklar",
    options: [
      { label: "Manuel", value: "manuel" },
      { label: "Randevu", value: "randevu" },
      { label: "Sözleşme", value: "sozlesme" },
    ],
  },
  {
    key: "firma",
    label: "Firma",
    type: "select",
    placeholder: "Tüm firmalar",
    options: Array.from(new Set(MOCK_FIRMALAR.map((f) => f.firmaAdi))).map(
      (name) => ({ label: name, value: name })
    ),
  },
];

/**
 * Columns match PRODUCT_STRUCTURE > Görevler > Liste kolonları:
 * görev başlığı, bağlı firma, kaynak, atanan kişi, termin, öncelik, durum
 */
const COLUMNS: ColumnDef<TaskListRow>[] = [
  { key: "title", header: "Görev Başlığı", sortable: true },
  { key: "firma_name", header: "Bağlı Firma", sortable: true },
  {
    key: "source_type",
    header: "Kaynak",
    render: (val) => <TaskSourceBadge source={val as TaskSourceType} />,
  },
  {
    key: "assigned_to",
    header: "Atanan Kişi",
    render: (val) => <span>{(val as string | null) ?? "Atanmadı"}</span>,
  },
  {
    key: "due_date",
    header: "Termin",
    sortable: true,
    render: (val, row) => {
      const isLate = row.status === "gecikti";
      return (
        <span className={clsx(TYPE_BODY, isLate ? "text-red-600 font-medium" : TEXT_BODY)}>
          {(val as string | null) ? formatDateTR((val as string).slice(0, 10)) : "—"}
        </span>
      );
    },
  },
  {
    key: "priority",
    header: "Öncelik",
    sortable: true,
    render: (val) => <PriorityBadge priority={val as OncelikSeviyesi} />,
  },
  {
    key: "status",
    header: "Durum",
    sortable: true,
    render: (val) => <StatusBadge status={val as GorevDurumu} />,
  },
];

export default function GorevlerPage() {
  const { role } = useRole();
  const router = useRouter();

  const supabase = useMemo(() => createClient(), []);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [companyNameById, setCompanyNameById] = useState<Record<string, string>>({});
  const [companyLegacyById, setCompanyLegacyById] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<FilterValues>({
    durum: "",
    oncelik: "",
    kaynak: "",
    firma: "",
  });
  const [newOpen, setNewOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editDurum, setEditDurum] = useState<GorevDurumu>("acik");
  const [editAtananKisi, setEditAtananKisi] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSearch = useCallback((val: string) => setSearch(val), []);

  // ------------------------------------------------------------------
  // Data loader — mirrors the Faz 2 Sözleşmeler pattern
  // ------------------------------------------------------------------
  const reload = useCallback(async () => {
    setLoadError(null);
    try {
      const rows = await listAllTasks(supabase);
      setTasks(rows);
      // Resolve firma display names + legacy ids in a single batched
      // round trip — getCompanyDisplayMapByIds deduplicates internally.
      const uniqueCompanyIds = Array.from(new Set(rows.map((r) => r.company_id)));
      const display = await getCompanyDisplayMapByIds(supabase, uniqueCompanyIds);
      setCompanyNameById(display.nameById);
      setCompanyLegacyById(display.legacyById);
    } catch (err) {
      setTasks([]);
      setCompanyNameById({});
      setCompanyLegacyById({});
      setLoadError(
        err instanceof Error ? err.message : "Görevler yüklenirken bir hata oluştu.",
      );
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    setLoading(true);
    void reload();
  }, [reload]);

  // ------------------------------------------------------------------
  // Enriched rows — add firma_name for display + filtering
  // ------------------------------------------------------------------
  const enrichedRows: TaskListRow[] = useMemo(() => {
    return tasks.map((t) => ({
      ...t,
      firma_name: companyNameById[t.company_id] ?? "—",
      firma_legacy_id: companyLegacyById[t.company_id] ?? null,
    }));
  }, [tasks, companyNameById, companyLegacyById]);

  // ------------------------------------------------------------------
  // Status counts — computed from loaded tasks
  // ------------------------------------------------------------------
  const statusCounts = useMemo(() => {
    const counts: Record<GorevDurumu, number> = {
      acik: 0,
      devam_ediyor: 0,
      tamamlandi: 0,
      gecikti: 0,
      iptal: 0,
    };
    for (const t of tasks) {
      if (t.status in counts) {
        counts[t.status as GorevDurumu]++;
      }
    }
    return counts;
  }, [tasks]);

  // ------------------------------------------------------------------
  // Client-side filter + search
  // ------------------------------------------------------------------
  const filteredData = useMemo(() => {
    return enrichedRows.filter((g) => {
      if (search) {
        const q = search.toLowerCase();
        const match =
          g.title.toLowerCase().includes(q) ||
          g.firma_name.toLowerCase().includes(q) ||
          (g.assigned_to ?? "").toLowerCase().includes(q);
        if (!match) return false;
      }
      if (filters.durum && g.status !== filters.durum) return false;
      if (filters.oncelik && g.priority !== filters.oncelik) return false;
      if (filters.kaynak && g.source_type !== filters.kaynak) return false;
      if (filters.firma && g.firma_name !== filters.firma) return false;
      return true;
    });
  }, [enrichedRows, search, filters]);

  const selectedTask = useMemo(
    () => enrichedRows.find((task) => task.id === selectedId) ?? null,
    [enrichedRows, selectedId]
  );

  useEffect(() => {
    if (!selectedTask) return;
    setEditDurum(selectedTask.status);
    setEditAtananKisi(selectedTask.assigned_to ?? "");
  }, [selectedTask]);

  const firmaOptions = MOCK_FIRMALAR.map((f) => ({ id: f.id, ad: f.firmaAdi }));

  const rowActions: RowAction<TaskListRow>[] = [
    {
      label: "Hızlı Güncelle",
      onClick: (row) => setSelectedId(row.id),
    },
  ];

  // ------------------------------------------------------------------
  // Role gate — goruntuleyici / muhasebe have no access
  // ------------------------------------------------------------------
  if (["goruntuleyici", "muhasebe"].includes(role)) {
    return (
      <>
        <PageHeader title="Görevler" subtitle="Operasyon takibi" />
        <EmptyState title="Erişim kısıtlı" description="Bu ekran görüntüleyici erişiminin dışındadır." size="page" />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Görevler"
        subtitle="Görev takibi ve koordinasyon"
        actions={[
          {
            label: "Yeni Görev",
            onClick: () => setNewOpen(true),
            icon: <Plus size={16} />,
          },
        ]}
      />

      <div className="space-y-4">
        {/* Loading state */}
        {loading && (
          <div className={`text-center py-8 ${TYPE_BODY} ${TEXT_MUTED}`}>Yükleniyor...</div>
        )}

        {/* Error state */}
        {loadError && (
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {loadError}
          </div>
        )}

        {/* Main content */}
        {!loading && !loadError && (
          <>
            {/* Summary KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <KPIStatCard label="Açık" value={statusCounts.acik} />
              <KPIStatCard label="Devam Ediyor" value={statusCounts.devam_ediyor} />
              <KPIStatCard label="Gecikmiş" value={statusCounts.gecikti} />
              <KPIStatCard label="Tamamlanan" value={statusCounts.tamamlandi} />
            </div>

            {/* Status chips */}
            <div className="flex items-center gap-2 flex-wrap">
              {Object.entries(statusCounts)
                .filter(([, count]) => count > 0)
                .map(([status, count]) => (
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
                <SearchInput placeholder="Görev, firma, kişi ara..." onChange={handleSearch} />
              </div>
              <FilterBar filters={FILTER_CONFIG} values={filters} onChange={setFilters} />
            </div>

            <DataTable<TaskListRow>
              columns={COLUMNS}
              data={filteredData}
              rowKey="id"
              onRowClick={(row) => setSelectedId(row.id)}
              rowActions={rowActions}
              emptyTitle="Görev bulunamadı"
              emptyDescription="Arama veya filtre kriterlerinizi değiştirin."
            />
          </>
        )}
      </div>

      <RightSidePanel
        open={!!selectedTask}
        onClose={() => setSelectedId(null)}
        title="Görev Hızlı Güncelle"
      >
        {selectedTask && (
          <div className="space-y-4">
            <div>
              <h3 className={`${TYPE_CARD_TITLE} ${TEXT_PRIMARY}`}>{selectedTask.title}</h3>
              <div className="mt-2 flex items-center gap-2 flex-wrap">
                <TaskSourceBadge source={selectedTask.source_type} />
                <PriorityBadge priority={selectedTask.priority} />
                <StatusBadge status={selectedTask.status} />
              </div>
            </div>

            <dl className="space-y-3">
              <div>
                <dt className={DL_LABEL}>Bağlı Firma</dt>
                <dd className={`${TYPE_BODY} mt-0.5`}>
                  {selectedTask.firma_legacy_id ? (
                    <a
                      href={`/firmalar/${selectedTask.firma_legacy_id}`}
                      className={`${TEXT_LINK} hover:underline`}
                    >
                      {selectedTask.firma_name}
                    </a>
                  ) : (
                    <span className={TEXT_BODY}>{selectedTask.firma_name}</span>
                  )}
                </dd>
              </div>
              <div>
                <dt className={DL_LABEL}>Termin</dt>
                <dd className={DL_VALUE}>
                  {selectedTask.due_date
                    ? formatDateTR(selectedTask.due_date.slice(0, 10))
                    : "—"}
                </dd>
              </div>
            </dl>

            <div className={`space-y-4 border-t ${BORDER_SUBTLE} pt-4`}>
              <div>
                <label className={FORM_LABEL}>
                  Durum
                </label>
                <select
                  value={editDurum}
                  onChange={(e) => setEditDurum(e.target.value as GorevDurumu)}
                  className={INPUT_BASE}
                >
                  <option value="acik">Açık</option>
                  <option value="devam_ediyor">Devam Ediyor</option>
                  <option value="tamamlandi">Tamamlandı</option>
                  <option value="gecikti">Gecikti</option>
                  <option value="iptal">İptal</option>
                </select>
              </div>
              {/* Atanan Kişi — hidden for ik (no cross-role reassignment) */}
              {role !== "ik" && (
                <div>
                  <label className={FORM_LABEL}>
                    Atanan Kişi
                  </label>
                  <input
                    type="text"
                    value={editAtananKisi}
                    onChange={(e) => setEditAtananKisi(e.target.value)}
                    className={INPUT_BASE}
                  />
                </div>
              )}
              <button
                disabled={saving}
                onClick={async () => {
                  if (!selectedTask) return;
                  setSaving(true);
                  try {
                    await updateTask(supabase, selectedTask.id, {
                      status: editDurum,
                      ...(role !== "ik"
                        ? { assignedTo: editAtananKisi.trim() || undefined }
                        : {}),
                    });
                    setSelectedId(null);
                    await reload();
                    router.refresh();
                  } catch (err) {
                    console.error("[gorevler] update error:", err);
                  } finally {
                    setSaving(false);
                  }
                }}
                className={`w-full px-4 py-2 ${TYPE_BODY} font-medium ${BUTTON_PRIMARY} ${RADIUS_SM} disabled:opacity-40 disabled:cursor-not-allowed`}
              >
                {saving ? "Kaydediliyor..." : "Güncellemeyi Uygula"}
              </button>
            </div>
          </div>
        )}
      </RightSidePanel>

      <NewTaskModal
        open={newOpen}
        onClose={() => setNewOpen(false)}
        firmalar={firmaOptions}
        allowAssignee={role !== "ik"}
        onSubmit={async ({ baslik, firmaId, kaynak, kaynakRef, atananKisi, termin, oncelik }) => {
          try {
            const input: TaskCreateInput = {
              legacyCompanyId: firmaId,
              title: baslik,
              assignedTo: role === "ik" ? undefined : atananKisi.trim() || undefined,
              dueDate: termin || undefined,
              sourceType: kaynak,
              sourceRef: kaynakRef,
              priority: oncelik,
            };
            await createTask(supabase, input);
            await reload();
            router.refresh();
          } catch (err) {
            console.error("[gorevler] create error:", err);
          }
        }}
      />
    </>
  );
}
