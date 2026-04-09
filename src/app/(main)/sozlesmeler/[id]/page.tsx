"use client";

import { use, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Pencil } from "lucide-react";
import { formatDateTR } from "@/lib/format-date";
import {
  EmptyState,
  PageHeader,
  ContractSummaryHeader,
  RenewalTrackingCard,
  StatusBadge,
} from "@/components/ui";
import { NewContractModal } from "@/components/modals";
import { useRole } from "@/context/RoleContext";
// Faz 2: Sözleşme Detay core read path cuts over to the contracts
// service layer. Sections that depended on excluded domains are
// removed in this slice — see the cutover report's "what was
// implemented" + "unresolved items" sections.
import { MOCK_FIRMALAR } from "@/mocks/firmalar";
import { createClient } from "@/lib/supabase/client";
import {
  getContractById,
  updateContractContent,
  updateContractStatus,
  updateContractRenewal,
  computeRemainingDays,
  CONTRACT_STATUSES,
  type ContractContentUpdateInput,
} from "@/lib/services/contracts";
import { getCompanyDisplayMapByIds } from "@/lib/services/companies";
import { listTasksByContractId } from "@/lib/services/tasks";
import { listAppointmentsByContractId } from "@/lib/services/appointments";
import { APPOINTMENT_TYPE_LABELS } from "@/lib/appointment-types";
import type { ContractRow, TaskRow, AppointmentRow } from "@/types/database.types";
import type { SozlesmeDurumu } from "@/types/ui";
import {
  SURFACE_PRIMARY,
  BORDER_DEFAULT,
  BORDER_SUBTLE,
  RADIUS_DEFAULT,
  RADIUS_SM,
  TYPE_BODY,
  TYPE_CARD_TITLE,
  TYPE_CAPTION,
  TEXT_PRIMARY,
  TEXT_BODY,
  TEXT_SECONDARY,
  TEXT_MUTED,
  BUTTON_BASE,
  BUTTON_SECONDARY,
} from "@/styles/tokens";

// Page-local helpers
const SECTION = `${SURFACE_PRIMARY} border ${BORDER_DEFAULT} ${RADIUS_DEFAULT} p-5`;
const SECTION_TITLE = `${TYPE_CARD_TITLE} ${TEXT_PRIMARY} mb-3`;

const STATUS_LABELS: Record<SozlesmeDurumu, string> = {
  taslak: "Taslak",
  imza_bekliyor: "İmza Bekliyor",
  aktif: "Aktif",
  suresi_doldu: "Süresi Doldu",
  feshedildi: "Feshedildi",
};

