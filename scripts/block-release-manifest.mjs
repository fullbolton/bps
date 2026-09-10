/** Local-only release evidence: hashes files; never commits, uploads or deploys. */
import {readdirSync,lstatSync,readFileSync,writeFileSync} from 'node:fs';
import {join,resolve,relative} from 'node:path';import {fileURLToPath} from 'node:url';import {createHash} from 'node:crypto';import {execFileSync} from 'node:child_process';
export const appRoots=['src','public','package.json','package-lock.json','tsconfig.json','next-env.d.ts','next.config.ts','postcss.config.mjs','vercel.json'];
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
export function collectFiles(root,roots){
 const result={};
 function walk(path){
  const key=relative(root,path).split('\\').join('/');
  if(!key||key.startsWith('../')||key==='.env'||key.split('/').some(p=>p.startsWith('.env')))throw Error('Unsafe manifest path: '+key);
  const stat=lstatSync(path);
  if(stat.isSymbolicLink())throw Error('Manifest cannot follow symlink: '+key);
  if(stat.isDirectory()){for(const name of readdirSync(path).sort())if(name!=='.DS_Store')walk(join(path,name));}
  else if(stat.isFile())result[key]=hash(readFileSync(path));
  else throw Error('Manifest cannot read special file: '+key);
 }
 for(const name of roots)walk(join(root,name));
 return Object.fromEntries(Object.entries(result).sort(([a],[b])=>a.localeCompare(b)));
}
export function differences(expected,actual){
 return [...new Set([...Object.keys(expected),...Object.keys(actual)])].sort().flatMap(path=>expected[path]===actual[path]?[]:[{path,change:!(path in expected)?'added':!(path in actual)?'removed':'changed'}]);
}
export function assertFiles(expected,actual){
 const diff=differences(expected,actual);if(diff.length)throw Error('Release snapshot differs: '+JSON.stringify(diff));
}
const pending=['20260909002800_start_board_filters','20260909002900_start_event_validation','20260910000100_candidate_company_operations'];
const checkRoots=['scripts/qa-local-export.mjs','scripts/block-release-manifest.mjs','scripts/block-release.test.mjs','scripts/qa-candidate-company.mjs','scripts/qa-local-candidate-company.mjs','scripts/qa-start-validation.mjs','scripts/qa-start-board-filters.mjs','scripts/qa-local-start-tracking.mjs','scripts/qa-local-start-board-filters.mjs','scripts/qa-start-review-regression.mjs','scripts/candidate-company.test.mjs','scripts/start-failure.test.mjs','scripts/start-overview.test.mjs','scripts/weekly-plan.test.mjs','scripts/qa-acceptance.mjs','scripts/helpers'];
export function snapshot(root){
 const baseline=JSON.parse(readFileSync(join(root,'supabase/manual/release-20260909.json'),'utf8'));
 const migrations={};
 if(baseline.migrations.length!==27)throw Error('Expected 27 baseline migrations');
 for(const m of baseline.migrations){const path='supabase/migrations/'+m.name+'.sql',actual=hash(readFileSync(join(root,path)));if(actual!==m.sha256)throw Error('Applied SQL changed: '+path);migrations[path]=actual;}
 for(const name of pending){const path='supabase/migrations/'+name+'.sql';migrations[path]=hash(readFileSync(join(root,path)));}
 return {application:collectFiles(root,appRoots),migrations,verification:collectFiles(root,checkRoots)};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const root=fileURLToPath(new URL('..',import.meta.url)),path=join(root,'supabase/manual/block-01-local-release.json');
 const mode=process.argv[2];if(!['--write','--check'].includes(mode))throw Error('Use --write or --check');
 const current=snapshot(root);
 // Require the app bytes to match the cumulative locally accepted slices, not only a newly written manifest.
 const accepted=JSON.parse(readFileSync(join(root,'supabase/manual/release-20260909-source-sha256.json'),'utf8'));
 for(const name of ['local-20260909-036.json','local-20260909-037.json','local-20260909-038.json','local-20260910-039.json']){
  const layer=JSON.parse(readFileSync(join(root,'supabase/manual',name),'utf8'));
  for(const [path,digest] of Object.entries(layer.files))if(path.startsWith('src/')||path.startsWith('public/')||path in accepted)accepted[path]=digest;
 }
 assertFiles(accepted,current.application);
 if(mode==='--write'){
  const baseline=JSON.parse(readFileSync(join(root,'supabase/manual/release-20260909-source-sha256.json'),'utf8'));
  const doc={block:'01',state:'local_release_candidate_not_deployed',createdAt:new Date().toISOString(),gitHead:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),sourceIsWorkingTree:true,applicationMatchesAcceptanceSnapshots:true,excludedMetadata:['.DS_Store'],productionCheckedNow:false,baselineDeployment:'dpl_7dGwr1wHZc2REPBUYuJwjNnE6RZk',pendingProductionMigrations:pending,deltaFrom035:differences(baseline,current.application),...current};
  writeFileSync(path,JSON.stringify(doc,null,2)+'\n');
 }else{
  const doc=JSON.parse(readFileSync(path,'utf8'));for(const key of ['application','migrations','verification'])assertFiles(doc[key],current[key]);
 }
 console.log(`PASS ${mode}: ${Object.keys(current.application).length} app files, ${Object.keys(current.migrations).length} SQL files, ${Object.keys(current.verification).length} verification files. No production action.`);
}
