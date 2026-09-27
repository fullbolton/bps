"use client";
import {clsx} from "clsx";
export interface ReportOption {key:string;label:string;description?:string;}
interface ReportSwitcherProps {reports:ReportOption[];activeKey:string;onSwitch:(key:string)=>void;}
/** Selection only; the page supplies the reports allowed for the current role. */
export default function ReportSwitcher({reports,activeKey,onSwitch}:ReportSwitcherProps){
 const selected=reports.find(report=>report.key===activeKey);
 return <><div className="rounded-xl border border-slate-200 bg-white p-4 sm:hidden"><label className="grid gap-2 text-sm font-semibold text-slate-900">Rapor<select value={activeKey} onChange={event=>onSwitch(event.target.value)} className="min-h-11 w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal">{reports.map(report=><option key={report.key} value={report.key}>{report.label}</option>)}</select></label>{selected?.description&&<p className="mt-2 text-sm text-slate-600">{selected.description}</p>}</div><div role="group" aria-label="Rapor seçimi" className="hidden gap-2 sm:grid sm:grid-cols-2 xl:grid-cols-3">{reports.map(report=><button type="button" key={report.key} aria-pressed={report.key===activeKey} onClick={()=>onSwitch(report.key)} className={clsx("min-h-11 min-w-0 rounded-xl border p-4 text-left transition-colors focus-visible:outline-2 focus-visible:outline-blue-600",report.key===activeKey?"border-blue-600 bg-blue-50 text-blue-900":"border-slate-200 bg-white text-slate-700 hover:border-blue-300")}><span className="block text-sm font-semibold">{report.label}</span>{report.description&&<span className="mt-1 block text-sm leading-relaxed text-slate-600">{report.description}</span>}</button>)}</div></>;
}