export default function SozlesmeDetayPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { role } = useRole();

  const supabase = useMemo(() => createClient(), []);
  const [contract, setContract] = useState<ContractRow | null>(null);
  const [firmaName, setFirmaName] = useState<string>("");
  const [firmaLegacyId, setFirmaLegacyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  // Faz 3: linked tasks and appointments for this contract
  const [linkedTasks, setLinkedTasks] = useState<TaskRow[]>([]);
  const [linkedAppointments, setLinkedAppointments] = useState<AppointmentRow[]>([]);

  const reload = useCallback(async () => {
    setLoadError(null);
    try {
      const row = await getContractById(supabase, id);
      setContract(row);
      if (row) {
        const display = await getCompanyDisplayMapByIds(supabase, [row.company_id]);
        setFirmaName(display.nameById[row.company_id] ?? "—");
        setFirmaLegacyId(display.legacyById[row.company_id] ?? null);
        // Faz 3: load linked tasks and appointments for this contract
        void listTasksByContractId(supabase, row.id)
          .then(setLinkedTasks).catch(() => setLinkedTasks([]));
        void listAppointmentsByContractId(supabase, row.id)
          .then(setLinkedAppointments).catch(() => setLinkedAppointments([]));
      } else {
        setFirmaName("");
        setFirmaLegacyId(null);
        setLinkedTasks([]);
        setLinkedAppointments([]);
      }
    } catch (err) {
      setContract(null);
      setLoadError(
        err instanceof Error ? err.message : "Sözleşme yüklenirken bir hata oluştu.",
      );
    } finally {
      setLoading(false);
    }
  }, [supabase, id]);

  useEffect(() => {
    setLoading(true);
    void reload();
  }, [reload]);

  const canEdit = role === "yonetici" || role === "partner";

  if (["goruntuleyici", "ik", "muhasebe"].includes(role)) {
    return (
      <>
        <PageHeader title="Sözleşme Detay" subtitle="Sözleşme yaşam döngüsü" />
        <EmptyState title="Erişim kısıtlı" description="Bu ekran erişiminizin dışındadır." size="page" />
      </>
    );
  }

  if (loading) {
    return (
      <div className="py-12">
        <p className={`${TYPE_BODY} ${TEXT_MUTED} text-center`}>Yükleniyor…</p>
      </div>
    );
  }

  if (!contract) {
    return (
      <div className="py-12">
        <EmptyState
          title="Sözleşme bulunamadı"
          description={loadError ?? "Bu ID ile eşleşen bir sözleşme bulunamadı veya erişim yetkiniz yok."}
          size="page"
          action={{ label: "Sözleşmelere Dön", onClick: () => router.push("/sozlesmeler") }}
        />
      </div>
    );
  }

  const kalanGun = computeRemainingDays(contract.end_date);

  async function handleStatusChange(next: SozlesmeDurumu) {
    if (!contract) return;
    if (next === contract.status) return;
    setActionError(null);
    try {
      await updateContractStatus(supabase, contract.id, next);
      await reload();
      router.refresh();
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Durum değiştirilemedi.",
      );
    }
  }

  async function handleRenewalToggle(
    field:
      | "renewalDiscussionOpened"
      | "renewalResponsibleSet"
      | "renewalTaskCreated",
    next: boolean,
  ) {
    if (!contract) return;
    setActionError(null);
    try {
      await updateContractRenewal(supabase, contract.id, { [field]: next });
      await reload();
      router.refresh();
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Yenileme takibi güncellenemedi.",
      );
    }
  }

  return (
    <>
      {/* Back navigation */}
      <button
        onClick={() => router.push("/sozlesmeler")}
        className={`flex items-center gap-1.5 ${TYPE_BODY} ${TEXT_SECONDARY} hover:text-slate-700 mb-4 transition-colors`}
      >
        <ArrowLeft size={16} />
        <span>Sözleşmeler</span>
      </button>

      <ContractSummaryHeader
        sozlesmeAdi={contract.name}
        durum={contract.status}
        firmaAdi={firmaName}
        firmaHref={firmaLegacyId ? `/firmalar/${firmaLegacyId}` : "#"}
        tur={contract.contract_type ?? "—"}
        baslangic={contract.start_date ? formatDateTR(contract.start_date.slice(0, 10)) : ""}
        bitis={contract.end_date ? formatDateTR(contract.end_date.slice(0, 10)) : ""}
        kalanGun={kalanGun}
        sorumlu={contract.responsible ?? "—"}
        tutar={contract.contract_value ?? undefined}
      />

      {/* Contract-owned write actions — yonetici / partner only */}
      {canEdit && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
          <div className="flex items-center gap-2">
            <label className={`${TYPE_CAPTION} ${TEXT_SECONDARY}`}>
              Durum:
            </label>
            <select
              value={contract.status}
              onChange={(e) => { void handleStatusChange(e.target.value as SozlesmeDurumu); }}
              className={`px-2 py-1 ${TYPE_CAPTION} border ${BORDER_DEFAULT} ${RADIUS_SM} focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white`}
            >
              {CONTRACT_STATUSES.map((s) => (
                <option key={s} value={s}>{STATUS_LABELS[s]}</option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={() => setEditOpen(true)}
            className={`${BUTTON_BASE} ${BUTTON_SECONDARY} inline-flex items-center gap-1.5`}
          >
            <Pencil size={14} />
            Sözleşmeyi Düzenle
          </button>
        </div>
      )}

      {actionError && (
        <p className={`${TYPE_CAPTION} text-red-600 mb-3`} role="alert" aria-live="polite">
          {actionError}
        </p>
      )}

      <div className="space-y-6">
        {/* Kritik Maddeler Özeti — real DB column */}
        <section className={SECTION}>
          <h2 className={SECTION_TITLE}>Kritik Maddeler Özeti</h2>
          {contract.critical_clauses.length === 0 ? (
            <EmptyState title="Kritik madde tanımlanmamış" size="card" />
          ) : (
            <ul className="space-y-2">
              {contract.critical_clauses.map((madde, idx) => (
                <li
                  key={idx}
                  className={`flex items-start gap-2 ${TYPE_BODY} ${TEXT_BODY}`}
                >
                  <span className="text-blue-500 mt-0.5 font-bold">•</span>
                  {madde}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Yenileme Takibi — bounded renewal-tracking truth (scope item 5) */}
        <section className="space-y-2">
          <RenewalTrackingCard
            bitisTarihi={
              contract.renewal_target_date
                ? formatDateTR(contract.renewal_target_date.slice(0, 10))
                : contract.end_date
                  ? formatDateTR(contract.end_date.slice(0, 10))
                  : "—"
            }
            gorusmeAcildiMi={contract.renewal_discussion_opened}
            sorumluVar={contract.renewal_responsible_set}
            gorevUretildi={contract.renewal_task_created}
          />
          {canEdit && (
            <div className={`${SURFACE_PRIMARY} border ${BORDER_DEFAULT} ${RADIUS_DEFAULT} p-4`}>
              <p className={`${TYPE_CAPTION} ${TEXT_SECONDARY} mb-2`}>
                Yenileme takibi sinyallerini güncelle
              </p>
              <div className="space-y-2">
                <label className={`flex items-center gap-2 ${TYPE_BODY} ${TEXT_BODY}`}>
                  <input
                    type="checkbox"
                    checked={contract.renewal_discussion_opened}
                    onChange={(e) => { void handleRenewalToggle("renewalDiscussionOpened", e.target.checked); }}
                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  Yenileme görüşmesi açıldı
                </label>
                <label className={`flex items-center gap-2 ${TYPE_BODY} ${TEXT_BODY}`}>
                  <input
                    type="checkbox"
                    checked={contract.renewal_responsible_set}
                    onChange={(e) => { void handleRenewalToggle("renewalResponsibleSet", e.target.checked); }}
                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  Sorumlu kişi atandı
                </label>
                <label className={`flex items-center gap-2 ${TYPE_BODY} ${TEXT_BODY}`}>
                  <input
                    type="checkbox"
                    checked={contract.renewal_task_created}
                    onChange={(e) => { void handleRenewalToggle("renewalTaskCreated", e.target.checked); }}
                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  İlgili görev üretildi
                </label>
              </div>
            </div>
          )}
        </section>

        {/* Kapsam ve Tutar — display-only secondary info */}
        {(contract.scope || contract.contract_value) && (
          <section className={SECTION}>
            <h2 className={SECTION_TITLE}>Kapsam ve Tutar</h2>
            <dl className="space-y-3">
              {contract.scope && (
                <div>
                  <dt className={`${TYPE_CAPTION} ${TEXT_SECONDARY}`}>Kapsam</dt>
                  <dd className={`${TYPE_BODY} ${TEXT_BODY} mt-0.5`}>{contract.scope}</dd>
                </div>
              )}
              {contract.contract_value && (
                <div className={`pt-2 border-t ${BORDER_SUBTLE}`}>
                  <dt className={`${TYPE_CAPTION} ${TEXT_SECONDARY}`}>Tutar</dt>
                  <dd className={`${TYPE_BODY} font-medium ${TEXT_PRIMARY} mt-0.5`}>
                    {contract.contract_value}
                  </dd>
                </div>
              )}
              {contract.last_action_label && (
                <div>
                  <dt className={`${TYPE_CAPTION} ${TEXT_SECONDARY}`}>Son İşlem</dt>
                  <dd className={`${TYPE_BODY} ${TEXT_BODY} mt-0.5`}>{contract.last_action_label}</dd>
                </div>
              )}
            </dl>
          </section>
        )}

        {/* Bağlı Görevler — Faz 3 real truth via tasks service */}
        <section className={SECTION}>
          <h2 className={SECTION_TITLE}>Bağlı Görevler</h2>
          {linkedTasks.length === 0 ? (
            <EmptyState title="Bağlı görev yok" size="card" />
          ) : (
            <div className="space-y-2">
              {linkedTasks.map((g) => (
                <a key={g.id} href="/gorevler" className={`flex items-center justify-between py-2 border-b ${BORDER_SUBTLE} last:border-0`}>
                  <span className={`${TYPE_BODY} ${TEXT_BODY}`}>{g.title}</span>
                  <StatusBadge status={g.status} />
                </a>
              ))}
            </div>
          )}
        </section>

        {/* Bağlı Randevular — Faz 3 real truth via appointments service */}
        <section className={SECTION}>
          <h2 className={SECTION_TITLE}>Bağlı Randevular</h2>
          {linkedAppointments.length === 0 ? (
            <EmptyState title="Bağlı randevu yok" size="card" />
          ) : (
            <div className="space-y-2">
              {linkedAppointments.map((r) => (
                <a key={r.id} href="/randevular" className={`flex items-center justify-between py-2 border-b ${BORDER_SUBTLE} last:border-0`}>
                  <div>
                    <span className={`${TYPE_BODY} ${TEXT_BODY}`}>{formatDateTR(r.meeting_date)} — {APPOINTMENT_TYPE_LABELS[r.meeting_type] ?? r.meeting_type}</span>
                    {r.result && (
                      <p className={`${TYPE_CAPTION} ${TEXT_MUTED} mt-0.5`}>{r.result}</p>
                    )}
                  </div>
                  <StatusBadge status={r.status} />
                </a>
              ))}
            </div>
          )}
        </section>
      </div>

      <NewContractModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        firmalar={MOCK_FIRMALAR.map((f) => ({ id: f.id, ad: f.firmaAdi }))}
        editData={contract}
        onSubmit={async (data) => {
          // Faz 2: persist via service layer. Status changes go through
          // updateContractStatus instead — this path only patches
          // content fields. Errors bubble inline; on resolve we refetch
          // and invalidate the client Router Cache so list/firma readers
          // see the new truth on their next visit.
          const patch: ContractContentUpdateInput = {
            name: data.sozlesmeAdi,
            contractType: data.tur || null,
            startDate: data.baslangic || null,
            endDate: data.bitis || null,
            scope: data.kapsam || null,
            contractValue: data.tutar || null,
            responsible: data.sorumlu || null,
          };
          await updateContractContent(supabase, contract.id, patch);
          await reload();
          router.refresh();
        }}
      />
    </>
  );
}
