import {
  SURFACE_PRIMARY,
  BORDER_DEFAULT,
  RADIUS_DEFAULT,
  TYPE_CARD_TITLE,
  TYPE_BODY,
  TYPE_CAPTION,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
  TEXT_MUTED,
} from "@/styles/tokens";

interface DocumentsChecklistCardProps {
  tam: number;
  eksik: number;
  suresiYaklsiyor: number;
  suresiDoldu: number;
}

const ITEMS: { key: keyof DocumentsChecklistCardProps; label: string; dot: string }[] = [
  { key: "tam", label: "Tam", dot: "bg-green-500" },
  { key: "eksik", label: "Eksik", dot: "bg-red-500" },
  { key: "suresiYaklsiyor", label: "Süresi Yaklaşıyor", dot: "bg-amber-500" },
  { key: "suresiDoldu", label: "Süresi Doldu", dot: "bg-red-400" },
];

export default function DocumentsChecklistCard(props: DocumentsChecklistCardProps) {
  const total = props.tam + props.eksik + props.suresiYaklsiyor + props.suresiDoldu;

  return (
    <div className={`${SURFACE_PRIMARY} border ${BORDER_DEFAULT} ${RADIUS_DEFAULT} p-4`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className={`${TYPE_CARD_TITLE} ${TEXT_PRIMARY}`}>Evrak Durumu Özeti</h3>
        <span className={`${TYPE_CAPTION} ${TEXT_MUTED}`}>{total} evrak</span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {ITEMS.map((item) => (
          <div key={item.key} className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${item.dot}`} />
            <span className={`${TYPE_CAPTION} ${TEXT_SECONDARY}`}>{item.label}</span>
            <span className={`${TYPE_BODY} font-medium ${TEXT_PRIMARY} ml-auto`}>{props[item.key]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
