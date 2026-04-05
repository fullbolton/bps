"use client";

/**
 * Kurumsal Kritik Tarihler — company-wide critical date/deadline visibility.
 * Not firm-scoped. Not document management. Not compliance software.
 * Broad visibility for all roles; create/edit is yönetici-only.
 */

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { formatDateTR } from "@/lib/format-date";
import { ArrowLeft, Plus, Pencil, AlertTriangle } from "lucide-react";
import { PageHeader, StatusBadge, EmptyState } from "@/components/ui";
import { ModalShell } from "@/components/ui";
import { useRole } from "@/context/RoleContext";
import {
  MOCK_KURUMSAL_BELGELER,
  updateKurumsalBelgeler,
  BELGE_TURU_LABELS,
  ONCELIK_LABELS,
  kalanGunHesapla,
} from "@/mocks/kurumsal-belgeler";
import type {
  MockKurumsalBelge,
  KurumsalBelgeTuru,
  KurumsalOncelik,
  KurumsalBelgeDurumu,
} from "@/mocks/kurumsal-belgeler";
import {
  SURFACE_PRIMARY,
  SURFACE_HEADER,
  BORDER_DEFAULT,
  BORDER_SUBTLE,
  RADIUS_DEFAULT,
  RADIUS_SM,
  TYPE_BODY,
  TYPE_CAPTION,
  TYPE_CARD_TITLE,
  TEXT_PRIMARY,
  TEXT_BODY,
  TEXT_SECONDARY,
  TEXT_MUTED,
  TEXT_LINK,
  BUTTON_PRIMARY,
} from "@/styles/tokens";

const DURUM_LABELS: Record<KurumsalBelgeDurumu, string> = {
  aktif: "Aktif",
  suresi_yaklsiyor: "Yaklaşıyor",
  suresi_doldu: "Süresi Doldu",
};

