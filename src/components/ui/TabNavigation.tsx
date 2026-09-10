"use client";

import type { TabItem } from "@/types/ui";
import { clsx } from "clsx";


interface TabNavigationProps {
  tabs: TabItem[];
  activeTab: string;
  onTabChange: (key: string) => void;
}

export default function TabNavigation({
  tabs,
  activeTab,
  onTabChange,
}: TabNavigationProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
      <nav className="flex gap-1 overflow-x-auto" aria-label="Sayfa bölümleri">
        {tabs.map((tab) => {
          const isActive = tab.key === activeTab;
          const isDisabled = tab.disabled;

          return (
            <button
              key={tab.key}
              onClick={() => {
                if (!isDisabled) {
                  onTabChange(tab.key);
                }
              }}
              disabled={isDisabled}
              aria-pressed={isActive}
              className={clsx(
                "min-h-11 shrink-0 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-blue-50 text-blue-800 shadow-sm"
                  : isDisabled
                    ? "text-slate-400 cursor-not-allowed"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
