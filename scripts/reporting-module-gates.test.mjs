import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {entries,render,migrationUrl} from './reporting-module-gates.mjs';
import {importActualTypeScript} from './helpers/import-typescript.mjs';
test('12 explicit reporting signatures generate the exact candidate migration',()=>{assert.equal(entries.length,12);assert.equal(new Set(entries.map(e=>e.signature)).size,12);assert.equal(readFileSync(migrationUrl,'utf8'),render());for(const e of entries)assert.ok(e.guard.includes(`workspace_require_module_${e.mode}_v1`));});
test('reporting and import messages distinguish disabled module from transport uncertainty',async()=>{
 const {reportError}=await importActualTypeScript(new URL('../src/lib/project-reporting/view.ts',import.meta.url));
 const {importError}=await importActualTypeScript(new URL('../src/lib/project-reporting/import-view.ts',import.meta.url));
 for(const fn of [reportError,importError]){assert.match(fn({code:'BM001',message:'MODULE_DISABLED'}),/modül.*kapalı/);assert.doesNotMatch(fn(new Error('fetch failed')),/modül.*kapalı/);}
});
