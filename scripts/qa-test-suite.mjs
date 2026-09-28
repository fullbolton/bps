import {readFileSync,readdirSync,existsSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
const mode=process.argv[2];
assert.ok(['application','database','pending','inventory'].includes(mode),'Unknown suite');
const entries=JSON.parse(readFileSync(new URL('./test-inventory.json',import.meta.url),'utf8'));
const found=readdirSync(new URL('./',import.meta.url)).filter(f=>f.endsWith('.test.mjs')).map(f=>'scripts/'+f).sort();
assert.equal(new Set(entries.map(e=>e.file)).size,entries.length,'Duplicate test classification');
assert.deepEqual(entries.map(e=>e.file).sort(),found,'Every test file must be explicitly classified');
for(const e of entries){
 assert.ok(['application','database','pending'].includes(e.suite));
 assert.ok(existsSync(e.file),'Missing test: '+e.file);
 if(e.suite==='pending'){
  assert.ok(e.reason&&e.requires,'Pending test needs a reason and missing source');
  assert.ok(!existsSync(e.requires),'Implementation now exists; activate its tests: '+e.file);
 }
}
for(const suite of ['application','database','pending'])console.log(`${suite}: ${entries.filter(e=>e.suite===suite).length} files`);
if(mode==='inventory')process.exit(0);
const selected=entries.filter(e=>e.suite===mode).map(e=>e.file);
assert.ok(selected.length,'Suite is empty');
if(mode==='pending')console.error('Pending implementations are absent. This command executes their retained tests and is expected to fail; they are not release coverage.');
else console.log('Pending feature tests are NOT part of the passed application coverage.');
const result=spawnSync(process.execPath,['--test','--test-concurrency='+ (mode==='database'?'1':'4'),...selected],{stdio:'inherit'});
if(result.error)throw result.error;
process.exit(result.status??1);
