"use client";
import {useId, useRef, useState, useEffect} from "react";
import {MoreVertical} from "lucide-react";
import type {RowAction} from "@/types/ui";

export default function TableRowActions<T extends object>({row, actions}: {row:T; actions:RowAction<T>[]}) {
  const id=useId(), popup=useRef<HTMLDivElement>(null);
  const [position,setPosition]=useState<{left:number;top?:number;bottom?:number}>({left:0,top:0});
  const [expanded,setExpanded]=useState(false);
  useEffect(()=>{
    if(!expanded)return;
    const close=()=>popup.current?.hidePopover();
    const scroll=(event:Event)=>{if(event.target instanceof Node && popup.current?.contains(event.target))return;close();};
    window.addEventListener('resize',close);document.addEventListener('scroll',scroll,true);
    return ()=>{window.removeEventListener('resize',close);document.removeEventListener('scroll',scroll,true);};
  },[expanded]);
  return <>
    <button type="button" popoverTarget={id} aria-label="Satır işlemleri" aria-expanded={expanded}
      onClick={e=>{e.stopPropagation();const r=e.currentTarget.getBoundingClientRect();const below=innerHeight-r.bottom;setPosition({left:Math.max(8,Math.min(r.right-208,innerWidth-216)),...(below>=Math.min(actions.length*44+16,240)?{top:r.bottom+4}:{bottom:innerHeight-r.top+4})});}}
      className="flex h-11 w-11 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"><MoreVertical size={18}/></button>
    <div id={id} ref={popup} popover="auto" role="group" aria-label="Kayıt işlemleri"
      onToggle={e=>setExpanded(e.newState==='open')} onClick={e=>e.stopPropagation()}
      style={position} className="fixed inset-auto m-0 w-52 max-w-[calc(100vw-16px)] max-h-[50dvh] overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 text-sm shadow-xl">
      {actions.map(action=><button key={action.label} type="button" disabled={action.isDisabled?.(row)??false}
        onClick={()=>{popup.current?.hidePopover();action.onClick(row);}}
        className="flex min-h-11 w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400">
        {action.icon}{action.label}
      </button>)}
    </div>
  </>;
}
