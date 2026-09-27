"use client";

import {useId} from "react";
import {X} from "lucide-react";
import {useModalDialog} from "./useModalDialog";
import {MODAL_CONTAINER, MODAL_HEADER, MODAL_BODY, MODAL_FOOTER} from "@/styles/tokens";

interface ModalShellProps {
  open: boolean;
  onClose: () => void;
  title: string;
  closeDisabled?: boolean;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export default function ModalShell({open, onClose, title, children, footer, closeDisabled = false}: ModalShellProps) {
  const ref = useModalDialog(open);
  const titleId = useId();
  if (!open) return null;
  return <dialog ref={ref} aria-labelledby={titleId}
    className="[&:not([open])]:hidden fixed inset-0 m-0 flex h-dvh max-h-none w-screen max-w-none items-center justify-center border-0 bg-transparent p-0 text-slate-900 backdrop:bg-slate-950/40"
    onCancel={e => { e.preventDefault(); if (!closeDisabled) onClose(); }}
    onClick={e => { if (e.target === ref.current && !closeDisabled) onClose(); }}>
    <div className={MODAL_CONTAINER}>
      <div className={MODAL_HEADER}>
        <h2 id={titleId} className="text-base font-semibold text-slate-900">{title}</h2>
        <button type="button" disabled={closeDisabled} aria-label={`${title} penceresini kapat`} onClick={onClose} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-800 disabled:opacity-40"><X size={20}/></button>
      </div>
      <div className={MODAL_BODY}>{children}</div>
      {footer && <div className={MODAL_FOOTER}>{footer}</div>}
    </div>
  </dialog>;
}
