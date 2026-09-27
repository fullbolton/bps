"use client";

import { useEffect, useRef } from "react";
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
  const navRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const reveal = () => {
      const selected = nav.querySelector<HTMLButtonElement>('[aria-pressed="true"]');
      if (!selected) return;
      const viewport = nav.getBoundingClientRect(), button = selected.getBoundingClientRect();
      // Move only this horizontal strip; never jump the whole page vertically.
      if (button.left < viewport.left) nav.scrollLeft += button.left - viewport.left;
      else if (button.right > viewport.right) nav.scrollLeft += button.right - viewport.right;
    };
    reveal();
    const observer = new ResizeObserver(reveal);
    observer.observe(nav);
    return () => observer.disconnect();
  }, [activeTab]);
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
      <nav ref={navRef} className="flex gap-1 overflow-x-auto" aria-label="Sayfa bölümleri">
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
