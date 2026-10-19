import {readFileSync,writeFileSync,unlinkSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
const manifest=JSON.parse(readFileSync(new URL('./candidate.json',import.meta.url)));
const results=[];
for(const kind of ['history','catalog']){
 const original=new URL(`../../hr-catalog-20261018/${kind}-schema.mjs`,import.meta.url);
 const temporary=new URL(`../../hr-catalog-20261018/.bridge-${kind}-${process.pid}.mjs`,import.meta.url);
 const output=new URL(`./${kind}-result.json`,import.meta.url);
 let source=readFileSync(original,'utf8');
 source=source.replace("new URL('../../src/lib/modules/change-history.ts',import.meta.url)",`new URL(${JSON.stringify(pathToFileURL(manifest.path+'/src/lib/modules/change-history.ts').href)})`);
 source=source.replace(`new URL('./${kind}-schema-result.json',import.meta.url)`,`new URL(${JSON.stringify(output.href)})`);
 try{
  writeFileSync(temporary,source);
  const run=spawnSync(process.execPath,[fileURLToPath(temporary)],{encoding:'utf8',env:{...process.env,BPS_TEST_SOURCE:manifest.path}});
  process.stdout.write(run.stdout);process.stderr.write(run.stderr);
  assert.equal(run.status,0,`${kind} candidate schema failed`);
  results.push({kind,checks:JSON.parse(readFileSync(output)).checks.length});
 }finally{unlinkSync(temporary);}
}
writeFileSync(new URL('./verification.json',import.meta.url),JSON.stringify({measuredAt:new Date().toISOString(),candidateFiles:manifest.files,results,limits:['Actual isolated candidate parser with real local PostgreSQL','Not a browser or production acceptance'],deployed:false},null,2)+'\n');
