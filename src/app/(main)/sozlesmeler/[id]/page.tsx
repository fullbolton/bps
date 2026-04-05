"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import { formatDateTR } from "@/lib/format-date";
import { ArrowLeft, FileText, FolderOpen, CheckCircle2, Circle } from "lucide-react";
import {
  EmptyState,
  PageHeader,
  ContractSummaryHeader,
  RenewalTrackingCard,
  StatusBadge,
} from "@/components/ui";
import { useRole } from "@/context/RoleContext";
import { MOCK_SOZLESME_DETAY, MOCK_SOZLESMELER } from "@/mocks/sozlesmeler";
import { MOCK_GOREVLER } from "@/mocks/gorevler";
import { MOCK_RANDEVULAR } from "@/mocks/randevular";
import {
  SURFACE_PRIMARY,
  BORDER_DEFAULT,
  BORDER_SUBTLE,
  RADIUS_DEFAULT,
  TYPE_BODY,
  TYPE_CARD_TITLE,
  TYPE_CAPTION,
  TEXT_PRIMARY,
  TEXT_BODY,
  TEXT_SECONDARY,
  TEXT_MUTED,
  TEXT_DISABLED,
} from "@/styles/tokens";

// Page-local helpers
const SECTION = `${SURFACE_PRIMARY} border ${BORDER_DEFAULT} ${RADIUS_DEFAULT} p-5`;
const SECTION_TITLE = `${TYPE_CARD_TITLE} ${TEXT_PRIMARY} mb-3`;
const SECTION_TITLE_ICON = `${TYPE_CARD_TITLE} ${TEXT_PRIMARY} mb-3 flex items-center gap-1.5`;
const LIST_DIVIDER = `border-b ${BORDER_SUBTLE} last:border-0`;

