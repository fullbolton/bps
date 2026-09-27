"use client";
import ListToolbar from "@/components/ui/ListToolbar";

import type { SearchInputHandle } from "@/components/ui/SearchInput";
import { useListViewState } from "@/components/ui/useListViewState";
import { taskAssigneeLabel } from "@/lib/task-assignee-label";
import ConfirmActionDialog from "@/components/ui/ConfirmActionDialog";
import PickerFeedback from "@/components/ui/PickerFeedback";
import CollapsibleFilters from "@/components/ui/CollapsibleFilters";
import ActionNotice, { useActionNotice } from "@/components/ui/ActionNotice";
import AsyncSection from "@/components/ui/AsyncSection";

import { Suspense, useState, useRef, useId, useMemo, useCallback, useEffect } from "react";
import TaskLinkOpener from "./TaskLinkOpener";
import TaskPrefillBanner from "./TaskPrefillBanner";
import TaskAssignmentHistory from "./TaskAssignmentHistory";
import MobileTaskList from "./MobileTaskList";
import { taskActionPermissions, unassignedTask, activeTask, operationDay, taskDueLabel, type MobileTaskView } from "@/lib/mobile-operations";
import { useNavigationGuard } from "@/context/NavigationGuardContext";
import type { TaskPrefill } from "@/lib/operations/task-prefill";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { formatDateTR } from "@/lib/format-date";
import { Plus } from "lucide-react";
import {
  PageHeader,
  SearchInput,
  FilterBar,
  DataTable,
  StatusBadge,
  PriorityBadge,
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
import { createTaskAction, claimTaskAction, completeTaskAction } from "./actions";
import { taskContextLinks } from "@/lib/task-context";
import type { TaskRow } from "@/types/database.types";
import type { ColumnDef, FilterConfig, FilterValues } from "@/types/ui";
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

/**
 * Augment the raw `TaskRow` with the firma display name resolved from
 * companies. firma_name is resolved via `getCompanyDisplayMapByIds`
 * after loading tasks from the service layer.
 */
interface TaskListRow extends TaskRow {
  firma_name: string;
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
  { key: "title", header: "Görev", sortable: true, render: (value,row) => <div><span>{String(value)}</span>{taskContextLinks(row).length>0&&<p className="mt-1 text-xs font-normal text-slate-500">{taskContextLinks(row).map(link=>link.summary).join(' · ')}</p>}</div> },
  { key: "firma_name", header: "Bağlı Firma", sortable: true },
  {
    key: "assignee_label",
    header: "Atanan Kişi",
  },
  {
    key: "due_date",
    header: "Bitiş tarihi",
    sortable: true,
    render: (_val, row) => {
      const isLate = activeTask(row) && !!row.due_date && row.due_date.slice(0,10) < operationDay();
      return (
        <span className={clsx(TYPE_BODY, isLate ? "text-red-600 font-medium" : TEXT_BODY)}>
          {taskDueLabel(row,operationDay())}
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

const LIST_FILTER_DEFAULTS: FilterValues = { durum: "", oncelik: "", firma: "", atama: "" };

export default function GorevlerPage() {
  const { role } = useRole();
  const { loading: authLoading, user } = useAuth();
  const feedback = useActionNotice(JSON.stringify([user?.id, user?.app_metadata?.active_tenant, role]));
  const router = useRouter();
  const navigationGuard = useNavigationGuard();
  const [quickTask, setQuickTask] = useState<TaskListRow | null>(null);
  const [quickBusy, setQuickBusy] = useState(false);
  const quickFlight = useRef(false);
  const [quickMessage, setQuickMessage] = useState('');

  const supabase = useMemo(() => createClient(), []);
  const [taskRows, setTasks] = useState<TaskRow[]>([]);
  const [taskDataScope, setTaskDataScope] = useState<string | null>(null);
  const taskGeneration = useRef(0);
  const [companyNameById, setCompanyNameById] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  // Real companies for the firma filter + New Task modal dropdown.
  // RLS-scoped; option id prefers legacy_mock_id so the modal's write
  // path (createTask → legacyCompanyId) keeps working.
  const [companySnapshot, setCompanySnapshot] = useState<{scope: string; rows: CompanyRow[]; status: "loading" | "error" | "ready"} | null>(null);
  const [companyReloadKey, setCompanyReloadKey] = useState(0);
  const [profileSnapshot, setProfileSnapshot] = useState<{ scope: string; rows: ProfileRow[]; status: "loading" | "error" | "ready" } | null>(null);
  const [profileReloadKey, setProfileReloadKey] = useState(0);

  const editFormId = useId();
  const searchControl = useRef<SearchInputHandle>(null);
  const listScope = !authLoading && user ? JSON.stringify([user.id, user.app_metadata?.active_tenant ?? null, role]) : null;
  const { search, filters, setSearch: handleSearch, setFilters, ready: viewReady } = useListViewState("gorevler", listScope, LIST_FILTER_DEFAULTS);
  const allCompanies = useMemo(() => companySnapshot?.scope === listScope ? companySnapshot?.rows ?? [] : [], [companySnapshot, listScope]);
  const companiesDurum = companySnapshot?.scope === listScope ? companySnapshot?.status ?? "loading" : "loading";
  const creationContext = useMemo(() => ({scope: listScope}), [listScope]);
  const liveCreationContext = useRef<typeof creationContext | null>(creationContext);
  liveCreationContext.current = creationContext;
  useEffect(() => { liveCreationContext.current = creationContext; return () => { liveCreationContext.current = null; }; }, [creationContext]);
  const tasks = useMemo(() => taskDataScope === listScope ? taskRows : [], [taskDataScope, listScope, taskRows]);
  const taskLiveScope = useRef(listScope);
  taskLiveScope.current = listScope;
  const allProfiles = useMemo(() => profileSnapshot?.scope === listScope ? profileSnapshot?.rows ?? [] : [], [profileSnapshot, listScope]);
  const profilesDurum = profileSnapshot?.scope === listScope ? profileSnapshot?.status ?? "loading" : "loading";
  const profileNames = useMemo(() => new Map(allProfiles.map(profile => [profile.id, profile.display_name])), [allProfiles]);
  const [transferOpen, setTransferOpen] = useState(false);
  useEffect(() => { setTransferOpen(false); }, [user?.id, user?.app_metadata?.active_tenant, role]);
  const [newOpen, setNewOpen] = useState(false);
  const [taskPrefill, setTaskPrefill] = useState<TaskPrefill | null>(null);
  useEffect(() => { setNewOpen(false); setTaskPrefill(null); }, [listScope]);
  const [panelError, setPanelError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editDurum, setEditDurum] = useState<GorevDurumu>("acik");
  // Holds profiles.id ("" = unassigned). The display name is derived on save.
  const [editAtananKisiId, setEditAtananKisiId] = useState("");
  const [saving, setSaving] = useState(false);
  const saveBusy = useRef(false);
  const [discardIntent, setDiscardIntent] = useState<string | null>(null);
  useEffect(() => { setDiscardIntent(null); setPanelError(null); }, [selectedId, listScope]);


  // ------------------------------------------------------------------
  // Data loader — mirrors the Faz 2 Sözleşmeler pattern
  // ------------------------------------------------------------------
  const reload = useCallback(async () => {
    if (!listScope || taskLiveScope.current !== listScope) return;
    const generation = ++taskGeneration.current;
    setLoading(true); setLoadError(null);
    try {
      const rows = await listAllTasks(supabase);
      const display = await getCompanyDisplayMapByIds(supabase, Array.from(new Set(rows.map(row => row.company_id).filter((id): id is string => id !== null))));
      if (generation !== taskGeneration.current) return;
      setTasks(rows); setCompanyNameById(display.nameById); setTaskDataScope(listScope);
    } catch (err) {
      if (generation !== taskGeneration.current) return;
      setTasks([]); setCompanyNameById({}); setTaskDataScope(null);
      setLoadError(err instanceof Error ? err.message : "Görevler yüklenirken bir hata oluştu.");
    } finally {
      if (generation === taskGeneration.current) setLoading(false);
    }
  }, [supabase, listScope]);

  useEffect(() => {
    setSelectedId(null); setTasks([]); setTaskDataScope(null);
    void reload();
    return () => { taskGeneration.current++; };
  }, [reload]);
  const openLinkedTask = useCallback((id: string) => { setPanelError(null); setSelectedId(id); }, []);

  // Distinguish directory errors from a genuinely empty list and bind it to auth scope.
  useEffect(() => {
    if (!listScope) return;
    let active = true;
    setCompanySnapshot({scope: listScope, rows: [], status: "loading"});
    void selectAllCompanies(supabase).then(rows => {
      if (active) setCompanySnapshot({scope: listScope, rows, status: "ready"});
    }).catch(() => {
      if (active) setCompanySnapshot({scope: listScope, rows: [], status: "error"});
    });
    return () => { active = false; };
  }, [supabase, listScope, companyReloadKey]);

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
      firma_name: t.company_id ? companyNameById[t.company_id] ?? "—" : "Firma dışı görev",
      assignee_label: taskAssigneeLabel(t, t.assigned_to_user_id ? profileNames.get(t.assigned_to_user_id) : undefined, profilesDurum),
    }));
  }, [tasks, companyNameById, profileNames, profilesDurum]);

  // ------------------------------------------------------------------
  // Status counts — computed from loaded tasks
  // ------------------------------------------------------------------
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
      if (filters.firma && g.firma_name !== filters.firma) return false;
      if (filters.atama === "atanmamis" && !unassignedTask(g)) return false;
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

  const [mobileView, setMobileView] = useState<MobileTaskView>('open');
  const hasUnsavedChanges = !!selectedTask && (editDurum !== selectedTask.status ||
    (role !== "ik" && editAtananKisiId !== (selectedTask.assigned_to_user_id ?? "")));
  useEffect(() => { setQuickTask(null); setQuickMessage(''); setMobileView('open'); }, [listScope]);
  useEffect(() => navigationGuard.register(event => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (saving || quickFlight.current) { event.preventDefault(); return; }
    if (hasUnsavedChanges) { event.preventDefault(); setDiscardIntent(event.currentTarget.getAttribute('href') || 'close'); }
  }), [navigationGuard, saving, hasUnsavedChanges]);
  useEffect(() => {
    const block = (event: BeforeUnloadEvent) => { if (hasUnsavedChanges || saving || quickFlight.current) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', block); return () => window.removeEventListener('beforeunload', block);
  }, [hasUnsavedChanges, saving]);
  async function quickAction(row: TaskListRow, kind: 'claim' | 'complete') {
    if (quickFlight.current || !user || !listScope || row.tenant_id !== user.app_metadata.active_tenant) {
      if (kind === 'complete') throw new Error('Çalışma alanını ve işlem durumunu kontrol edin.');
      setQuickMessage('Çalışma alanını ve işlem durumunu kontrol edin.'); return;
    }
    quickFlight.current = true; setQuickBusy(true); setQuickMessage('');
    const captured = listScope;
    try {
      const action = kind === 'claim' ? claimTaskAction : completeTaskAction;
      const result = await action({ id:row.id, revision:row.revision, actorId:user.id, tenantId:row.tenant_id });
      if (taskLiveScope.current !== captured) return;
      if (!result.ok) throw new Error(result.error);
      feedback.show(kind === 'claim' ? 'İş size atandı.' : 'Görev tamamlandı.');
      await reload();
    } catch (error) {
      if (taskLiveScope.current === captured) {
        if (kind === 'complete') throw error;
        setQuickMessage(error instanceof Error ? error.message : 'Sonuç alınamadı. İşleri yenileyin.');
      }
    } finally { quickFlight.current = false; setQuickBusy(false); }
  }
  function requestPanelClose() {
    if (saveBusy.current) return;
    if (hasUnsavedChanges) setDiscardIntent("close");
    else setSelectedId(null);
  }

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
      buildFirmaFilter(["Firma dışı görev", ...allCompanies.map((c) => c.name)]),
    ],
    [allCompanies],
  );

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
          ...(role === "yonetici" ? [{ label: "Görevleri devret", variant: "secondary" as const, onClick: () => setTransferOpen(true) }] : []),
          {
            label: "Yeni Görev",
            onClick: () => { feedback.clear(); setTaskPrefill(null); setNewOpen(true); },
            icon: <Plus size={16} />,
          },
        ]}
      />

      {(role === "yonetici" || role === "operasyon") && <Suspense fallback={<p role="status">Talep bağlantısı hazırlanıyor…</p>}>
        <TaskPrefillBanner key={listScope} disabled={newOpen} onPrepare={prefill => {
          setTaskPrefill(prefill); setNewOpen(true);
        }} />
      </Suspense>}

      <Suspense fallback={null}>
        <TaskLinkOpener key={listScope} ready={!loading && !loadError && taskDataScope === listScope}
          taskIds={tasks.map(task => task.id)} onOpen={openLinkedTask} />
      </Suspense>
      <ActionNotice message={feedback.message} onDismiss={feedback.clear} />
      {quickBusy && <p role="status" className="mb-3 text-sm text-blue-700">İşlem kaydediliyor…</p>}
      {quickMessage && <div role="alert" className="mb-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm"><p>{quickMessage}</p><button className="mt-2 min-h-11 underline" onClick={() => { setQuickMessage(''); void reload(); }}>İşleri yenile</button></div>}
      <PickerFeedback id="task-company-directory" status={companiesDurum} count={allCompanies.length} name="Firma listesi"
        emptyText="Firma filtresinde gösterilecek firma yok." onRetry={() => setCompanyReloadKey(value => value + 1)} />
      {profilesDurum === "error" && <div role="status" className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
        <p>Görevler yüklendi ancak görevlerin kimde olduğunu gösteren isimler alınamadı. Kişi listesini yeniden yükleyin.</p>
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
            <ListToolbar label="Görevlerde ara" search={<SearchInput ref={searchControl} key={listScope} value={search} maxLength={512} placeholder="Görev, firma, kişi ara..." onChange={handleSearch} />}>
              <CollapsibleFilters key={listScope} activeCount={Object.values(filters).filter(Boolean).length}>
                <FilterBar filters={filterConfig} values={filters} onChange={next => { setFilters(next); setMobileView("all"); }} />
              </CollapsibleFilters>
            </ListToolbar>

            <MobileTaskList view={mobileView} onViewChange={setMobileView} key={listScope} rows={filteredData} actorId={user?.id ?? null} role={role} busy={quickBusy || saving}
              onCreate={() => { feedback.clear(); setTaskPrefill(null); setNewOpen(true); }} onOpen={row => setSelectedId(row.id)} onClaim={row => void quickAction(row,'claim')} onComplete={setQuickTask} onReload={() => void reload()}
              onClearFilters={search || Object.values(filters).some(Boolean) ? () => { searchControl.current?.clear(); handleSearch(''); setFilters(LIST_FILTER_DEFAULTS); } : undefined}
              renderDesktop={rows => <DataTable<TaskListRow>
                columns={[...COLUMNS, {key:'id',header:'Hızlı işlem',render:(_value,row)=>{
                  const permissions=taskActionPermissions(row,role,user?.id??null);
                  return <div className="flex gap-2" onClick={event=>event.stopPropagation()}>
                    {permissions.claim&&<button type="button" disabled={quickBusy||saving} onClick={()=>void quickAction(row,'claim')} className="min-h-11 whitespace-nowrap rounded-lg border border-blue-200 px-3 text-sm font-medium text-blue-700 disabled:opacity-40">İşi üstlen</button>}
                    {permissions.complete&&<button type="button" disabled={quickBusy||saving} onClick={()=>setQuickTask(row)} className="min-h-11 rounded-lg border border-emerald-200 px-3 text-sm font-medium text-emerald-800 disabled:opacity-40">Tamamla</button>}
                    {!permissions.claim&&!permissions.complete&&<span className="text-xs text-slate-500">Detaydan inceleyin</span>}
                  </div>;
                }}]}
                data={rows} rowKey="id" onRowClick={row=>setSelectedId(row.id)}
              />} />
          </>
        )}
      </div>

      <RightSidePanel
        open={!!selectedTask}
        onClose={requestPanelClose}
        closeDisabled={saving}
        title="Görev detayı"
      >
        {selectedTask && (
          <div className="space-y-4">
            <div>
              <h3 className={`${TYPE_CARD_TITLE} ${TEXT_PRIMARY}`}>{selectedTask.title}</h3>
              <div className="mt-2 flex items-center gap-2 flex-wrap">
                <PriorityBadge priority={selectedTask.priority} />
                <StatusBadge status={selectedTask.status} />
              </div>
            </div>

            {taskContextLinks(selectedTask).length>0&&<section className="rounded-xl border border-slate-200 bg-slate-50 p-3" aria-label="Görevle ilgili kayıtlar"><h4 className="text-sm font-medium">İlgili kayıtlar</h4>{taskContextLinks(selectedTask).map(link=><Link key={link.href} href={link.href} aria-disabled={saving||undefined} onClick={event=>{if(event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;if(saveBusy.current){event.preventDefault();return;}if(hasUnsavedChanges){event.preventDefault();setDiscardIntent(link.href);}}} className="block min-h-11 py-3 text-sm text-blue-700 underline underline-offset-4">{link.label}</Link>)}</section>}
            <dl className="space-y-3">
              <div>
                <dt className={DL_LABEL}>Bağlı Firma</dt>
                <dd className={`${TYPE_BODY} mt-0.5`}>
                  {selectedTask.company_id ? <Link href={`/firmalar/${selectedTask.company_id}`} aria-disabled={saving || undefined}
                    onClick={event => {
                      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
                      if (saveBusy.current) { event.preventDefault(); return; }
                      if (hasUnsavedChanges) { event.preventDefault(); setDiscardIntent(`/firmalar/${selectedTask.company_id}`); }
                    }}
                    className={`${TEXT_LINK} inline-block min-h-11 max-w-full break-words py-2 underline underline-offset-4`}>
                    {selectedTask.firma_name === "—" ? "Firma kaydını aç" : selectedTask.firma_name}
                  </Link> : <span>Firma dışı görev</span>}
                </dd>
              </div>
              <div>
                <dt className={DL_LABEL}>Atanan kişi</dt>
                <dd className={DL_VALUE}>{selectedTask.assignee_label}</dd>
              </div>
              <div>
                <dt className={DL_LABEL}>Bitiş tarihi</dt>
                <dd className={DL_VALUE}>
                  {selectedTask.due_date
                    ? formatDateTR(selectedTask.due_date.slice(0, 10))
                    : "—"}
                </dd>
              </div>
            </dl>

            <fieldset disabled={saving} className={`space-y-4 border-t ${BORDER_SUBTLE} pt-4`}>
              <div>
                <label htmlFor={`${editFormId}-status`} className={FORM_LABEL}>
                  Durum
                </label>
                <select
                  id={`${editFormId}-status`}
                  value={editDurum}
                  onChange={(e) => setEditDurum(e.target.value as GorevDurumu)}
                  className={`${INPUT_BASE} min-h-11`}
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
                    className={`${INPUT_BASE} min-h-11`}
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
                disabled={saving || !hasUnsavedChanges}
                onClick={async () => {
                  if (!selectedTask || saveBusy.current || !hasUnsavedChanges) return;
                  saveBusy.current = true;
                  const saveScope = listScope;
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
                    if (taskLiveScope.current !== saveScope) return;
                    feedback.show("Görev güncellendi.");
                    setSelectedId(null);
                    await reload();
                    router.refresh();
                  } catch (err) {
                    if (taskLiveScope.current !== saveScope) return;
                    // Surface the failure — a silent catch left the panel
                    // looking saved when nothing was written.
                    setPanelError(
                      err instanceof Error
                        ? err.message
                        : "Görev güncellenirken bir hata oluştu.",
                    );
                  } finally {
                    saveBusy.current = false;
                    setSaving(false);
                  }
                }}
                className={`min-h-11 w-full px-4 py-2 ${TYPE_BODY} font-medium ${BUTTON_PRIMARY} ${RADIUS_SM} disabled:opacity-40 disabled:cursor-not-allowed`}
              >
                {saving ? "Kaydediliyor..." : hasUnsavedChanges ? "Değişiklikleri kaydet" : "Değişiklik yok"}
              </button>
              {saving && <p role="status" className="text-sm text-blue-700">Görev kaydediliyor, lütfen bekleyin.</p>}
            </fieldset>
          </div>
        )}
        {selectedTask&&<TaskAssignmentHistory key={`${user?.id}:${selectedTask.id}:${selectedTask.revision}`} client={supabase} taskId={selectedTask.id} profiles={allProfiles} />}
      </RightSidePanel>
      {quickTask && <ConfirmActionDialog key={`${listScope}:${quickTask.id}:${quickTask.revision}`} title="Görevi tamamla" recordName={quickTask.title}
        description="Bu işi tamamlandı olarak kaydedeceksiniz. Bağlı personel talebi veya işe başlama takibi bundan etkilenmez."
        confirmLabel="Tamamlandı olarak kaydet" onClose={() => setQuickTask(null)} onConfirm={() => quickAction(quickTask,'complete')} />}
      {discardIntent && selectedTask && <ConfirmActionDialog
        title="Kaydedilmemiş değişiklikler" recordName={selectedTask.title}
        description="Bu görevdeki kaydedilmemiş düzenlemeler bırakılacak. Kayıtlı görev değişmeyecek."
        confirmLabel="Değişiklikleri bırak" destructive onClose={() => setDiscardIntent(null)}
        onConfirm={async () => {
          const destination = discardIntent;
          setDiscardIntent(null); setSelectedId(null);
          if (destination !== "close") router.push(destination);
        }} />}


      {transferOpen && role === "yonetici" && user && <TaskTransferModal
        key={`${user.id}:${user.app_metadata?.active_tenant}:${role}`}
        actorId={user.id} onClose={() => setTransferOpen(false)}
        onApplied={() => { void reload(); router.refresh(); }}
      />}
      <NewTaskModal
        key={listScope}
        open={newOpen}
        onClose={() => { if (liveCreationContext.current !== creationContext) return; setNewOpen(false); setTaskPrefill(null); }}
        firmalar={taskPrefill ? [{id:taskPrefill.companyId,ad:taskPrefill.companyName}] : firmaOptions}
        firmalarDurum={taskPrefill ? "ready" : companiesDurum}
        onRetryFirmalar={taskPrefill ? undefined : () => setCompanyReloadKey(value => value + 1)}
        onRetryKullanicilar={() => setProfileReloadKey(value => value + 1)}
        defaultFirmaId={taskPrefill?.companyId}
        defaultBaslik={taskPrefill?.title}
        prefillNotice={taskPrefill ? "Şube ve gün bilgisi görev başlığına kopyalandı. Talepteki sonraki değişiklikler bu göreve yansımaz; görevi tamamlamak talebi kapatmaz." : undefined}
        currentUserId={user?.id}
        kullanicilar={kullaniciOptions}
        kullanicilarDurum={profilesDurum}
        allowAssignee={role !== "ik"}
        onSubmit={async ({ baslik, firmaId, kaynak, kaynakRef, atananKisiId, termin, oncelik }) => {
          // No try/catch here: errors must bubble so NewTaskModal renders
          // its inline submitError (matches every sibling page). The old
          // console.error swallow closed the modal as if the create
          // succeeded when it had failed.
          const input: TaskCreateInput = {
            legacyCompanyId: firmaId || null,
            title: baslik,
            // id only — the service resolves the display name server-side.
            assignedToUserId: role === "ik" ? undefined : atananKisiId,
            dueDate: termin || undefined,
            sourceType: kaynak,
            sourceRef: kaynakRef,
            priority: oncelik,
          };
          const result = await createTaskAction(input);
          if (liveCreationContext.current !== creationContext) return;
          if (!result.ok) throw new Error(result.error);
          feedback.show(`${baslik} görevlere eklendi.`);
          await reload();
          if (liveCreationContext.current !== creationContext) return;
          router.refresh();
        }}
      />
    </>
  );
}
