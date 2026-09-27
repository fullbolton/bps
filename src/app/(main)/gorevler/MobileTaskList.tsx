"use client";
import { useEffect, useState, type ReactNode } from 'react';
import { Check, ChevronRight, Clock3, UserRound, RefreshCw } from 'lucide-react';
import { taskContextLinks } from '@/lib/task-context';
import { StatusBadge, PriorityBadge } from '@/components/ui';
import type { TaskRow } from '@/types/database.types';
import { activeTask, taskActionPermissions, mobileTaskMatches, mobileTaskViews, operationDay, orderMobileTasks, taskDueLabel, type MobileTaskView } from '@/lib/mobile-operations';

type Row = TaskRow & { firma_name: string; assignee_label: string };
export default function MobileTaskList({ rows, actorId, role, busy, onOpen, onClaim, onComplete, onReload, onClearFilters, onCreate, renderDesktop, view, onViewChange }: {
  view: MobileTaskView; onViewChange: (view: MobileTaskView) => void;
  rows: Row[]; actorId: string | null; role: string; busy: boolean;
  onOpen: (row: Row) => void; onClaim: (row: Row) => void; onComplete: (row: Row) => void; onReload: () => void;
  onClearFilters?: () => void;
  onCreate: () => void;
  renderDesktop: (rows:Row[]) => ReactNode;
}) {
  const [today, setToday] = useState(operationDay), [limit, setLimit] = useState(20);
  useEffect(() => { const id = setInterval(() => setToday(operationDay()), 60_000); return () => clearInterval(id); }, []);
  const matching = orderMobileTasks(rows.filter(row => mobileTaskMatches(row, view, actorId, today)));
  return <section className="space-y-3" aria-label="İş listesi">
    {onClearFilters && <div className="flex items-center justify-between gap-2 rounded-xl bg-blue-50 px-3 text-xs text-blue-900"><p>Arama ve filtreler bu görünümlere de uygulanıyor.</p><button type="button" onClick={onClearFilters} className="min-h-11 shrink-0 font-semibold underline">Temizle</button></div>}
    <div className="flex flex-wrap gap-2" role="group" aria-label="İş görünümü">{mobileTaskViews.map(v => <button key={v.value} type="button" disabled={busy} aria-pressed={view === v.value}
      onClick={() => { onViewChange(v.value); setLimit(20); }} className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-600 aria-pressed:border-blue-600 aria-pressed:bg-blue-600 aria-pressed:text-white disabled:opacity-40">
      {v.label} <span className="ml-1 text-xs tabular-nums">{rows.filter(r => mobileTaskMatches(r, v.value, actorId, today)).length}</span>
    </button>)}</div>
    <div className="flex items-center justify-between gap-2"><p className="text-xs text-slate-500">{view === 'today' ? 'Bugün bitmesi gereken açık işler' : view === 'all' ? 'Tamamlanan ve iptal edilenler dahil' : 'Geciken ve yaklaşan işler önce'} · {matching.length} iş</p><button type="button" disabled={busy} onClick={onReload} aria-label="İşleri yenile" className="flex min-h-11 min-w-11 items-center justify-center rounded-xl border bg-white text-slate-600"><RefreshCw size={17}/></button></div>
    {!matching.length && <div className="rounded-2xl border bg-white p-5"><h2 className="font-semibold">{onClearFilters?'Bu aramaya uygun iş bulunamadı':view==='today'?'Bugün bitmesi gereken açık iş yok':view==='overdue'?'Bitiş tarihi geçmiş açık iş yok':view==='mine'?'Size atanmış açık iş yok':view==='unassigned'?'Üstlenilmeyi bekleyen iş yok':view==='open'?'Açık iş yok':'Henüz görev yok'}</h2><p className="mt-2 text-sm text-slate-600">{onClearFilters?'Arama ve filtreleri temizleyerek tekrar bakabilirsiniz.':rows.length?'Diğer işleri görmek için tüm işler görünümüne geçebilirsiniz.':'Firma seçmeden de ekip içi veya dışarıda yapılacak bir görev oluşturabilirsiniz.'}</p><button type="button" disabled={busy} onClick={onClearFilters??(rows.length?()=>{onViewChange('all');setLimit(20);}:onCreate)} className="mt-3 min-h-11 rounded-xl border border-blue-200 px-4 text-sm font-semibold text-blue-700 disabled:opacity-40">{onClearFilters?'Arama ve filtreleri temizle':rows.length?'Tüm işleri göster':'Yeni görev oluştur'}</button></div>}
    {matching.length>0&&<div className="hidden md:block">{renderDesktop(matching)}</div>}
    <ul className="space-y-3 md:hidden">{matching.slice(0, limit).map(row => {
      const {claim:canClaim,complete:canComplete}=taskActionPermissions(row,role,actorId);
      const late = activeTask(row) && !!row.due_date && row.due_date.slice(0, 10) < today;
      return <li key={row.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3"><span className="min-w-0 break-words text-xs font-medium text-slate-500">{row.firma_name === '—' ? 'Firma bilgisi alınamadı' : row.firma_name}</span><span className="flex shrink-0 flex-wrap justify-end gap-1"><PriorityBadge priority={row.priority}/><StatusBadge status={row.status}/></span></div>
        <button type="button" onClick={() => onOpen(row)} disabled={busy} className="mt-2 flex min-h-11 w-full items-center justify-between gap-2 text-left font-semibold text-slate-900"><span className="min-w-0 break-words">{row.title}</span><ChevronRight size={18} className="shrink-0 text-slate-400"/></button>
        {taskContextLinks(row).length>0&&<p className="mt-1 text-xs text-slate-500">{taskContextLinks(row).map(link=>link.summary).join(' · ')}</p>}
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-xs"><span className={`flex items-center gap-1.5 ${late ? 'text-red-700' : 'text-slate-600'}`}><Clock3 size={14}/>{taskDueLabel(row,today)}</span><span className="flex min-w-0 items-center gap-1.5 text-slate-600"><UserRound size={14} className="shrink-0"/><span className="break-words">{row.assignee_label}</span></span></div>
        <div className="mt-4 grid grid-cols-2 gap-2"><button type="button" disabled={busy} onClick={() => onOpen(row)} className={`min-h-11 rounded-xl border border-slate-200 px-3 text-sm font-medium ${canClaim === canComplete ? 'col-span-2' : ''}`}>Detay / güncelle</button>
          {canClaim && <button type="button" disabled={busy} onClick={() => onClaim(row)} className="min-h-11 flex-1 rounded-xl bg-blue-600 px-3 text-sm font-semibold text-white disabled:opacity-40">İşi üstlen</button>}
          {canComplete && <button type="button" disabled={busy} onClick={() => onComplete(row)} className="flex min-h-11 flex-1 items-center justify-center gap-1 rounded-xl bg-emerald-700 px-3 text-sm font-semibold text-white disabled:opacity-40"><Check size={16}/>Tamamla</button>}
        </div>
      </li>;
    })}</ul>
    {matching.length > limit && <button type="button" onClick={() => setLimit(n => n + 20)} className="min-h-11 w-full rounded-xl border bg-white px-4 text-sm md:hidden">20 iş daha göster · {matching.length - limit} kalan</button>}
  </section>;
}
