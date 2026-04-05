"use client";

import { X } from "lucide-react";
import {
  PANEL_OVERLAY,
  PANEL_CONTAINER,
  PANEL_HEADER,
  PANEL_BODY,
  TYPE_SECTION_TITLE,
  TEXT_PRIMARY,
  TEXT_MUTED,
  RADIUS_SM,
} from "@/styles/tokens";

interface RightSidePanelProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

/**
 * Generic slide-in panel from right.
 * Accepts only open, onClose, title, and children.
 * No domain-specific props — content is composed at screen level.
 */
export default function RightSidePanel({
  open,
  onClose,
  title,
  children,
}: RightSidePanelProps) {
  if (!open) return null;

  return (
    <>
      <div className={PANEL_OVERLAY} onClick={onClose} />
      <div className={PANEL_CONTAINER}>
        <div className={PANEL_HEADER}>
          {title && (
            <h2 className={`${TYPE_SECTION_TITLE} ${TEXT_PRIMARY}`}>{title}</h2>
          )}
          <button
            onClick={onClose}
            className={`p-1.5 ${RADIUS_SM} hover:bg-slate-100 ${TEXT_MUTED} hover:text-slate-600 ml-auto`}
          >
            <X size={18} />
          </button>
        </div>
        <div className={PANEL_BODY}>{children}</div>
      </div>
    </>
  );
}
