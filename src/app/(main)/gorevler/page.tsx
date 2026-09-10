"use client";

import type { SearchInputHandle } from "@/components/ui/SearchInput";
import { useListViewState } from "@/components/ui/useListViewState";
import { taskAssigneeLabel } from "@/lib/task-assignee-label";
import CollapsibleFilters from "@/components/ui/CollapsibleFilters";
import ActionNotice, { useActionNotice } from "@/components/ui/ActionNotice";
import AsyncSection from "@/components/ui/AsyncSection";

import { Suspense, useState, useRef, useId, useMemo, useCallback, useEffect } from "react";
import TaskPrefillBanner from "./TaskPrefillBanner";
import TaskAssignmentHistory from "./TaskAssignmentHistory";
import type { TaskPrefill } from "@/lib/operations/task-prefill";
import { useRouter } from "next/navigation";
import { formatDateTR } from "@/lib/format-date";
import { Plus } from "lucide-react";
import {
  PageHeader,
  SearchInput,
  FilterBar,
  DataTable,
  StatusBadge,
  PriorityBadge,
  TaskSourceBadge,
  RightSidePanel,
  EmptyState,
} from "@/components/ui";
import { useRole } from "@/context/RoleContext";
import { useAuth } from "@/context/AuthContext";
import { NewTaskModal } from "@/components/modals";
// Faz 3: Görevler list cutover. Tasks come from the tasks service
// layer; the firma filter dropdown and New Task modal now source
// options from the real companies table via selectAllCompanies (RLS-
// scoped), replacing the earlier MOCK_FIRMALAR UI dictionary.
import { createClient } from "@/lib/supabase/client";
import { selectAllCompanies } from "@/lib/supabase/companies";
import { listActiveTenantProfiles } from "@/lib/services/profiles";
import type { CompanyRow, ProfileRow } from "@/types/database.types";
import {
  listAllTasks,
  updateTask,
  type TaskCreateInput,
} from "@/lib/services/tasks";
import { getCompanyDisplayMapByIds } from "@/lib/services/companies";
// Görev create routes through the server action so the passive-company
// guard runs before the insert (updateTask stays a direct service call).
import { createTaskAction } from "./actions";
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
  TEXT_PRIMARY,
  TEXT_BODY,
  TEXT_SECONDARY,
  TEXT_MUTED,
  TEXT_LINK,
  BORDER_SUBTLE,
  RADIUS_SM,
  INPUT_BASE,
  BUTTON_PRIMARY,
} from "@/styles/tokens";

