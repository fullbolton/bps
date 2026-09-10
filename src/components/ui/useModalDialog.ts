"use client";
import {useEffect, useRef} from "react";

let locks = 0;
let previousOverflow = "";

/** Native modal dialogs provide nested focus containment and background inertness. */
export function useModalDialog(open: boolean) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!open || !dialog) return;
    const returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog.showModal();
    // Native inertness blocks the page; wrap Tab at the dialog edges as well,
    // so desktop browsers do not move focus into their browser chrome.
    const wrapFocus = (event: KeyboardEvent) => {
      if (event.key !== "Tab" || (event.target as Element)?.closest("dialog") !== dialog) return;
      const items = Array.from(dialog.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), summary, [tabindex]:not([tabindex="-1"])'))
        .filter(el => el.tabIndex >= 0 && el.getClientRects().length > 0 && el.closest("dialog") === dialog);
      const first = items[0], last = items.at(-1);
      if (!first) { event.preventDefault(); dialog.focus(); return; }
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    dialog.addEventListener("keydown", wrapFocus);
    if (locks++ === 0) {
      previousOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
    }
    return () => {
      dialog.removeEventListener("keydown", wrapFocus);
      dialog.close();
      if (returnFocus?.isConnected) returnFocus.focus({preventScroll: true});
      if (--locks === 0) document.body.style.overflow = previousOverflow;
    };
  }, [open]);
  return ref;
}
