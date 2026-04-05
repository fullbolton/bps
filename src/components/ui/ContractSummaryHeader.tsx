import type { SozlesmeDurumu } from "@/types/ui";
import StatusBadge from "./StatusBadge";
import { clsx } from "clsx";
import {
  SURFACE_PRIMARY,
  BORDER_DEFAULT,
  RADIUS_DEFAULT,
  TYPE_PAGE_TITLE,
  TYPE_BODY,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
  TEXT_MUTED,
  TEXT_BODY,
  TEXT_LINK,
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
    <div className={`${SURFACE_PRIMARY} border ${BORDER_DEFAULT} ${RADIUS_DEFAULT} p-5 mb-4`}>
      <div className="flex items-start justify-between">
        <div>
          <h1 className={`${TYPE_PAGE_TITLE} ${TEXT_PRIMARY}`}>{sozlesmeAdi}</h1>
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            <StatusBadge status={durum} size="md" />
            <span className={`${TYPE_BODY} ${TEXT_SECONDARY}`}>{tur}</span>
            <span className={`${TYPE_BODY} ${TEXT_MUTED}`}>·</span>
            <a href={firmaHref} className={`${TYPE_BODY} ${TEXT_LINK} hover:underline`}>
              {firmaAdi}
            </a>
          </div>
          <div className={`flex items-center gap-4 mt-3 ${TYPE_BODY} ${TEXT_SECONDARY} flex-wrap`}>
            <span>
              {baslangic || "—"} → {bitis || "—"}
            </span>
            {kalanGun !== null && (
              <span
                className={clsx(
                  "font-medium",
                  kalanGun <= 15
                    ? "text-red-600"
                    : kalanGun <= 30
                      ? "text-amber-600"
                      : TEXT_BODY
                )}
              >
                {kalanGun} gün kaldı
              </span>
            )}
            <span className={TEXT_MUTED}>·</span>
            <span>Sorumlu: {sorumlu}</span>
            {tutar && (
              <>
                <span className={TEXT_MUTED}>·</span>
                <span className={`font-medium ${TEXT_BODY}`}>{tutar}</span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