export default function KurumsalTarihlerPage() {
  const router = useRouter();
  const { role } = useRole();
  const isYonetici = role === "yonetici";

  const [belgeler, _setBelgeler] = useState<MockKurumsalBelge[]>(MOCK_KURUMSAL_BELGELER);
  // Wrap setter to sync shared module state for Dashboard consistency
  function setBelgeler(updater: MockKurumsalBelge[] | ((prev: MockKurumsalBelge[]) => MockKurumsalBelge[])) {
    _setBelgeler((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      updateKurumsalBelgeler(next);
      return next;
    });
  }
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<MockKurumsalBelge | null>(null);

  // Modal form state
  const [formBaslik, setFormBaslik] = useState("");
  const [formTur, setFormTur] = useState<KurumsalBelgeTuru | "">("");
  const [formBitis, setFormBitis] = useState("");
  const [formOncelik, setFormOncelik] = useState<KurumsalOncelik>("normal");
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
    setModalOpen(true);
  }

  function openEdit(belge: MockKurumsalBelge) {
    setEditTarget(belge);
    setFormBaslik(belge.baslik);
    setFormTur(belge.tur);
    setFormBitis(belge.bitisTarihi);
    setFormOncelik(belge.oncelik);
    setFormSorumlu(belge.sorumlu);
    setFormNot(belge.kisaNot ?? "");
    setModalOpen(true);
  }

  function handleSubmit() {
    if (!formBaslik.trim() || !formTur || !formBitis) return;

    const kalanGun = kalanGunHesapla(formBitis);
    const durum: KurumsalBelgeDurumu = kalanGun < 0 ? "suresi_doldu" : kalanGun <= 30 ? "suresi_yaklsiyor" : "aktif";

    if (editTarget) {
      setBelgeler((prev) =>
        prev.map((b) =>
          b.id === editTarget.id
            ? { ...b, baslik: formBaslik.trim(), tur: formTur as KurumsalBelgeTuru, bitisTarihi: formBitis, durum, oncelik: formOncelik, sorumlu: formSorumlu.trim(), kisaNot: formNot.trim() || undefined }
            : b
        )
      );
      console.log("[Kurumsal belge güncellendi]", editTarget.id);
    } else {
      const newBelge: MockKurumsalBelge = {
        id: `kb-new-${Date.now()}`,
        baslik: formBaslik.trim(),
        tur: formTur as KurumsalBelgeTuru,
        bitisTarihi: formBitis,
        durum,
        sorumlu: formSorumlu.trim() || "Atanmadı",
        oncelik: formOncelik,
        kisaNot: formNot.trim() || undefined,
      };
      setBelgeler((prev) => [newBelge, ...prev]);
      console.log("[Kurumsal belge oluşturuldu]", newBelge);
    }
    setModalOpen(false);
  }

  const sorted = useMemo(() =>
    [...belgeler].sort((a, b) => {
      const durumOrder: Record<KurumsalBelgeDurumu, number> = { suresi_doldu: 0, suresi_yaklsiyor: 1, aktif: 2 };
      const oncelikOrder: Record<KurumsalOncelik, number> = { kritik: 0, yuksek: 1, normal: 2 };
      const dCmp = durumOrder[a.durum] - durumOrder[b.durum];
      if (dCmp !== 0) return dCmp;
      return oncelikOrder[a.oncelik] - oncelikOrder[b.oncelik];
    }),
    [belgeler]
  );

  const isFormValid = formBaslik.trim() && formTur && formBitis;

  return (
    <>
      <button
        onClick={() => router.push("/dashboard")}
        className={`flex items-center gap-1.5 ${TYPE_BODY} ${TEXT_SECONDARY} hover:text-slate-700 mb-4 transition-colors`}
      >
        <ArrowLeft size={16} />
        <span>Dashboard</span>
      </button>

      <PageHeader
        title="Kurumsal Kritik Tarihler"
        subtitle="Şirket geneli kritik belge ve son tarihleri"
        actions={isYonetici ? [
          { label: "Yeni Kayıt", onClick: openCreate, icon: <Plus size={16} /> },
        ] : []}
      />

      <div className="space-y-4">
        {sorted.length === 0 ? (
          <EmptyState title="Kayıt yok" description="Kurumsal kritik tarih kaydı bulunmuyor." size="page" />
        ) : (
          <div className={`${SURFACE_PRIMARY} border ${BORDER_DEFAULT} ${RADIUS_DEFAULT} overflow-hidden`}>
            {sorted.map((b, idx) => {
              const kalan = kalanGunHesapla(b.bitisTarihi);
              return (
                <div key={b.id} className={`p-4 ${idx < sorted.length - 1 ? `border-b ${BORDER_SUBTLE}` : ""}`}>
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className={`${TYPE_BODY} font-medium ${TEXT_PRIMARY}`}>{b.baslik}</p>
                        {b.durum === "suresi_doldu" && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded-full bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20">
                            Süresi Doldu
                          </span>
                        )}
                        {b.durum === "suresi_yaklsiyor" && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded-full bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20">
                            Yaklaşıyor
                          </span>
                        )}
                        {b.durum === "aktif" && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded-full bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/20">
                            Aktif
                          </span>
                        )}
                        {b.oncelik === "kritik" && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded-full bg-red-50 text-red-600 ring-1 ring-inset ring-red-500/20">
                            Kritik
                          </span>
                        )}
                        {b.oncelik === "yuksek" && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded-full bg-amber-50 text-amber-600 ring-1 ring-inset ring-amber-500/20">
                            Yüksek
                          </span>
                        )}
                      </div>
                      <p className={`${TYPE_CAPTION} ${TEXT_SECONDARY} mt-1`}>
                        {BELGE_TURU_LABELS[b.tur]} · {b.sorumlu} · Son tarih: {formatDateTR(b.bitisTarihi)}
                        {kalan < 0 && <span className="text-red-600 font-medium ml-1">({Math.abs(kalan)} gün gecikmiş)</span>}
                        {kalan >= 0 && kalan <= 30 && <span className="text-amber-600 font-medium ml-1">({kalan} gün kaldı)</span>}
                      </p>
                      {b.kisaNot && (
                        <p className={`${TYPE_CAPTION} ${TEXT_MUTED} mt-1`}>{b.kisaNot}</p>
                      )}
                    </div>
                    {isYonetici && (
                      <button
                        onClick={() => openEdit(b)}
                        className={`flex-shrink-0 ml-3 p-1.5 ${TEXT_MUTED} hover:text-slate-600 hover:bg-slate-100 ${RADIUS_SM} transition-colors`}
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

      {/* Create/Edit Modal — yönetici-only */}
      <ModalShell
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editTarget ? "Kaydı Düzenle" : "Yeni Kritik Tarih"}
        footer={
          <>
            <button onClick={() => setModalOpen(false)} className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50">
              İptal
            </button>
            <button onClick={handleSubmit} disabled={!isFormValid} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed">
              {editTarget ? "Güncelle" : "Ekle"}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className={`block ${TYPE_CAPTION} font-medium ${TEXT_SECONDARY} mb-1`}>Başlık <span className="text-red-500">*</span></label>
            <input type="text" value={formBaslik} onChange={(e) => setFormBaslik(e.target.value)} placeholder="ör. İSG Yetki Belgesi" className={`w-full px-3 py-2 ${TYPE_BODY} border ${BORDER_DEFAULT} ${RADIUS_SM} focus:outline-none focus:ring-2 focus:ring-blue-500`} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={`block ${TYPE_CAPTION} font-medium ${TEXT_SECONDARY} mb-1`}>Tür <span className="text-red-500">*</span></label>
              <select value={formTur} onChange={(e) => setFormTur(e.target.value as KurumsalBelgeTuru)} className={`w-full px-3 py-2 ${TYPE_BODY} border ${BORDER_DEFAULT} ${RADIUS_SM} focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white`}>
                <option value="">Seçin</option>
                {(Object.entries(BELGE_TURU_LABELS) as [KurumsalBelgeTuru, string][]).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={`block ${TYPE_CAPTION} font-medium ${TEXT_SECONDARY} mb-1`}>Son Tarih <span className="text-red-500">*</span></label>
              <input type="date" value={formBitis} onChange={(e) => setFormBitis(e.target.value)} className={`w-full px-3 py-2 ${TYPE_BODY} border ${BORDER_DEFAULT} ${RADIUS_SM} focus:outline-none focus:ring-2 focus:ring-blue-500`} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={`block ${TYPE_CAPTION} font-medium ${TEXT_SECONDARY} mb-1`}>Öncelik</label>
              <select value={formOncelik} onChange={(e) => setFormOncelik(e.target.value as KurumsalOncelik)} className={`w-full px-3 py-2 ${TYPE_BODY} border ${BORDER_DEFAULT} ${RADIUS_SM} focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white`}>
                {(Object.entries(ONCELIK_LABELS) as [KurumsalOncelik, string][]).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={`block ${TYPE_CAPTION} font-medium ${TEXT_SECONDARY} mb-1`}>Sorumlu</label>
              <input type="text" value={formSorumlu} onChange={(e) => setFormSorumlu(e.target.value)} placeholder="İsim" className={`w-full px-3 py-2 ${TYPE_BODY} border ${BORDER_DEFAULT} ${RADIUS_SM} focus:outline-none focus:ring-2 focus:ring-blue-500`} />
            </div>
          </div>
          <div>
            <label className={`block ${TYPE_CAPTION} font-medium ${TEXT_SECONDARY} mb-1`}>Kısa Not</label>
            <input type="text" value={formNot} onChange={(e) => setFormNot(e.target.value)} placeholder="Opsiyonel kısa açıklama" className={`w-full px-3 py-2 ${TYPE_BODY} border ${BORDER_DEFAULT} ${RADIUS_SM} focus:outline-none focus:ring-2 focus:ring-blue-500`} />
          </div>
        </div>
      </ModalShell>
    </>
  );
}
