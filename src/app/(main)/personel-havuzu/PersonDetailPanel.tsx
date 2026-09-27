'use client';

import {useEffect, useId, useState, type ReactNode} from 'react';
import {X} from 'lucide-react';
import {useModalDialog} from '@/components/ui/useModalDialog';

/** One dialog subtree: resizing never remounts an in-progress form or file input. */
export default function PersonDetailPanel({children,onClose,closeDisabled}:{children:ReactNode;onClose:()=>void;closeDisabled:boolean}) {
 const [wide,setWide]=useState(false);
 const titleId=useId();
 useEffect(()=>{
  // Keep this breakpoint aligned with the 2xl reserved space in PersonPool.
  const media=window.matchMedia('(min-width: 1536px)');
  const update=()=>setWide(media.matches);
  update();media.addEventListener('change',update);
  return()=>media.removeEventListener('change',update);
 },[]);
 const ref=useModalDialog(true,!wide);
 return <dialog ref={ref} aria-labelledby={titleId} aria-modal={wide?undefined:true}
  className={`[&:not([open])]:hidden fixed left-auto m-0 flex max-h-none flex-col border-0 bg-white p-0 text-slate-900 shadow-2xl ${wide?'bottom-0 right-0 top-0 z-40 h-dvh w-[30rem] max-w-none border-l border-slate-200':'inset-y-0 right-0 h-dvh w-screen max-w-xl backdrop:bg-slate-950/40'}`}
  onCancel={e=>{e.preventDefault();if(!closeDisabled)onClose();}}>
  <header className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
   <h2 id={titleId} className="text-base font-semibold">Kişi kartı</h2>
   <button type="button" onClick={onClose} disabled={closeDisabled} aria-label="Kişi kartı panelini kapat" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-blue-600 disabled:opacity-40"><X size={20}/></button>
  </header>
  <div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-6">{children}</div>
 </dialog>;
}
