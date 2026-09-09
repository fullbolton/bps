import test from 'node:test';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,existsSync,rmSync,lstatSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {parseArgs,redact,validateLocalStatus,acquireLock,buildSnapshot,isolatedBuildEnv,runProcess,writeReport} from './helpers/acceptance-runner.mjs';
const local={API_URL:'http://127.0.0.1:54321',DB_URL:'postgresql://postgres:synthetic@127.0.0.1:54322/postgres',ANON_KEY:'synthetic-anon',SERVICE_ROLE_KEY:'synthetic-service'};
const config='project_id = "bps-supabase-acceptance"\n',container={Name:'/supabase_db_bps-supabase-acceptance',State:{Running:true},NetworkSettings:{Ports:{'5432/tcp':[{HostPort:'54322'}]}}};
const gateway={Name:'/supabase_kong_bps-supabase-acceptance',State:{Running:true},NetworkSettings:{Ports:{'8000/tcp':[{HostPort:'54321'}]}}};
test('explicit mode selection never implies unrequested database work',()=>{
  assert.deepEqual(parseArgs([]),{sql:false,localApi:false,build:false,help:false});
  assert.equal(parseArgs(['--build']).localApi,false);assert.equal(parseArgs(['--all']).sql,true);
  assert.throws(()=>parseArgs(['--prod']));
});
test('local guard rejects remote, alternate project and stopped container',()=>{
  validateLocalStatus(local,config,container,gateway);
  for(const patch of [{API_URL:'https://example.supabase.co'},{API_URL:'http://localhost:54321'},{API_URL:'http://127.0.0.1:54321/?redirect=1'},{DB_URL:'postgresql://postgres:x@remote:54322/postgres'},{DB_URL:'postgresql://postgres:x@127.0.0.1:54322/other'},{SERVICE_ROLE_KEY:null}])assert.throws(()=>validateLocalStatus({...local,...patch},config,container,gateway));
  assert.throws(()=>validateLocalStatus(local,'project_id = "prod"',container,gateway));assert.throws(()=>validateLocalStatus(local,config,{...container,State:{Running:false}},gateway));
});
test('local port and root-project checks cannot be satisfied by unrelated config entries',()=>{
  assert.throws(()=>validateLocalStatus(local,'[other]\n'+config,container,gateway));
  assert.throws(()=>validateLocalStatus(local,config,container,{...gateway,NetworkSettings:{Ports:{'8000/tcp':[{HostPort:'6543'}]}}}));
});
test('redaction covers known credentials, bearer tokens and JWT-shaped tokens',()=>{
  const raw='secret-value Bearer abcde password="hidden" eyJabc.def.ghi sb_secret_abcdefgh '+JSON.stringify({password:'json-private'})+' postgresql://postgres:url-private@127.0.0.1/db';
  const safe=redact(raw,['secret-value']);
  for(const part of ['secret-value','abcde','hidden','eyJabc.def.ghi','sb_secret_abcdefgh','json-private','url-private'])assert.equal(safe.includes(part),false);
});
test('child nonzero and timeout are distinct from successful execution',async()=>{
  const ok=await runProcess(process.execPath,['-e','console.log("PASS example")']);assert.equal(ok.status,'passed');
  const failed=await runProcess(process.execPath,['-e','process.exit(7)']);assert.equal(failed.status,'failed');assert.equal(failed.exitCode,7);
  const timed=await runProcess(process.execPath,['-e','setInterval(()=>{},1000)'],{timeoutMs:80});assert.equal(timed.status,'timed_out');
});
test('spawn error and user interruption cannot report passed',async()=>{
  const missing=await runProcess('/nonexistent/bps-acceptance-command',[],{timeoutMs:1000});assert.equal(missing.status,'failed');assert.equal(missing.errorCode,'ENOENT');
  const c=new AbortController();const pending=runProcess(process.execPath,['-e','setInterval(()=>{},1000)'],{signal:c.signal});c.abort();assert.equal((await pending).status,'interrupted');
});
test('API logs drop diagnostic payloads instead of persisting credentials',async()=>{
  const result=await runProcess(process.execPath,['-e','console.log("PASS tested");console.error("private diagnostic payload")'],{summaryOnly:true});
  assert.ok(result.log.includes('PASS tested'));assert.equal(result.log.includes('private diagnostic payload'),false);
});
test('exclusive lock preserves live owner and releases only its own lock',()=>{
  const dir=mkdtempSync(join(tmpdir(),'bps-lock-test-')),path=join(dir,'lock');
  try{const release=acquireLock(path);assert.throws(()=>acquireLock(path));release();const releaseAgain=acquireLock(path);releaseAgain();assert.equal(existsSync(path),false);}
  finally{rmSync(dir,{recursive:true,force:true});}
});
test('stale lock recovery replaces only a verified exited owner',()=>{
  const dir=mkdtempSync(join(tmpdir(),'bps-stale-lock-test-')),path=join(dir,'lock');
  try{const child=spawnSync(process.execPath,['-e','process.exit(0)']);assert.equal(child.status,0);writeFileSync(path,JSON.stringify({pid:child.pid}));const release=acquireLock(path);assert.equal(JSON.parse(readFileSync(path,'utf8')).pid,process.pid);assert.equal(existsSync(path+'.recovery'),false);release();}
  finally{rmSync(dir,{recursive:true,force:true});}
});
test('build snapshot excludes env and caches without copying dependencies',()=>{
  const repo=mkdtempSync(join(tmpdir(),'bps-snapshot-test-'));let snapshot;
  try{
    for(const name of ['src','public','node_modules','.next'])mkdirSync(join(repo,name));
    writeFileSync(join(repo,'package.json'),'{}');writeFileSync(join(repo,'src','page.tsx'),'export default null;');writeFileSync(join(repo,'.env.local'),'SECRET=not-real');writeFileSync(join(repo,'.next','marker'),'live');
    snapshot=buildSnapshot(repo);assert.equal(existsSync(join(snapshot,'.env.local')),false);assert.equal(existsSync(join(snapshot,'.next')),false);assert.ok(lstatSync(join(snapshot,'node_modules')).isSymbolicLink());assert.equal(readFileSync(join(repo,'.next','marker'),'utf8'),'live');
    const env=isolatedBuildEnv({PATH:'/bin',SUPABASE_SERVICE_ROLE_KEY:'private',NEXT_PUBLIC_SUPABASE_URL:'https://prod.invalid',OPENAI_API_KEY:'private',DATABASE_URL:'private'});assert.equal(env.SUPABASE_SERVICE_ROLE_KEY,undefined);assert.equal(env.OPENAI_API_KEY,undefined);assert.equal(env.DATABASE_URL,undefined);assert.equal(env.NEXT_PUBLIC_SUPABASE_URL,'http://127.0.0.1:54321');
  }finally{if(snapshot)rmSync(snapshot,{recursive:true,force:true});rmSync(repo,{recursive:true,force:true});}
});
test('JSON and human report retain not-requested versus skipped and failed',()=>{
  const dir=mkdtempSync(join(tmpdir(),'bps-report-test-'));
  try{const report={status:'failed',startedAt:'now',finishedAt:'later',steps:[{id:'a',status:'failed'},{id:'b',status:'skipped'},{id:'c',status:'not_requested'}]};writeReport(dir,report);assert.deepEqual(JSON.parse(readFileSync(join(dir,'report.json'),'utf8')),report);assert.match(readFileSync(join(dir,'report.md'),'utf8'),/not_requested/);assert.equal(lstatSync(join(dir,'report.json')).mode&0o777,0o600);}
  finally{rmSync(dir,{recursive:true,force:true});}
});
