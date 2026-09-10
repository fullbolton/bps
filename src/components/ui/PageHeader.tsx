import type { PageHeaderAction } from "@/types/ui";
import { clsx } from "clsx";
import {
  TYPE_PAGE_TITLE,
  TYPE_BODY,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
  BUTTON_BASE,
  BUTTON_PRIMARY,
  BUTTON_SECONDARY,
} from "@/styles/tokens";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: PageHeaderAction[];
}

export default function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between mb-7">
      <div className="min-w-0">
        <h1 className={`${TYPE_PAGE_TITLE} ${TEXT_PRIMARY}`}>{title}</h1>
        {subtitle && (
          <p className={`mt-1 ${TYPE_BODY} ${TEXT_SECONDARY}`}>{subtitle}</p>
        )}
      </div>
      {actions && actions.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 shrink-0 print:hidden">
          {actions.map((action) => (
            <button
              key={action.label}
              onClick={action.onClick}
              className={clsx(
                BUTTON_BASE,
                action.variant === "secondary"
                  ? BUTTON_SECONDARY
                  : BUTTON_PRIMARY
              )}
            >
              {action.icon}
              <span>{action.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
