import type { FirmaDurumu, RiskSeviyesi } from "@/types/ui";
import type { ReactNode } from "react";
import StatusBadge from "./StatusBadge";
import { Building2, MapPin } from "lucide-react";
import {
  SURFACE_PRIMARY,
  BORDER_DEFAULT,
  RADIUS_DEFAULT,
  TYPE_PAGE_TITLE,
  TEXT_PRIMARY,
  BUTTON_BASE,
  BUTTON_SECONDARY,
} from "@/styles/tokens";

interface QuickAction {
  label: string;
  onClick: () => void;
  icon?: ReactNode;
  disabled?: boolean;
}

interface FirmaSummaryHeaderProps {
  firmaAdi: string;
  durum: FirmaDurumu;
  risk: RiskSeviyesi;
  sektor?: string;
  sehir?: string;
  partner?: string;
  actions?: QuickAction[];
}

export default function FirmaSummaryHeader({
  firmaAdi,
  durum,
  sektor,
  sehir,
  partner,
  actions,
}: FirmaSummaryHeaderProps) {
  return (
    <section aria-label="Firma özeti" className={`${SURFACE_PRIMARY} border ${BORDER_DEFAULT} ${RADIUS_DEFAULT} p-5 sm:p-6 mb-5 shadow-sm`}>
      <div className="flex flex-col gap-5 xl:flex-row xl:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <span className="hidden sm:flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-700"><Building2 size={24}/></span>
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wider text-slate-500 mb-2">Firma çalışma alanı</p>
            <h1 className={`${TYPE_PAGE_TITLE} ${TEXT_PRIMARY} break-words`}>{firmaAdi}</h1>
            <div className="flex flex-wrap items-center gap-2 mt-3">
              <StatusBadge status={durum} size="md" />
              {sektor && sektor !== "—" && <span className="rounded-lg bg-slate-50 px-2 py-1 text-xs text-slate-600">{sektor}</span>}
              {sehir && sehir !== "—" && <span className="inline-flex items-center gap-1 text-sm text-slate-600"><MapPin size={14}/>{sehir}</span>}
              {partner && <span className="text-sm text-slate-500">Partner: {partner}</span>}
            </div>
          </div>
        </div>
        {actions && actions.length > 0 && <div className="flex flex-wrap items-start content-start gap-2 xl:max-w-md xl:justify-end">
          {actions.map(action => <button key={action.label} onClick={action.onClick} disabled={action.disabled}
            className={`${BUTTON_BASE} ${BUTTON_SECONDARY} disabled:opacity-40 disabled:cursor-not-allowed`}>
            {action.icon}<span>{action.label}</span>
          </button>)}
        </div>}
      </div>
    </section>
  );
}
