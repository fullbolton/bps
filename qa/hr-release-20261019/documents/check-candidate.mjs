import {readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const root=new URL('../../../',import.meta.url);
const read=p=>readFileSync(new URL(p,root),'utf8');
const release=JSON.parse(read('qa/hr-release-20261019/remaining/release.json'));
const baseline=[...JSON.parse(read('qa/hr-release-20261019/live-ledger.json')).rows.map(r=>r.version),...release.appliedVersions];
assert.equal(new Set(baseline).size,207);
assert.equal(baseline.at(-1),'20261019001700');
const files=readdirSync(new URL('supabase/migrations/',root)).filter(f=>f.endsWith('.sql')).sort();
assert.equal(new Set(files.map(f=>f.slice(0,14))).size,files.length,'Duplicate version');
for(const version of baseline){
 const file=files.find(f=>f.startsWith(version+'_')); assert.ok(file,`Missing ${version}`);
 const path='supabase/migrations/'+file;
 assert.equal(read(path),execFileSync('git',['show',release.sourceCommit+':'+path],{cwd:root,encoding:'utf8'}),`Applied migration changed: ${file}`);
}
const pending=files.filter(f=>!baseline.includes(f.slice(0,14))&&!f.startsWith('20260722000200_'));
assert.deepEqual(pending.map(f=>f.slice(0,14)),Array.from({length:9},(_,i)=>`2026101900${18+i}00`));
const migrations=pending.map(name=>{const body=read('supabase/migrations/'+name);assert.equal((body.match(/^BEGIN;/gm)||[]).length,1);assert.equal((body.match(/^COMMIT;/gm)||[]).length,1);return {name,sha256:createHash('sha256').update(body).digest('hex')};});
assert.equal(JSON.parse(read('vercel.json')).git.deploymentEnabled['codex/tenant-modules-foundation-20260928'],false);
const result={measuredAt:new Date().toISOString(),sourceCommit:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),historicalBaseline:{migrationCount:207,sourceCommit:release.sourceCommit,releasedAt:release.releasedAt},appliedFilesUnchanged:true,expectedFinalCount:216,automaticBranchDeployment:false,migrations,currentProductionVerified:false,releaseApproved:false,remaining:['Fresh read-only production ledger/catalog/load and Storage policy comparison','Guarded atomic migration payload rehearsal against current baseline','Deployment environment and rollback compatibility validation','Production smoke with HR preview and activation still disabled']};
writeFileSync(new URL('candidate.json',import.meta.url),JSON.stringify(result,null,2)+'\n');
console.log('PASS: 207 historical files unchanged; 9 ordered candidates; auto deployment disabled. No production check or deployment.');
