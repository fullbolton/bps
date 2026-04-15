"use client";

/**
 * Kurumsal Kritik Tarihler — company-wide critical date/deadline visibility.
 * Not firm-scoped. Not document management. Not compliance software.
 * Broad visibility for all roles; create/edit is yonetici-only.
 *
 * Phase 4B cutover: reads/writes from real Supabase truth.
 * Status is DERIVED from deadline_date via `deriveDeadlineStatus` — never stored.
 */

import { useState, useMemo, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { formatDateTR } from "@/lib/format-date";
import { ArrowLeft, Plus, Pencil, Download } from "lucide-react";
import { PageHeader, EmptyState, ModalShell } from "@/components/ui";
import { useRole } from "@/context/RoleContext";
import { createClient } from "@/lib/supabase/client";
import {
  listAllCriticalDates,
  createCriticalDate,
  updateCriticalDateRecord,
} from "@/lib/services/critical-dates";
import {
  CRITICAL_DATE_TYPE_LABELS,
  CRITICAL_DATE_PRIORITY_LABELS,
  computeRemainingDays,
  deriveDeadlineStatus,
} from "@/lib/critical-date-types";
import type {
  CriticalDateType,
  CriticalDatePriority,
  CriticalDateStatus,
} from "@/lib/critical-date-types";
import type { CriticalDateRow } from "@/types/database.types";
import {
  SURFACE_PRIMARY,
  BORDER_DEFAULT,
  BORDER_SUBTLE,
  RADIUS_DEFAULT,
  RADIUS_SM,
  TYPE_BODY,
  TYPE_CAPTION,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
  TEXT_MUTED,
} from "@/styles/tokens";

export default function KurumsalTarihlerPage() {
  const router = useRouter();
  const { role } = useRole();
  const isYonetici = role === "yonetici";
  const supabase = createClient();

  // ---------------------------------------------------------------------------
  // Data loading
  // ---------------------------------------------------------------------------
  const [records, setRecords] = useState<CriticalDateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setLoadError(null);
      const data = await listAllCriticalDates(supabase);
      setRecords(data);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Veriler yuklenemedi.");
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    let active = true;
    reload().then(() => { if (!active) return; });
    return () => { active = false; };
  }, [reload]);

  // ---------------------------------------------------------------------------
  // Modal state
  // ---------------------------------------------------------------------------
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<CriticalDateRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Form fields
  const [formBaslik, setFormBaslik] = useState("");
  const [formTur, setFormTur] = useState<CriticalDateType | "">("");
  const [formBitis, setFormBitis] = useState("");
  const [formOncelik, setFormOncelik] = useState<CriticalDatePriority>("normal");
  const [formSorumlu, setFormSorumlu] = useState("");
  const [formNot, setFormNot] = useState("");

  function openCreate() {
    setEditTarget(null);
    setFormBaslik("");
    setFormTur("");
    setFormBitis("");
    setFormOncelik("normal");
    setFormSorumlu("");
    setFormNot("");
    setSaving(false);
    setSubmitError(null);
    setModalOpen(true);
  }

  function openEdit(belge: CriticalDateRow) {
    setEditTarget(belge);
    setFormBaslik(belge.title);
    setFormTur(belge.date_type);
    setFormBitis(belge.deadline_date);
    setFormOncelik(belge.priority);
    setFormSorumlu(belge.responsible ?? "");
    setFormNot(belge.note ?? "");
    setSaving(false);
    setSubmitError(null);
    setModalOpen(true);
  }

  async function handleSubmit() {
    if (!formBaslik.trim() || !formTur || !formBitis || saving) return;

    setSaving(true);
    setSubmitError(null);
    try {
      if (editTarget) {
        await updateCriticalDateRecord(supabase, editTarget.id, {
          title: formBaslik.trim(),
          dateType: formTur as CriticalDateType,
          deadlineDate: formBitis,
          priority: formOncelik,
          responsible: formSorumlu.trim() || undefined,
          note: formNot.trim() || undefined,
        });
      } else {
        await createCriticalDate(supabase, {
          title: formBaslik.trim(),
          dateType: formTur as CriticalDateType,
          deadlineDate: formBitis,
          priority: formOncelik,
          responsible: formSorumlu.trim() || undefined,
          note: formNot.trim() || undefined,
        });
      }
      setModalOpen(false);
      await reload();
      router.refresh();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Islem basarisiz.");
    } finally {
      setSaving(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Sorting — derive status then sort by urgency
  // ---------------------------------------------------------------------------
  const sorted = useMemo(() => {
    return [...records].sort((a, b) => {
      const durumOrder: Record<CriticalDateStatus, number> = { suresi_doldu: 0, suresi_yaklsiyor: 1, aktif: 2 };
      const oncelikOrder: Record<CriticalDatePriority, number> = { kritik: 0, yuksek: 1, normal: 2 };

      const aDurum = deriveDeadlineStatus(a.deadline_date);
      const bDurum = deriveDeadlineStatus(b.deadline_date);
      const dCmp = durumOrder[aDurum] - durumOrder[bDurum];
      if (dCmp !== 0) return dCmp;
      return oncelikOrder[a.priority] - oncelikOrder[b.priority];
    });
  }, [records]);

  const isFormValid = formBaslik.trim() && formTur && formBitis;

  // ---------------------------------------------------------------------------
  // PDF export — bounded snapshot. Reuses the shipped print infrastructure
  // from the Finansal Ozet slice (globals.css @media print, Layout.tsx
  // print:hidden chrome wrappers, PageHeader.tsx print:hidden actions).
  // Timestamp is rendered only in @media print and reflects the moment
  // the user clicked "PDF Olarak Indir".
  // ---------------------------------------------------------------------------
  const [exportTimestamp, setExportTimestamp] = useState<string>("");

  function handleExportPdf() {
    const now = new Date();
    const formatted = now.toLocaleString("tr-TR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    setExportTimestamp(formatted);
    window.requestAnimationFrame(() => {
      window.print();
    });
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  if (loading) {
    return (
      <>
        <PageHeader title="Kurumsal Kritik Tarihler" subtitle="Sirket geneli kritik belge ve son tarihleri" />
        <p className={`${TYPE_BODY} ${TEXT_SECONDARY} py-8 text-center`}>Yukleniyor...</p>
      </>
    );
  }

  if (loadError) {
    return (
      <>
        <PageHeader title="Kurumsal Kritik Tarihler" subtitle="Sirket geneli kritik belge ve son tarihleri" />
        <div className={`${RADIUS_DEFAULT} border border-red-200 bg-red-50 p-4 text-sm text-red-700`}>{loadError}</div>
      </>
    );
  }

  return (
    <>
      <button
        onClick={() => router.push("/dashboard")}
        className={`flex items-center gap-1.5 ${TYPE_BODY} ${TEXT_SECONDARY} hover:text-slate-700 mb-4 transition-colors print:hidden`}
      >
        <ArrowLeft size={16} />
        <span>Dashboard</span>
      </button>

      <PageHeader
        title="Kurumsal Kritik Tarihler"
        subtitle="Sirket geneli kritik belge ve son tarihleri"
        actions={isYonetici ? [
          {
            label: "PDF Olarak Indir",
            onClick: handleExportPdf,
            icon: <Download size={16} />,
            variant: "secondary" as const,
          },
          { label: "Yeni Kayit", onClick: openCreate, icon: <Plus size={16} /> },
        ] : []}
      />

      {/* Print-only export timestamp — hidden on screen, visible in PDF.
          Empty until the user clicks "PDF Olarak Indir", which sets the
          timestamp then triggers window.print(). */}
      {exportTimestamp && (
        <div className={`hidden print:block mb-4 ${TYPE_CAPTION} ${TEXT_MUTED}`}>
          Disa aktarildi: {exportTimestamp}
        </div>
      )}

      <div className="space-y-4">
        {sorted.length === 0 ? (
          <EmptyState title="Kayit yok" description="Kurumsal kritik tarih kaydi bulunmuyor." size="page" />
        ) : (
          <div className={`${SURFACE_PRIMARY} border ${BORDER_DEFAULT} ${RADIUS_DEFAULT} overflow-hidden`}>
            {sorted.map((b, idx) => {
              const kalan = computeRemainingDays(b.deadline_date);
              const durum = deriveDeadlineStatus(b.deadline_date);
              return (
                <div key={b.id} className={`p-4 ${idx < sorted.length - 1 ? `border-b ${BORDER_SUBTLE}` : ""}`}>
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className={`${TYPE_BODY} font-medium ${TEXT_PRIMARY}`}>{b.title}</p>
                        {durum === "suresi_doldu" && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded-full bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20">
                            Suresi Doldu
                          </span>
                        )}
                        {durum === "suresi_yaklsiyor" && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded-full bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20">
                            Yaklaiyor
                          </span>
                        )}
                        {durum === "aktif" && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded-full bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/20">
                            Aktif
                          </span>
                        )}
                        {b.priority === "kritik" && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded-full bg-red-50 text-red-600 ring-1 ring-inset ring-red-500/20">
                            Kritik
                          </span>
                        )}
                        {b.priority === "yuksek" && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded-full bg-amber-50 text-amber-600 ring-1 ring-inset ring-amber-500/20">
                            Yuksek
                          </span>
                        )}
                      </div>
                      <p className={`${TYPE_CAPTION} ${TEXT_SECONDARY} mt-1`}>
                        {CRITICAL_DATE_TYPE_LABELS[b.date_type]} {"·"} {b.responsible ?? "Atanmadi"} {"·"} Son tarih: {formatDateTR(b.deadline_date)}
                        {kalan < 0 && <span className="text-red-600 font-medium ml-1">({Math.abs(kalan)} gun gecikmis)</span>}
                        {kalan >= 0 && kalan <= 30 && <span className="text-amber-600 font-medium ml-1">({kalan} gun kaldi)</span>}
                      </p>
                      {b.note && (
                        <p className={`${TYPE_CAPTION} ${TEXT_MUTED} mt-1`}>{b.note}</p>
                      )}
                    </div>
                    {isYonetici && (
                      <button
                        onClick={() => openEdit(b)}
                        className={`flex-shrink-0 ml-3 p-1.5 ${TEXT_MUTED} hover:text-slate-600 hover:bg-slate-100 ${RADIUS_SM} transition-colors print:hidden`}
                      >
                        <Pencil size={13} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create/Edit Modal — yonetici-only */}
      <ModalShell
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editTarget ? "Kaydi Duzenle" : "Yeni Kritik Tarih"}
        footer={
          <>
            <button onClick={() => setModalOpen(false)} disabled={saving} className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 disabled:opacity-40">
              Iptal
            </button>
            <button onClick={handleSubmit} disabled={!isFormValid || saving} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed">
              {saving ? "Kaydediliyor..." : editTarget ? "Guncelle" : "Ekle"}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          {submitError && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{submitError}</div>
          )}
          <div>
            <label className={`block ${TYPE_CAPTION} font-medium ${TEXT_SECONDARY} mb-1`}>Baslik <span className="text-red-500">*</span></label>
            <input type="text" value={formBaslik} onChange={(e) => setFormBaslik(e.target.value)} disabled={saving} placeholder="or. ISG Yetki Belgesi" className={`w-full px-3 py-2 ${TYPE_BODY} border ${BORDER_DEFAULT} ${RADIUS_SM} focus:outline-none focus:ring-2 focus:ring-blue-500`} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={`block ${TYPE_CAPTION} font-medium ${TEXT_SECONDARY} mb-1`}>Tur <span className="text-red-500">*</span></label>
              <select value={formTur} onChange={(e) => setFormTur(e.target.value as CriticalDateType)} disabled={saving} className={`w-full px-3 py-2 ${TYPE_BODY} border ${BORDER_DEFAULT} ${RADIUS_SM} focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white`}>
                <option value="">Secin</option>
                {(Object.entries(CRITICAL_DATE_TYPE_LABELS) as [CriticalDateType, string][]).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={`block ${TYPE_CAPTION} font-medium ${TEXT_SECONDARY} mb-1`}>Son Tarih <span className="text-red-500">*</span></label>
              <input type="date" value={formBitis} onChange={(e) => setFormBitis(e.target.value)} disabled={saving} className={`w-full px-3 py-2 ${TYPE_BODY} border ${BORDER_DEFAULT} ${RADIUS_SM} focus:outline-none focus:ring-2 focus:ring-blue-500`} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={`block ${TYPE_CAPTION} font-medium ${TEXT_SECONDARY} mb-1`}>Oncelik</label>
              <select value={formOncelik} onChange={(e) => setFormOncelik(e.target.value as CriticalDatePriority)} disabled={saving} className={`w-full px-3 py-2 ${TYPE_BODY} border ${BORDER_DEFAULT} ${RADIUS_SM} focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white`}>
                {(Object.entries(CRITICAL_DATE_PRIORITY_LABELS) as [CriticalDatePriority, string][]).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={`block ${TYPE_CAPTION} font-medium ${TEXT_SECONDARY} mb-1`}>Sorumlu</label>
              <input type="text" value={formSorumlu} onChange={(e) => setFormSorumlu(e.target.value)} disabled={saving} placeholder="Isim" className={`w-full px-3 py-2 ${TYPE_BODY} border ${BORDER_DEFAULT} ${RADIUS_SM} focus:outline-none focus:ring-2 focus:ring-blue-500`} />
            </div>
          </div>
          <div>
            <label className={`block ${TYPE_CAPTION} font-medium ${TEXT_SECONDARY} mb-1`}>Kisa Not</label>
            <input type="text" value={formNot} onChange={(e) => setFormNot(e.target.value)} disabled={saving} placeholder="Opsiyonel kisa aciklama" className={`w-full px-3 py-2 ${TYPE_BODY} border ${BORDER_DEFAULT} ${RADIUS_SM} focus:outline-none focus:ring-2 focus:ring-blue-500`} />
          </div>
        </div>
      </ModalShell>
    </>
  );
}
