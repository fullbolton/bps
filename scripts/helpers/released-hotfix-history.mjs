// Exact released hotfix bodies; no permissive fallback and no import cycle with generators.
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const hash=s=>createHash('sha256').update(s).digest('hex');
const files=['20261004001100_attendance_lifecycle_guard.sql','20261004001300_start_confirmation_shift_window.sql','20261004001400_reporting_canonical_people.sql'];
export const releasedHotfixes=new Map();
for(const file of files){
 const sql=readFileSync(new URL('../../supabase/migrations/'+file,import.meta.url),'utf8');
 const rows=[...sql.matchAll(/\('(public\.[^']+)',jsonb_build_array\(jsonb_build_object\('hash','([a-f0-9]{64})','body','((?:[^']|'')*)'\)/gs)];
 if(rows.length!==(file.includes('reporting')?8:1))throw Error('Released hotfix layout drift: '+file);
 for(const m of rows){if(releasedHotfixes.has(m[1]))throw Error('Duplicate released signature');const body=m[3].replaceAll("''","'");releasedHotfixes.set(m[1],{beforeHash:m[2],body,hash:hash(body)});}
}
export function withReleasedHotfix(entry){
 const patch=releasedHotfixes.get(entry.signature);if(!patch)return entry;
 if(hash(entry.body)!==patch.beforeHash)throw Error('Released hotfix baseline drift: '+entry.signature);
 if(entry.body.split(entry.anchor).length!==2||patch.body.split(entry.anchor).length!==2)throw Error('Released hotfix anchor drift: '+entry.signature);
 return {...entry,preHotfixBody:entry.body,body:patch.body,hash:patch.hash,declaration:entry.declaration.replace(entry.body,()=>patch.body)};
}
