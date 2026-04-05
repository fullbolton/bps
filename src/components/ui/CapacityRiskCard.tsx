import type { IsGucuRiskSeviyesi } from "@/types/batch4";
import WorkforceRiskBadge from "./WorkforceRiskBadge";
import {
  SURFACE_PRIMARY,
  BORDER_DEFAULT,
  BORDER_SUBTLE,
  RADIUS_DEFAULT,
  TYPE_CARD_TITLE,
  TYPE_BODY,
  TYPE_CAPTION,
  TEXT_PRIMARY,
  TEXT_BODY,
  TEXT_SECONDARY,
} from "@/styles/tokens";

interface CapacityRiskCardProps {
  aktifKisi: number;
  hedefKisi: number;
  acikFark: number;
  son30GunGiris: number;
  son30GunCikis: number;
  riskEtiketi: IsGucuRiskSeviyesi;
}

export default function CapacityRiskCard({
  aktifKisi,
  hedefKisi,
  acikFark,
  son30GunGiris,
  son30GunCikis,
  riskEtiketi,
}: CapacityRiskCardProps) {
  return (
    <div className={`${SURFACE_PRIMARY} border ${BORDER_DEFAULT} ${RADIUS_DEFAULT} p-4`}>
      <h3 className={`${TYPE_CARD_TITLE} ${TEXT_PRIMARY} mb-3`}>Kapasite ve Risk</h3>
      <dl className="space-y-2.5">
        <div className="flex justify-between items-baseline">
          <dt className={`${TYPE_CAPTION} ${TEXT_SECONDARY}`}>Aktif Kişi</dt>
          <dd className={`${TYPE_BODY} font-medium ${TEXT_PRIMARY}`}>{aktifKisi}</dd>
        </div>
        <div className="flex justify-between items-baseline">
          <dt className={`${TYPE_CAPTION} ${TEXT_SECONDARY}`}>Hedef Kişi</dt>
          <dd className={`${TYPE_BODY} ${TEXT_BODY}`}>{hedefKisi}</dd>
        </div>
        <div className="flex justify-between items-baseline">
          <dt className={`${TYPE_CAPTION} ${TEXT_SECONDARY}`}>Açık Fark</dt>
          <dd className={`${TYPE_BODY} font-medium ${acikFark > 0 ? "text-amber-600" : "text-green-600"}`}>
            {acikFark > 0 ? `−${acikFark}` : "0"}
          </dd>
        </div>
        <div className="flex justify-between items-baseline">
          <dt className={`${TYPE_CAPTION} ${TEXT_SECONDARY}`}>Son 30 Gün Giriş</dt>
          <dd className={`${TYPE_BODY} text-green-600`}>+{son30GunGiris}</dd>
        </div>
        <div className="flex justify-between items-baseline">
          <dt className={`${TYPE_CAPTION} ${TEXT_SECONDARY}`}>Son 30 Gün Çıkış</dt>
          <dd className={`${TYPE_BODY} text-red-600`}>−{son30GunCikis}</dd>
        </div>
        <div className={`flex justify-between items-center pt-1 border-t ${BORDER_SUBTLE}`}>
          <dt className={`${TYPE_CAPTION} ${TEXT_SECONDARY}`}>Risk</dt>
          <dd><WorkforceRiskBadge risk={riskEtiketi} /></dd>
        </div>
      </dl>
    </div>
  );
}