// Page-local helpers
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
  assignee_label: string;
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
    // Kişi-merkezli daraltma. Varsayılan boş = Tümü; Görevler tam yönetim
    // ekranı olduğu için burada varsayılan daraltma YAPILMIYOR (Dashboard'da
    // yapılıyor — orası "bugün ne yapmalıyım" yüzeyi).
    //
    // "Atanmamış" ayrı bir seçenek: `completeAppointment` handoff görevi
    // assignee yazmıyor, yani sahipsiz görev üretiliyor ve bugün onları
    // bulmanın hiçbir yolu yok. WORKFLOW_RULES "sahipsiz iş yasağı" diyor;
    // yasağın işe yaraması için sahipsiz işin ARANABİLİR olması gerekiyor.
    key: "atama",
    label: "Atama",
    type: "select",
    placeholder: "Tümü",
    options: [
      { label: "Bana atanan", value: "bana" },
      { label: "Atanmamış", value: "atanmamis" },
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
  // Note: the "firma" filter is appended at the component level so its
  // options can come from the real companies table.
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
    key: "assignee_label",
    header: "Atanan Kişi",
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

import TaskTransferModal from "./TaskTransferModal";

const LIST_FILTER_DEFAULTS: FilterValues = { durum: "", oncelik: "", kaynak: "", firma: "", atama: "" };

export default function GorevlerPage() {
  const { role } = useRole();
  const { loading: authLoading, user } = useAuth();
  const feedback = useActionNotice(JSON.stringify([user?.id, user?.app_metadata?.active_tenant, role]));
  const router = useRouter();

  const supabase = useMemo(() => createClient(), []);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [companyNameById, setCompanyNameById] = useState<Record<string, string>>({});
  const [companyLegacyById, setCompanyLegacyById] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  // Real companies for the firma filter + New Task modal dropdown.
  // RLS-scoped; option id prefers legacy_mock_id so the modal's write
  // path (createTask → legacyCompanyId) keeps working.
  const [allCompanies, setAllCompanies] = useState<CompanyRow[]>([]);
  const [profileSnapshot, setProfileSnapshot] = useState<{ scope: string; rows: ProfileRow[]; status: "loading" | "error" | "ready" } | null>(null);
  const [profileReloadKey, setProfileReloadKey] = useState(0);

  const editFormId = useId();
  const searchControl = useRef<SearchInputHandle>(null);
  const listScope = !authLoading && user ? JSON.stringify([user.id, user.app_metadata?.active_tenant ?? null, role]) : null;
  const { search, filters, setSearch: handleSearch, setFilters, ready: viewReady } = useListViewState("gorevler", listScope, LIST_FILTER_DEFAULTS);
  const allProfiles = useMemo(() => profileSnapshot?.scope === listScope ? profileSnapshot?.rows ?? [] : [], [profileSnapshot, listScope]);
  const profilesDurum = profileSnapshot?.scope === listScope ? profileSnapshot?.status ?? "loading" : "loading";
  const profileNames = useMemo(() => new Map(allProfiles.map(profile => [profile.id, profile.display_name])), [allProfiles]);
  const [transferOpen, setTransferOpen] = useState(false);
  useEffect(() => { setTransferOpen(false); }, [user?.id, user?.app_metadata?.active_tenant, role]);
  const [newOpen, setNewOpen] = useState(false);
  const [taskPrefill, setTaskPrefill] = useState<TaskPrefill | null>(null);
  useEffect(() => { setNewOpen(false); setTaskPrefill(null); }, [user?.id, role]);
  const [panelError, setPanelError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editDurum, setEditDurum] = useState<GorevDurumu>("acik");
  // Holds profiles.id ("" = unassigned). The display name is derived on save.
  const [editAtananKisiId, setEditAtananKisiId] = useState("");
  const [saving, setSaving] = useState(false);


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

  // Companies for the firma filter + New Task modal. Errors fall to
  // an empty list so both surfaces show an honest empty state.
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

  // Scope the directory snapshot so a previous account/tenant cannot name current rows.
  useEffect(() => {
    if (!listScope) return;
    let active = true;
    setProfileSnapshot({ scope: listScope, rows: [], status: "loading" });
    void listActiveTenantProfiles(supabase).then(rows => {
      if (active) setProfileSnapshot({ scope: listScope, rows, status: "ready" });
    }).catch(() => {
      if (active) setProfileSnapshot({ scope: listScope, rows: [], status: "error" });
    });
    return () => { active = false; };
  }, [supabase, listScope, profileReloadKey]);

  // ------------------------------------------------------------------
  // Enriched rows — add firma_name for display + filtering
  // ------------------------------------------------------------------
  const enrichedRows: TaskListRow[] = useMemo(() => {
    return tasks.map((t) => ({
      ...t,
      firma_name: companyNameById[t.company_id] ?? "—",
      firma_legacy_id: companyLegacyById[t.company_id] ?? null,
      assignee_label: taskAssigneeLabel(t, t.assigned_to_user_id ? profileNames.get(t.assigned_to_user_id) : undefined, profilesDurum),
    }));
  }, [tasks, companyNameById, companyLegacyById, profileNames, profilesDurum]);

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
          g.assignee_label.toLowerCase().includes(q);
        if (!match) return false;
      }
      if (filters.durum && g.status !== filters.durum) return false;
      if (filters.oncelik && g.priority !== filters.oncelik) return false;
      if (filters.kaynak && g.source_type !== filters.kaynak) return false;
      if (filters.firma && g.firma_name !== filters.firma) return false;
      if (filters.atama === "atanmamis" && g.assigned_to_user_id) return false;
      // Oturum çözülmemişse "bana atanan" HİÇBİR ŞEY döndürür — açıkça,
      // `user?.id ?? null` ile karşılaştırarak DEĞİL: o hâlde null === null
      // eşleşir ve ATANMAMIŞ görevler "bana atanan" gibi görünürdü.
      if (filters.atama === "bana") {
        if (!user?.id) return false;
        if (g.assigned_to_user_id !== user.id) return false;
      }
      return true;
    });
  }, [enrichedRows, search, filters, user]);

  const selectedTask = useMemo(
    () => enrichedRows.find((task) => task.id === selectedId) ?? null,
    [enrichedRows, selectedId]
  );

  const selectedTaskId = selectedTask?.id;
  const selectedTaskStatus = selectedTask?.status;
  const selectedTaskAssignee = selectedTask?.assigned_to_user_id;
  const selectedTaskRevision = selectedTask?.revision;
  useEffect(() => {
    if (!selectedTaskId || !selectedTaskStatus) return;
    setEditDurum(selectedTaskStatus);
    setEditAtananKisiId(selectedTaskAssignee ?? "");
  }, [selectedTaskId, selectedTaskStatus, selectedTaskAssignee, selectedTaskRevision]);

  const firmaOptions = useMemo(
    () =>
      allCompanies.map((c) => ({
        id: c.legacy_mock_id ?? c.id,
        ad: c.name,
      })),
    [allCompanies],
  );

  const kullaniciOptions = useMemo(
    () => allProfiles.filter((p) => ["yonetici", "operasyon", "ik"].includes(p.role)).map((p) => ({ id: p.id, ad: p.display_name })),
    [allProfiles],
  );

  const filterConfig = useMemo<FilterConfig[]>(
    () => [
      ...FILTER_CONFIG,
      buildFirmaFilter(allCompanies.map((c) => c.name)),
    ],
    [allCompanies],
  );

  const rowActions: RowAction<TaskListRow>[] = [
    {
      label: "Hızlı Güncelle",
      onClick: (row) => setSelectedId(row.id),
    },
  ];

  // ------------------------------------------------------------------
  // Role gate — goruntuleyici / muhasebe have no access
  // ------------------------------------------------------------------
  // Auth not resolved yet — don't flash "Erişim kısıtlı" (role defaults to
  // "goruntuleyici" while AuthContext is loading). Wait, then decide.
  if (authLoading || !viewReady) {
    return (
      <>
        <PageHeader title="Görevler" subtitle="Operasyon takibi" />
        <EmptyState title="Yükleniyor…" description="Yetki bilgisi kontrol ediliyor." size="page" />
      </>
    );
  }

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
          ...(role === "yonetici" ? [{ label: "Görevleri devret", onClick: () => setTransferOpen(true) }] : []),
          {
            label: "Yeni Görev",
            onClick: () => { feedback.clear(); setTaskPrefill(null); setNewOpen(true); },
            icon: <Plus size={16} />,
          },
        ]}
      />

      {(role === "yonetici" || role === "operasyon") && <Suspense fallback={<p role="status">Talep bağlantısı hazırlanıyor…</p>}>
        <TaskPrefillBanner key={`${user?.id}:${role}`} disabled={newOpen} onPrepare={prefill => {
          setTaskPrefill(prefill); setNewOpen(true);
        }} />
      </Suspense>}

      <ActionNotice message={feedback.message} onDismiss={feedback.clear} />
      {profilesDurum === "error" && <div role="status" className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
        <p>Kişi listesi alınamadı. Görevler gösteriliyor; atanan kişi adları doğrulanamadı.</p>
        <button type="button" className="mt-2 min-h-11 rounded-lg border border-amber-300 px-3" onClick={() => setProfileReloadKey(value => value + 1)}>Kişi listesini tekrar yükle</button>
      </div>}

      <div className="space-y-4">
        {/* Loading state */}
        {loading && (
          <div className={`text-center py-8 ${TYPE_BODY} ${TEXT_MUTED}`}>Yükleniyor...</div>
        )}

        {/* Error state */}
        {loadError && (
          <AsyncSection isLoading={false} hasError onRetry={() => { setLoading(true); void reload(); }}>
            {null}
          </AsyncSection>
        )}

        {/* Main content */}
        {!loading && !loadError && (
          <>
            <div role="group" aria-label="Durum filtresi">
              <p className="mb-2 text-xs text-slate-500">Tüm görevlerin durum özeti · filtrelemek için seçin</p>
              <div className="grid grid-cols-3 gap-2 lg:grid-cols-6">
                {[{ status: "", label: "Tümü", count: tasks.length }, ...Object.entries(statusCounts).map(([status, count]) => ({ status, label: STATUS_LABELS[status], count }))].map(({ status, label, count }) => (
                  <button key={status} type="button" aria-pressed={filters.durum === status}
                    onClick={() => setFilters(previous => ({ ...previous, durum: previous.durum === status ? "" : status }))}
                    className={clsx("flex min-h-16 min-w-0 flex-col items-start justify-center rounded-xl border px-3 py-2 text-left transition-colors", filters.durum === status ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-700 hover:border-slate-400")}>
                    <span className="text-xs">{label}</span>
                    <span className="text-xl font-semibold tabular-nums">{count}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <div className="w-full sm:max-w-xs">
                <SearchInput ref={searchControl} key={listScope} value={search} maxLength={512} placeholder="Görev, firma, kişi ara..." onChange={handleSearch} />
              </div>
              <CollapsibleFilters key={listScope} activeCount={Object.values(filters).filter(Boolean).length}>
                <FilterBar filters={filterConfig} values={filters} onChange={setFilters} />
              </CollapsibleFilters>
            </div>

            <DataTable<TaskListRow>
              columns={COLUMNS}
              data={filteredData}
              rowKey="id"
              onRowClick={(row) => setSelectedId(row.id)}
              rowActions={rowActions}
              emptyAction={(tasks.length > 0 && (search !== "" || Object.values(filters).some(Boolean))) ? {
                label: "Arama ve filtreleri temizle",
                onClick: () => { searchControl.current?.clear(); setFilters(LIST_FILTER_DEFAULTS); },
              } : undefined}
              emptyTitle={tasks.length === 0 ? "Henüz görev yok" : "Bu filtrelerle eşleşen görev yok"}
              emptyDescription={tasks.length === 0 ? "Yeni Görev ile ilk işinizi oluşturabilirsiniz.":"Aramayı veya filtreleri değiştirerek yeniden deneyin."}
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
                <dt className={DL_LABEL}>Atanan kişi</dt>
                <dd className={DL_VALUE}>{selectedTask.assignee_label}</dd>
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
                <label htmlFor={`${editFormId}-status`} className={FORM_LABEL}>
                  Durum
                </label>
                <select
                  id={`${editFormId}-status`}
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
                  <label htmlFor={`${editFormId}-assignee`} className={FORM_LABEL}>
                    Atanan Kişi
                  </label>
                  <select
                    id={`${editFormId}-assignee`}
                    value={editAtananKisiId}
                    onChange={(e) => setEditAtananKisiId(e.target.value)}
                    disabled={profilesDurum !== "ready" || kullaniciOptions.length === 0}
                    className={INPUT_BASE}
                  >
                    <option value="">
                      {profilesDurum === "loading"
                        ? "Kullanıcılar yükleniyor…"
                        : profilesDurum === "error"
                          ? "Kullanıcı listesi yüklenemedi"
                          : kullaniciOptions.length === 0
                            ? "Atanabilecek kullanıcı yok"
                            : "Atanmadı"}
                    </option>
                    {editAtananKisiId && !kullaniciOptions.some(option => option.id === editAtananKisiId) && (
                      <option value={editAtananKisiId} disabled>{selectedTask.assignee_label}</option>
                    )}
                    {kullaniciOptions.map((k) => (
                      <option key={k.id} value={k.id}>
                        {k.ad}
                      </option>
                    ))}
                  </select>
                  {/* Legacy rows carry only a typed name; show it so the
                      current value is visible until someone re-assigns. */}
                  {!editAtananKisiId && selectedTask?.assigned_to && (
                    <p className={`${TYPE_CAPTION} ${TEXT_MUTED} mt-1`}>
                      Kayıtlı (eski): {selectedTask.assigned_to}
                    </p>
                  )}
                </div>
              )}
              {panelError && (
                <div className={`${TYPE_CAPTION} text-red-600`} role="alert">
                  {panelError}
                  <button disabled={saving} className="mt-2 block underline" onClick={async()=>{await reload();setPanelError(null);}}>Güncel kaydı yükle (formu yeniler)</button>
                </div>
              )}
              <button
                disabled={saving}
                onClick={async () => {
                  if (!selectedTask) return;
                  setSaving(true);
                  setPanelError(null);
                  try {
                    // Send the id only — the service derives the display name
                    // from profiles and clears both columns on "" (unassign).
                    await updateTask(supabase, selectedTask.id, {
                      expectedRevision: selectedTask.revision,
                      status: editDurum,
                      ...(role !== "ik"
                        ? { assignedToUserId: editAtananKisiId || null }
                        : {}),
                    });
                    feedback.show("Görev güncellendi.");
                    setSelectedId(null);
                    await reload();
                    router.refresh();
                  } catch (err) {
                    // Surface the failure — a silent catch left the panel
                    // looking saved when nothing was written.
                    setPanelError(
                      err instanceof Error
                        ? err.message
                        : "Görev güncellenirken bir hata oluştu.",
                    );
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
        {selectedTask&&<TaskAssignmentHistory key={`${user?.id}:${selectedTask.id}:${selectedTask.revision}`} client={supabase} taskId={selectedTask.id} profiles={allProfiles} />}
      </RightSidePanel>

      {transferOpen && role === "yonetici" && user && <TaskTransferModal
        key={`${user.id}:${user.app_metadata?.active_tenant}:${role}`}
        actorId={user.id} onClose={() => setTransferOpen(false)}
        onApplied={() => { void reload(); router.refresh(); }}
      />}
      <NewTaskModal
        open={newOpen}
        onClose={() => { setNewOpen(false); setTaskPrefill(null); }}
        firmalar={taskPrefill ? [{id:taskPrefill.companyId,ad:taskPrefill.companyName}] : firmaOptions}
        defaultFirmaId={taskPrefill?.companyId}
        defaultBaslik={taskPrefill?.title}
        prefillNotice={taskPrefill ? "Şube ve gün bilgisi görev başlığına kopyalandı. Talepteki sonraki değişiklikler bu göreve yansımaz; görevi tamamlamak talebi kapatmaz." : undefined}
        kullanicilar={kullaniciOptions}
        kullanicilarDurum={profilesDurum}
        allowAssignee={role !== "ik"}
        onSubmit={async ({ baslik, firmaId, kaynak, kaynakRef, atananKisiId, termin, oncelik }) => {
          // No try/catch here: errors must bubble so NewTaskModal renders
          // its inline submitError (matches every sibling page). The old
          // console.error swallow closed the modal as if the create
          // succeeded when it had failed.
          const input: TaskCreateInput = {
            legacyCompanyId: firmaId,
            title: baslik,
            // id only — the service resolves the display name server-side.
            assignedToUserId: role === "ik" ? undefined : atananKisiId,
            dueDate: termin || undefined,
            sourceType: kaynak,
            sourceRef: kaynakRef,
            priority: oncelik,
          };
          const result = await createTaskAction(input);
          if (!result.ok) throw new Error(result.error);
          feedback.show(`${baslik} görevlere eklendi.`);
          await reload();
          router.refresh();
        }}
      />
    </>
  );
}
