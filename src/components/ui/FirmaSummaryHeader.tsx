import type { FirmaDurumu, RiskSeviyesi } from "@/types/ui";
import type { ReactNode } from "react";
import StatusBadge from "./StatusBadge";
import RiskBadge from "./RiskBadge";
import {
  SURFACE_PRIMARY,
  BORDER_DEFAULT,
  RADIUS_DEFAULT,
  TYPE_PAGE_TITLE,
  TYPE_BODY,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
  TEXT_BODY,
  TEXT_MUTED,
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
  risk,
  sektor,
  sehir,
  partner,
  actions,
}: FirmaSummaryHeaderProps) {
  return (
    <div className={`${SURFACE_PRIMARY} border ${BORDER_DEFAULT} ${RADIUS_DEFAULT} p-5 mb-4`}>
      <div className="flex items-start justify-between">
        <div>
          <h1 className={`${TYPE_PAGE_TITLE} ${TEXT_PRIMARY}`}>{firmaAdi}</h1>
          <div className="flex items-center gap-3 mt-2">
            <StatusBadge status={durum} size="md" />
            <RiskBadge risk={risk} size="md" />
            {sektor && (
              <span className={`${TYPE_BODY} ${TEXT_SECONDARY}`}>{sektor}</span>
            )}
            {sehir && (
              <span className={`${TYPE_BODY} ${TEXT_SECONDARY}`}>· {sehir}</span>
            )}
            {partner && (
              <span className={`${TYPE_BODY} ${TEXT_MUTED}`}>· Partner: {partner}</span>
            )}
          </div>
        </div>
        {actions && actions.length > 0 && (
          <div className="flex items-center gap-2">
            {actions.map((action) => (
              <button
                key={action.label}
                onClick={action.onClick}
                disabled={action.disabled}
                className={`${BUTTON_BASE} ${BUTTON_SECONDARY} disabled:opacity-40 disabled:cursor-not-allowed`}
              >
                {action.icon}
                <span>{action.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
