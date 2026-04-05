import { CheckCircle2, XCircle } from "lucide-react";

interface RenewalSignal {
  label: string;
  met: boolean;
  detail?: string;
}

interface RenewalTrackingCardProps {
  bitisTarihi: string;
  gorusmeAcildiMi: boolean;
  sorumluVar: boolean;
  gorevUretildi: boolean;
}

/**
 * Per WORKFLOW_RULES §3.4 — renewal tracking must show:
 * 1. Sözleşme bitiş tarihi
 * 2. Yenileme görüşmesi açıldı mı
 * 3. Sorumlu kişi var mı
 * 4. İlgili görev üretildi mi
 */
export default function RenewalTrackingCard({
  bitisTarihi,
  gorusmeAcildiMi,
  sorumluVar,
  gorevUretildi,
}: RenewalTrackingCardProps) {
  const signals: RenewalSignal[] = [
    { label: "Bitiş Tarihi", met: true, detail: bitisTarihi },
    { label: "Yenileme Görüşmesi Açıldı", met: gorusmeAcildiMi },
    { label: "Sorumlu Kişi Atandı", met: sorumluVar },
    { label: "İlgili Görev Üretildi", met: gorevUretildi },
  ];

  const metCount = signals.filter((s) => s.met).length;

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-slate-900">Yenileme Takibi</h3>
        <span className="text-xs text-slate-400">{metCount}/4 tamamlandı</span>
      </div>
      <div className="space-y-2.5">
        {signals.map((signal) => (
          <div key={signal.label} className="flex items-center gap-2.5">
            {signal.met ? (
              <CheckCircle2 size={16} className="text-green-500 flex-shrink-0" />
            ) : (
              <XCircle size={16} className="text-slate-300 flex-shrink-0" />
            )}
            <span className="text-sm text-slate-700">{signal.label}</span>
            {signal.detail && (
              <span className="text-xs text-slate-400 ml-auto">{signal.detail}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
