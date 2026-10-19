// Old released parsers against the current full synthetic schema. No production writes.
import {execFileSync,spawnSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdtempSync,rmSync,unlinkSync} from 'node:fs';
import {tmpdir} from 'node:os';import {join} from 'node:path';import {pathToFileURL,fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const root=new URL('../../../',import.meta.url),dir=new URL('./',import.meta.url);
const release=JSON.parse(readFileSync(new URL('../remaining/release.json',import.meta.url)));
const extracted=mkdtempSync(join(tmpdir(),'bps-rollback-source-'));
const results=[];
try{
 const archive=execFileSync('git',['archive',release.sourceCommit,'src'],{cwd:root,maxBuffer:64*1024*1024});
 execFileSync('tar',['-x','-C',extracted],{input:archive});
 for(const kind of ['catalog','scoped-directory']){
  const original=new URL(`../../hr-catalog-20261018/${kind}-schema.mjs`,import.meta.url);
  const temporary=new URL(`../../hr-catalog-20261018/.rollback-${kind}-${process.pid}.mjs`,import.meta.url);
  const output=new URL(`rollback-${kind}-result.json`,dir);
  let source=readFileSync(original,'utf8');
  source=source.replace(/new URL\('\.\.\/\.\.\/src\/([^']+)',import.meta.url\)/g,(_,p)=>`new URL(${JSON.stringify(pathToFileURL(join(extracted,'src',p)).href)})`);
  source=source.replace(`new URL('./${kind}-schema-result.json',import.meta.url)`,`new URL(${JSON.stringify(output.href)})`);
  if(kind==='catalog'){
   const apply=" sql(readFileSync(new URL('../../supabase/migrations/'+migration,import.meta.url),'utf8'));";
   assert.ok(source.includes(apply));
   source=source.replace(apply,apply+"\n for(const f of loadFixtureMigrations().filter(f=>f>migration))sql(readFileSync(new URL('../../supabase/migrations/'+f,import.meta.url),'utf8'));");
  }
  try{
   writeFileSync(temporary,source);
   const r=spawnSync(process.execPath,[fileURLToPath(temporary)],{cwd:root,env:{...process.env,BPS_TEST_SOURCE:extracted},encoding:'utf8'});
   process.stdout.write(r.stdout);process.stderr.write(r.stderr);assert.equal(r.status,0,kind+' rollback contract failed');
   const result=JSON.parse(readFileSync(output));
   result.sourceCommit=release.sourceCommit;result.schemaThrough='20261019002600';result.limits=['Released TypeScript parser with real local PostgreSQL and synthetic data','Not browser, deployment or production activation acceptance'];
   writeFileSync(output,JSON.stringify(result,null,2)+'\n');results.push({kind,checks:result.checks.length});
  }finally{try{unlinkSync(temporary);}catch{}}
 }
 writeFileSync(new URL('rollback-contracts-result.json',dir),JSON.stringify({measuredAt:new Date().toISOString(),sourceCommit:release.sourceCommit,schemaThrough:'20261019002600',syntheticOnly:true,results,browserVerified:false},null,2)+'\n');
}finally{rmSync(extracted,{recursive:true,force:true});}
