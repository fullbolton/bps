import type { TaskRow } from '@/types/database.types';

export type MobileTaskView = 'open' | 'today' | 'mine' | 'unassigned' | 'overdue' | 'all';
export const mobileTaskViews = [
  { value: 'open', label: 'Açık işler' }, { value: 'today', label: 'Bugün' },
  { value: 'mine', label: 'Bendeki' }, { value: 'unassigned', label: 'Üstlenilmeyen' },
  { value: 'overdue', label: 'Geciken' },
  { value: 'all', label: 'Tümü' },
] as const;
export const activeTask = (t: Pick<TaskRow, 'status'>) => ['acik', 'devam_ediyor', 'gecikti'].includes(t.status);
export const unassignedTask = (t: Pick<TaskRow, 'assigned_to_user_id' | 'assigned_to'>) => t.assigned_to_user_id === null && t.assigned_to === null;
export const operationDay = (date = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);

export function mobileTaskMatches(t: TaskRow, view: MobileTaskView, actorId: string | null, today: string) {
  if (view === 'all') return true;
  if (!activeTask(t)) return false;
  if (view === 'today') return t.due_date?.slice(0, 10) === today;
  if (view === 'overdue') return !!t.due_date && t.due_date.slice(0, 10) < today;
  if (view === 'mine') return !!actorId && t.assigned_to_user_id === actorId;
  if (view === 'unassigned') return unassignedTask(t);
  return true;
}

export function orderMobileTasks<T extends TaskRow>(rows: T[]): T[] {
  return [...rows].sort((a, b) => Number(activeTask(b)) - Number(activeTask(a))
    || (a.due_date?.slice(0, 10) || '9999').localeCompare(b.due_date?.slice(0, 10) || '9999')
    || a.id.localeCompare(b.id));
}

export function taskDueLabel(t: Pick<TaskRow, 'status' | 'due_date'>, today: string) {
  const day = t.due_date?.slice(0, 10);
  if (!day) return 'Tarih belirlenmedi';
  const label = day.split('-').reverse().join('.');
  if (!activeTask(t)) return `Bitiş: ${label}`;
  if (day < today) return `Geciken · ${label}`;
  if (day === today) return 'Bugün';
  return label;
}

/** UI availability only; server actions remain the authority for membership/revision checks. */
export function taskActionPermissions(task:TaskRow,role:string,actorId:string|null){
  return {
    claim:['yonetici','operasyon'].includes(role)&&activeTask(task)&&unassignedTask(task),
    complete:activeTask(task)&&(role==='yonetici'||['operasyon','ik'].includes(role)&&!!actorId&&task.assigned_to_user_id===actorId),
  };
}
