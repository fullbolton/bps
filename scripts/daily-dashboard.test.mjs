import test from 'node:test';import assert from 'node:assert/strict';import {importActualTypeScript} from './helpers/import-typescript.mjs';
const {parseDailyDashboard}=await importActualTypeScript(new URL('../src/lib/daily-dashboard.ts',import.meta.url));
const row={day:'2026-09-09',requests:0,required:0,placed:0,missing:0,openRequests:0,gaps:[]};
test('measured empty day accepted, unavailable or malformed RPC never becomes zero',()=>{assert.deepEqual(parseDailyDashboard(row),row);for(const v of [null,{}, {...row,required:'0'},{...row,day:'2026-02-30'},{...row,placed:-1},{...row,openRequests:1}])assert.throws(()=>parseDailyDashboard(v));});
