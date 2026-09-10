"use client";

import { useState } from "react";
import { CheckCircle2, X } from "lucide-react";

/** A late mutation response can announce only in the identity/tenant that started it. */
export function useActionNotice(scope: string) {
  const [notice, setNotice] = useState<{ scope: string; text: string } | null>(null);
  return {
    message: notice?.scope === scope ? notice.text : null,
    show: (text: string) => setNotice({ scope, text }),
    clear: () => setNotice(null),
  };
}

export default function ActionNotice({ message, onDismiss }: {
  message: string | null;
  onDismiss: () => void;
}) {
  if (!message) return null;
  return (
    <div role="status" className="mb-5 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
      <CheckCircle2 size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
      <p className="min-w-0 flex-1 break-words py-0.5">{message}</p>
      <button type="button" aria-label="İşlem bildirimini kapat" onClick={onDismiss} className="-my-2 -mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg hover:bg-emerald-100">
        <X size={18} aria-hidden="true" />
      </button>
    </div>
  );
}
