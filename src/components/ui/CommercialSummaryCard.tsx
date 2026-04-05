import type { RiskSeviyesi } from "@/types/ui";
import RiskBadge from "./RiskBadge";
import {
  SURFACE_PRIMARY,
  BORDER_DEFAULT,
  RADIUS_DEFAULT,
  TYPE_CARD_TITLE,
  TYPE_BODY,
  TYPE_CAPTION,
  TEXT_PRIMARY,
  TEXT_BODY,
  TEXT_SECONDARY,
  BORDER_SUBTLE,
} from "@/styles/tokens";

interface CommercialSummaryCardProps {
  acikBakiye: string;
  sonFaturaTarihi?: string;
  sonFaturaTutari?: string;
  kesilmemisBekleyen?: string;
  ticariRisk: RiskSeviyesi;
}

/**
 * CommercialSummaryCard — firma-level read-only commercial visibility.
 *
 * Per ROLE_MATRIX §5.9 and WORKFLOW_RULES §10.4:
 * - Strictly read-only. No edit affordance for any role in Batch 2.
 * - Visibility gating by role is handled at the screen level, not here.
 *   Screen must hide this card for görüntüleyici.
 *
 * Per STATUS_DICTIONARY §17.2:
 * - "Açık Bakiye" is the firma-context label (not "Açık Alacak").
 */
export default function CommercialSummaryCard({
  acikBakiye,
  sonFaturaTarihi,
  sonFaturaTutari,
  kesilmemisBekleyen,
  ticariRisk,
}: CommercialSummaryCardProps) {
  return (
    <div className={`${SURFACE_PRIMARY} border ${BORDER_DEFAULT} ${RADIUS_DEFAULT} p-4`}>
      <h3 className={`${TYPE_CARD_TITLE} ${TEXT_PRIMARY} mb-3`}>Ticari Özet</h3>
      <dl className="space-y-2.5">
        <div className="flex justify-between items-baseline">
          <dt className={`${TYPE_CAPTION} ${TEXT_SECONDARY}`}>Açık Bakiye</dt>
          <dd className={`${TYPE_BODY} font-medium ${TEXT_PRIMARY}`}>{acikBakiye}</dd>
        </div>
        <div className="flex justify-between items-baseline">
          <dt className={`${TYPE_CAPTION} ${TEXT_SECONDARY}`}>Son Fatura Tarihi</dt>
          <dd className={`${TYPE_BODY} ${TEXT_BODY}`}>{sonFaturaTarihi ?? "—"}</dd>
        </div>
        <div className="flex justify-between items-baseline">
          <dt className={`${TYPE_CAPTION} ${TEXT_SECONDARY}`}>Son Fatura Tutarı</dt>
          <dd className={`${TYPE_BODY} ${TEXT_BODY}`}>{sonFaturaTutari ?? "—"}</dd>
        </div>
        <div className="flex justify-between items-baseline">
          <dt className={`${TYPE_CAPTION} ${TEXT_SECONDARY}`}>Kesilmemiş Bekleyen</dt>
          <dd className={`${TYPE_BODY} ${TEXT_BODY}`}>{kesilmemisBekleyen ?? "—"}</dd>
        </div>
        <div className={`flex justify-between items-center pt-1 border-t ${BORDER_SUBTLE}`}>
          <dt className={`${TYPE_CAPTION} ${TEXT_SECONDARY}`}>Ticari Risk</dt>
          <dd>
            <RiskBadge risk={ticariRisk} size="sm" />
          </dd>
        </div>
      </dl>
    </div>
  );
}
