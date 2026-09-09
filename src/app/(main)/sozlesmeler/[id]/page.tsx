"use client";

import { use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Pencil, Trash2 } from "lucide-react";
import { formatDateTR } from "@/lib/format-date";
import { formatTRY } from "@/lib/format-currency";
import {
  EmptyState,
  PageHeader,
  ContractSummaryHeader,
  StatusBadge,
} from "@/components/ui";
import { NewContractModal } from "@/components/modals";
import { useRole } from "@/context/RoleContext";
import { useAuth } from "@/context/AuthContext";
// Faz 2: Sözleşme Detay core read path cuts over to the contracts
// service layer. Sections that depended on excluded domains are
// removed in this slice — see the cutover report's "what was
// implemented" + "unresolved items" sections.
import { createClient } from "@/lib/supabase/client";
import { selectAllCompanies } from "@/lib/supabase/companies";
import type { CompanyRow } from "@/types/database.types";
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
import {
  getActiveContractDocument,
} from "@/lib/services/documents";
import PdfUploadPanel from "./PdfUploadPanel";
import RenewalTaskPanel from "./RenewalTaskPanel";
import ContractAppendices from "./ContractAppendices";
import PdfVersionHistory from "./PdfVersionHistory";
import { deleteContractAction } from "./actions";
import { APPOINTMENT_TYPE_LABELS } from "@/lib/appointment-types";
import type { ContractRow, TaskRow, AppointmentRow, DocumentRow } from "@/types/database.types";
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
  const { loading: authLoading, user } = useAuth();

  const supabase = useMemo(() => createClient(), []);
  const [contract, setContract] = useState<ContractRow | null>(null);
  const [firmaName, setFirmaName] = useState<string>("");
  const [firmaLegacyId, setFirmaLegacyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  // Contract hard-delete (yonetici-only). Errors surface on actionError.
  const [contractDeleting, setContractDeleting] = useState(false);
  // Faz 3: linked tasks and appointments for this contract
  const [linkedTasks, setLinkedTasks] = useState<TaskRow[]>([]);
  const [linkedAppointments, setLinkedAppointments] = useState<AppointmentRow[]>([]);
  // Hafta 2: single active contract PDF document (null when none yet).
  const [contractDoc, setContractDoc] = useState<DocumentRow | null>(null);
  const pdfReadGeneration = useRef(0);
  const [pdfLoading, setPdfLoading] = useState(true);
  const [pdfReadError, setPdfReadError] = useState<string | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);
  // Real companies for the edit-modal firma dropdown (partner-scoped
  // via RLS). Empty on error → honest empty picker.
  const [allCompanies, setAllCompanies] = useState<CompanyRow[]>([]);

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

  const firmaOptions = useMemo(
    () =>
      allCompanies.map((c) => ({
        id: c.legacy_mock_id ?? c.id,
        ad: c.name,
      })),
    [allCompanies],
  );

  const reload = useCallback(async () => {
    const pdfGeneration = ++pdfReadGeneration.current;
    setPdfLoading(true);setPdfReadError(null);setContractDoc(null);
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
        void getActiveContractDocument(supabase, row.id)
          .then(doc => {if(pdfGeneration===pdfReadGeneration.current)setContractDoc(doc);})
          .catch(() => {if(pdfGeneration===pdfReadGeneration.current)setPdfReadError("PDF bilgisi yüklenemedi. Belgenin yokluğu doğrulanamadı.");})
          .finally(() => {if(pdfGeneration===pdfReadGeneration.current)setPdfLoading(false);});
      } else {
        setFirmaName("");
        setFirmaLegacyId(null);
        setLinkedTasks([]);
        setLinkedAppointments([]);
        setContractDoc(null);
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

  // Auth not resolved yet — don't flash "Erişim kısıtlı" (role defaults to
  // "goruntuleyici" while AuthContext is loading). Wait, then decide.
  if (authLoading) {
    return (
      <>
        <PageHeader title="Sözleşme Detay" subtitle="Sözleşme yaşam döngüsü" />
        <EmptyState title="Yükleniyor…" description="Yetki bilgisi kontrol ediliyor." size="page" />
      </>
    );
  }

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

  async function handleContractDelete() {
    if (!contract) return;
    // Strong confirm — hard delete affects operational/commercial history.
    if (!window.confirm("Bu sözleşmeyi kalıcı olarak silmek üzeresiniz. Bu işlem geri alınamaz ve operasyonel/ticari geçmiş görünürlüğünü etkileyebilir.")) {
      return;
    }
    setActionError(null);
    setContractDeleting(true);
    try {
      const result = await deleteContractAction(contract.id);
      if (result.ok) {
        // Row gone (or already absent) — leave the detail page.
        router.push("/sozlesmeler");
        router.refresh();
      } else {
        setActionError(result.error);
        setContractDeleting(false);
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Sözleşme silinemedi.");
      setContractDeleting(false);
    }
  }

  async function handleRenewalToggle(
    field: "renewalDiscussionOpened",
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

  async function handlePdfDownload() {
    if (!contractDoc?.storage_path) return;
    setPdfError(null);
    const { data, error } = await supabase.storage
      .from("documents")
      .createSignedUrl(contractDoc.storage_path, 60);
    if (error || !data?.signedUrl) {
      setPdfError(`İndirme bağlantısı oluşturulamadı: ${error?.message ?? "bilinmeyen hata"}`);
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
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
        tutar={contract.contract_value ? formatTRY(contract.contract_value) : undefined}
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
        {/* One current PDF with version history. Upload/resume/cancel is manager-only;
            a uploaded file is not an attestation that the contract was signed. */}
        <section className={SECTION}>
          <h2 className={SECTION_TITLE}>Sözleşme PDF&apos;i</h2>
          {pdfLoading ? <p className={`${TYPE_BODY} ${TEXT_MUTED}`}>PDF bilgisi yükleniyor…</p> : pdfReadError ? <p role="alert" className="text-sm text-red-700">{pdfReadError}</p> : contractDoc ? (
            <div className="space-y-2">
              <dl className="space-y-1.5">
                <div className="flex items-baseline gap-2">
                  <dt className={`${TYPE_CAPTION} ${TEXT_SECONDARY} w-32 shrink-0`}>Dosya</dt>
                  <dd className={`${TYPE_BODY} ${TEXT_BODY}`}>{contractDoc.name}</dd>
                </div>
                <div className="flex items-baseline gap-2">
                  <dt className={`${TYPE_CAPTION} ${TEXT_SECONDARY} w-32 shrink-0`}>Yüklenme</dt>
                  <dd className={`${TYPE_BODY} ${TEXT_BODY}`}>
                    {formatDateTR(contractDoc.updated_at?.split("T")[0] ?? "")}
                  </dd>
                </div>
                <div className="flex items-baseline gap-2">
                  <dt className={`${TYPE_CAPTION} ${TEXT_SECONDARY} w-32 shrink-0`}>Yükleyen</dt>
                  <dd className={`${TYPE_BODY} ${TEXT_BODY}`}>{contractDoc.uploaded_by ?? "—"}</dd>
                </div>
              </dl>
              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => { void handlePdfDownload(); }}
                  className={`${BUTTON_BASE} ${BUTTON_SECONDARY}`}
                >
                  İndir
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <p className={`${TYPE_BODY} ${TEXT_MUTED}`}>PDF yüklenmemiş.</p>
            </div>
          )}
          {pdfError && (
            <p className={`${TYPE_CAPTION} text-red-600 mt-2`} role="alert" aria-live="polite">
              {pdfError}
            </p>
          )}
          <button type="button" disabled={pdfLoading} onClick={() => { void reload(); }} className="mt-3 text-sm text-blue-700 disabled:opacity-50">PDF kaydını yeniden yükle</button>
          {user && role === "yonetici" && !pdfLoading && !pdfReadError && typeof user.app_metadata?.active_tenant === "string" && <PdfUploadPanel key={`${user.id}:${user.app_metadata.active_tenant}:${id}`} actorId={user.id} tenantId={user.app_metadata.active_tenant} contractId={id} document={contractDoc} onPublished={() => { void reload(); router.refresh(); }} />}
          {user && <PdfVersionHistory key={`${user.id}:${user.app_metadata?.active_tenant}:${role}:${id}:${contractDoc?.revision}`} actorId={user.id} contractId={id} />}
        </section>

        {user && typeof user.app_metadata?.active_tenant === "string" && <ContractAppendices key={`${user.id}:${user.app_metadata.active_tenant}:${id}:${role}`} actorId={user.id} tenantId={user.app_metadata.active_tenant} contractId={id} canUpload={role === 'yonetici'} />}

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
          {user && <RenewalTaskPanel key={`${user.id}:${user.app_metadata?.active_tenant}:${role}:${contract.id}:${contract.updated_at}`} actorId={user.id} contractId={contract.id} onCreated={() => { void reload(); }} />}
          {canEdit && (
            <div className={`${SURFACE_PRIMARY} border ${BORDER_DEFAULT} ${RADIUS_DEFAULT} p-4`}>
              <p className={`${TYPE_CAPTION} ${TEXT_SECONDARY} mb-2`}>
                Görüşme beyanı
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
                    {formatTRY(contract.contract_value)}
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

        {/* Kalıcı silme — yonetici-only. Hard delete (Faz 1), güçlü
            onay zorunlu. contracts DELETE RLS de yonetici-only. */}
        {role === "yonetici" && (
          <section className={`${SURFACE_PRIMARY} border border-red-200 ${RADIUS_DEFAULT} p-5`}>
            <h2 className={`${TYPE_CARD_TITLE} text-red-700 mb-1`}>Sözleşmeyi Sil</h2>
            <p className={`${TYPE_CAPTION} ${TEXT_MUTED} mb-3`}>
              Bu işlem geri alınamaz. Sözleşme ve onunla ilişkili görünürlük kalıcı olarak kaldırılır.
            </p>
            <button
              type="button"
              onClick={() => { void handleContractDelete(); }}
              disabled={contractDeleting}
              className={`${BUTTON_BASE} inline-flex items-center gap-1.5 text-red-700 border border-red-200 hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed`}
            >
              <Trash2 size={14} />
              {contractDeleting ? "Siliniyor…" : "Sözleşmeyi Kalıcı Olarak Sil"}
            </button>
          </section>
        )}
      </div>

      <NewContractModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        firmalar={firmaOptions}
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
