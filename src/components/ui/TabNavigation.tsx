"use client";

import type { TabItem } from "@/types/ui";
import { clsx } from "clsx";
import {
  TAB_BASE,
  TAB_ACTIVE,
  TAB_INACTIVE,
  TAB_DISABLED,
  BORDER_DEFAULT,
} from "@/styles/tokens";

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
    <div className={`border-b ${BORDER_DEFAULT}`}>
      <nav className="-mb-px flex gap-0" aria-label="Tabs">
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
              className={clsx(
                TAB_BASE,
                isActive
                  ? TAB_ACTIVE
                  : isDisabled
                    ? TAB_DISABLED
                    : TAB_INACTIVE
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