export default function SozlesmeDetayPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { role } = useRole();

  const detay = MOCK_SOZLESME_DETAY[id];
  const base = detay ?? MOCK_SOZLESMELER.find((s) => s.id === id);
  const liveBagliGorevler = detay
    ? (() => {
        const linked = new Map<string, { id: string; baslik: string; durum: string }>();

        for (const gorev of detay.bagliGorevler) {
          const current = MOCK_GOREVLER.find((item) => item.id === gorev.id);
          linked.set(
            gorev.id,
            current
              ? { id: current.id, baslik: current.baslik, durum: current.durum }
              : gorev
          );
        }

        for (const gorev of MOCK_GOREVLER.filter((item) => item.kaynak === "sozlesme" && item.kaynakRef === id)) {
          if (!linked.has(gorev.id)) {
            linked.set(gorev.id, {
              id: gorev.id,
              baslik: gorev.baslik,
              durum: gorev.durum,
            });
          }
        }

        return Array.from(linked.values());
      })()
    : [];
  const liveBagliRandevular = detay
    ? detay.bagliRandevular.map((randevu) => {
        const current = MOCK_RANDEVULAR.find((item) => item.id === randevu.id);
        return current
          ? {
              id: current.id,
              tarih: current.tarih,
              durum: current.durum,
              sonuc: current.sonuc || undefined,
            }
          : randevu;
      })
    : [];

  if (!base) {
    return (
      <div className="py-12">
        <EmptyState
          title="Sözleşme bulunamadı"
          description="Bu ID ile eşleşen bir sözleşme bulunamadı."
          size="page"
          action={{ label: "Sözleşmelere Dön", onClick: () => router.push("/sozlesmeler") }}
        />
      </div>
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
        sozlesmeAdi={base.sozlesmeAdi}
        durum={base.durum}
        firmaAdi={base.firmaAdi}
        firmaHref={`/firmalar/${base.firmaId}`}
        tur={base.tur}
        baslangic={base.baslangic}
        bitis={base.bitis}
        kalanGun={base.kalanGun}
        sorumlu={base.sorumlu}
        tutar={base.tutar !== "—" ? base.tutar : undefined}
      />

      {/* Section-based detail composition — not a tab system */}
      {detay ? (
        <div className="space-y-6">
          {/* 0. Ticari Hazırlık — contract preparation history (Batch 6) */}
          {detay.ticariHazirlik && (
            <section className={SECTION}>
              <h2 className={SECTION_TITLE}>Ticari Hazırlık</h2>
              <div className="space-y-3">
                {detay.ticariHazirlik.adimlar.map((adim, idx) => (
                  <div key={idx} className="flex items-start gap-3">
                    {adim.tamamlandi ? (
                      <CheckCircle2 size={16} className="text-green-500 mt-0.5 flex-shrink-0" />
                    ) : (
                      <Circle size={16} className={`${TEXT_DISABLED} mt-0.5 flex-shrink-0`} />
                    )}
                    <div className="min-w-0">
                      <p className={`${TYPE_BODY} ${adim.tamamlandi ? TEXT_BODY : TEXT_MUTED}`}>
                        {adim.adim}
                      </p>
                      <div className={`flex items-center gap-2 mt-0.5 ${TYPE_CAPTION} ${TEXT_MUTED}`}>
                        <span>{formatDateTR(adim.tarih)}</span>
                        <span>·</span>
                        <span>{adim.user}</span>
                      </div>
                      {adim.not && (
                        <p className={`${TYPE_CAPTION} ${TEXT_SECONDARY} mt-0.5`}>{adim.not}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              {detay.ticariHazirlik.imzaliPdfNotu && (
                <p className={`${TYPE_CAPTION} ${TEXT_SECONDARY} mt-4 pt-3 border-t ${BORDER_SUBTLE}`}>
                  {detay.ticariHazirlik.imzaliPdfNotu}
                </p>
              )}
            </section>
          )}

          {/* 1. Dosyalar & Versiyonlar */}
          <section className={SECTION}>
            <h2 className={SECTION_TITLE_ICON}>
              <FolderOpen size={14} className={TEXT_MUTED} />
              Dosyalar & Versiyonlar
            </h2>
            {detay.dosyalar.length === 0 ? (
              <EmptyState title="Dosya yok" size="card" />
            ) : (
              <div className="space-y-2">
                {detay.dosyalar.map((d, idx) => (
                  <div
                    key={idx}
                    className={`flex items-center justify-between py-2 ${LIST_DIVIDER}`}
                  >
                    <div className="flex items-center gap-2">
                      <FileText size={14} className={TEXT_MUTED} />
                      <span className={`${TYPE_BODY} ${TEXT_BODY}`}>{d.ad}</span>
                    </div>
                    <div className={`flex items-center gap-3 ${TYPE_CAPTION} ${TEXT_MUTED}`}>
                      <span className={`font-medium ${TEXT_SECONDARY}`}>{d.versiyon}</span>
                      <span>{formatDateTR(d.tarih)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* 2. Kritik Maddeler Özeti */}
          <section className={SECTION}>
            <h2 className={SECTION_TITLE}>
              Kritik Maddeler Özeti
            </h2>
            {detay.kritikMaddeler.length === 0 ? (
              <EmptyState title="Kritik madde tanımlanmamış" size="card" />
            ) : (
              <ul className="space-y-2">
                {detay.kritikMaddeler.map((madde, idx) => (
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

          {/* 3. Yenileme Takibi */}
          <section>
            <RenewalTrackingCard
              bitisTarihi={detay.yenileme.bpisTarihi}
              gorusmeAcildiMi={detay.yenileme.gorusmeAcildiMi}
              sorumluVar={detay.yenileme.sorumluVar}
              gorevUretildi={detay.yenileme.gorevUretildi}
            />
          </section>

          {/* 4. Bağlı Görevler */}
          <section className={SECTION}>
            <h2 className={SECTION_TITLE}>
              Bağlı Görevler
            </h2>
            {liveBagliGorevler.length === 0 ? (
              <EmptyState title="Bağlı görev yok" size="card" />
            ) : (
              <div className="space-y-2">
                {liveBagliGorevler.map((g) => (
                  <a
                    key={g.id}
                    href="/gorevler"
                    className={`flex items-center justify-between py-2 ${LIST_DIVIDER}`}
                  >
                    <span className={`${TYPE_BODY} ${TEXT_BODY}`}>{g.baslik}</span>
                    <StatusBadge status={g.durum as "acik" | "devam_ediyor" | "gecikti" | "tamamlandi" | "iptal"} />
                  </a>
                ))}
              </div>
            )}
          </section>

          {/* 5. Bağlı Randevular */}
          <section className={SECTION}>
            <h2 className={SECTION_TITLE}>
              Bağlı Randevular
            </h2>
            {liveBagliRandevular.length === 0 ? (
              <EmptyState title="Bağlı randevu yok" size="card" />
            ) : (
              <div className="space-y-2">
                {liveBagliRandevular.map((r) => (
                  <a
                    key={r.id}
                    href="/randevular"
                    className={`flex items-center justify-between py-2 ${LIST_DIVIDER}`}
                  >
                    <div>
                      <span className={`${TYPE_BODY} ${TEXT_BODY}`}>{formatDateTR(r.tarih)}</span>
                      {r.sonuc && (
                        <p className={`${TYPE_CAPTION} ${TEXT_MUTED} mt-0.5`}>{r.sonuc}</p>
                      )}
                    </div>
                    <StatusBadge status={r.durum as "planlandi" | "tamamlandi" | "iptal" | "ertelendi"} />
                  </a>
                ))}
              </div>
            )}
          </section>

          {/* 6. İç Notlar */}
          <section className={SECTION}>
            <h2 className={SECTION_TITLE}>
              İç Notlar
            </h2>
            {detay.icNotlar.length === 0 ? (
              <EmptyState title="Henüz not yok" size="card" />
            ) : (
              <div className="space-y-3">
                {detay.icNotlar.map((not, idx) => (
                  <div
                    key={idx}
                    className={`py-2.5 ${LIST_DIVIDER}`}
                  >
                    <p className={`${TYPE_BODY} ${TEXT_BODY}`}>{not.icerik}</p>
                    <div className={`flex items-center gap-2 mt-1 ${TYPE_CAPTION} ${TEXT_MUTED}`}>
                      <span>{formatDateTR(not.tarih)}</span>
                      <span>·</span>
                      <span>{not.user}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      ) : (
        /* Fallback for contracts without extended detail data */
        <div className={SECTION}>
          <p className={`${TYPE_BODY} ${TEXT_SECONDARY}`}>
            Kapsam: {base.kapsam}
          </p>
          <p className={`${TYPE_BODY} ${TEXT_MUTED} mt-3`}>
            Bu sözleşme için detay verisi henüz tanımlanmamış.
          </p>
        </div>
      )}
    </>
  );
}
