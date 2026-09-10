"use client";

import {useId} from "react";
import {X} from "lucide-react";
import {useModalDialog} from "./useModalDialog";

interface RightSidePanelProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

export default function RightSidePanel({open, onClose, title = "Detay", children}: RightSidePanelProps) {
  const ref = useModalDialog(open);
  const titleId = useId();
  if (!open) return null;
  return <dialog ref={ref} aria-labelledby={titleId}
    className="[&:not([open])]:hidden fixed inset-0 m-0 flex h-dvh max-h-none w-screen max-w-none justify-end border-0 bg-transparent p-0 text-slate-900 backdrop:bg-slate-950/40"
    onCancel={e => { e.preventDefault(); onClose(); }}
    onClick={e => { if (e.target === ref.current) onClose(); }}>
    <div className="flex h-full w-full max-w-xl flex-col bg-white shadow-2xl sm:rounded-l-2xl">
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
        <h2 id={titleId} className="text-base font-semibold">{title}</h2>
        <button type="button" onClick={onClose} aria-label={`${title} panelini kapat`} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100"><X size={20}/></button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-6">{children}</div>
    </div>
  </dialog>;
}
