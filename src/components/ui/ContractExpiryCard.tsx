import StatusBadge from "./StatusBadge";
import EmptyState from "./EmptyState";
import type { SozlesmeDurumu } from "@/types/ui";
import { clsx } from "clsx";
import {
  SURFACE_PRIMARY,
  BORDER_DEFAULT,
  RADIUS_DEFAULT,
  TYPE_CARD_TITLE,
  TYPE_BODY,
  TYPE_CAPTION,
  TYPE_LABEL,
  TEXT_PRIMARY,
  TEXT_BODY,
  TEXT_MUTED,
  TEXT_SECONDARY,
  TEXT_LINK,
  BORDER_SUBTLE,
  TABLE_ROW_HOVER,
} from "@/styles/tokens";

export interface ExpiringContract {
  id: string;
  sozlesmeAdi: string;
  firmaAdi: string;
  kalanGun: number;
  durum: SozlesmeDurumu;
}

interface ContractExpiryCardProps {
  contracts: ExpiringContract[];
  maxItems?: number;
  /** Optional click handler for individual contract rows */
  onItemClick?: (contract: ExpiringContract) => void;
  /** Optional card-level action link (e.g. "Tümünü Gör") */
  actionHref?: string;
}

export default function ContractExpiryCard({
  contracts,
  maxItems = 5,
  onItemClick,
  actionHref,
}: ContractExpiryCardProps) {
  const displayed = contracts.slice(0, maxItems);

  if (displayed.length === 0) {
    return (
      <div className={`${SURFACE_PRIMARY} border ${BORDER_DEFAULT} ${RADIUS_DEFAULT} p-4`}>
        <h3 className={`${TYPE_CARD_TITLE} ${TEXT_PRIMARY} mb-3`}>
          Yaklaşan Sözleşme Bitişleri
        </h3>
        <EmptyState title="Yaklaşan sözleşme yok" size="card" />
      </div>
    );
  }

  return (
    <div className={`${SURFACE_PRIMARY} border ${BORDER_DEFAULT} ${RADIUS_DEFAULT} p-4`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className={`${TYPE_CARD_TITLE} ${TEXT_PRIMARY}`}>
          Yaklaşan Sözleşme Bitişleri
        </h3>
        {actionHref && (
          <a
            href={actionHref}
            className={`${TYPE_CAPTION} ${TEXT_LINK} hover:underline`}
          >
            Tümünü Gör
          </a>
        )}
      </div>
      <div className="space-y-0">
        {displayed.map((c, idx) => {
          const row = (
            <div
              key={c.id}
              onClick={onItemClick ? () => onItemClick(c) : undefined}
              className={clsx(
                "flex items-center justify-between py-2.5",
                idx < displayed.length - 1 && `border-b ${BORDER_SUBTLE}`,
                onItemClick && `cursor-pointer ${TABLE_ROW_HOVER} -mx-2 px-2 rounded`
              )}
            >
              <div className="min-w-0">
                <p className={`${TYPE_BODY} font-medium ${TEXT_BODY} truncate`}>
                  {c.sozlesmeAdi}
                </p>
                <p className={`${TYPE_CAPTION} ${TEXT_MUTED} truncate`}>{c.firmaAdi}</p>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0 ml-3">
                <span
                  className={clsx(
                    `${TYPE_CAPTION} font-medium`,
                    c.kalanGun <= 15
                      ? "text-red-600"
                      : c.kalanGun <= 30
                        ? "text-amber-600"
                        : TEXT_SECONDARY
                  )}
                >
                  {c.kalanGun} gün
                </span>
                <StatusBadge status={c.durum} />
              </div>
            </div>
          );
          return row;
        })}
      </div>
    </div>
  );
}
