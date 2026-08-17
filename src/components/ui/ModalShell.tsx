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

/**
 * Open-modal stack, module level.
 *
 * Escape is listened for on `document`, so with two modals open BOTH used to
 * react to a single keypress. That is not cosmetic: the inline-firma flow
 * opens a company modal on top of the Yeni Randevu form, and that form wipes
 * its fields in its close handler — so one Escape closed the small modal and
 * silently threw away everything the user had typed underneath.
 *
 * Only the topmost open modal now reacts. With a single modal open — every
 * other caller in the app — behaviour is unchanged.
 */
const openModalStack: object[] = [];

export default function ModalShell({
  open,
  onClose,
  title,
  children,
  footer,
}: ModalShellProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  // Stable identity for this instance's slot in the stack.
  const idRef = useRef<object | null>(null);
  if (idRef.current === null) idRef.current = {};

  // `onClose` is usually an inline function, so its identity changes every
  // render. Kept in a ref so the effect below depends only on `open` — if it
  // re-ran per render it would pop and re-push this modal, putting it back on
  // top of a modal that legitimately opened above it.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const id = idRef.current as object;
    openModalStack.push(id);

    function handleEsc(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (openModalStack[openModalStack.length - 1] !== id) return;
      onCloseRef.current();
    }
    document.addEventListener("keydown", handleEsc);

    return () => {
      document.removeEventListener("keydown", handleEsc);
      const i = openModalStack.lastIndexOf(id);
      if (i !== -1) openModalStack.splice(i, 1);
    };
  }, [open]);

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
