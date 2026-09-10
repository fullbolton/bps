import {test} from 'node:test';
import assert from 'node:assert/strict';
import {importActualTypeScript} from './helpers/import-typescript.mjs';
const {appointmentLinkHref,parseAppointmentLink}=await importActualTypeScript(new URL('../src/lib/appointment-link.ts',import.meta.url));
const id='00000000-0000-4000-8000-000000000012';
test('links contain only the appointment UUID and round trip',()=>{assert.equal(appointmentLinkHref(id),'/randevular?randevu='+id);assert.equal(parseAppointmentLink(new URLSearchParams(appointmentLinkHref(id).split('?')[1])),id);});
test('unrelated query parameters do not become an appointment link',()=>assert.equal(parseAppointmentLink(new URLSearchParams('firma=abc&talep=def')),null));
test('malformed, empty and duplicate IDs are rejected',()=>{for(const q of ['randevu=','randevu=javascript:x','randevu='+id+'&randevu='+id])assert.throws(()=>parseAppointmentLink(new URLSearchParams(q)));assert.throws(()=>appointmentLinkHref('../admin'));});
