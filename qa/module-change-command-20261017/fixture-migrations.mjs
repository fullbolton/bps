import {readFileSync,readdirSync} from 'node:fs';
import assert from 'node:assert/strict';

// This synthetic template already contains the foundation and announcement cutover.
// Never silently ignore a new migration when claiming acceptance on the current tree.
export const FIXTURE_BASELINE='20261005003100';
export function validateFixtureMigrations(manifest,available){
 assert.ok(Array.isArray(manifest)&&manifest.length>0,'Fixture migration manifest is empty or invalid');
 assert.ok(manifest.every(name=>typeof name==='string'&&/^\d{14}_[a-z0-9_]+\.sql$/.test(name)),'Invalid fixture migration name');
 assert.equal(new Set(manifest).size,manifest.length,'Duplicate fixture migration');
 const expected=available.filter(name=>name.endsWith('.sql')&&name.slice(0,14)>FIXTURE_BASELINE).sort();
 assert.deepEqual(manifest,expected,'Fixture migrations differ from repository: review and update the manifest before acceptance');
 return manifest;
}
export function loadFixtureMigrations(){
 const manifest=JSON.parse(readFileSync(new URL('./fixture-migrations.json',import.meta.url),'utf8'));
 return validateFixtureMigrations(manifest,readdirSync(new URL('../../supabase/migrations/',import.meta.url)));
}
