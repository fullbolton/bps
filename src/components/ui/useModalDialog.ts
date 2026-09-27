"use client";
import {useEffect, useRef} from "react";

let locks = 0;
let previousOverflow = "";

/** Modal by default. Nonmodal detail panes preserve page interaction and do not lock scroll. */
export function useModalDialog(open: boolean, modal = true) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!open || !dialog) return;
    const returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (modal) dialog.showModal();
    else dialog.show();
    // React autoFocus can run while a native dialog is still closed. Focus the
    // requested field only after showModal, preserving the outside return target.
    const initial = dialog.querySelector<HTMLElement>("[data-dialog-initial-focus]");
    if (initial && !initial.matches(":disabled") && initial.getClientRects().length > 0 && initial.closest("dialog") === dialog) {
      initial.focus({preventScroll: true});
    }
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
    if (modal) dialog.addEventListener("keydown", wrapFocus);
    if (modal && locks++ === 0) {
      previousOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
    }
    return () => {
      dialog.removeEventListener("keydown", wrapFocus);
      dialog.close();
      if (returnFocus?.isConnected) returnFocus.focus({preventScroll: true});
      if (modal && --locks === 0) document.body.style.overflow = previousOverflow;
    };
  }, [open, modal]);
  return ref;
}
