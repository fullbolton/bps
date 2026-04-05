import type { EmptyStateSize } from "@/types/ui";
import type { ReactNode } from "react";
import { Inbox } from "lucide-react";
import { clsx } from "clsx";
import {
  TEXT_PRIMARY,
  TEXT_SECONDARY,
  TEXT_MUTED,
  EMPTY_SIZES,
  EMPTY_ICON_SIZE,
  EMPTY_ICON_PIXEL,
  EMPTY_TITLE_SIZE,
  EMPTY_DESC_SIZE,
  EMPTY_ACTION_BUTTON,
} from "@/styles/tokens";

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: {
    label: string;
    onClick: () => void;
  };
  size?: EmptyStateSize;
}

export default function EmptyState({
  title,
  description,
  icon,
  action,
  size = "page",
}: EmptyStateProps) {
  return (
    <div
      className={clsx(
        "flex flex-col items-center justify-center text-center",
        EMPTY_SIZES[size]
      )}
    >
      <div
        className={clsx(
          "flex items-center justify-center rounded-full bg-slate-100 mb-4",
          TEXT_MUTED,
          EMPTY_ICON_SIZE[size]
        )}
      >
        {icon ?? <Inbox size={EMPTY_ICON_PIXEL[size]} />}
      </div>
      <h3
        className={clsx(
          "font-medium",
          TEXT_PRIMARY,
          EMPTY_TITLE_SIZE[size]
        )}
      >
        {title}
      </h3>
      {description && (
        <p
          className={clsx(
            "mt-1 max-w-sm",
            TEXT_SECONDARY,
            EMPTY_DESC_SIZE[size]
          )}
        >
          {description}
        </p>
      )}
      {action && (
        <button
          onClick={action.onClick}
          className={EMPTY_ACTION_BUTTON}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
