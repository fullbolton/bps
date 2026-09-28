import test from 'node:test';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
const source = process.env.BPS_CALENDAR_SOURCE ? pathToFileURL(process.env.BPS_CALENDAR_SOURCE + '/') : new URL('../', import.meta.url);
import {importActualTypeScript} from './helpers/import-typescript.mjs';
const {appointmentDayKey, groupCalendarAppointments} = await importActualTypeScript(new URL('src/lib/appointment-calendar.ts', source));
const {selectAllAppointments} = await importActualTypeScript(new URL('src/lib/supabase/appointments.ts', source));

test('calendar follows Istanbul day across UTC midnight and year rollover', () => {
  assert.equal(appointmentDayKey(new Date('2026-12-31T21:30:00Z')), '2027-01-01');
  assert.equal(appointmentDayKey(new Date('2026-09-14T20:59:59Z')), '2026-09-14');
  assert.equal(appointmentDayKey(new Date('2026-09-14T21:00:00Z')), '2026-09-15');
});
test('agenda groups civil dates, sorts unknown time last, retains cancelled entries, never mutates source', () => {
  const rows = [{id:'3',meeting_date:'2026-09-15',meeting_time:null,status:'iptal'}, {id:'2',meeting_date:'2026-09-15',meeting_time:'14:00'}, {id:'1',meeting_date:'2026-09-15',meeting_time:'09:00'}, {id:'4',meeting_date:'2026-09-16',meeting_time:'08:00'}];
  const original = JSON.stringify(rows), days = groupCalendarAppointments(rows);
  assert.deepEqual(days.get('2026-09-15').map(row => row.id), ['1','2','3']);
  assert.equal(days.get('2026-09-16').length, 1);
  assert.equal(days.has('2026-09-17'), false);
  assert.equal(JSON.stringify(rows), original);
});
test('truncated or uncounted appointment response cannot render a falsely empty calendar', async () => {
  const client = result => ({from: table => {assert.equal(table,'appointments'); return {select: (columns, options) => {assert.equal(options.count,'exact'); return {order: async () => result};}};}});
  assert.deepEqual(await selectAllAppointments(client({data:[], count:0, error:null})), []);
  for (const result of [{data:[{id:'1'}],count:2,error:null},{data:[],count:null,error:null},{data:null,count:0,error:null},{data:[],count:0,error:{message:'connection failed'}}]) {
    await assert.rejects(selectAllAppointments(client(result)));
  }
});
