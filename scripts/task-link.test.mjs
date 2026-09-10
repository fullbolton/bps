import {test} from 'node:test';
import assert from 'node:assert/strict';
import {importActualTypeScript} from './helpers/import-typescript.mjs';
const {taskLinkHref,parseTaskLink}=await importActualTypeScript(new URL('../src/lib/task-link.ts',import.meta.url));
const id='00000000-0000-4000-8000-000000000012';
test('links contain only the task UUID and round trip',()=>{assert.equal(taskLinkHref(id),'/gorevler?gorev='+id);assert.equal(parseTaskLink(new URLSearchParams(taskLinkHref(id).split('?')[1])),id);});
test('unrelated task-prefill parameters do not become a task link',()=>assert.equal(parseTaskLink(new URLSearchParams('firma=abc&talep=def')),null));
test('malformed, empty and duplicate IDs are rejected',()=>{for(const q of ['gorev=','gorev=javascript:x','gorev='+id+'&gorev='+id])assert.throws(()=>parseTaskLink(new URLSearchParams(q)));assert.throws(()=>taskLinkHref('../admin'));});
