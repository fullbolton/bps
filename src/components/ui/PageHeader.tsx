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
    <div className="mb-6 flex flex-col gap-4 border-b border-slate-200 pb-5 lg:flex-row lg:items-center lg:justify-between">
      <div className="min-w-0">
        <h1 className={`${TYPE_PAGE_TITLE} ${TEXT_PRIMARY}`}>{title}</h1>
        {subtitle && (
          <p className={`mt-2 max-w-2xl ${TYPE_BODY} ${TEXT_SECONDARY}`}>{subtitle}</p>
        )}
      </div>
      {actions && actions.length > 0 && (
        <div className="flex max-w-full flex-wrap items-center gap-2 lg:justify-end print:hidden">
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
