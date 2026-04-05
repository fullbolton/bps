import {
  SURFACE_PRIMARY,
  BORDER_DEFAULT,
  BORDER_SUBTLE,
  RADIUS_DEFAULT,
  TYPE_CARD_TITLE,
  TYPE_BODY,
  TYPE_CAPTION,
  TYPE_KPI_VALUE,
  TEXT_PRIMARY,
  TEXT_BODY,
  TEXT_SECONDARY,
  TEXT_LINK,
} from "@/styles/tokens";
import type { FirmaAlacakEntry, FirmaKesilmemisEntry } from "@/types/batch5-finansal";

interface ReceivablesSummaryCardProps {
  toplamAlacak: string;
  gecikmisAlacak: string;
  gecikmisFirmaSayisi: number;
  firmaAlacakDagilimi: FirmaAlacakEntry[];
  firmaKesilmemisDagilimi: FirmaKesilmemisEntry[];
}

/**
 * Receivables breakdown card for Finansal Özet.
 * Shows: total receivables, overdue summary, top firms by açık alacak,
 * top firms by kesilmemiş bekleyen.
 * Compact list format — not a DataTable.
 */
export default function ReceivablesSummaryCard({
  toplamAlacak,
  gecikmisAlacak,
  gecikmisFirmaSayisi,
  firmaAlacakDagilimi,
  firmaKesilmemisDagilimi,
}: ReceivablesSummaryCardProps) {
  return (
    <div className={`${SURFACE_PRIMARY} border ${BORDER_DEFAULT} ${RADIUS_DEFAULT} p-5`}>
      <h3 className={`${TYPE_CARD_TITLE} ${TEXT_PRIMARY} mb-4`}>Alacak Dağılımı ve Baskı Görünümü</h3>

      {/* Top-line summary */}
      <div className="grid grid-cols-2 gap-4 mb-5">
        <div>
          <p className={`${TYPE_CAPTION} ${TEXT_SECONDARY}`}>Toplam Açık Alacak</p>
          <p className={`${TYPE_KPI_VALUE} ${TEXT_PRIMARY} mt-1`}>{toplamAlacak}</p>
        </div>
        <div>
          <p className={`${TYPE_CAPTION} ${TEXT_SECONDARY}`}>Gecikmiş Alacak</p>
          <p className={`${TYPE_KPI_VALUE} text-red-600 mt-1`}>{gecikmisAlacak}</p>
          <p className={`${TYPE_CAPTION} ${TEXT_SECONDARY} mt-0.5`}>{gecikmisFirmaSayisi} firmada gecikme</p>
        </div>
      </div>

      {/* Firma distribution — açık alacak */}
      <div className={`pt-4 border-t ${BORDER_SUBTLE}`}>
        <h4 className={`${TYPE_CAPTION} ${TEXT_SECONDARY} mb-3`}>Firma Bazlı Açık Alacak</h4>
        <div className="space-y-2">
          {firmaAlacakDagilimi.map((f) => (
            <div key={f.firmaId} className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                {f.gecikmisMi && (
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />
                )}
                <a href={`/firmalar/${f.firmaId}`} className={`${TYPE_BODY} ${TEXT_LINK} hover:underline truncate`}>
                  {f.firmaAdi}
                </a>
              </div>
              <span className={`${TYPE_BODY} font-medium ${f.gecikmisMi ? "text-red-600" : TEXT_PRIMARY} ml-3 flex-shrink-0`}>
                {f.acikAlacak}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Firma distribution — kesilmemiş bekleyen */}
      <div className={`pt-4 mt-4 border-t ${BORDER_SUBTLE}`}>
        <h4 className={`${TYPE_CAPTION} ${TEXT_SECONDARY} mb-3`}>Firma Bazlı Kesilmemiş Bekleyen</h4>
        <div className="space-y-2">
          {firmaKesilmemisDagilimi.map((f) => (
            <div key={f.firmaId} className="flex items-center justify-between">
              <a href={`/firmalar/${f.firmaId}`} className={`${TYPE_BODY} ${TEXT_LINK} hover:underline truncate min-w-0`}>
                {f.firmaAdi}
              </a>
              <span className={`${TYPE_BODY} font-medium text-amber-600 ml-3 flex-shrink-0`}>
                {f.kesilmemisBekleyen}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
