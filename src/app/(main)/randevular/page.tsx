"use client";

import { useState, useMemo, useCallback } from "react";
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
import {
  MOCK_RANDEVULAR,
  RANDEVU_TIPI_LABELS,
  updateRandevular,
} from "@/mocks/randevular";
import { MOCK_GOREVLER, updateGorevler } from "@/mocks/gorevler";
import { MOCK_FIRMALAR } from "@/mocks/firmalar";
import type { MockRandevu, RandevuTipi } from "@/mocks/randevular";
import type { MockGorev } from "@/mocks/gorevler";
import type { ColumnDef, FilterConfig, FilterValues, RowAction } from "@/types/ui";
import type { OncelikSeviyesi } from "@/types/ui";
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
  planlandi: "Planlandı",
  tamamlandi: "Tamamlandı",
  iptal: "İptal",
  ertelendi: "Ertelendi",
};

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
    key: "firma",
    label: "Firma",
    type: "select",
    placeholder: "Tüm firmalar",
    options: Array.from(new Set(MOCK_RANDEVULAR.map((r) => r.firmaAdi))).map(
      (name) => ({ label: name, value: name })
    ),
  },
  {
    key: "tip",
    label: "Tip",
    type: "select",
    placeholder: "Tüm tipler",
    options: (Object.keys(RANDEVU_TIPI_LABELS) as RandevuTipi[]).map((t) => ({
      label: RANDEVU_TIPI_LABELS[t],
      value: t,
    })),
  },
];

