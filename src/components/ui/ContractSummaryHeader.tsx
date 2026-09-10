import type { SozlesmeDurumu } from "@/types/ui";
import StatusBadge from "./StatusBadge";
import { clsx } from "clsx";
import {
  SURFACE_PRIMARY,
  BORDER_DEFAULT,
  RADIUS_DEFAULT,
  TYPE_PAGE_TITLE,
  TEXT_PRIMARY,
} from "@/styles/tokens";

interface ContractSummaryHeaderProps {
  sozlesmeAdi: string;
  durum: SozlesmeDurumu;
  firmaAdi: string;
  firmaHref: string;
  tur: string;
  baslangic: string;
  bitis: string;
  kalanGun: number | null;
  sorumlu: string;
  /** Optional — not a required structural field */
  tutar?: string;
}

export default function ContractSummaryHeader({
  sozlesmeAdi,
  durum,
  firmaAdi,
  firmaHref,
  tur,
  baslangic,
  bitis,
  kalanGun,
  sorumlu,
  tutar,
}: ContractSummaryHeaderProps) {
  return (
    <section aria-label="Sözleşme özeti" className={`${SURFACE_PRIMARY} border ${BORDER_DEFAULT} ${RADIUS_DEFAULT} p-5 sm:p-6 mb-5 shadow-sm`}>
      <p className="text-xs font-medium uppercase tracking-wider text-slate-500 mb-2">Sözleşme çalışma alanı</p>
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="min-w-0"><h1 className={`${TYPE_PAGE_TITLE} ${TEXT_PRIMARY} break-words`}>{sozlesmeAdi}</h1>
          <a href={firmaHref} className="mt-2 inline-block text-sm text-blue-700 hover:underline break-words">{firmaAdi} →</a>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0"><StatusBadge status={durum} size="md"/><span className="text-sm text-slate-500">{tur}</span></div>
      </div>
      <dl className="mt-6 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 border-t border-slate-100 pt-5">
        <div><dt className="text-xs text-slate-500">Sözleşme dönemi</dt><dd className="mt-1.5 text-sm font-medium text-slate-800">{baslangic || "—"} → {bitis || "—"}</dd></div>
        <div><dt className="text-xs text-slate-500">Bitişe kalan süre</dt><dd className={clsx("mt-1.5 text-sm font-semibold", kalanGun !== null && kalanGun <= 15 ? "text-red-700" : kalanGun !== null && kalanGun <= 30 ? "text-amber-700" : "text-slate-800")}>{kalanGun === null ? "Bitiş tarihi yok" : kalanGun < 0 ? `${Math.abs(kalanGun)} gün önce doldu` : kalanGun === 0 ? "Bugün doluyor" : `${kalanGun} gün`}</dd></div>
        <div className="min-w-0"><dt className="text-xs text-slate-500">Sözleşme sorumlu notu</dt><dd className="mt-1.5 text-sm text-slate-800 break-words">{sorumlu}</dd></div>
        {tutar && <div><dt className="text-xs text-slate-500">Sözleşme tutarı</dt><dd className="mt-1.5 text-sm font-semibold text-slate-800 break-words">{tutar}</dd></div>}
      </dl>
    </section>
  );
}
