import test from 'node:test';
import assert from 'node:assert/strict';
import {importActualTypeScript} from './helpers/import-typescript.mjs';
const {workforceCapacity,workforceCapacityTotals}=await importActualTypeScript(new URL('../src/lib/workforce-capacity.ts',import.meta.url));
test('five surplus staff in one location cannot cancel five missing in another',()=>{
 assert.deepEqual(workforceCapacityTotals([{current_count:5,target_count:10},{current_count:15,target_count:10}]),{active:20,target:20,shortage:5,surplus:5});
});
test('zero target, fully staffed and empty sets remain distinct and nonnegative',()=>{
 assert.deepEqual(workforceCapacity({current_count:4,target_count:0}),{shortage:0,surplus:4});
 assert.deepEqual(workforceCapacity({current_count:4,target_count:4}),{shortage:0,surplus:0});
 assert.deepEqual(workforceCapacityTotals([]),{active:0,target:0,shortage:0,surplus:0});
});