const COLUMNS: ColumnDef<MockRandevu>[] = [
  { key: "tarih", header: "Tarih", sortable: true, render: (val) => formatDateTR(val as string) },
  { key: "firmaAdi", header: "Firma", sortable: true },
  {
    key: "gorusmeTipi",
    header: "Görüşme Tipi",
    render: (val) => <span>{RANDEVU_TIPI_LABELS[val as RandevuTipi] ?? String(val)}</span>,
  },
  { key: "katilimci", header: "Katılımcı" },
  {
    key: "durum",
    header: "Durum",
    sortable: true,
    render: (val) => <StatusBadge status={val as MockRandevu["durum"]} />,
  },
  {
    key: "sonuc",
    header: "Sonuç",
    render: (val) => (
      <span className={COL_TRUNCATED}>
        {(val as string) || "—"}
      </span>
    ),
  },
  {
    key: "sonrakiAksiyon",
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
  const [appointments, _setAppointments] = useState(MOCK_RANDEVULAR);
  function setAppointments(
    updater: typeof MOCK_RANDEVULAR | ((prev: typeof MOCK_RANDEVULAR) => typeof MOCK_RANDEVULAR)
  ) {
    _setAppointments((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      updateRandevular(next);
      return next;
    });
  }
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

  const handleSearch = useCallback((val: string) => setSearch(val), []);
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const appointment of appointments) {
      counts[appointment.durum] = (counts[appointment.durum] || 0) + 1;
    }
    return counts;
  }, [appointments]);

  const filteredData = useMemo(() => {
    return appointments.filter((r) => {
      if (search) {
        const q = search.toLowerCase();
        const match =
          r.firmaAdi.toLowerCase().includes(q) ||
          r.katilimci.toLowerCase().includes(q) ||
          r.sonuc.toLowerCase().includes(q);
        if (!match) return false;
      }
      if (filters.durum && r.durum !== filters.durum) return false;
      if (filters.firma && r.firmaAdi !== filters.firma) return false;
      if (filters.tip && r.gorusmeTipi !== filters.tip) return false;
      return true;
    });
  }, [appointments, search, filters]);

  const selectedRandevu = useMemo(
    () => appointments.find((r) => r.id === selectedId) ?? null,
    [appointments, selectedId]
  );

  const selectedRandevuTasks = useMemo(() => {
    if (!selectedRandevu) return [];
    return tasks.filter((task) => task.kaynakRef === selectedRandevu.id);
  }, [tasks, selectedRandevu]);

  const firmaOptions = MOCK_FIRMALAR.map((f) => ({ id: f.id, ad: f.firmaAdi }));

  const rowActions: RowAction<MockRandevu>[] = [
    {
      label: "Tamamla",
      onClick: (row) => setResultTarget({ open: true, randevuId: row.id }),
      isDisabled: (row) => row.durum === "tamamlandi" || row.durum === "iptal",
    },
    {
      label: "Görev Oluştur",
      onClick: (row) =>
        setTaskTarget({ open: true, firmaId: row.firmaId, randevuId: row.id }),
    },
  ];

  if (["goruntuleyici", "ik", "muhasebe"].includes(role)) {
    return (
      <>
        <PageHeader title="Randevular" subtitle="Görüşme takibi" />
        <EmptyState title="Erişim kısıtlı" description="Bu ekran erişiminizin dışındadır." size="page" />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Randevular"
        subtitle="Görüşme sonuçları ve takip aksiyonları"
        actions={[
          {
            label: "Yeni Randevu",
            onClick: () => setNewOpen(true),
            icon: <Plus size={16} />,
          },
        ]}
      />

      <div className="space-y-4">
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
            <SearchInput placeholder="Firma, katılımcı ara..." onChange={handleSearch} />
          </div>
          <FilterBar filters={FILTER_CONFIG} values={filters} onChange={setFilters} />
        </div>

        <DataTable<MockRandevu>
          columns={COLUMNS}
          data={filteredData}
          rowKey="id"
          onRowClick={(row) => setSelectedId(row.id)}
          rowActions={rowActions}
          emptyTitle="Randevu bulunamadı"
          emptyDescription="Arama veya filtre kriterlerinizi değiştirin."
        />
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
                <a href={`/firmalar/${selectedRandevu.firmaId}`} className={`${TEXT_LINK} hover:underline`}>
                  {selectedRandevu.firmaAdi}
                </a>
              </dd>
            </div>
            <div>
              <dt className={DL_LABEL}>Tarih / Saat</dt>
              <dd className={DL_VALUE}>{formatDateTR(selectedRandevu.tarih)} {selectedRandevu.saat}</dd>
            </div>
            <div>
              <dt className={DL_LABEL}>Görüşme Tipi</dt>
              <dd className={DL_VALUE}>{RANDEVU_TIPI_LABELS[selectedRandevu.gorusmeTipi]}</dd>
            </div>
            <div>
              <dt className={DL_LABEL}>Katılımcı</dt>
              <dd className={DL_VALUE}>{selectedRandevu.katilimci}</dd>
            </div>
            <div>
              <dt className={DL_LABEL}>Durum</dt>
              <dd className="mt-1"><StatusBadge status={selectedRandevu.durum} /></dd>
            </div>
            {selectedRandevu.sonuc && (
              <div className={`pt-2 border-t ${BORDER_SUBTLE}`}>
                <dt className={DL_LABEL}>Sonuç</dt>
                <dd className={DL_VALUE}>{selectedRandevu.sonuc}</dd>
              </div>
            )}
            {selectedRandevu.sonrakiAksiyon && (
              <div>
                <dt className={DL_LABEL}>Sonraki Aksiyon</dt>
                <dd className={DL_VALUE}>{selectedRandevu.sonrakiAksiyon}</dd>
              </div>
            )}
            {selectedRandevuTasks.length > 0 && (
              <div className={`pt-2 border-t ${BORDER_SUBTLE}`}>
                <dt className={DL_LABEL}>Bu Randevudan Açılan Görevler</dt>
                <dd className="mt-1 space-y-1.5">
                  {selectedRandevuTasks.map((task, idx) => (
                    <p key={`${task.baslik}-${idx}`} className={`${TYPE_BODY} ${TEXT_BODY}`}>
                      {task.baslik}
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
        onSubmit={({ firmaId, firmaAdi, tarih, saat, gorusmeTipi, katilimci }) => {
          setAppointments((prev) => [
            {
              id: `rnd-new-${Date.now()}`,
              tarih,
              saat,
              firmaId,
              firmaAdi,
              gorusmeTipi,
              katilimci: katilimci.trim() || "—",
              durum: "planlandi",
              sonuc: "",
              sonrakiAksiyon: "",
            },
            ...prev,
          ]);
        }}
      />
      <AppointmentResultModal
        open={resultTarget.open}
        onClose={() => setResultTarget({ open: false })}
        randevuId={resultTarget.randevuId}
        onComplete={({ randevuId, sonuc, sonrakiAksiyon }) => {
          if (!randevuId) return;
          setAppointments((prev) =>
            prev.map((appointment) =>
              appointment.id === randevuId
                ? {
                    ...appointment,
                    durum: "tamamlandi",
                    sonuc,
                    sonrakiAksiyon,
                  }
                : appointment
            )
          );
        }}
      />
      <NewTaskModal
        open={taskTarget.open}
        onClose={() => setTaskTarget({ open: false })}
        firmalar={firmaOptions}
        defaultKaynak="randevu"
        defaultFirmaId={taskTarget.firmaId}
        defaultKaynakRef={taskTarget.randevuId}
        onSubmit={({ baslik, firmaId, kaynak, kaynakRef, atananKisi, termin, oncelik }) => {
          const firma = MOCK_FIRMALAR.find((item) => item.id === firmaId);
          if (!firma) return;
          const newTask: MockGorev = {
            id: `g-local-${Date.now()}`,
            baslik,
            firmaId,
            firmaAdi: firma.firmaAdi,
            kaynak,
            kaynakRef,
            atananKisi: atananKisi.trim() || "Atanmadı",
            termin: termin || "—",
            oncelik: oncelik as OncelikSeviyesi,
            durum: "acik",
          };
          setTasks((prev) => [newTask, ...prev]);
        }}
      />
    </>
  );
}
