"use client";

import {useMemo, useState} from 'react';
import {TZDate} from 'react-day-picker';
import {tr} from 'react-day-picker/locale';
import {Calendar} from '@/components/ui/calendar';
import {Button} from '@/components/ui/button';
import {APPOINTMENT_TYPE_LABELS} from '@/lib/appointment-types';
import {appointmentDayKey, groupCalendarAppointments, type CalendarAppointment} from '@/lib/appointment-calendar';

const statusLabels: Record<string,string> = {planlandi:'Planlandı', tamamlandi:'Tamamlandı', iptal:'İptal', ertelendi:'Ertelendi'};
const asDate = (key: string) => new TZDate(`${key}T12:00:00+03:00`, 'Europe/Istanbul');

export default function AppointmentCalendar({rows, onOpen, loading = false, hasError = false}: {
  rows: CalendarAppointment[];
  onOpen: (id: string) => void;
  loading?: boolean;
  hasError?: boolean;
}) {
  const [selected, setSelected] = useState(() => appointmentDayKey(new Date()));
  const [month, setMonth] = useState<Date>(() => asDate(selected));
  const days = useMemo(() => groupCalendarAppointments(rows), [rows]);
  const entries = days.get(selected) ?? [];
  const selectDay = (date: Date) => {setSelected(appointmentDayKey(date)); setMonth(asDate(appointmentDayKey(date)));};
  const monthKey = appointmentDayKey(month).slice(0,7);
  const monthCount = useMemo(() => rows.filter(row => row.meeting_date.startsWith(monthKey)).length, [rows, monthKey]);

  return <section aria-label="Randevu takvimi" className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
      <div><h2 className="font-semibold">Randevu takvimi</h2><p className="mt-1 text-xs text-slate-500">Arama ve filtreler takvime de uygulanır. İşaretli günlerde kayıt vardır.</p></div>
      <Button type="button" variant="outline" onClick={() => selectDay(asDate(appointmentDayKey(new Date())))}>Bugün</Button>
    </div>
    <div className="grid lg:grid-cols-[360px_1fr]">
      <div className="min-w-0 border-b border-slate-100 p-2 sm:p-4 lg:border-b-0 lg:border-r">
        <Calendar mode="single" required selected={asDate(selected)} onSelect={selectDay} month={month} onMonthChange={selectDay}
          locale={tr} timeZone="Europe/Istanbul" weekStartsOn={1} className="mx-auto w-full max-w-[328px] [--cell-size:2rem] sm:[--cell-size:2.75rem]"
          labels={{labelNext: () => 'Sonraki ay', labelPrevious: () => 'Önceki ay', labelDayButton: date => {
            const key = appointmentDayKey(date), count = days.get(key)?.length ?? 0;
            return `${date.toLocaleDateString('tr-TR', {timeZone:'Europe/Istanbul', dateStyle:'full'})}${!loading && !hasError && count ? `, ${count} randevu` : ''}`;
          }}}
          modifiers={{hasAppointments: date => !loading && !hasError && days.has(appointmentDayKey(date))}}
          modifiersClassNames={{hasAppointments: "after:pointer-events-none after:absolute after:bottom-1 after:left-1/2 after:z-20 after:size-1 after:-translate-x-1/2 after:rounded-full after:bg-blue-600 [&[data-selected=true]]:after:bg-white"}}
        />
        {!loading && !hasError && <p className="mt-3 text-center text-xs text-slate-500">Görünen ayda {monthCount} randevu · mevcut filtrelerle</p>}
      </div>
      <div className="min-w-0 p-4 sm:p-5">
        <h3 className="font-semibold">{asDate(selected).toLocaleDateString('tr-TR', {timeZone:'Europe/Istanbul', dateStyle:'full'})}</h3>
        {loading ? <p role="status" className="mt-4 text-sm text-slate-500">Randevular yükleniyor…</p> : hasError ? <p role="alert" className="mt-4 text-sm text-amber-800">Randevular doğrulanamadı. Listeyi yenileyerek tekrar deneyin.</p> : <>
          <p role="status" className="mt-1 text-sm text-slate-500">{entries.length ? `${entries.length} randevu` : 'Bu gün için mevcut filtrelerle eşleşen randevu yok.'}</p>
          <ul className="mt-4 space-y-2">{entries.map(row => <li key={row.id}>
            <button type="button" onClick={() => onOpen(row.id)} className="flex w-full items-start gap-3 rounded-xl border border-slate-200 p-3 text-left hover:border-blue-300 hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-blue-600">
              <span className="w-16 shrink-0 pt-0.5 text-sm font-semibold tabular-nums text-slate-700">{row.meeting_time?.slice(0,5) || 'Saati yok'}</span>
              <span className="min-w-0 flex-1"><span className="block break-words font-medium">{row.firma_name}</span><span className="mt-1 block break-words text-sm text-slate-500">{APPOINTMENT_TYPE_LABELS[row.meeting_type as keyof typeof APPOINTMENT_TYPE_LABELS] ?? row.meeting_type}{row.attendee ? ` · ${row.attendee}` : ''}</span><span className="mt-2 inline-block rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-700">{statusLabels[row.status] ?? row.status}</span></span>
            </button>
          </li>)}</ul>
        </>}
      </div>
    </div>
  </section>;
}
