"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import {
  MODAL_OVERLAY,
  MODAL_CONTAINER,
  MODAL_HEADER,
  MODAL_BODY,
  MODAL_FOOTER,
  TYPE_SECTION_TITLE,
  TEXT_PRIMARY,
  TEXT_MUTED,
  RADIUS_SM,
} from "@/styles/tokens";

interface ModalShellProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export default function ModalShell({
  open,
  onClose,
  title,
  children,
  footer,
}: ModalShellProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleEsc(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      className={MODAL_OVERLAY}
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
    >
      <div className={MODAL_CONTAINER}>
        <div className={MODAL_HEADER}>
          <h2 className={`${TYPE_SECTION_TITLE} ${TEXT_PRIMARY}`}>{title}</h2>
          <button
            onClick={onClose}
            className={`p-1 ${RADIUS_SM} hover:bg-slate-100 ${TEXT_MUTED} hover:text-slate-600`}
          >
            <X size={18} />
          </button>
        </div>
        <div className={MODAL_BODY}>{children}</div>
        {footer && (
          <div className={MODAL_FOOTER}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
