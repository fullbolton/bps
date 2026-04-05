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
    <div className="flex items-start justify-between mb-6">
      <div>
        <h1 className={`${TYPE_PAGE_TITLE} ${TEXT_PRIMARY}`}>{title}</h1>
        {subtitle && (
          <p className={`mt-1 ${TYPE_BODY} ${TEXT_SECONDARY}`}>{subtitle}</p>
        )}
      </div>
      {actions && actions.length > 0 && (
        <div className="flex items-center gap-2">
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
