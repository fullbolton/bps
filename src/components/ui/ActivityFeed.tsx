import {
  Building2,
  FileText,
  CalendarCheck,
  ListChecks,
  FolderOpen,
  Users,
  StickyNote,
  Clock,
} from "lucide-react";
import type { ReactNode } from "react";
import { clsx } from "clsx";
import EmptyState from "./EmptyState";
import {
  TYPE_BODY,
  TYPE_CAPTION,
  TEXT_BODY,
  TEXT_MUTED,
  TEXT_SECONDARY,
  BORDER_SUBTLE,
  SURFACE_HEADER,
} from "@/styles/tokens";

export interface ActivityEvent {
  id: string;
  type: string;
  title: string;
  description?: string;
  timestamp: string;
  user?: string;
  linkedRecord?: { label: string; href?: string };
}

const EVENT_ICONS: Record<string, ReactNode> = {
  firma: <Building2 size={14} />,
  sozlesme: <FileText size={14} />,
  randevu: <CalendarCheck size={14} />,
  gorev: <ListChecks size={14} />,
  evrak: <FolderOpen size={14} />,
  talep: <Users size={14} />,
  not: <StickyNote size={14} />,
};

interface ActivityFeedProps {
  events: ActivityEvent[];
  maxItems?: number;
}

export default function ActivityFeed({ events, maxItems }: ActivityFeedProps) {
  const displayed = maxItems ? events.slice(0, maxItems) : events;

  if (displayed.length === 0) {
    return <EmptyState title="Henüz aktivite yok" size="card" />;
  }

  return (
    <div className="space-y-0">
      {displayed.map((event, idx) => (
        <div
          key={event.id}
          className={clsx(
            "flex gap-3 py-3",
            idx < displayed.length - 1 && `border-b ${BORDER_SUBTLE}`
          )}
        >
          <div className={`mt-0.5 flex-shrink-0 w-7 h-7 rounded-full ${SURFACE_HEADER} flex items-center justify-center ${TEXT_SECONDARY}`}>
            {EVENT_ICONS[event.type] ?? <Clock size={14} />}
          </div>
          <div className="flex-1 min-w-0">
            <p className={`${TYPE_BODY} ${TEXT_BODY}`}>{event.title}</p>
            {event.description && (
              <p className={`${TYPE_CAPTION} ${TEXT_MUTED} mt-0.5 truncate`}>
                {event.description}
              </p>
            )}
            <div className={`flex items-center gap-2 mt-1 ${TYPE_CAPTION} ${TEXT_MUTED}`}>
              <span>{event.timestamp}</span>
              {event.user && (
                <>
                  <span>·</span>
                  <span>{event.user}</span>
                </>
              )}
              {event.linkedRecord && (
                <>
                  <span>·</span>
                  {event.linkedRecord.href ? (
                    <a
                      href={event.linkedRecord.href}
                      className="text-blue-500 hover:underline"
                    >
                      {event.linkedRecord.label}
                    </a>
                  ) : (
                    <span>{event.linkedRecord.label}</span>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
