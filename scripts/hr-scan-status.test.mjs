import test from 'node:test';import assert from 'node:assert/strict';import {importActualTypeScript} from './helpers/import-typescript.mjs';
const {parseHrScanStatus:parse}=await importActualTypeScript(new URL('../src/lib/services/hr-scan-status.ts',import.meta.url));
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`,expected={actor:id(1),tenant:id(2),employee:id(3),upload:id(4)};
const row={schemaVersion:1,actorId:id(1),tenantId:id(2),employeeId:id(3),uploadId:id(4),status:'ready',attempts:1};
test('only fresh ready status enables finalization',()=>{for(const status of ['not_queued','queued','scanning','ready','blocked','failed','expired','published','cancelled','cancelling'])assert.equal(parse({...row,status},expected).canFinalize,status==='ready');});
test('foreign scope, unknown state and malformed attempt count reject',()=>{for(const patch of [{actorId:id(9)},{tenantId:id(9)},{employeeId:id(9)},{uploadId:id(9)},{status:'constructor'},{status:'clean'},{attempts:'1'},{attempts:-1},{attempts:4},{attempts:null}])assert.throws(()=>parse({...row,...patch},expected));});

test('rescan is offered only for expired results with remaining attempts',()=>{for(const status of ['not_queued','queued','scanning','ready','blocked','failed','expired','published','cancelled','cancelling'])for(const attempts of [0,1,2,3])assert.equal(parse({...row,status,attempts},expected).canRescan,status==='expired'&&attempts>0&&attempts<3);});
