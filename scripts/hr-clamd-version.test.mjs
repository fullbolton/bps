import test from 'node:test';import assert from 'node:assert/strict';
import {parseClamdVersion} from '../workers/hr-malware/version.mjs';
test('running version response provides engine, signature revision and UTC build time',()=>{assert.deepEqual(parseClamdVersion('ClamAV 1.5.4/28158/Mon Oct 19 06:24:00 2026\0'),{engine:'clamav',engineVersion:'1.5.4',signatureVersion:'28158',signaturesUpdatedAt:'2026-10-19T06:24:00.000Z'});});
test('truncated, duplicate, unknown and invalid version responses fail closed',()=>{for(const r of ['ClamAV 1.5.4/28158/Mon Oct 19 06:24:00 2026','ClamAV 1.5.4/28158/Mon Oct 19 06:24:00 2026\0other\0','UNKNOWN COMMAND\0','ClamAV devel/1/bad\0','ClamAV 1.5.4/1/Mon Oct 99 99:99:00 2026\0'])assert.throws(()=>parseClamdVersion(r));});
