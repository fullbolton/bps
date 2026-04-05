"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
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
import { MOCK_GOREVLER, getGorevStatusCounts, updateGorevler } from "@/mocks/gorevler";
import { MOCK_FIRMALAR } from "@/mocks/firmalar";
import type { MockGorev, GorevKaynagi } from "@/mocks/gorevler";
import type { ColumnDef, FilterConfig, FilterValues, RowAction } from "@/types/ui";
import type { OncelikSeviyesi } from "@/types/ui";
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
    options: Array.from(new Set(MOCK_GOREVLER.map((g) => g.firmaAdi))).map(
      (name) => ({ label: name, value: name })
    ),
  },
];

/**
 * Columns match PRODUCT_STRUCTURE > Görevler > Liste kolonları:
 * görev başlığı, bağlı firma, kaynak, atanan kişi, termin, öncelik, durum
 */
const COLUMNS: ColumnDef<MockGorev>[] = [
  { key: "baslik", header: "Görev Başlığı", sortable: true },
  { key: "firmaAdi", header: "Bağlı Firma", sortable: true },
  {
    key: "kaynak",
    header: "Kaynak",
    render: (val) => <TaskSourceBadge source={val as GorevKaynagi} />,
  },
  { key: "atananKisi", header: "Atanan Kişi" },
  {
    key: "termin",
    header: "Termin",
    sortable: true,
    render: (val, row) => {
      const isLate = row.durum === "gecikti";
      return (
        <span className={clsx(TYPE_BODY, isLate ? "text-red-600 font-medium" : TEXT_BODY)}>
          {formatDateTR(val as string)}
        </span>
      );
    },
  },
  {
    key: "oncelik",
    header: "Öncelik",
    sortable: true,
    render: (val) => <PriorityBadge priority={val as OncelikSeviyesi} />,
  },
  {
    key: "durum",
    header: "Durum",
    sortable: true,
    render: (val) => <StatusBadge status={val as MockGorev["durum"]} />,
  },
];

export default function GorevlerPage() {
  const { role } = useRole();
  const [tasks, _setTasks] = useState(MOCK_GOREVLER);
  function setTasks(
    updater: typeof MOCK_GOREVLER | ((prev: typeof MOCK_GOREVLER) => typeof MOCK_GOREVLER)
  ) {
    _setTasks((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      updateGorevler(next);
      return next;
    });
  }
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<FilterValues>({
    durum: "",
    oncelik: "",
    kaynak: "",
    firma: "",
  });
  const [newOpen, setNewOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editDurum, setEditDurum] = useState<MockGorev["durum"]>("acik");
  const [editAtananKisi, setEditAtananKisi] = useState("");

  const handleSearch = useCallback((val: string) => setSearch(val), []);
  const statusCounts = useMemo(() => getGorevStatusCounts(tasks), [tasks]);

  const filteredData = useMemo(() => {
    return tasks.filter((g) => {
      if (search) {
        const q = search.toLowerCase();
        const match =
          g.baslik.toLowerCase().includes(q) ||
          g.firmaAdi.toLowerCase().includes(q) ||
          g.atananKisi.toLowerCase().includes(q);
        if (!match) return false;
      }
      if (filters.durum && g.durum !== filters.durum) return false;
      if (filters.oncelik && g.oncelik !== filters.oncelik) return false;
      if (filters.kaynak && g.kaynak !== filters.kaynak) return false;
      if (filters.firma && g.firmaAdi !== filters.firma) return false;
      return true;
    });
  }, [tasks, search, filters]);

  const selectedTask = useMemo(
    () => tasks.find((task) => task.id === selectedId) ?? null,
    [tasks, selectedId]
  );

  useEffect(() => {
    if (!selectedTask) return;
    setEditDurum(selectedTask.durum);
    setEditAtananKisi(selectedTask.atananKisi);
  }, [selectedTask]);

  const firmaOptions = MOCK_FIRMALAR.map((f) => ({ id: f.id, ad: f.firmaAdi }));

  const rowActions: RowAction<MockGorev>[] = [
    {
      label: "Hızlı Güncelle",
      onClick: (row) => setSelectedId(row.id),
    },
  ];

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

        <DataTable<MockGorev>
          columns={COLUMNS}
          data={filteredData}
          rowKey="id"
          onRowClick={(row) => setSelectedId(row.id)}
          rowActions={rowActions}
          emptyTitle="Görev bulunamadı"
          emptyDescription="Arama veya filtre kriterlerinizi değiştirin."
        />
      </div>

      <RightSidePanel
        open={!!selectedTask}
        onClose={() => setSelectedId(null)}
        title="Görev Hızlı Güncelle"
      >
        {selectedTask && (
          <div className="space-y-4">
            <div>
              <h3 className={`${TYPE_CARD_TITLE} ${TEXT_PRIMARY}`}>{selectedTask.baslik}</h3>
              <div className="mt-2 flex items-center gap-2 flex-wrap">
                <TaskSourceBadge source={selectedTask.kaynak} />
                <PriorityBadge priority={selectedTask.oncelik} />
                <StatusBadge status={selectedTask.durum} />
              </div>
            </div>

            <dl className="space-y-3">
              <div>
                <dt className={DL_LABEL}>Bağlı Firma</dt>
                <dd className={`${TYPE_BODY} mt-0.5`}>
                  <a
                    href={`/firmalar/${selectedTask.firmaId}`}
                    className={`${TEXT_LINK} hover:underline`}
                  >
                    {selectedTask.firmaAdi}
                  </a>
                </dd>
              </div>
              <div>
                <dt className={DL_LABEL}>Termin</dt>
                <dd className={DL_VALUE}>{formatDateTR(selectedTask.termin)}</dd>
              </div>
            </dl>

            <div className={`space-y-4 border-t ${BORDER_SUBTLE} pt-4`}>
              <div>
                <label className={FORM_LABEL}>
                  Durum
                </label>
                <select
                  value={editDurum}
                  onChange={(e) => setEditDurum(e.target.value as MockGorev["durum"])}
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
                onClick={() => {
                  if (!selectedTask) return;
                  setTasks((prev) =>
                    prev.map((task) =>
                      task.id === selectedTask.id
                        ? {
                            ...task,
                            durum: editDurum,
                            ...(role !== "ik" ? { atananKisi: editAtananKisi.trim() || task.atananKisi } : {}),
                          }
                        : task
                    )
                  );
                  setSelectedId(null);
                }}
                className={`w-full px-4 py-2 ${TYPE_BODY} font-medium ${BUTTON_PRIMARY} ${RADIUS_SM}`}
              >
                Güncellemeyi Uygula
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
        onSubmit={({ baslik, firmaId, kaynak, kaynakRef, atananKisi, termin, oncelik }) => {
          const firma = MOCK_FIRMALAR.find((item) => item.id === firmaId);
          if (!firma) return;
          setTasks((prev) => [
            {
              id: `g-local-${Date.now()}`,
              baslik,
              firmaId,
              firmaAdi: firma.firmaAdi,
              kaynak,
              kaynakRef,
              atananKisi: role === "ik" ? "Atanmadı" : atananKisi.trim() || "Atanmadı",
              termin: termin || "—",
              oncelik: oncelik as OncelikSeviyesi,
              durum: "acik",
            },
            ...prev,
          ]);
        }}
      />
    </>
  );
}
