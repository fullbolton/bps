"use client";
import {operationDay} from '@/lib/mobile-operations';
import {addDays} from '@/lib/operations/weekly-plan';

export default function TaskDueDateField({id,value,onChange}:{id:string;value:string;onChange:(value:string)=>void}){
  return <div>
    <label htmlFor={id} className="mb-1 block text-sm font-medium text-slate-700">Bitiş tarihi (isteğe bağlı)</label>
    <input id={id} type="date" value={value} onChange={event=>onChange(event.target.value)} className="min-h-11 w-full min-w-0 rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/>
    <div className="mt-1 flex flex-wrap gap-2" role="group" aria-label="Hızlı bitiş tarihi">
      <button type="button" onClick={()=>onChange(operationDay())} className="min-h-11 rounded-lg px-2 text-sm text-blue-700 hover:bg-blue-50">Bugün</button>
      <button type="button" onClick={()=>onChange(addDays(operationDay(),1))} className="min-h-11 rounded-lg px-2 text-sm text-blue-700 hover:bg-blue-50">Yarın</button>
      {value&&<button type="button" onClick={()=>onChange('')} className="min-h-11 rounded-lg px-2 text-sm text-slate-600 hover:bg-slate-50">Tarihi kaldır</button>}
    </div>
  </div>;
}
